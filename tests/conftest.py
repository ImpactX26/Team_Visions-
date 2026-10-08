"""Session-scoped pytest fixtures for ECDAT integration tests in tests/.

Provides a disposable file database per test session, separate from the
checked-in ecdat.db file, with independent transaction connections.
"""
# ruff: noqa: I001
import sys

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

# Ensure backend package is importable.
_root = __import__("pathlib").Path(__file__).resolve().parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

# Ensure env is set before any backend module reads os.environ.
import tests.integration_env  # noqa: F401

# ── Capture per-module SessionLocal originals ─────────────────────────────────
# Every module that imports SessionLocal from backend.db gets its own reference.
# We capture those references BEFORE any fixture patches them, so we can restore
# each module independently in finally blocks.
import backend.db as _db
import backend.middleware.rate_limit as _rl
import backend.routers.assets as _assets_mod
import backend.routers.dashboard as _dash_mod
import backend.routers.outputs as _outputs_mod
import backend.routers.scan as _scan_mod
import backend.security as _sec
import backend.services.scan_control as _sc
from backend.db import Base
from backend.main import app

_ORIG_SESSIONLOCALS = {
    "backend.db": _db.SessionLocal,
    "backend.routers.scan": _scan_mod.SessionLocal,
    "backend.routers.assets": _assets_mod.SessionLocal,
    "backend.routers.dashboard": _dash_mod.SessionLocal,
    "backend.routers.outputs": _outputs_mod.SessionLocal,
    "backend.security": _sec.SessionLocal,
    "backend.services.scan_control": _sc.SessionLocal,
}

_MODULES = (
    _db,
    _scan_mod,
    _assets_mod,
    _dash_mod,
    _outputs_mod,
    _sec,
    _sc,
)


@pytest.fixture(scope="session")
def _isolated_engine(tmp_path_factory):
    """Use independent connections so background rollbacks cannot erase setup."""
    database = tmp_path_factory.mktemp("api-database") / "tests.db"
    engine = create_engine(
        f"sqlite:///{database.as_posix()}",
        connect_args={"check_same_thread": False},
    )
    @event.listens_for(engine, "connect")
    def foreign_keys(connection, record):
        connection.execute("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(bind=engine)
    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture(scope="session")
def _isolated_session_factory(_isolated_engine):
    return sessionmaker(bind=_isolated_engine, autocommit=False, autoflush=False)


@pytest.fixture(autouse=True)
def _clear_rate_limiter():
    """Ensure rate-limiter windows dict is empty before each test."""
    _rl._windows.clear()
    yield
    _rl._windows.clear()


@pytest.fixture()
def isolated_client(_isolated_session_factory, monkeypatch):
    """Return a TestClient wired to an isolated disposable database.

    Patches the module-level SessionLocal in every module that imports it
    directly, so the app and all routers use the test database.

    All patches are restored in a finally block so failed tests cannot leak state.
    """
    factory = _isolated_session_factory

    # Patch module-level SessionLocal everywhere it is used directly.
    for mod in _MODULES:
        monkeypatch.setattr(mod, "SessionLocal", factory)

    # Disable rate limiter in tests via monkeypatch (auto-restores after test).
    monkeypatch.setattr(_rl, "_allow", lambda *a, **kw: True)

    # Reset scan control active slot via monkeypatch.
    monkeypatch.setattr(_sc, "_active", None)

    # Suppress audit writes.
    audit_patcher = pytest.MonkeyPatch()
    audit_patcher.setattr(_sec, "record_audit", lambda *a, **kw: None)

    # Suppress background supervise.
    def _suppressed_supervise(*_a, **_kw):
        raise RuntimeError("suppressed in tests")

    supervise_patcher = pytest.MonkeyPatch()
    supervise_patcher.setattr(_scan_mod, "supervise", _suppressed_supervise)

    # Make background_tasks.add_task a no-op.
    bt_patcher = pytest.MonkeyPatch()
    bt_patcher.setattr("fastapi.BackgroundTasks.add_task", lambda *a, **kw: None)

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        # Explicit cleanup in case monkeypatch context exits early.
        audit_patcher.undo()
        supervise_patcher.undo()
        bt_patcher.undo()
        _sc._active = None
