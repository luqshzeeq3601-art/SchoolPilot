"""Data contracts for SchoolPilot automation, validation, resilience, and mock HRIS."""

from app.contracts.extraction import (
    ExtractionValidationStatus,
    ExtractionValidationError,
    ExtractionValidationResult,
)
from app.contracts.events import (
    LeaveApprovalEventType,
    WorkflowErrorAlertPayload,
)
from app.contracts.mock_hris import (
    MockHrisSyncRequest,
    MockHrisSyncResponse,
    MockHrisErrorDetail,
    MockHrisBalanceItem,
    MockHrisBalanceResponse,
)
from app.contracts.idempotency import (
    IDEMPOTENCY_KEY_HEADER,
    N8N_API_KEY_HEADER,
    PAYROLL_IDEMPOTENCY_PREFIX,
    make_payroll_idempotency_key,
    compute_payload_hash,
)

__all__ = [
    "ExtractionValidationStatus",
    "ExtractionValidationError",
    "ExtractionValidationResult",
    "LeaveApprovalEventType",
    "WorkflowErrorAlertPayload",
    "MockHrisSyncRequest",
    "MockHrisSyncResponse",
    "MockHrisErrorDetail",
    "MockHrisBalanceItem",
    "MockHrisBalanceResponse",
    "IDEMPOTENCY_KEY_HEADER",
    "N8N_API_KEY_HEADER",
    "PAYROLL_IDEMPOTENCY_PREFIX",
    "make_payroll_idempotency_key",
    "compute_payload_hash",
]
