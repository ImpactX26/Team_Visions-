"""Versioned, local repository snapshot and conservative occurrence anchors."""
import ast
import hashlib
import json
import os
import re
import sys
from importlib.metadata import version as package_version
from pathlib import Path
from urllib.parse import quote

from scanner.limits import max_file_bytes, read_bytes

CONTRACT = "ecdat-comparison-v1"


def digest(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()


def relative_file(root: str, location: str) -> str | None:
    # Locations may have a line suffix; Windows drive colons are preserved.
    location = re.sub(r":\d+(?::\d+)?$", "", location)
    if not os.path.isabs(location):
        location = os.path.join(root, location)
    try:
        relative = os.path.relpath(os.path.abspath(location), os.path.abspath(root))
    except ValueError:
        return None
    parts = relative.split(os.sep)
    if any(part in {"", ".", ".."} for part in parts):
        return None
    return "/".join(quote(part, safe="-._~ ") for part in parts)


def scanner_version() -> str:
    root = Path(__file__).resolve().parents[2]
    files = [*sorted((root / "scanner").rglob("*.py"))]
    files += [root / "backend/services" / name for name in
              ("correlator.py", "correlator_v3.py", "confidence.py", "risk_engine.py", "risk_policy.py", "scan_identity.py", "scanner_runner.py")]
    rules = root / "scanner/rules"
    if rules.exists():
        files += sorted(p for p in rules.rglob("*") if p.is_file() and p.suffix in {".json", ".yaml", ".yml"})
    return digest([(str(path.relative_to(root)), hashlib.sha256(path.read_bytes()).hexdigest()) for path in files])


def git_identity(root: str) -> dict:
    """Optional hints only; do not execute repository-controlled Git configuration."""
    scope = Path(root).resolve()
    directory = scope / ".git"
    for candidate in (scope, *scope.parents):
        if (candidate / ".git").exists():
            directory = candidate / ".git"
            break
    if directory.exists() and (not directory.is_dir() or directory.is_symlink()):
        return {"branch": None, "revision": None, "git_unverified": True}
    if not directory.is_dir() or directory.is_symlink():
        return {"branch": None, "revision": None}
    try:
        head = read_bytes(str(directory / "HEAD")).decode("ascii").strip()
        if head.startswith("ref: refs/heads/"):
            reference = head[5:]
            if len(reference) > 256 or ".." in reference.split("/") or not re.fullmatch(r"refs/heads/[\w./-]+", reference):
                return {"branch": None, "revision": None, "git_unverified": True}
            revision_file = directory / reference
            if not revision_file.resolve().is_relative_to(directory.resolve()):
                return {"branch": None, "revision": None, "git_unverified": True}
            revision = read_bytes(str(revision_file)).decode("ascii").strip() if revision_file.is_file() else None
            return {"branch": reference, "revision": revision if revision and re.fullmatch(r"[a-f0-9]{40,64}", revision) else None}
        if not re.fullmatch(r"[a-f0-9]{40,64}", head):
            return {"branch": None, "revision": None, "git_unverified": True}
        return {"branch": "detached", "revision": head}
    except (OSError, UnicodeError):
        return {"branch": None, "revision": None, "git_unverified": True}


def comparison_metadata(root: str, metrics: dict, version: str) -> dict:
    manifest = metrics.get("processing_manifest", {})
    if not isinstance(manifest, dict):
        manifest = {}
    return {
        "contract": CONTRACT,
        "repository_id": digest(os.path.normcase(os.path.realpath(root))),
        "profile": {"name": metrics.get("scan_profile", "unknown"), "max_file_bytes": max_file_bytes(),
                    "python": list(sys.version_info[:3]), "cryptography": package_version("cryptography"),
                    "js_parser": {name: package_version(name) for name in
                                  ("tree-sitter", "tree-sitter-javascript", "tree-sitter-typescript")},
                    "correlator": os.getenv("ECDAT_CORRELATOR_VERSION", "v2")},
        "scanner_version": version,
        "snapshot_id": digest(manifest),
        "manifest": manifest,
        **git_identity(root),
    }


def attach_anchors(root: str, findings: list[dict], metadata: dict) -> None:
    """Unique named Python assignment/return contexts only; duplicates stay ambiguous."""
    by_file: dict[str, list[dict]] = {}
    for finding in findings:
        location = finding.get("location", "")
        relative = relative_file(root, location)
        finding["comparison_file"] = relative
        if relative and metadata["manifest"].get(relative, {}).get("status") == "processed":
            by_file.setdefault(location, []).append(finding)
    for location, group in by_file.items():
        if not location.endswith(".py"):
            continue
        try:
            content = read_bytes(location)
            relative = group[0]["comparison_file"]
            if hashlib.sha256(content).hexdigest() != metadata["manifest"][relative]["sha256"]:
                metadata["manifest"][relative]["status"] = "unknown"
                continue
            tree = ast.parse(content.decode("utf-8", errors="replace"))
            contexts: dict[tuple[int, int], str] = {}

            def walk(node, scope=(), anchor=None, contexts=contexts, relative=relative):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                    scope = (*scope, node.name)
                    anchor = None
                if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
                    anchor = "assign:" + node.targets[0].id
                elif isinstance(node, ast.Return) and scope:
                    anchor = "return"
                if isinstance(node, ast.Call) and anchor:
                    contexts[(node.lineno, node.col_offset)] = digest((relative, scope, anchor))
                for child in ast.iter_child_nodes(node):
                    walk(child, scope, anchor)
            walk(tree)
            for finding in group:
                anchors = {
                    contexts[(span.get("line_start"), span.get("column_start"))]
                    for entry in finding.get("evidence_list", []) if entry.get("source") == "ast"
                    and entry.get("evidence_kind") == "observed_operation"
                    and (span := entry.get("span") or {})
                    and (span.get("line_start"), span.get("column_start")) in contexts
                }
                if len(anchors) == 1:
                    finding["comparison_anchor"] = next(iter(anchors))
        except (OSError, ValueError, SyntaxError, RecursionError):
            continue
    metadata["snapshot_id"] = digest(metadata["manifest"])
