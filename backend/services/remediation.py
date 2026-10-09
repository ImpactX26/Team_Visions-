"""Bounded remediation rehearsal using owned fixtures, never uploaded code."""

from __future__ import annotations

import difflib
import hashlib
import json
import tempfile
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from backend.services.confidence import score_finding
from backend.services.risk_engine import assess_risk
from backend.services.risk_policy import apply_risk_defaults
from backend.services.scanner_runner import collect_scan_result

RECIPE_ID = "integrity-md5-to-sha256"
SOURCE = """import hashlib
import hmac

def checksum(payload: bytes) -> str:
    return hashlib.md5(payload).hexdigest()

def verify(payload: bytes, expected: str) -> bool:
    return hmac.compare_digest(checksum(payload), expected)
"""
UNCHANGED = """import hashlib

def audit_digest(payload: bytes) -> str:
    return hashlib.sha512(payload).hexdigest()
"""
LIMITATIONS = [
    "Controlled integrity-checksum example; this does not migrate passwords, signatures, or TLS.",
    "SHA-256 changes digest values and length. Stored checksums and all producers/consumers need coordinated migration.",
    "An unkeyed checksum does not authenticate its sender. Expected digests must come from a trusted source.",
    "Static rescanning and fixture checks do not prove application-wide security or PQC compatibility.",
]
# Published MD5 collision blocks: inert byte strings, never executable content.
COLLISION_A = bytes.fromhex(
    "d131dd02c5e6eec4693d9a0698aff95c2fcab58712467eab4004583eb8fb7f89"
    "55ad340609f4b30283e488832571415a085125e8f7cdc99fd91dbdf280373c5b"
    "d8823e3156348f5bae6dacd436c919c6dd53e2b487da03fd02396306d248cda0"
    "e99f33420f577ee8ce54b67080a80d1ec69821bcb6a8839396f9652b6ff72a70"
)
COLLISION_B = bytes.fromhex(
    "d131dd02c5e6eec4693d9a0698aff95c2fcab50712467eab4004583eb8fb7f89"
    "55ad340609f4b30283e4888325f1415a085125e8f7cdc99fd91dbd7280373c5b"
    "d8823e3156348f5bae6dacd436c919c6dd53e23487da03fd02396306d248cda0"
    "e99f33420f577ee8ce54b67080280d1ec69821bcb6a8839396f965ab6ff72a70"
)


def preview() -> dict:
    after = SOURCE.replace("hashlib.md5(payload)", "hashlib.sha256(payload)")
    return {
        "recipe_id": RECIPE_ID,
        "title": "Replace a weak integrity checksum",
        "before_source": SOURCE,
        "after_source": after,
        "source_sha256": hashlib.sha256(SOURCE.encode()).hexdigest(),
        "diff": "".join(
            difflib.unified_diff(
                SOURCE.splitlines(True),
                after.splitlines(True),
                fromfile="before/checksum.py",
                tofile="after/checksum.py",
            )
        ),
        "rollback_diff": "".join(
            difflib.unified_diff(
                after.splitlines(True),
                SOURCE.splitlines(True),
                fromfile="after/checksum.py",
                tofile="before/checksum.py",
            )
        ),
        "limitations": LIMITATIONS,
        "collision_preview": {
            "payload_a": COLLISION_A.hex(),
            "payload_b": COLLISION_B.hex(),
            "changed_offsets": [
                i for i, (a, b) in enumerate(zip(COLLISION_A, COLLISION_B)) if a != b
            ],
            "md5_a": hashlib.md5(COLLISION_A).hexdigest(),
            "md5_b": hashlib.md5(COLLISION_B).hexdigest(),
            "sha256_a": hashlib.sha256(COLLISION_A).hexdigest(),
            "sha256_b": hashlib.sha256(COLLISION_B).hexdigest(),
        },
    }


def _scan(root: Path) -> dict:
    result = collect_scan_result(str(root))
    findings = []
    for raw in result["findings"]:
        finding = dict(raw)
        finding.update(score_finding(finding))
        finding = apply_risk_defaults(finding)
        risk = assess_risk(finding)
        findings.append(
            {
                "algorithm": finding.get("algorithm", "Unknown"),
                "file": finding.get("comparison_file")
                or str(finding.get("location", ""))
                .replace(str(root), "")
                .lstrip("/\\"),
                "location": str(finding.get("location", "")).replace(
                    str(root), "<isolated-copy>"
                ),
                "sources": finding.get("sources", []),
                "confidence": finding.get("confidence", 0),
                "priority_label": risk.get("priority_label", "UNKNOWN"),
                "risk_reasons": risk.get("risk_reasons", []),
            }
        )
    metrics = result["metrics"]
    return {
        "findings": findings,
        "coverage_pct": metrics.get("coverage_pct", 0),
        "scanned_files": metrics.get("scanned_files", 0),
        "in_scope_files": metrics.get("in_scope_files", 0),
        "failed_files": metrics.get("failed_files", 0),
    }


