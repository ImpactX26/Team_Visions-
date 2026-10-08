"""Bounded comparison of compatible per-file snapshots; no remediation claims."""
from collections import defaultdict

from fastapi import HTTPException
from sqlalchemy import select

from backend.models.asset import CryptoAssetDB
from backend.models.scan_job import ScanJobDB
from backend.services.scan_identity import CONTRACT, digest

STATUSES = ("added", "changed", "unchanged", "no_longer_observed", "ambiguous", "unknown")
MAX_FINDINGS = 10_000
FIELDS = ("algorithm", "key_size", "category", "usage", "library", "protocol", "evidence_kind",
          "confidence", "conflict", "priority_score", "priority_label", "business_criticality",
          "data_sensitivity", "exposure", "migration_effort", "data_lifetime_years",
          "migration_time_years", "threat_horizon_years", "risk_context_provenance")


def clean_evidence(value):
    if isinstance(value, dict):
        return {key: clean_evidence(item) for key, item in value.items()
                if key not in {"asset_id", "location", "span", "file", "path", "manifest", "line", "line_number",
                               "operation_anchor", "span_anchor", "comparison_anchor", "comparison_file"}}
    if isinstance(value, list):
        return sorted((clean_evidence(item) for item in value), key=digest)
    return value


def key(asset):
    evidence = asset.evidence_json or {}
    file = evidence.get("comparison_file")
    if not file:
        return ("unlocated", asset.id)
    if anchor := evidence.get("comparison_anchor"):
        return ("python_context", file, anchor, asset.evidence_kind, asset.usage)
    return ("evidence_signature", file, asset.algorithm, asset.evidence_kind, asset.usage,
            digest(clean_evidence(evidence.get("evidence_list", []))))


def brief(asset):
    return {"id": asset.id, "algorithm": asset.algorithm, "key_size": asset.key_size,
            "file": (asset.evidence_json or {}).get("comparison_file"),
            "location": asset.location, "span": asset.span or {}, "priority_score": asset.priority_score,
            "review_status": asset.review_status}


def processed(scan, file):
    entry = (scan.comparison_metadata or {}).get("manifest", {}).get(file, {})
    return scan.status == "completed" and entry.get("status") == "processed" and bool(entry.get("sha256"))


