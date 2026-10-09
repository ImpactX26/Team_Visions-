import hashlib
import json

import pytest

from backend.services import remediation


def test_rehearsal_proves_collision_and_rescans_real_sources():
    plan = remediation.preview()
    result = remediation.rehearse(plan["source_sha256"])
    assert result["status"] == "verified"
    assert all(check["passed"] for check in result["checks"])
    assert result["collision"]["md5_a"] == result["collision"]["md5_b"]
    assert result["collision"]["sha256_a"] != result["collision"]["sha256_b"]
    assert result["comparison"]["removed"] == [("MD5", "checksum.py")]
    assert result["comparison"]["introduced"] == [("SHA-256", "checksum.py")]
    assert result["comparison"]["unchanged"] == [("SHA-512", "audit.py")]
    receipt = result.pop("receipt_sha256")
    assert (
        receipt
        == hashlib.sha256(json.dumps(result, sort_keys=True).encode()).hexdigest()
    )


def test_stale_preview_never_runs_scanner(monkeypatch):
    monkeypatch.setattr(remediation, "_scan", lambda *_: pytest.fail("must not scan"))
    with pytest.raises(ValueError, match="preview changed"):
        remediation.rehearse("0" * 64)


def test_incomplete_scan_does_not_claim_verified(monkeypatch):
    original = remediation._scan

    def incomplete(root):
        snapshot = original(root)
        snapshot["failed_files"] = 1
        return snapshot

    monkeypatch.setattr(remediation, "_scan", incomplete)
    result = remediation.rehearse(remediation.preview()["source_sha256"])
    assert result["status"] == "inconclusive"


def test_api_requires_write_role_and_rejects_arbitrary_inputs(isolated_client):
    client = isolated_client
    from backend.main import app
    from backend.security import current_role

    app.dependency_overrides[current_role] = lambda: "viewer"
    try:
        assert client.get("/api/remediation/preview").status_code == 200
        assert (
            client.post(
                "/api/remediation/verify",
                json={"source_sha256": remediation.preview()["source_sha256"]},
            ).status_code
            == 403
        )
    finally:
        app.dependency_overrides.pop(current_role, None)
    assert client.post(
        "/api/remediation/verify", json={"source_sha256": "bad", "repo_path": "C:/"}
    ).status_code in {401, 422}


def test_api_preview_binding_and_success(isolated_client, monkeypatch):
    from backend.main import app
    from backend.security import current_role

    app.dependency_overrides[current_role] = lambda: "security_analyst"
    audit = []
    monkeypatch.setattr(
        "backend.routers.remediation.record_audit", lambda *args: audit.append(args)
    )
    try:
        plan = isolated_client.get("/api/remediation/preview").json()
        assert (
            isolated_client.post(
                "/api/remediation/verify", json={"source_sha256": "0" * 64}
            ).status_code
            == 409
        )
        assert (
            isolated_client.post(
                "/api/remediation/verify",
                json={"source_sha256": plan["source_sha256"], "source": "malicious"},
            ).status_code
            == 422
        )
        response = isolated_client.post(
            "/api/remediation/verify", json={"source_sha256": plan["source_sha256"]}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "verified"
        assert len(response.json()["checks"]) == 11
        assert audit[0][0] == "remediation.rehearsed"
    finally:
        app.dependency_overrides.pop(current_role, None)
