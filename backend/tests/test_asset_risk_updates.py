"""Risk edits preserve scanner evidence and the origin of untouched inputs."""
import pytest

from backend.main import app
from backend.models.asset import CryptoAssetDB
from backend.models.audit_log import AuditLogDB
from backend.models.scan_job import ScanJobDB
from backend.security import Principal, current_role


@pytest.fixture
def finding(session_factory):
    def create(kind="observed_operation", provenance=None):
        with session_factory() as db:
            scan = ScanJobDB(repo_path="/risk-edit-test", status="completed")
            db.add(scan)
            db.flush()
            asset = CryptoAssetDB(
                scan_job_id=scan.id, algorithm="RSA", usage="tls", location="crypto.py:1",
                evidence_kind=kind, evidence_quality=kind, confidence=0.91,
                confirmed_use=kind == "observed_operation",
                capability_only=kind == "declared_capability",
                evidence_json={"source": "scanner", "line": 1},
                risk_context_provenance=provenance or {},
                priority_score=38 if kind == "observed_operation" else 31,
                risk_reasons=["original scanner assessment"],
            )
            db.add(asset)
            db.commit()
            return asset.id
    return create


@pytest.mark.parametrize("kind,score,note", [
    ("observed_operation", 42, "confirmed use of"),
    ("declared_capability", 35, "capability-only exposure to"),
])
def test_edit_preserves_evidence_and_prior_provenance(client, finding, kind, score, note):
    provenance = {"business_criticality": "user-provided", "data_sensitivity": "policy-default"}
    asset_id = finding(kind, provenance)
    before = client.get(f"/api/assets/{asset_id}").json()
    response = client.patch(f"/api/assets/{asset_id}", json={"exposure": "internet"})
    assert response.status_code == 200
    result = response.json()
    assert result["priority_score"] == score
    assert note in result["risk_reasons"][0]
    assert result["risk_context_provenance"]["exposure"] == "user-provided"
    assert result["risk_context_provenance"]["business_criticality"] == "user-provided"
    assert result["risk_context_provenance"]["data_sensitivity"] == "policy-default"
    assert result["risk_context_provenance"]["data_lifetime_years"] == "unknown"
    for field in ("evidence_kind", "evidence_quality", "confidence", "evidence_json",
                  "confirmed_use", "capability_only"):
        assert result[field] == before[field]
    assert client.get(f"/api/assets/{asset_id}").json() == result


@pytest.mark.parametrize("payload", [{}, {"exposure": None}])
def test_empty_edit_is_noop(client, finding, monkeypatch, payload):
    asset_id = finding()
    before = client.get(f"/api/assets/{asset_id}").json()
    audits = []
    monkeypatch.setattr("backend.routers.assets.record_audit", lambda *a, **kw: audits.append(a))
    response = client.patch(f"/api/assets/{asset_id}", json=payload)
    assert response.status_code == 200
    assert response.json() == before
    assert audits == []


def test_failed_audit_rolls_back_risk_edit(client, finding, monkeypatch):
    asset_id = finding()
    before = client.get(f"/api/assets/{asset_id}").json()
    def fail(*args, **kwargs):
        raise RuntimeError("audit unavailable")
    monkeypatch.setattr("backend.routers.assets.record_audit", fail)
    with pytest.raises(RuntimeError, match="audit unavailable"):
        client.patch(f"/api/assets/{asset_id}", json={"exposure": "internet"})
    assert client.get(f"/api/assets/{asset_id}").json() == before


@pytest.mark.parametrize("role", ["auditor", "viewer"])
def test_readonly_role_cannot_edit(client, finding, session_factory, role):
    asset_id = finding()
    before = client.get(f"/api/assets/{asset_id}").json()
    app.dependency_overrides[current_role] = lambda: role
    response = client.patch(f"/api/assets/{asset_id}", json={"exposure": "internet"})
    assert response.status_code == 403
    assert client.get(f"/api/assets/{asset_id}").json() == before
    with session_factory() as db:
        assert db.query(AuditLogDB).filter_by(resource=f"asset:{asset_id}").count() == 0


@pytest.mark.parametrize("payload", [
    {"exposure": "public"}, {"data_lifetime_years": -1}, {"threat_horizon_years": 0},
])
def test_invalid_edit_leaves_asset_and_audit_unchanged(client, finding, session_factory, payload):
    asset_id = finding()
    before = client.get(f"/api/assets/{asset_id}").json()
    assert client.patch(f"/api/assets/{asset_id}", json=payload).status_code == 422
    assert client.get(f"/api/assets/{asset_id}").json() == before
    with session_factory() as db:
        assert db.query(AuditLogDB).filter_by(resource=f"asset:{asset_id}").count() == 0


@pytest.mark.parametrize("role", ["admin", "security_analyst"])
def test_audit_records_only_explicit_edits_and_signed_actor(client, finding, session_factory, role):
    asset_id = finding()
    principal = Principal("risk-reviewer", role, 123456, "risk-session")
    app.dependency_overrides[current_role] = lambda: principal
    response = client.patch(f"/api/assets/{asset_id}", json={
        "exposure": "internet", "data_lifetime_years": 0, "migration_effort": None,
    })
    assert response.status_code == 200
    assert response.json()["data_lifetime_years"] == 0
    with session_factory() as db:
        event = db.query(AuditLogDB).filter_by(resource=f"asset:{asset_id}").one()
        assert event.action == "asset.risk_context_updated"
        assert event.details == {"exposure": "internet", "data_lifetime_years": 0}
        assert (event.actor_subject, event.actor_role, event.actor_session_id) == (
            "risk-reviewer", role, "risk-session",
        )