def compare_scans(db, baseline_id: int, current_id: int, limit: int, offset: int,
                  status: str | None = None) -> dict:
    if db.get_bind().dialect.name not in {"sqlite", "postgresql"}:
        raise HTTPException(503, "Consistent comparison is unsupported for this database")
    if baseline_id == current_id:
        raise HTTPException(422, "Choose two different scans")
    # One statement snapshots metadata, evidence and editable risk context together.
    rows = db.execute(select(ScanJobDB, CryptoAssetDB)
                      .outerjoin(CryptoAssetDB, CryptoAssetDB.scan_job_id == ScanJobDB.id)
                      .where(ScanJobDB.id.in_([baseline_id, current_id]))
                      .order_by(ScanJobDB.id, CryptoAssetDB.id).limit(2 * MAX_FINDINGS + 1)).all()
    if len(rows) > 2 * MAX_FINDINGS:
        raise HTTPException(413, "Comparison exceeds 10,000 findings per scan; no results were truncated")
    scans = {scan.id: scan for scan, _ in rows}
    if baseline_id not in scans or current_id not in scans:
        raise HTTPException(404, "Comparison scan not found")
    baseline, current = scans[baseline_id], scans[current_id]
    if baseline_id > current_id:
        raise HTTPException(422, "Baseline must precede the current scan")
    for scan in (baseline, current):
        if scan.status not in {"completed", "failed", "cancelled", "timed_out"}:
            raise HTTPException(409, "Wait for both scans to finish")
        metadata = scan.comparison_metadata or {}
        if metadata.get("git_unverified"):
            raise HTTPException(409, "Repository branch metadata is unavailable; comparison refused")
        if metadata.get("identity_consistent") is not True:
            raise HTTPException(409, "Snapshot identity changed during scanning or was not verified; run fresh scans")
        if metadata.get("contract") != CONTRACT or not all(metadata.get(field) for field in
                ("repository_id", "scanner_version", "snapshot_id", "profile")) or not isinstance(metadata.get("manifest"), dict):
            raise HTTPException(409, "Legacy or incomplete identity metadata; run fresh scans to compare reliably")
    left_meta, right_meta = baseline.comparison_metadata, current.comparison_metadata
    for field, message in (("repository_id", "repository"), ("profile", "scan scope/profile"),
                           ("scanner_version", "scanner version"), ("branch", "repository branch")):
        if left_meta.get(field) != right_meta.get(field):
            raise HTTPException(409, f"Incompatible {message}; comparison refused")
    assets: dict[int, list] = {baseline_id: [], current_id: []}
    for scan, asset in rows:
        if asset is not None:
            assets[scan.id].append(asset)
    if len(rows) > 2 * MAX_FINDINGS or any(len(items) > MAX_FINDINGS for items in assets.values()):
        raise HTTPException(413, "Comparison exceeds 10,000 findings per scan; no results were truncated")
    grouped = defaultdict(lambda: [[], []])
    for side, scan_id in enumerate((baseline_id, current_id)):
        for asset in assets[scan_id]:
            grouped[key(asset)][side].append(asset)
    entries = []
    for match_key, (before, after) in sorted(grouped.items(), key=lambda item: str(item[0])):
        file = ((before or after)[0].evidence_json or {}).get("comparison_file")
        changed_fields = []
        if not file or not processed(baseline, file) or not processed(current, file):
            classification = "unknown"
            reason = "The file was not successfully and stably processed in both scans."
        elif len(before) > 1 or len(after) > 1 or any(
                (asset.evidence_json or {}).get("ambiguous") for asset in [*before, *after]):
            classification = "ambiguous"
            reason = "Multiple findings share this context/signature; correspondence is not forced."
        elif before and after:
            same_bytes = left_meta["manifest"][file]["sha256"] == right_meta["manifest"][file]["sha256"]
            if match_key[0] == "evidence_signature" and not same_bytes:
                classification = "unknown"
                reason = "Evidence resembles the baseline, but the edited file has no stable occurrence context."
            else:
                changed_fields = [field for field in FIELDS if getattr(before[0], field) != getattr(after[0], field)]
                if clean_evidence((before[0].evidence_json or {}).get("evidence_list", [])) != clean_evidence((after[0].evidence_json or {}).get("evidence_list", [])):
                    changed_fields.append("evidence")
                classification = "changed" if changed_fields else "unchanged"
                reason = "Unique Python assignment/return context." if match_key[0] == "python_context" else "Unique evidence signature in an unchanged file."
        elif after:
            classification = "added"
            reason = "Observed now; the same file was successfully revisited in both scans."
        else:
            classification = "no_longer_observed"
            reason = "Not observed in the revisited file. This does not verify remediation."
        entries.append({"status": classification, "reason": reason, "file": file,
                        "match_method": match_key[0], "changed_fields": changed_fields,
                        "baseline": [brief(asset) for asset in before],
                        "current": [brief(asset) for asset in after]})
    totals = {name: sum(entry["status"] == name for entry in entries) for name in STATUSES}
    selected = [entry for entry in entries if status is None or entry["status"] == status]
    return {"baseline_id": baseline_id, "current_id": current_id,
            "baseline_snapshot": left_meta["snapshot_id"], "current_snapshot": right_meta["snapshot_id"],
            "contract": CONTRACT, "totals": totals, "total": len(selected),
            "baseline_findings": len(assets[baseline_id]), "current_findings": len(assets[current_id]),
            "items": selected[offset:offset + limit], "limit": limit, "offset": offset,
            "warnings": ["Counts describe comparison groups; ambiguous groups may contain several findings.",
                         "Risk scores and context reflect currently saved values, read together in one database snapshot.",
                         "Review decisions remain attached to their original scan findings.",
                         "Deleted, renamed, excluded or failed files remain unknown; absence is not remediation."]}
