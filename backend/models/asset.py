"""CryptoAsset model — persisted finding from a scan job."""
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
)

from backend.db import Base


class CryptoAssetDB(Base):
    __tablename__ = "crypto_assets"

    id = Column(Integer, primary_key=True, index=True)
    scan_job_id = Column(
        Integer, ForeignKey("scan_jobs.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    algorithm = Column(String, nullable=False, index=True)
    category = Column(String, default="")
    source = Column(JSON, default=list)
    location = Column(String, nullable=False, index=True)
    evidence_json = Column(JSON, default=dict)
    confidence = Column(Float, default=0.0)
    conflict = Column(Boolean, default=False)
    quantum_vulnerable = Column(Boolean, default=False)
    priority_score = Column(Integer, default=0)
    priority_label = Column(String, default="LOW")
    pqc_candidate = Column(String, default="")
    business_criticality = Column(String, default="medium")
    usage = Column(String, default="unknown")
    library = Column(String, default="")
    protocol = Column(String, default="")
    key_size = Column(Integer, nullable=True)
    data_sensitivity = Column(String, default="medium")
    data_lifetime_years = Column(Integer, default=10)
    migration_time_years = Column(Integer, default=3)
    threat_horizon_years = Column(Integer, default=15)
    exposure = Column(String, default="internal")
    migration_effort = Column(String, default="medium")
    risk_reasons = Column(JSON, default=list)
    hybrid_recommended = Column(Boolean, default=False)
    logical_asset_id = Column(String, default="", index=True)
    evidence_kind = Column(String, default="unknown", index=True)
    parser_version = Column(String, default="")
    evidence_quality = Column(String, default="unknown")
    confirmed_use = Column(Boolean, default=False)
    capability_only = Column(Boolean, default=False)
    risk_context_provenance = Column(JSON, default=dict)
    span = Column(JSON, default=dict)
    confidence_reasons = Column(JSON, default=list)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    review_status = Column(String, nullable=False, default="unreviewed", server_default="unreviewed")
    review_version = Column(Integer, nullable=False, default=0, server_default="0")
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_reason = Column(String(2000), nullable=True)

    __table_args__ = (
        Index("ix_crypto_assets_risk", "priority_label"),
        Index("ix_crypto_assets_quantum", "quantum_vulnerable"),
    )


class AssetReviewDB(Base):
    """Append-only analyst decisions, independent of scanner evidence."""

    __tablename__ = "asset_reviews"
    id = Column(Integer, primary_key=True)
    asset_id = Column(Integer, ForeignKey("crypto_assets.id", ondelete="CASCADE"), nullable=False, index=True)
    version = Column(Integer, nullable=False)
    status = Column(String, nullable=False)
    reason = Column(String(2000), nullable=False)
    reviewer = Column(String, nullable=False)
    reviewed_at = Column(DateTime(timezone=True), nullable=False)
