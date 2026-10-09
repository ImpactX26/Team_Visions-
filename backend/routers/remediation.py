"""Authenticated preview and write-role verification of a fixed remediation recipe."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from backend.db import SessionLocal
from backend.middleware.rate_limit import limit
from backend.models.asset import CryptoAssetDB
from backend.models.scan_job import ScanJobDB
from backend.security import current_role, ensure_write_role, record_audit
from backend.services.asset_remediation import asset_plan, verify_asset
from backend.services.remediation import preview, rehearse

router = APIRouter(prefix="/api/remediation", tags=["remediation"])


class VerifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")


class AssetVerifyRequest(VerifyRequest):
    integrity_checksum_confirmed: bool


def finding(db, asset_id):
    asset = db.get(CryptoAssetDB, asset_id)
    if asset is None:
        raise HTTPException(404, "Finding not found")
    scan = db.get(ScanJobDB, asset.scan_job_id)
    if scan is None or scan.status != "completed":
        raise HTTPException(409, "A completed source scan is required")
    return asset, scan


@router.get("/assets/{asset_id}/preview")
def get_asset_preview(asset_id: int, role: Annotated[str, Depends(current_role)]):
    with SessionLocal() as db:
        asset, scan = finding(db, asset_id)
        return asset_plan(asset, scan)


@router.post("/assets/{asset_id}/verify")
@limit(threshold=5, window=60)
def verify_asset_recipe(
    request: Request,
    asset_id: int,
    payload: AssetVerifyRequest,
    role: Annotated[str, Depends(current_role)],
):
    ensure_write_role(role)
    if not payload.integrity_checksum_confirmed:
        raise HTTPException(
            422, "Confirm integrity-checksum usage and review compatibility first"
        )
    with SessionLocal() as db:
        asset, scan = finding(db, asset_id)
        try:
            result = verify_asset(asset, scan, payload.source_sha256)
        except ValueError as exc:
            raise HTTPException(409, str(exc)) from exc
    record_audit(
        "remediation.finding_rehearsed",
        f"asset:{asset_id}",
        role,
        {
            "run_id": result["run_id"],
            "status": result["status"],
            "receipt_sha256": result["receipt_sha256"],
        },
    )
    return result


@router.get("/preview")
def get_preview(role: Annotated[str, Depends(current_role)]):
    return preview()


@router.post("/verify")
@limit(threshold=5, window=60)
def verify_recipe(
    request: Request,
    payload: VerifyRequest,
    role: Annotated[str, Depends(current_role)],
):
    ensure_write_role(role)
    try:
        result = rehearse(payload.source_sha256)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    record_audit(
        "remediation.rehearsed",
        f"remediation:{result['run_id']}",
        role,
        {
            "recipe_id": result["recipe_id"],
            "status": result["status"],
            "receipt_sha256": result["receipt_sha256"],
        },
    )
    return result
