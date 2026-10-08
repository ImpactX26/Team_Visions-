"""Retain processing manifests and versioned scan identity."""
import sqlalchemy as sa

from alembic import op

revision = "0010_scan_comparison"
down_revision = "0009_analyst_reviews"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("scan_jobs", sa.Column("comparison_metadata", sa.JSON(), nullable=False, server_default="{}"))


def downgrade():
    with op.batch_alter_table("scan_jobs") as batch:
        batch.drop_column("comparison_metadata")
