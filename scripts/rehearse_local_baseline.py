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
parser.add_argument("--comparison", action="store_true", help="Verify real scan/edit/rescan comparison with disposable source")
parser.add_argument("--semantics", action="store_true", help="Verify real JS/TS detection and native CBOM export")
parser.add_argument("--demo-pack", type=Path, help="Verify three controls and save portable exports")
parser.add_argument("--screenshots", type=Path, help="Save browser screenshots; requires --browser")
args = parser.parse_args()
if args.semantics and (args.browser or args.comparison or args.demo_pack or args.screenshots):
    parser.error("Run --semantics separately with its disposable fixture")
if args.comparison and (args.browser or args.demo_pack or args.screenshots):
    parser.error("Run --comparison separately to isolate its two-scan admission window")
if args.demo_pack and args.browser:
    parser.error("Run --demo-pack and --browser --screenshots separately to isolate scan admission windows")
if args.screenshots and not args.browser:
    parser.error("--screenshots requires --browser")
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
        "ECDAT_ALLOWED_SCAN_ROOTS": os.pathsep.join([str(root / "test-repo"), str(root / "demo-repositories"), str(Path(folder) / "comparison-repo")]),
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
            if not args.demo_pack and not args.comparison and not args.semantics:
                subprocess.run([
                    sys.executable, "scripts/verify_rnsit_workflow.py", str(root / "test-repo"),
                    "--base-url", base, "--timeout", "90", "--verify-risk-edit"],
                    cwd=root, env=env, check=True, timeout=100)
            if args.demo_pack:
                subprocess.run([sys.executable, "scripts/verify_demo_controls.py",
                                "--base-url", base, "--output", str(args.demo_pack.resolve())],
                               cwd=root, env=env, check=True, timeout=400)
            if args.browser or args.comparison or args.semantics:
                browser_env = dict(env, ECDAT_REHEARSAL_API=base, ECDAT_REHEARSAL_FOLDER=folder)
                if args.screenshots:
                    args.screenshots.mkdir(parents=True, exist_ok=True)
                    browser_env["ECDAT_DEMO_OUTPUT"] = str(args.screenshots.resolve())
                script = ("scripts/verify_crypto_semantics.mjs" if args.semantics else
                          "scripts/verify_scan_comparison.mjs" if args.comparison else "scripts/verify_live_browser.mjs")
                subprocess.run(["node", script], cwd=root,
                               env=browser_env, check=True, timeout=150)
                result_file = ("semantics-result.json" if args.semantics else
                               "comparison-result.json" if args.comparison else "browser-result.json")
                result = json.loads((Path(folder) / result_file).read_text())
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
                path = (f"/api/exports/cbom?scan_id={result['scanId']}" if args.semantics else
                        f"/api/scans/compare?baseline_id={result['baselineId']}&current_id={result['currentId']}"
                        if args.comparison else f"/api/assets/{result['assetId']}")
                request = urllib.request.Request(base + path,
                    headers={"Authorization": f"Bearer {token}"})
                with urllib.request.urlopen(request, timeout=10) as response:
                    actual = json.load(response)
                    if args.semantics:
                        assert actual["components"] == result["components"]
                    else:
                        assert actual == result["result" if args.comparison else "updated"]
                print("PASS API restart preserves native CBOM semantics" if args.semantics else
                      "PASS API restart preserves comparison snapshots and results" if args.comparison
                      else "PASS API restart preserves browser-edited finding, evidence and risk context")
        finally:
            stop_server(server)
