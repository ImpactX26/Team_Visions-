"""Finding-specific plans and bounded, non-executing source rehearsals."""

import ast
import difflib
import hashlib
import json
import re
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

from backend.services.remediation import _scan
from backend.services.repository_guard import resolve_repository
from backend.services.scan_identity import relative_file
from scanner.limits import read_bytes


def _source(asset, scan):
    root = Path(resolve_repository(scan.repo_path))
    location = re.sub(r":\d+(?::\d+)?$", "", asset.location)
    path = Path(location)
    if not path.is_absolute():
        path = root / path
    if not path.resolve().is_relative_to(root) or path.suffix != ".py":
        raise ValueError(
            "A bounded Python source file inside the scanned repository is required."
        )
    # Reject linked files and parents; do not follow repository-controlled links.
    if any(
        p.is_symlink() or p.is_junction()
        for p in [path, *path.parents]
        if p != root.parent
    ):
        raise ValueError("Linked source paths cannot be rehearsed.")
    content = read_bytes(str(path))
    if len(content) > 128 * 1024:
        raise ValueError("This source exceeds the 128 KB rehearsal limit.")
    relative = relative_file(str(root), str(path))
    entry = (scan.comparison_metadata or {}).get("manifest", {}).get(relative, {})
    if (
        entry.get("status") != "processed"
        or entry.get("sha256") != hashlib.sha256(content).hexdigest()
    ):
        raise ValueError(
            "Source is missing a matching scan snapshot. Rescan before preparing a patch."
        )
    return path, content.decode("utf-8"), relative


def _patch(source, asset):
    tree = ast.parse(source)
    name = {"MD5": "md5", "SHA-1": "sha1", "SHA1": "sha1"}.get(asset.algorithm.upper())
    if not name:
        raise ValueError("No automatic source recipe for this algorithm.")
    aliases = {
        alias.asname or "hashlib"
        for node in tree.body
        if isinstance(node, ast.Import)
        for alias in node.names
        if alias.name == "hashlib"
    }
    # Refuse shadowed imports anywhere, including parameters and nested assignments.
    if any(
        (
            isinstance(node, ast.Name)
            and isinstance(node.ctx, ast.Store)
            and node.id in aliases
        )
        or (isinstance(node, ast.arg) and node.arg in aliases)
        or (
            isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))
            and node.name in aliases
        )
        or (
            isinstance(node, ast.Attribute)
            and isinstance(node.ctx, ast.Store)
            and isinstance(node.value, ast.Name)
            and node.value.id in aliases
        )
        or (
            isinstance(node, ast.Import)
            and any(
                alias.name != "hashlib"
                and (alias.asname or alias.name.split(".")[0]) in aliases
                for alias in node.names
            )
        )
        or (
            isinstance(node, ast.ImportFrom)
            and any(
                (alias.asname or alias.name) in aliases or alias.name == "*"
                for alias in node.names
            )
        )
        for node in ast.walk(tree)
    ):
        raise ValueError(
            "The hashlib binding is shadowed; review this finding manually."
        )
    entries = (asset.evidence_json or {}).get("evidence_list", [])
    lines = {
        (item.get("span") or {}).get("line_start")
        for item in entries
        if item.get("source") == "ast"
        and item.get("evidence_kind") == "observed_operation"
    }
    calls = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and isinstance(node.func.value, ast.Name)
        and node.func.value.id in aliases
        and node.func.attr == name
        and (not lines or node.lineno in lines)
    ]
    if len(calls) != 1:
        raise ValueError(
            "A unique direct hashlib operation could not be matched to this finding."
        )
    node = calls[0].func
    rows = source.splitlines(keepends=True)
    if node.lineno != node.end_lineno:
        raise ValueError("Multiline bindings require manual review.")
    # AST columns are UTF-8 byte offsets, not Python string offsets.
    row = rows[node.lineno - 1].encode("utf-8")
    stop = node.end_col_offset
    start = stop - len(name)
    if row[start:stop] != name.encode():
        raise ValueError("Source anchor did not match the proposed replacement.")
    rows[node.lineno - 1] = (row[:start] + b"sha256" + row[stop:]).decode("utf-8")
    after = "".join(rows)
    ast.parse(after)
    return after


