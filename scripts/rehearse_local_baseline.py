"""Reproduce local startup and a bundled scan without using persistent data."""
import argparse
import json
import os
import secrets
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from contextlib import contextmanager
from pathlib import Path


@contextmanager
def disposable_folder(parent):
    temporary = tempfile.TemporaryDirectory(prefix="demo-", dir=parent)
    try:
        yield temporary.name
    finally:
        for attempt in range(20):
            try:
                temporary.cleanup()
                break
            except PermissionError:
                if attempt == 19:
                    raise
                time.sleep(0.25)
        print("PASS temporary server stopped; disposable database removed")


def stop_server(server):
    if server.poll() is None:
        if os.name == "nt":
            subprocess.run(["taskkill", "/PID", str(server.pid), "/T", "/F"],
                           check=True, capture_output=True, timeout=10)
        else:
            server.terminate()
    try:
        server.wait(timeout=10)
    except subprocess.TimeoutExpired:
        server.kill()
        server.wait(timeout=5)


def wait_ready(server, base):
    for _ in range(100):
        if server.poll() is not None:
            raise RuntimeError("Demo API failed to start")
        try:
            with urllib.request.urlopen(base + "/ready", timeout=2) as response:
                if response.status == 200:
                    return
        except Exception:
            time.sleep(0.2)
    raise RuntimeError("Demo readiness timed out")

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--browser", action="store_true", help="Verify real frontend/API integration")
args = parser.parse_args()
(root / "tmp").mkdir(exist_ok=True)
with disposable_folder(root / "tmp") as folder:
    env = os.environ.copy()
    env.update({
        "DATABASE_URL": "sqlite:///" + (Path(folder) / "demo.db").as_posix(),
        "ECDAT_TOKEN_SECRET": secrets.token_urlsafe(48),
        "ECDAT_USERS_JSON": json.dumps({"presenter": {
            "role": "admin", "password": secrets.token_urlsafe(24)}}),
        "ECDAT_ENV": "local",
        "ECDAT_AUTO_CREATE_TABLES": "false",
        "ECDAT_ALLOWED_SCAN_ROOTS": str(root / "test-repo"),
        "ECDAT_ALLOW_UNRESTRICTED_SCAN_ROOTS": "false",
        "ECDAT_ALLOW_ROLE_HEADER": "false",
        "ECDAT_RATE_LIMIT": "10000",
    })
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"],
                   cwd=root, env=env, check=True, capture_output=True, timeout=30)
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    base = f"http://127.0.0.1:{port}"
    with (Path(folder) / "server.log").open("w") as log:
        server = subprocess.Popen([
            sys.executable, "-m", "uvicorn", "backend.main:app",
            "--host", "127.0.0.1", "--port", str(port)],
            cwd=root, env=env, stdout=log, stderr=log)
        try:
            wait_ready(server, base)
            print("PASS migrated database and readiness")
            subprocess.run([
                sys.executable, "scripts/verify_rnsit_workflow.py", str(root / "test-repo"),
                "--base-url", base, "--timeout", "90", "--verify-risk-edit"],
                cwd=root, env=env, check=True, timeout=100)
            if args.browser:
                browser_env = dict(env, ECDAT_REHEARSAL_API=base, ECDAT_REHEARSAL_FOLDER=folder)
                subprocess.run(["node", "scripts/verify_live_browser.mjs"], cwd=root,
                               env=browser_env, check=True, timeout=150)
                result = json.loads((Path(folder) / "browser-result.json").read_text())
                command = server.args
                stop_server(server)
                server = subprocess.Popen(command, cwd=root, env=env, stdout=log, stderr=log)
                wait_ready(server, base)
                username, account = next(iter(json.loads(env["ECDAT_USERS_JSON"]).items()))
                login = urllib.request.Request(base + "/api/auth/login",
                    data=json.dumps({"username": username, "password": account["password"]}).encode(),
                    headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(login, timeout=10) as response:
                    token = json.load(response)["access_token"]
                request = urllib.request.Request(base + f"/api/assets/{result['assetId']}",
                    headers={"Authorization": f"Bearer {token}"})
                with urllib.request.urlopen(request, timeout=10) as response:
                    assert json.load(response) == result["updated"]
                print("PASS API restart preserves browser-edited finding, evidence and risk context")
        finally:
            stop_server(server)