def rehearse(expected_source_sha256: str) -> dict:
    started = time.perf_counter()
    stages = []

    def checkpoint(name: str, since: float):
        stages.append(
            {
                "name": name,
                "duration_ms": round((time.perf_counter() - since) * 1000, 2),
            }
        )

    plan = preview()
    if expected_source_sha256 != plan["source_sha256"]:
        raise ValueError("The preview changed. Reload it before applying the recipe.")
    with tempfile.TemporaryDirectory(prefix="impactx-remediation-") as temp:
        root = Path(temp)
        before_root, after_root = root / "before", root / "after"
        before_root.mkdir()
        (before_root / "checksum.py").write_text(SOURCE, encoding="utf-8")
        (before_root / "audit.py").write_text(UNCHANGED, encoding="utf-8")
        checkpoint("Prepare isolated baseline", started)
        step_started = time.perf_counter()
        before = _scan(before_root)
        checkpoint("Scan baseline source", step_started)
        step_started = time.perf_counter()
        after_root.mkdir()
        baseline_source = (before_root / "checksum.py").read_text(encoding="utf-8")
        if baseline_source.count("hashlib.md5(payload)") != 1:
            raise ValueError("Recipe target is ambiguous. No patch was applied.")
        patched_source = baseline_source.replace(
            "hashlib.md5(payload)", "hashlib.sha256(payload)"
        )
        (after_root / "checksum.py").write_text(patched_source, encoding="utf-8")
        (after_root / "audit.py").write_bytes((before_root / "audit.py").read_bytes())
        checkpoint("Apply reviewed checksum patch", step_started)
        step_started = time.perf_counter()
        # Only immutable, server-owned source is executed; the API accepts no code or paths.
        namespace: dict = {}
        exec(compile(patched_source, "<owned-checksum-fixture>", "exec"), namespace)  # noqa: S102 - immutable owned fixture, no user code
        checksum, verify = namespace["checksum"], namespace["verify"]
        baseline: dict = {}
        exec(compile(SOURCE, "<owned-baseline-fixture>", "exec"), baseline)  # noqa: S102 - immutable owned fixture, no user code
        checks = [
            {
                "name": "SHA-256 known value: abc",
                "passed": checksum(b"abc")
                == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
            },
            {
                "name": "SHA-256 known value: empty input",
                "passed": checksum(b"")
                == "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            },
            {
                "name": "Original payload verifies",
                "passed": verify(b"abc", checksum(b"abc")),
            },
            {
                "name": "Modified payload is rejected",
                "passed": not verify(b"abd", checksum(b"abc")),
            },
            {
                "name": "MD5 values require migration",
                "passed": not verify(b"abc", hashlib.md5(b"abc").hexdigest()),
            },
            {
                "name": "Companion source stays unchanged",
                "passed": (before_root / "audit.py").read_bytes()
                == (after_root / "audit.py").read_bytes(),
            },
            {
                "name": "Distinct collision payloads share an MD5 digest",
                "passed": COLLISION_A != COLLISION_B
                and hashlib.md5(COLLISION_A).digest()
                == hashlib.md5(COLLISION_B).digest(),
            },
            {
                "name": "SHA-256 distinguishes the collision payloads",
                "passed": checksum(COLLISION_A) != checksum(COLLISION_B),
            },
            {
                "name": "Baseline verifier accepts the substituted payload",
                "passed": baseline["verify"](
                    COLLISION_B, baseline["checksum"](COLLISION_A)
                ),
            },
            {
                "name": "Patched verifier rejects the substituted payload",
                "passed": not verify(COLLISION_B, checksum(COLLISION_A)),
            },
            {
                "name": "Reverse patch reconstructs the original source",
                "passed": patched_source.replace(
                    "hashlib.sha256(payload)", "hashlib.md5(payload)"
                )
                == baseline_source,
            },
        ]
        checkpoint("Execute functional and collision checks", step_started)
        step_started = time.perf_counter()
        after = _scan(after_root)
        checkpoint("Rescan patched source", step_started)

        def keys(snapshot):
            return {(item["algorithm"], item["file"]) for item in snapshot["findings"]}

        old, new = keys(before), keys(after)
        complete = all(
            snapshot["failed_files"] == 0
            and snapshot["in_scope_files"] > 0
            and snapshot["scanned_files"] == snapshot["in_scope_files"]
            for snapshot in (before, after)
        )
        resolved = (
            complete
            and all(check["passed"] for check in checks)
            and any(algorithm == "MD5" for algorithm, _ in old)
            and not any(algorithm == "MD5" for algorithm, _ in new)
            and any(algorithm == "SHA-256" for algorithm, _ in new)
            and ("SHA-512", "audit.py") in old & new
        )
        result = {
            **plan,
            "run_id": str(uuid.uuid4()),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "status": "verified" if resolved else "inconclusive",
            "before": before,
            "after": after,
            "checks": checks,
            "comparison": {
                "removed": sorted(old - new),
                "introduced": sorted(new - old),
                "unchanged": sorted(old & new),
            },
            "after_source_sha256": hashlib.sha256(
                plan["after_source"].encode()
            ).hexdigest(),
            "scope": "Server-owned fixture in a disposable copy; no project source was modified.",
        }
        result["stages"] = stages
        result["duration_ms"] = round((time.perf_counter() - started) * 1000, 2)
        result["verification_reasons"] = (
            (
                ["Both scanner passes processed their complete supported scope."]
                if complete
                else ["Scanner coverage is incomplete or contains processing failures."]
            )
            + [
                f"Failed check: {check['name']}"
                for check in checks
                if not check["passed"]
            ]
            + (
                [
                    "MD5 was removed, SHA-256 was observed, and the SHA-512 companion was preserved."
                ]
                if resolved
                else [
                    "Review the scanner comparison; resolution requirements were not all satisfied."
                ]
            )
        )
        result["collision"] = {
            "payload_bytes": len(COLLISION_A),
            "different_bytes": sum(a != b for a, b in zip(COLLISION_A, COLLISION_B)),
            "md5_a": hashlib.md5(COLLISION_A).hexdigest(),
            "md5_b": hashlib.md5(COLLISION_B).hexdigest(),
            "sha256_a": checksum(COLLISION_A),
            "sha256_b": checksum(COLLISION_B),
        }
        result["receipt_sha256"] = hashlib.sha256(
            json.dumps(result, sort_keys=True).encode()
        ).hexdigest()
        return result
