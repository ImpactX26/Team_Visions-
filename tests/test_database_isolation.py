"""API background reads must not share a setup transaction's connection."""
from backend.models.scan_job import ScanJobDB


def test_background_rollback_preserves_setup_transaction(_isolated_session_factory):
    factory = _isolated_session_factory
    with factory() as writer:
        scan = ScanJobDB(repo_path="/isolation-regression", status="completed")
        writer.add(scan)
        writer.flush()
        scan_id = scan.id
        with factory() as reader:
            assert reader.get(ScanJobDB, scan_id) is None
            reader.rollback()
        writer.commit()
    with factory() as reader:
        assert reader.get(ScanJobDB, scan_id) is not None
