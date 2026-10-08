"""Analyst decisions remain distinct from evidence, with atomic audit/history."""
import pytest

from backend.main import app
from backend.models.asset import AssetReviewDB, CryptoAssetDB
from backend.models.audit_log import AuditLogDB
from backend.models.scan_job import ScanJobDB
from backend.security import Principal, current_role


@pytest.fixture
def review_finding(session_factory):
    with session_factory() as db:
        scan = ScanJobDB(repo_path="/analyst-review", status="completed")
        db.add(scan)
        db.flush()
        asset = CryptoAssetDB(scan_job_id=scan.id, algorithm="RSA", location="crypto.py:1",
                              evidence_json={"source": "scanner"}, confidence=0.87,
                              confirmed_use=True, priority_score=60)
        db.add(asset)
        db.commit()
        return asset.id, scan.id


def test_review_reload_history_audit_and_export(client, review_finding, session_factory):
    asset_id, scan_id = review_finding
    app.dependency_overrides[current_role] = lambda: Principal("alice", "security_analyst", 123, "session")
    before = client.get(f"/api/assets/{asset_id}").json()
    assert before["review_status"] == "unreviewed"
    for version, status in enumerate(("confirmed_use", "false_positive", "uncertain")):
        response = client.post(f"/api/assets/{asset_id}/reviews", json={
            "status": status, "reason": f"  decision {version}  ", "expected_version": version,
        })
        assert response.status_code == 200
        data = response.json()
        assert data["review_status"] == status
        assert data["reviewed_by"] == "alice"
        assert data["review_reason"] == f"decision {version}"
        assert data["review_version"] == version + 1
        assert data["reviewed_at"].endswith("Z")
        for field in ("evidence_json", "confidence", "confirmed_use", "priority_score", "risk_context_provenance"):
            assert data[field] == before[field]
        assert client.get(f"/api/assets/{asset_id}").json() == data
    history = client.get(f"/api/assets/{asset_id}/reviews").json()
    assert [row["version"] for row in history] == [3, 2, 1]
    assert len(client.get(f"/api/assets/{asset_id}/reviews?limit=1&offset=1").json()) == 1
    with session_factory() as db:
        audits = db.query(AuditLogDB).filter_by(resource=f"asset:{asset_id}", action="asset.reviewed").all()
        assert len(audits) == 3
        assert all(row.actor_subject == "alice" for row in audits)
    export = client.get(f"/api/exports/cbom?scan_id={scan_id}")
    assert export.status_code == 200
    props = {p["name"]: p["value"] for p in export.json()["components"][0]["properties"]}
    assert props["ecdat:asset:review_status"] == "uncertain"
    assert props["ecdat:asset:reviewed_by"] == "alice"


def test_stale_review_rejected_without_history(client, review_finding):
    asset_id, _ = review_finding
    payload = {"status": "uncertain", "reason": "needs evidence", "expected_version": 0}
    assert client.post(f"/api/assets/{asset_id}/reviews", json=payload).status_code == 200
    assert client.post(f"/api/assets/{asset_id}/reviews", json=payload).status_code == 409
    assert len(client.get(f"/api/assets/{asset_id}/reviews").json()) == 1


@pytest.mark.parametrize("role", ["viewer", "auditor"])
def test_readonly_review_denied(client, review_finding, role):
    app.dependency_overrides[current_role] = lambda: Principal("reader", role, 123, "session")
    asset_id, _ = review_finding
    assert client.post(f"/api/assets/{asset_id}/reviews", json={
        "status": "false_positive", "reason": "test", "expected_version": 0,
    }).status_code == 403
    assert client.get(f"/api/assets/{asset_id}/reviews").json() == []


@pytest.mark.parametrize("extra", [
    {"status": "unreviewed"}, {"reason": "   "}, {"reason": "x" * 2001},
    {"reviewer": "forged"}, {"expected_version": -1},
])
def test_invalid_review_denied(client, review_finding, extra):
    asset_id, _ = review_finding
    payload = {"status": "uncertain", "reason": "test", "expected_version": 0} | extra
    assert client.post(f"/api/assets/{asset_id}/reviews", json=payload).status_code == 422
    assert client.get(f"/api/assets/{asset_id}").json()["review_version"] == 0


def test_audit_failure_rolls_back_review(client, review_finding, monkeypatch, session_factory):
    asset_id, _ = review_finding
    def fail(*args, **kwargs):
        raise RuntimeError("audit failed")
    monkeypatch.setattr("backend.routers.assets.record_audit", fail)
    with pytest.raises(RuntimeError, match="audit failed"):
        client.post(f"/api/assets/{asset_id}/reviews", json={
            "status": "uncertain", "reason": "test", "expected_version": 0,
        })
    with session_factory() as db:
        assert db.get(CryptoAssetDB, asset_id).review_version == 0
        assert db.query(AssetReviewDB).filter_by(asset_id=asset_id).count() == 0


def test_missing_asset(client):
    assert client.get("/api/assets/99999999/reviews").status_code == 404
    assert client.post("/api/assets/99999999/reviews", json={
        "status": "uncertain", "reason": "test", "expected_version": 0,
    }).status_code == 404