def asset_plan(asset, scan):
    algorithm = asset.algorithm.upper()
    checks = [
        "Confirm source evidence, runtime use, and component ownership.",
        "Run operation-specific regression and interoperability tests.",
        "Rescan the same scope and compare findings and coverage.",
        "Stage deployment with a tested rollback and coordinated consumer migration.",
    ]
    if algorithm in {"MD5", "SHA-1", "SHA1"}:
        target = "SHA-256 for integrity checks"
        checks.insert(
            1,
            "Confirm this is an integrity checksum, not password storage, signing, or authentication.",
        )
    elif re.search(r"RSA|ECDSA|ECDH|DSA|ED25519|DIFFIE", algorithm):
        target = asset.pqc_candidate or "Operation-appropriate post-quantum migration"
        checks.insert(
            1,
            "Review protocol/library support, key and certificate rotation, performance, and hybrid interoperability.",
        )
    elif re.search(r"DES|RC4|BLOWFISH|AES", algorithm):
        target = (
            "Supported authenticated encryption with reviewed key and nonce management"
        )
        checks.insert(
            1,
            "Test tamper rejection, nonce uniqueness, legacy decryption, and key rotation.",
        )
    else:
        target = "Context-specific configuration and lifecycle review"
    result = {
        "asset_id": asset.id,
        "scan_id": scan.id,
        "algorithm": asset.algorithm,
        "location": asset.location,
        "target": target,
        "mode": "manual_review",
        "checks": checks,
        "limitations": [
            "No project source is modified.",
            "A file-scoped scanner check does not establish application compatibility or security.",
        ],
        "reason": "This operation needs a reviewed implementation and compatibility tests.",
    }
    if (
        asset.capability_only
        or asset.conflict
        or asset.review_status in {"uncertain", "false_positive"}
    ):
        result["reason"] = (
            "Resolve capability-only, conflicting, or analyst review evidence first."
        )
        return result
    if algorithm not in {"MD5", "SHA-1", "SHA1"}:
        return result
    if asset.usage not in {"hashing", "checksum", "integrity", "integrity_check"}:
        result["reason"] = (
            "Usage is not a supported integrity/hash operation; select a context-specific migration."
        )
        return result
    try:
        _, source, relative = _source(asset, scan)
        after = _patch(source, asset)
    except (ValueError, OSError, SyntaxError, UnicodeError, RecursionError) as exc:
        result["reason"] = str(exc)
        return result
    result.update(
        mode="patch_available",
        reason="One direct Python hashlib operation matched to a current scan snapshot.",
        file=relative,
        source_sha256=hashlib.sha256(source.encode()).hexdigest(),
        before_source=source,
        after_source=after,
        diff="".join(
            difflib.unified_diff(
                source.splitlines(True),
                after.splitlines(True),
                fromfile=f"before/{relative}",
                tofile=f"after/{relative}",
            )
        ),
        rollback_diff="".join(
            difflib.unified_diff(
                after.splitlines(True),
                source.splitlines(True),
                fromfile=f"after/{relative}",
                tofile=f"before/{relative}",
            )
        ),
    )
    return result


def verify_asset(asset, scan, expected_hash):
    plan = asset_plan(asset, scan)
    if plan["mode"] != "patch_available" or plan["source_sha256"] != expected_hash:
        raise ValueError(
            "Source or eligibility changed. Reload the plan and review it again."
        )
    with tempfile.TemporaryDirectory(prefix="impactx-finding-") as folder:
        before_root, after_root = Path(folder) / "before", Path(folder) / "after"
        before_path, after_path = before_root / plan["file"], after_root / plan["file"]
        before_path.parent.mkdir(parents=True)
        after_path.parent.mkdir(parents=True)
        before_path.write_bytes(plan["before_source"].encode("utf-8"))
        after_path.write_bytes(plan["after_source"].encode("utf-8"))
        before, after = _scan(before_root), _scan(after_root)
    old = asset.algorithm.upper().replace("SHA1", "SHA-1")
    count = lambda snapshot, algorithm: sum(
        f["algorithm"].upper() == algorithm for f in snapshot["findings"]
    )
    checks = [
        {
            "name": "Both file-scoped scans completed without failed files",
            "passed": all(
                s["failed_files"] == 0
                and s["in_scope_files"] > 0
                and s["scanned_files"] == s["in_scope_files"]
                for s in [before, after]
            ),
        },
        {
            "name": "One targeted weak-digest observation removed",
            "passed": count(before, old) - count(after, old) == 1,
        },
        {
            "name": "One SHA-256 observation introduced",
            "passed": count(after, "SHA-256") - count(before, "SHA-256") == 1,
        },
        {
            "name": "Patched source parses as Python without executing project code",
            "passed": True,
        },
    ]
    result = {
        "asset_id": asset.id,
        "scan_id": scan.id,
        "run_id": str(uuid.uuid4()),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "status": "scanner_verified"
        if all(c["passed"] for c in checks)
        else "inconclusive",
        "source_sha256": expected_hash,
        "after_source_sha256": hashlib.sha256(
            plan["after_source"].encode()
        ).hexdigest(),
        "before": before,
        "after": after,
        "checks": checks,
        "diff": plan["diff"],
        "scope": "Only the selected source file in disposable copies. Application tests still required; inventory remains unresolved.",
    }
    result["receipt_sha256"] = hashlib.sha256(
        json.dumps(result, sort_keys=True).encode()
    ).hexdigest()
    return result
