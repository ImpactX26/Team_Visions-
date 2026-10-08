"""No forced correspondence or false disappearance across scan snapshots."""
import pytest

from backend.main import app
from backend.models.asset import CryptoAssetDB
from backend.models.scan_job import ScanJobDB
from backend.security import Principal, current_role
from backend.services.scan_identity import CONTRACT
from backend.services.scanner_runner import collect_scan_result, persist_scan_result


@pytest.fixture
def scans(session_factory):
    def create(findings=(), metadata=None, status="completed"):
        with session_factory() as db:
            meta = {"contract": CONTRACT, "repository_id": "repo-a", "scanner_version": "version-a",
                    "profile": {"name": "source"}, "snapshot_id": "snapshot-a", "identity_consistent": True,
                    "branch": None, "manifest": {"crypto.py": {"status": "processed", "sha256": "hash"}}}
            if metadata is not None:
                meta.update(metadata)
            scan = ScanJobDB(repo_path="/repo-a", status=status, comparison_metadata=meta)
            db.add(scan)
            db.flush()
            for finding in findings:
                values = {"algorithm": "MD5", "location": "crypto.py", "evidence_kind": "observed_operation",
                          "usage": "hashing", "confidence": 0.9, "priority_score": 60,
                          "evidence_json": {"comparison_file": "crypto.py", "comparison_anchor": "assign:result",
                                            "evidence_list": [{"evidence": {"call": "hashlib.md5"}}]}}
                values.update(finding)
                db.add(CryptoAssetDB(scan_job_id=scan.id, **values))
            db.commit()
            return scan.id
    return create


def compare(client, baseline, current, query=""):
    return client.get(f"/api/scans/compare?baseline_id={baseline}&current_id={current}{query}")


def test_changed_occurrence_and_unchanged_review_independence(client, scans):
    baseline = scans([{}])
    current = scans([{"algorithm": "SHA-256", "location": "crypto.py:40", "priority_score": 0,
                      "review_status": "false_positive"}])
    response = compare(client, baseline, current)
    assert response.status_code == 200
    result = response.json()
    assert result["totals"]["changed"] == 1
    assert "algorithm" in result["items"][0]["changed_fields"]
    assert result["items"][0]["current"][0]["review_status"] == "false_positive"
    identical = scans([{}])
    assert compare(client, baseline, identical).json()["totals"]["unchanged"] == 1


def test_ambiguity_and_unmatched_totals(client, scans):
    duplicated = scans([{}, {}])
    current = scans([{}])
    result = compare(client, duplicated, current).json()
    assert result["totals"]["ambiguous"] == 1
    assert len(result["items"][0]["baseline"]) == 2
    empty = scans()
    assert compare(client, current, empty).json()["totals"]["no_longer_observed"] == 1
    added = scans([{}])
    assert compare(client, empty, added).json()["totals"]["added"] == 1


@pytest.mark.parametrize("manifest,status", [
    ({}, "completed"),
    ({"crypto.py": {"status": "unknown", "sha256": "hash"}}, "completed"),
    ({"crypto.py": {"status": "processed", "sha256": "hash"}}, "cancelled"),
    ({"crypto.py": {"status": "processed", "sha256": "hash"}}, "failed"),
])
def test_missing_failed_excluded_or_partial_files_never_imply_fix(client, scans, manifest, status):
    baseline = scans([{}])
    current = scans(metadata={"manifest": manifest}, status=status)
    result = compare(client, baseline, current).json()
    assert result["totals"]["unknown"] == 1
    assert result["totals"]["no_longer_observed"] == 0


@pytest.mark.parametrize("metadata", [
    {"repository_id": "other-repo"}, {"profile": {"name": "environment"}},
    {"scanner_version": "other-version"}, {"branch": "refs/heads/other"},
    {"contract": "legacy"}, {"identity_consistent": False},
])
def test_incompatible_scans_rejected(client, scans, metadata):
    baseline = scans([{}])
    current = scans([{}], metadata=metadata)
    assert compare(client, baseline, current).status_code == 409


def test_complete_pagination_and_filters(client, scans):
    findings = [{"location": f"crypto.py:{index}", "evidence_json": {
        "comparison_file": "crypto.py", "comparison_anchor": f"assign:{index}"}} for index in range(205)]
    baseline = scans(findings)
    current = scans(findings)
    first = compare(client, baseline, current, "&limit=200").json()
    last = compare(client, baseline, current, "&limit=200&offset=200").json()
    assert first["total"] == last["total"] == 205
    assert len(first["items"]) == 200 and len(last["items"]) == 5
    assert compare(client, baseline, current, "&status=changed").json()["total"] == 0


def test_input_and_readonly_access(client, scans):
    baseline, current = scans(), scans()
    for role in ("viewer", "auditor"):
        app.dependency_overrides[current_role] = lambda role=role: Principal("reader", role, 123, "session")
        assert compare(client, baseline, current).status_code == 200
    assert compare(client, baseline, baseline).status_code == 422
    assert compare(client, current, baseline).status_code == 422
    assert compare(client, baseline, 999999999).status_code == 404
    assert compare(client, baseline, current, "&limit=201").status_code == 422
    assert compare(client, baseline, current, "&status=invalid").status_code == 422


def test_real_collection_identity_moved_lines_and_algorithm_change(client, session_factory, tmp_path):
    root = tmp_path / "repo"
    root.mkdir()
    file = root / "crypto.py"
    original = "import hashlib\ndef digest(data):\n    result = hashlib.md5(data)\n    return result\n"
    ids = []
    for content in (original, "\n\n" + original, ("\n\n" + original).replace("md5", "sha256")):
        file.write_text(content)
        with session_factory() as db:
            scan = ScanJobDB(repo_path=str(root), status="running")
            db.add(scan)
            db.commit()
            ids.append(scan.id)
        result = collect_scan_result(str(root))
        assert result["metrics"]["comparison_metadata"]["manifest"]["crypto.py"]["status"] == "processed"
        persist_scan_result(ids[-1], result, session_factory=session_factory)
    moved = compare(client, ids[0], ids[1]).json()
    assert moved["totals"]["changed"] == 0, [item["changed_fields"] for item in moved["items"]]
    assert moved["totals"]["unchanged"] > 0
    modified = compare(client, ids[0], ids[2]).json()
    assert any(item["status"] == "changed" and "algorithm" in item["changed_fields"] for item in modified["items"])


def test_oversized_comparison_fails_without_truncation(client, scans, monkeypatch):
    baseline, current = scans([{}, {}]), scans([{}, {}])
    monkeypatch.setattr("backend.services.scan_comparison.MAX_FINDINGS", 1)
    assert compare(client, baseline, current).status_code == 413


def test_signature_without_anchor_cannot_prove_correspondence_in_edited_file(client, scans):
    finding = {"evidence_json": {"comparison_file": "crypto.py", "evidence_list": [{"evidence": {"call": "hashlib.md5"}}]}}
    baseline = scans([finding])
    same = scans([finding])
    assert compare(client, baseline, same).json()["totals"]["unchanged"] == 1
    edited = scans([finding], metadata={"manifest": {"crypto.py": {"status": "processed", "sha256": "edited-hash"}}})
    result = compare(client, baseline, edited).json()
    assert result["totals"]["unknown"] == 1 and result["totals"]["unchanged"] == 0
