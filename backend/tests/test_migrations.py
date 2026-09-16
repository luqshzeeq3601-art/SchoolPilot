import os
from alembic.config import Config
from alembic.script import ScriptDirectory
from app.database import Base
from app.leave.models import LeaveRequest
import app.users.models  # noqa: F401
import app.documents.models  # noqa: F401
import app.audit.models  # noqa: F401
import app.mock_hris.models  # noqa: F401
from sqlalchemy import CheckConstraint


def test_alembic_config_and_revisions():
    backend_dir = os.path.dirname(os.path.dirname(__file__))
    alembic_ini_path = os.path.join(backend_dir, "alembic.ini")
    assert os.path.exists(alembic_ini_path), "alembic.ini must exist in backend"

    config = Config(alembic_ini_path)
    script = ScriptDirectory.from_config(config)

    # Verify head revision
    heads = script.get_heads()
    assert len(heads) == 1
    assert heads[0] == "0003_mock_hris_tables"

    # Verify revision chain
    rev_0003 = script.get_revision("0003_mock_hris_tables")
    assert rev_0003 is not None
    assert rev_0003.down_revision == "0002_leave_constraints"

    rev_0002 = script.get_revision("0002_leave_constraints")
    assert rev_0002 is not None
    assert rev_0002.down_revision == "0001_initial_schema"

    rev_0001 = script.get_revision("0001_initial_schema")
    assert rev_0001 is not None
    assert rev_0001.down_revision is None


def test_database_metadata_tables_and_constraints():
    table_names = set(Base.metadata.tables.keys())
    expected_tables = {
        "users",
        "documents",
        "document_chunks",
        "leave_requests",
        "audit_logs",
        "mock_hris_balances",
        "mock_hris_syncs",
    }
    assert expected_tables.issubset(table_names), f"Missing tables in metadata: {expected_tables - table_names}"

    # Verify LeaveRequest model check constraints
    leave_table = Base.metadata.tables["leave_requests"]
    check_constraint_names = {
        c.name for c in leave_table.constraints if isinstance(c, CheckConstraint)
    }
    assert "ck_leave_requests_date_order" in check_constraint_names
    assert "ck_leave_requests_reason_len" in check_constraint_names
