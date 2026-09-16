"""Add mock_hris_balances and mock_hris_syncs tables

Revision ID: 0003_mock_hris_tables
Revises: 0002_leave_constraints
Create Date: 2026-09-16 21:05:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0003_mock_hris_tables"
down_revision: Union[str, None] = "0002_leave_constraints"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create mock_hris_balances table
    op.create_table(
        "mock_hris_balances",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("leave_type", sa.Enum("emergency", "medical", "annual", "compassionate", "maternity", "paternity", "unpaid", name="leave_type", native_enum=False), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("entitlement_days", sa.Integer(), nullable=False),
        sa.Column("used_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_mock_hris_balances_user_id", "mock_hris_balances", ["user_id"])
    op.create_unique_constraint(
        "uq_mock_hris_balances_user_type_year",
        "mock_hris_balances",
        ["user_id", "leave_type", "year"],
    )
    op.create_check_constraint(
        "ck_mock_hris_balances_entitlement_nonneg",
        "mock_hris_balances",
        "entitlement_days >= 0",
    )
    op.create_check_constraint(
        "ck_mock_hris_balances_used_nonneg",
        "mock_hris_balances",
        "used_days >= 0",
    )

    # 2. Create mock_hris_syncs table
    op.create_table(
        "mock_hris_syncs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("idempotency_key", sa.String(length=255), nullable=False),
        sa.Column("leave_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("leave_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="completed"),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("net_working_days", sa.Integer(), nullable=False),
        sa.Column("balance_before", sa.Integer(), nullable=False),
        sa.Column("balance_after", sa.Integer(), nullable=False),
        sa.Column("stored_response", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("error_code", sa.String(length=100), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("n8n_execution_id", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_mock_hris_syncs_idempotency_key", "mock_hris_syncs", ["idempotency_key"], unique=True)
    op.create_index("ix_mock_hris_syncs_leave_id", "mock_hris_syncs", ["leave_id"])


def downgrade() -> None:
    op.drop_table("mock_hris_syncs")
    op.drop_table("mock_hris_balances")
