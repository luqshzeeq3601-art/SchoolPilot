"""Add canonical integrity check constraints to leave_requests

Revision ID: 0002_leave_constraints
Revises: 0001_initial_schema
Create Date: 2026-09-16 20:31:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0002_leave_constraints"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_leave_requests_date_order",
        "leave_requests",
        "end_date >= start_date",
    )
    op.create_check_constraint(
        "ck_leave_requests_reason_len",
        "leave_requests",
        "length(reason) >= 5 AND length(reason) <= 1000",
    )
    op.create_check_constraint(
        "ck_leave_requests_leave_type",
        "leave_requests",
        "leave_type IN ('emergency', 'medical', 'annual', 'compassionate', 'maternity', 'paternity', 'unpaid')",
    )
    op.create_check_constraint(
        "ck_leave_requests_status",
        "leave_requests",
        "status IN ('pending', 'approved', 'rejected')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_leave_requests_status", "leave_requests", type_="check")
    op.drop_constraint("ck_leave_requests_leave_type", "leave_requests", type_="check")
    op.drop_constraint("ck_leave_requests_reason_len", "leave_requests", type_="check")
    op.drop_constraint("ck_leave_requests_date_order", "leave_requests", type_="check")
