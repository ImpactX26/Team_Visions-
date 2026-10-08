"""Bounded inventory-property export from one database statement snapshot."""
import hashlib
import json
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select

from backend.models.asset import CryptoAssetDB
from backend.models.scan_job import ScanJobDB
from backend.schemas.asset import AssetResponse
from backend.services.cbom_schema import validate_cbom
from scanner.redaction import redact_evidence

MAX_EXPORT_ASSETS = 10_000
MAX_EXPORT_BYTES = 32 * 1024 * 1024


def _properties(values: dict) -> list[dict[str, str]]:
    values = redact_evidence(values)
    return [{"name": name, "value": json.dumps(value, sort_keys=True, ensure_ascii=False)
             if isinstance(value, (dict, list, bool)) else str(value)}
            for name, value in values.items() if value is not None]


def export_cbom(db, scan_id: int | None) -> tuple[bytes, int, str]:
    # A single SELECT includes scan metadata, full asset rows and risk context.
    # SQLite/PostgreSQL statement snapshots cannot mix independently read pages.
    # Unsupported database dialects fail rather than promise unverified isolation.
    if db.get_bind().dialect.name not in {"sqlite", "postgresql"}:
        raise HTTPException(503, "Consistent CBOM export is unsupported for this database")
    selector = scan_id if scan_id is not None else (
        select(ScanJobDB.id).where(ScanJobDB.status == "completed")
        .order_by(ScanJobDB.id.desc()).limit(1).scalar_subquery()
    )
    rows = db.execute(
        select(ScanJobDB, CryptoAssetDB)
        .outerjoin(CryptoAssetDB, CryptoAssetDB.scan_job_id == ScanJobDB.id)
        .where(ScanJobDB.id == selector)
        .order_by(CryptoAssetDB.id.asc()).limit(MAX_EXPORT_ASSETS + 1)
    ).all()
    if not rows:
        raise HTTPException(404, "No completed scan found")
    scan = rows[0][0]
    if scan.status != "completed":
        raise HTTPException(409, "Scan is not complete")
    assets = [asset for _, asset in rows if asset is not None]
    if len(assets) > MAX_EXPORT_ASSETS:
        raise HTTPException(413, f"Complete CBOM export exceeds {MAX_EXPORT_ASSETS:,} findings")
    components = []
    for asset in assets:
        values = AssetResponse.model_validate(asset).model_dump(mode="json")
        values.pop("id")
        values.pop("scan_job_id")
        # Preserve the structured finding as properties, with raw source/secret
        # content conservatively redacted. This is not native cryptoProperties.
        components.append({"type": "library", "bom-ref": f"ecdat:asset:{asset.id}",
                           "name": asset.algorithm,
                           "properties": _properties({f"ecdat:asset:{key}": value
                                                       for key, value in values.items()})})
    document = redact_evidence({
        "$schema": "https://cyclonedx.org/schema/bom-1.6.schema.json",
        "bomFormat": "CycloneDX", "specVersion": "1.6",
        "serialNumber": f"urn:uuid:{uuid4()}", "version": 1,
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "tools": {"components": [{"type": "application", "name": "ECDAT", "version": "1.0.0"}]},
            "properties": _properties({
                "ecdat:scan:id": scan.id, "ecdat:repository:path": scan.repo_path,
                "ecdat:scan:result-version": scan.result_version,
                "ecdat:scan:coverage-percent": scan.coverage_pct,
                "ecdat:scan:in-scope-files": scan.in_scope_files,
                "ecdat:scan:scanned-files": scan.scanned_files,
                "ecdat:scan:failed-files": scan.failed_files,
                "ecdat:scan:blind-spots": scan.blind_spots or [],
                "ecdat:export:findings": len(assets),
                "ecdat:export:mapping": "ECDAT inventory properties; not native cryptographic-asset semantics",
                "ecdat:export:consistency": "single database statement snapshot including risk context",
            }),
        }, "components": components,
    })
    content = json.dumps(document, ensure_ascii=False, allow_nan=False).encode("utf-8")
    if len(content) > MAX_EXPORT_BYTES:
        raise HTTPException(413, "Complete CBOM export exceeds 32 MiB")
    errors = validate_cbom(document)
    if errors:
        raise HTTPException(500, "Generated CBOM failed pinned schema validation")
    return content, len(assets), hashlib.sha256(content).hexdigest()
