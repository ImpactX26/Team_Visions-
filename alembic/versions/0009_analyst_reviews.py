"""Persist analyst decisions separately from scanner evidence."""
import sqlalchemy as sa

from alembic import op

revision = "0009_analyst_reviews"
down_revision = "0008_scan_admission"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("crypto_assets", sa.Column("review_status", sa.String(), nullable=False, server_default="unreviewed"))
    op.add_column("crypto_assets", sa.Column("review_version", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("crypto_assets", sa.Column("reviewed_by", sa.String(), nullable=True))
    op.add_column("crypto_assets", sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("crypto_assets", sa.Column("review_reason", sa.String(2000), nullable=True))
    op.create_table("asset_reviews",
                    sa.Column("id", sa.Integer(), primary_key=True),
                    sa.Column("asset_id", sa.Integer(), sa.ForeignKey("crypto_assets.id", ondelete="CASCADE"), nullable=False),
                    sa.Column("version", sa.Integer(), nullable=False),
                    sa.Column("status", sa.String(), nullable=False),
                    sa.Column("reason", sa.String(2000), nullable=False),
                    sa.Column("reviewer", sa.String(), nullable=False),
                    sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_asset_reviews_asset_id", "asset_reviews", ["asset_id"])


def downgrade():
    op.drop_table("asset_reviews")
    with op.batch_alter_table("crypto_assets") as batch:
        for name in ("review_reason", "reviewed_at", "reviewed_by", "review_version", "review_status"):
            batch.drop_column(name)
