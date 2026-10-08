"""Complete standalone CBOM contract, independent of interactive pagination."""
import json

import pytest
from sqlalchemy import create_engine, event, update
from sqlalchemy.orm import sessionmaker

from backend.db import Base
from backend.models.asset import CryptoAssetDB
from backend.models.scan_job import ScanJobDB
from backend.services.cbom_export import export_cbom
from backend.services.cbom_schema import validate_cbom


@pytest.fixture
def export_scan(session_factory):
    def create(count=1, status="completed"):
        with session_factory() as db:
            scan = ScanJobDB(repo_path="/export-fixture", status=status,
                             in_scope_files=3, scanned_files=2, failed_files=1)
            db.add(scan)
            db.flush()
            db.add_all([CryptoAssetDB(scan_job_id=scan.id, algorithm="RSA", location=f"file-{i}.py",
                                     evidence_kind="observed_operation", confidence=0.9,
                                     evidence_json={"password": "do-not-export", "snippet": "source secret"},
                                     risk_context_provenance={"exposure": "policy-default"})
                        for i in range(count)])
            db.commit()
            return scan.id
    return create


def test_current_page_is_not_a_standalone_bom(client, export_scan):
    data = client.get(f"/api/cbom?scan_id={export_scan()}").json()
    assert any("pagination" in error for error in validate_cbom(data))


@pytest.mark.parametrize("count", [0, 1, 251])
def test_complete_schema_valid_export(client, export_scan, count):
    scan_id = export_scan(count)
    response = client.get(f"/api/exports/cbom?scan_id={scan_id}")
    assert response.status_code == 200
    data = response.json()
    assert validate_cbom(data) == []
    assert len(data["components"]) == count
    assert len({item["bom-ref"] for item in data["components"]}) == count
    assert "pagination" not in data
    assert "do-not-export" not in response.text
    assert "source secret" not in response.text
    assert "attachment" in response.headers["content-disposition"]
    assert int(response.headers["x-exported-count"]) == count
    assert len(client.get(f"/api/cbom?scan_id={scan_id}").json()["components"]) == min(count, 100)


def test_incomplete_and_missing_scan_rejected(client, export_scan):
    assert client.get(f"/api/exports/cbom?scan_id={export_scan(status='running')}").status_code == 409
    assert client.get("/api/exports/cbom?scan_id=99999999").status_code == 404


def test_invalid_schema_and_references_rejected():
    bad = {"bomFormat": "CycloneDX", "specVersion": "1.6", "components": [
        {"type": "invalid", "name": "RSA", "bom-ref": "a"},
        {"type": "library", "name": "RSA", "bom-ref": "a"},
    ], "dependencies": [{"ref": "a", "dependsOn": ["missing"]}]}
    errors = validate_cbom(bad)
    assert any("invalid" in error for error in errors)
    assert "Duplicate bom-ref identifiers" in errors
    assert "Dangling dependency reference" in errors


def test_offline_external_schema_resolution_and_wrong_version(monkeypatch):
    def no_network(*args, **kwargs):
        raise AssertionError("Validation attempted network access")
    monkeypatch.setattr("socket.create_connection", no_network)
    data = {"bomFormat": "CycloneDX", "specVersion": "1.6", "components": [
        {"type": "library", "name": "example", "licenses": [{"license": {"id": "MIT"}}]},
    ]}
    assert validate_cbom(data) == []
    data["components"][0]["licenses"][0]["license"]["id"] = "not-an-SPDX-license"
    assert validate_cbom(data)
    data["specVersion"] = "1.5"
    assert "specVersion must be 1.6 for the pinned schema" in validate_cbom(data)


def test_limits_fail_instead_of_truncating(client, export_scan, monkeypatch):
    scan_id = export_scan(3)
    monkeypatch.setattr("backend.services.cbom_export.MAX_EXPORT_ASSETS", 2)
    assert client.get(f"/api/exports/cbom?scan_id={scan_id}").status_code == 413
    monkeypatch.setattr("backend.services.cbom_export.MAX_EXPORT_ASSETS", 10)
    monkeypatch.setattr("backend.services.cbom_export.MAX_EXPORT_BYTES", 100)
    assert client.get(f"/api/exports/cbom?scan_id={scan_id}").status_code == 413


def test_explicit_scan_and_latest_completed_selector(client, export_scan):
    first, second = export_scan(1), export_scan(2)
    export_scan(3, status="running")
    assert len(client.get(f"/api/exports/cbom?scan_id={first}").json()["components"]) == 1
    latest = client.get("/api/exports/cbom").json()
    metadata = {p["name"]: p["value"] for p in latest["metadata"]["properties"]}
    assert metadata["ecdat:scan:id"] == str(second)
    assert metadata["ecdat:scan:failed-files"] == "1"
    assert len(latest["components"]) == 2


def test_concurrent_risk_update_cannot_mix_export_revisions(tmp_path):
    engine = create_engine(f"sqlite:///{(tmp_path / 'snapshot.db').as_posix()}")
    with engine.connect() as connection:
        connection.exec_driver_sql("PRAGMA journal_mode=WAL")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    with factory() as db:
        scan = ScanJobDB(repo_path="/snapshot", status="completed")
        db.add(scan)
        db.flush()
        scan_id = scan.id
        db.add_all([CryptoAssetDB(scan_job_id=scan_id, algorithm="RSA", location=f"{i}.py",
                                 priority_score=10, risk_context_provenance={"exposure": "policy-default"})
                    for i in range(2)])
        db.commit()
    selects = []
    def concurrent_edit(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("SELECT"):
            selects.append(statement)
            with factory() as writer:
                writer.execute(update(CryptoAssetDB).values(priority_score=20,
                               risk_context_provenance={"exposure": "user-provided"}))
                writer.commit()
    event.listen(engine, "after_cursor_execute", concurrent_edit)
    try:
        with factory() as db:
            content, count, _ = export_cbom(db, scan_id)
        assert count == 2
        assert len(selects) == 1
        for component in json.loads(content)["components"]:
            props = {p["name"]: p["value"] for p in component["properties"]}
            assert props["ecdat:asset:priority_score"] == "10"
            assert json.loads(props["ecdat:asset:risk_context_provenance"]) == {"exposure": "policy-default"}
    finally:
        event.remove(engine, "after_cursor_execute", concurrent_edit)
    with factory() as db:
        assert {a.priority_score for a in db.query(CryptoAssetDB).all()} == {20}
    engine.dispose()


def test_backend_setup_transaction_survives_background_rollback(session_factory):
    with session_factory() as writer:
        scan = ScanJobDB(repo_path="/backend-isolation", status="completed")
        writer.add(scan)
        writer.flush()
        scan_id = scan.id
        with session_factory() as reader:
            assert reader.get(ScanJobDB, scan_id) is None
            reader.rollback()
        writer.commit()
    with session_factory() as reader:
        assert reader.get(ScanJobDB, scan_id) is not None
