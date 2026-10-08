"""Verify labelled static demo controls through a disposable live API."""

import argparse
import json
import time
import urllib.error
from pathlib import Path

from verify_rnsit_workflow import PROJECT_ROOT, get_settings, request_json

from backend.services.cbom_schema import validate_cbom


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not args.base_url.startswith("http://127.0.0.1:"):
        raise ValueError("Use the disposable local rehearsal API")
    args.output.mkdir(parents=True, exist_ok=True)
    username, account = next(iter(get_settings().users.items()))
    token = request_json(args.base_url, "/api/auth/login", body={
        "username": username, "password": account.password})["access_token"]
    results = []
    for name in ("positive-control", "negative-control", "mixed-risk"):
        repository = PROJECT_ROOT / "demo-repositories" / name
        labels = json.loads((repository / "expected-findings.json").read_text())
        try:
            accepted = request_json(args.base_url, "/api/scan", token=token,
                                    body={"repo_path": str(repository)})
        except urllib.error.HTTPError as error:
            if error.code != 429:
                raise
            delay = int(error.headers.get("Retry-After", "60"))
            if not 1 <= delay <= 300:
                raise
            print(f"WAIT scan admission retry interval: {delay}s", flush=True)
            while delay:
                interval = min(delay, 30)
                time.sleep(interval)
                delay -= interval
            accepted = request_json(args.base_url, "/api/scan", token=token,
                                    body={"repo_path": str(repository)})
        scan_id = accepted["scan_id"]
        deadline = time.monotonic() + 40
        while True:
            job = request_json(args.base_url, f"/api/scans/{scan_id}", token=token)
            if job["status"] in {"completed", "failed", "cancelled", "timed_out"}:
                break
            if time.monotonic() > deadline:
                raise RuntimeError(f"{name}: scan timed out")
            time.sleep(0.25)
        assert job["status"] == "completed", job
        assert job["failed_files"] == 0, "Control scan contains processing failures"
        assert job["scanned_files"] == job["in_scope_files"] > 0, "Control scope was not fully processed"
        inventory = request_json(args.base_url, f"/api/assets?scan_job_id={scan_id}&limit=200", token=token)
        algorithms = sorted({asset["algorithm"] for asset in inventory["items"]})
        assert algorithms == sorted(labels["expected_algorithms"]), (name, algorithms)
        assert inventory["total"] == len(inventory["items"]), "Incomplete fixture inventory"
        if "expected_finding_count" in labels:
            assert inventory["total"] == labels["expected_finding_count"]
        document = request_json(args.base_url, f"/api/exports/cbom?scan_id={scan_id}", token=token)
        assert not validate_cbom(document), "Export failed official schema validation"
        assert len(document.get("components", [])) == inventory["total"]
        # Remove machine-specific paths from portable demonstration artifacts.
        serialized = json.dumps(document, indent=2)
        serialized = serialized.replace(json.dumps(str(PROJECT_ROOT))[1:-1], "<working-copy>")
        serialized = serialized.replace(PROJECT_ROOT.as_posix(), "<working-copy>")
        portable = json.loads(serialized)
        assert not validate_cbom(portable), "Portable export failed official schema validation"
        (args.output / f"{name}-cbom.json").write_text(serialized + "\n", encoding="utf-8")
        results.append({"fixture": name, "findings": inventory["total"],
                        "algorithms": algorithms, "status": job["status"],
                        "evidence_kinds": sorted({a["evidence_kind"] for a in inventory["items"]})})
        print(f"PASS {name}: {inventory['total']} findings; exact algorithm labels; offline schema valid")
    (args.output / "control-results.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
