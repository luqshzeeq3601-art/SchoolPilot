# ADR-006: Database Migrations with Alembic and Automated CI Quality Gates

## Status
Accepted

## Context
Previously, database schemas were created via `Base.metadata.create_all` without version control, preventing safe schema migrations in production. CI checks were unhardened against workflow JSON inconsistencies, leaked credentials, or migration drifts.

## Decision
1. **Alembic Database Version Control**:
   - Initialized Alembic migration environment with async SQLAlchemy engine support.
   - Established deterministic migration chain:
     - `0001_initial_schema`: Base tables (`users`, `documents`, `document_chunks`, `leave_requests`, `audit_logs`).
     - `0002_leave_constraints`: Check constraints for date ordering and minimum reason length.
     - `0003_mock_hris_tables`: Tables for Mock HRIS balances and idempotent payroll sync logs.
   - Added unit test verification for migration revision linearity and metadata integrity.

2. **n8n Workflow Structure & Secret Validation**:
   - Developed `validate_workflows.py` to assert JSON syntax, top-level schema (`name`, `nodes`, `connections`), sub-workflow ID integrity, and absence of hardcoded Telegram credentials or raw secrets.

3. **CI Pipeline Hardening (.github/workflows/ci.yml)**:
   - Configured 3 parallel quality jobs:
     - `backend-quality`: Workflow validation, migration chain testing, and complete pytest execution.
     - `frontend-quality`: TypeScript compilation, Vite production build, and dependency vulnerability auditing.
     - `security-scan`: Automated detection of committed `.env` files or leaked credentials in git index.

## Consequences
- Safe, reproducible database migrations across development, staging, and production environments.
- Continuous prevention of credential leaks and malformed workflow deployments.
- High test coverage and regression protection across all microservices.
