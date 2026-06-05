"""add homepage slides

Revision ID: 002_homepage_slides
Revises: 001_initial
Create Date: 2026-05-24 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "002_homepage_slides"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "homepage_slides",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("subtitle", sa.Text(), nullable=True),
        sa.Column("image_url", sa.String(length=2048), nullable=False),
        sa.Column("cta_text", sa.String(length=100), nullable=True),
        sa.Column("cta_href", sa.String(length=512), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_homepage_slides_sort_enabled",
        "homepage_slides",
        ["is_enabled", "sort_order"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_homepage_slides_sort_enabled", table_name="homepage_slides")
    op.drop_table("homepage_slides")
