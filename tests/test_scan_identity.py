"""Processing proof and anchors abstain when source identity is uncertain."""
from backend.services.scan_identity import (
    attach_anchors,
    comparison_metadata,
    git_identity,
    scanner_version,
)
from scanner import main as scanner_main


def test_changed_after_processing_file_is_not_a_verified_revisit(tmp_path, monkeypatch):
    first = tmp_path / "a.py"
    second = tmp_path / "b.py"
    first.write_text("import hashlib\nhashlib.md5(b'x')")
    second.write_text("import hashlib\nhashlib.sha256(b'x')")
    original = scanner_main._collect_path
    def modify_after_first(path, *args, **kwargs):
        result = original(path, *args, **kwargs)
        if path.endswith("b.py"):
            first.write_text("# replaced after evidence collection\n")
        return result
    monkeypatch.setattr(scanner_main, "_collect_path", modify_after_first)
    _, metrics = scanner_main.scan_with_metrics(str(tmp_path))
    assert metrics["processing_manifest"]["a.py"]["status"] == "unknown"
    assert metrics["processing_manifest"]["b.py"]["status"] == "processed"


def test_failed_python_file_has_no_processing_proof(tmp_path):
    (tmp_path / "bad.py").write_text("def invalid(")
    _, metrics = scanner_main.scan_with_metrics(str(tmp_path))
    assert metrics["processing_manifest"]["bad.py"]["status"] == "unknown"


def test_git_worktree_metadata_abstains_instead_of_assuming_branch(tmp_path):
    (tmp_path / ".git").write_text("gitdir: ../other/.git/worktrees/worktree")
    assert git_identity(str(tmp_path))["git_unverified"] is True


def test_repeated_assignments_share_anchor_and_remain_ambiguous(tmp_path):
    file = tmp_path / "crypto.py"
    file.write_text("import hashlib\ndef f(x):\n    result = hashlib.md5(x)\n    result = hashlib.sha256(x)\n")
    evidence, metrics = scanner_main.scan_with_metrics(str(tmp_path))
    from backend.services.correlator import correlate
    findings = correlate(evidence)
    metadata = comparison_metadata(str(tmp_path), metrics, scanner_version())
    attach_anchors(str(tmp_path), findings, metadata)
    anchors = [finding["comparison_anchor"] for finding in findings if finding.get("comparison_anchor")]
    assert len(anchors) == 2 and len(set(anchors)) == 1
