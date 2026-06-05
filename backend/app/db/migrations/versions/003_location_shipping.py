"""add address and shop coordinates for distance shipping

Revision ID: 003_location_shipping
Revises: 002_homepage_slides
Create Date: 2026-05-31 00:00:00.000000
"""

from alembic import op


revision = "003_location_shipping"
down_revision = "002_homepage_slides"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7)")
    op.execute("ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7)")
    op.execute("ALTER TABLE shops ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7)")
    op.execute("ALTER TABLE shops ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7)")


def downgrade() -> None:
    op.execute("ALTER TABLE shops DROP COLUMN IF EXISTS longitude")
    op.execute("ALTER TABLE shops DROP COLUMN IF EXISTS latitude")
    op.execute("ALTER TABLE user_addresses DROP COLUMN IF EXISTS longitude")
    op.execute("ALTER TABLE user_addresses DROP COLUMN IF EXISTS latitude")
