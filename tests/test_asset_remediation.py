import hashlib
from types import SimpleNamespace

import pytest

from backend.services.asset_remediation import asset_plan, verify_asset


def fixture(
    tmp_path,
    algorithm="MD5",
    source="import hashlib\ndef checksum(data):\n    return hashlib.md5(data).hexdigest()\n",
):
    path = tmp_path / "integrity.py"
    path.write_text(source, encoding="utf-8")
    asset = SimpleNamespace(
        id=12,
        algorithm=algorithm,
        location=str(path),
        usage="hashing",
        capability_only=False,
        conflict=False,
        review_status="unreviewed",
        pqc_candidate="",
        evidence_json={},
    )
    scan = SimpleNamespace(
        id=8,
        repo_path=str(tmp_path),
        comparison_metadata={
            "manifest": {
                "integrity.py": {
                    "status": "processed",
                    "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                }
            }
        },
    )
    return asset, scan, path


@pytest.mark.parametrize("algorithm,call", [("MD5", "md5"), ("SHA-1", "sha1")])
def test_actual_source_patch_and_real_file_rescan(tmp_path, algorithm, call):
    asset, scan, path = fixture(
        tmp_path,
        algorithm,
        f"import hashlib\ndef checksum(data):\n    return hashlib.{call}(data).hexdigest()\n",
    )
    original = path.read_bytes()
    plan = asset_plan(asset, scan)
    assert plan["mode"] == "patch_available"
    assert "integrity.py" in plan["diff"]
    result = verify_asset(asset, scan, plan["source_sha256"])
    assert result["status"] == "scanner_verified"
    assert all(check["passed"] for check in result["checks"])
    assert path.read_bytes() == original


def test_stale_source_and_stale_preview_block_rehearsal(tmp_path):
    asset, scan, path = fixture(tmp_path)
    plan = asset_plan(asset, scan)
    with pytest.raises(ValueError, match="changed"):
        verify_asset(asset, scan, "0" * 64)
    path.write_text("import hashlib\n", encoding="utf-8")
    assert asset_plan(asset, scan)["mode"] == "manual_review"
    with pytest.raises(ValueError, match="changed"):
        verify_asset(asset, scan, plan["source_sha256"])


def test_no_guessed_patch_for_ambiguous_shadowed_or_nonchecksum_usage(tmp_path):
    asset, scan, _ = fixture(
        tmp_path,
        source="import hashlib\ndef checksum(hashlib):\n    return hashlib.md5(b'abc')\n",
    )
    assert asset_plan(asset, scan)["mode"] == "manual_review"
    asset, scan, _ = fixture(
        tmp_path, source="import hashlib\na=hashlib.md5(b'a')\nb=hashlib.md5(b'b')\n"
    )
    assert asset_plan(asset, scan)["mode"] == "manual_review"
    asset, scan, _ = fixture(tmp_path)
    asset.usage = "password_storage"
    assert asset_plan(asset, scan)["mode"] == "manual_review"


def test_manual_migration_for_other_algorithms_and_unsafe_paths(tmp_path):
    asset, scan, _ = fixture(tmp_path, "RSA")
    assert "post-quantum" in asset_plan(asset, scan)["target"]
    asset.algorithm = "MD5"
    asset.location = str(tmp_path.parent / "outside.py")
    assert asset_plan(asset, scan)["mode"] == "manual_review"
    asset.capability_only = True
    assert "evidence" in asset_plan(asset, scan)["reason"]


def test_incomplete_scan_never_claims_verified(tmp_path, monkeypatch):
    asset, scan, _ = fixture(tmp_path)
    from backend.services import asset_remediation

    original = asset_remediation._scan

    def failed(root):
        value = original(root)
        value["failed_files"] = 1
        return value

    monkeypatch.setattr(asset_remediation, "_scan", failed)
    assert (
        verify_asset(asset, scan, asset_plan(asset, scan)["source_sha256"])["status"]
        == "inconclusive"
    )


def test_finding_api_permissions_and_confirmed_usage(
    isolated_client, tmp_path, monkeypatch
):
    from backend.main import app
    from backend.routers import remediation
    from backend.security import current_role

    asset, scan, _ = fixture(tmp_path)
    monkeypatch.setattr(remediation, "finding", lambda *_: (asset, scan))
    audits = []
    monkeypatch.setattr(
        remediation, "record_audit", lambda *args, **kwargs: audits.append(args)
    )
    try:
        app.dependency_overrides[current_role] = lambda: "viewer"
        preview = isolated_client.get("/api/remediation/assets/12/preview")
        assert preview.status_code == 200
        payload = {
            "source_sha256": preview.json()["source_sha256"],
            "integrity_checksum_confirmed": True,
        }
        assert (
            isolated_client.post(
                "/api/remediation/assets/12/verify", json=payload
            ).status_code
            == 403
        )
        app.dependency_overrides[current_role] = lambda: "security_analyst"
        assert (
            isolated_client.post(
                "/api/remediation/assets/12/verify",
                json={**payload, "integrity_checksum_confirmed": False},
            ).status_code
            == 422
        )
        assert (
            isolated_client.post(
                "/api/remediation/assets/12/verify",
                json={**payload, "path": "arbitrary.py"},
            ).status_code
            == 422
        )
        response = isolated_client.post(
            "/api/remediation/assets/12/verify", json=payload
        )
        assert response.status_code == 200
        assert response.json()["status"] == "scanner_verified"
        assert audits[0][0] == "remediation.finding_rehearsed"
    finally:
        app.dependency_overrides.pop(current_role, None)
