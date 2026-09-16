import uuid
from datetime import datetime, timezone
from app.contracts import (
    ExtractionValidationStatus,
    ExtractionValidationError,
    ExtractionValidationResult,
    LeaveApprovalEventType,
    WorkflowErrorAlertPayload,
    MockHrisSyncRequest,
    MockHrisSyncResponse,
    MockHrisErrorDetail,
    MockHrisBalanceItem,
    MockHrisBalanceResponse,
    IDEMPOTENCY_KEY_HEADER,
    N8N_API_KEY_HEADER,
    PAYROLL_IDEMPOTENCY_PREFIX,
    make_payroll_idempotency_key,
    compute_payload_hash,
)
from app.chat.schemas import ChatQueryResponse, Citation, LeaveFields
from app.n8n.schemas import N8nLeaveApprovalPayload


def test_extraction_validation_contract():
    # Valid status
    valid_res = ExtractionValidationResult(
        status=ExtractionValidationStatus.VALID,
        missing_fields=[],
        errors=[],
    )
    assert valid_res.status == "valid"
    assert valid_res.missing_fields == []
    assert len(valid_res.errors) == 0

    # Needs clarification status
    err = ExtractionValidationError(
        field="start_date",
        code="missing_required_field",
        message="Please provide the start date of your leave.",
    )
    clarify_res = ExtractionValidationResult(
        status=ExtractionValidationStatus.NEEDS_CLARIFICATION,
        missing_fields=["start_date"],
        errors=[err],
    )
    assert clarify_res.status == "needs_clarification"
    assert clarify_res.missing_fields == ["start_date"]
    assert clarify_res.errors[0].code == "missing_required_field"


def test_chat_query_response_additive_compatibility():
    # Response without extraction_validation (legacy shape)
    legacy_resp = ChatQueryResponse(
        query="What is annual leave?",
        answer="Annual leave is 14 days.",
        confidence="high",
        citations=[
            Citation(
                source_id=1,
                document_name="Handbook.pdf",
                page_number=3,
                exact_quote="Annual leave entitlement is 14 days.",
            )
        ],
        relevant_policies=["Annual Leave"],
        intent="info_query",
        orchestration_mode="direct_api",
    )
    assert legacy_resp.extraction_validation is None
    assert legacy_resp.detected_leave_fields is None

    # Response with extraction_validation
    val_result = ExtractionValidationResult(
        status=ExtractionValidationStatus.VALID,
        missing_fields=[],
        errors=[],
    )
    extended_resp = ChatQueryResponse(
        query="I need emergency leave tomorrow",
        answer="I have drafted your emergency leave request.",
        confidence="high",
        citations=[],
        relevant_policies=[],
        intent="leave_request",
        detected_leave_fields=LeaveFields(
            leave_type="emergency",
            start_date="2026-09-17",
            end_date="2026-09-17",
            reason="Family emergency",
        ),
        extraction_validation=val_result,
        orchestration_mode="direct_api",
    )
    assert extended_resp.extraction_validation is not None
    assert extended_resp.extraction_validation.status == "valid"
    assert extended_resp.detected_leave_fields.leave_type == "emergency"


def test_events_contract_and_n8n_payload():
    # Test event type enum values
    assert LeaveApprovalEventType.LEAVE_SUBMITTED.value == "leave_submitted"
    assert LeaveApprovalEventType.LEAVE_APPROVED.value == "leave_approved"
    assert LeaveApprovalEventType.LEAVE_REJECTED.value == "leave_rejected"

    # Test N8nLeaveApprovalPayload default event_type
    payload = N8nLeaveApprovalPayload(
        leave_id="test-id",
        teacher_id="teacher-id",
        teacher_name="Cikgu Azman",
        teacher_email="teacher.azman@cempaka.edu.my",
        department="Science & Mathematics",
        leave_type="emergency",
        start_date="2026-09-17",
        end_date="2026-09-17",
        reason="Family matter",
        submitted_at="2026-09-16T12:00:00Z",
    )
    assert payload.event_type == "leave_submitted"

    # Test error alert payload contract
    alert = WorkflowErrorAlertPayload(
        execution_id="12345",
        workflow_id="4rMX4jEzPbqJkQE1",
        workflow_name="SchoolPilot - Leave Request Approval Routing",
        failed_node="Validate & Route Approver",
        error_message="Missing essential leave parameters.",
        timestamp="2026-09-16T12:00:00Z",
    )
    assert alert.execution_id == "12345"
    assert alert.failed_node == "Validate & Route Approver"


def test_mock_hris_contracts():
    leave_id = uuid.uuid4()
    sync_id = uuid.uuid4()
    user_id = uuid.uuid4()

    # Request contract
    req = MockHrisSyncRequest(
        leave_id=leave_id,
        net_working_days=3,
        n8n_execution_id="exec-999",
    )
    assert req.leave_id == leave_id
    assert req.net_working_days == 3
    assert req.n8n_execution_id == "exec-999"

    # Response contract
    res = MockHrisSyncResponse(
        sync_id=sync_id,
        leave_id=leave_id,
        deducted_days=3,
        balance_before=14,
        balance_after=11,
        replayed=False,
    )
    assert res.mock is True
    assert res.integration == "mock_hris_payroll"
    assert res.status == "synced"
    assert res.deducted_days == 3
    assert res.balance_after == 11

    # Error detail contract
    err = MockHrisErrorDetail(
        code="INSUFFICIENT_BALANCE",
        message="Requested 5 days exceeds available 3 days.",
        retryable=False,
    )
    assert err.code == "INSUFFICIENT_BALANCE"
    assert err.retryable is False

    # Balance summary contract
    balance_resp = MockHrisBalanceResponse(
        user_id=user_id,
        year=2026,
        balances={
            "annual": MockHrisBalanceItem(entitlement_days=14, used_days=3, remaining_days=11),
            "medical": MockHrisBalanceItem(entitlement_days=14, used_days=0, remaining_days=14),
            "emergency": MockHrisBalanceItem(entitlement_days=7, used_days=1, remaining_days=6),
        },
    )
    assert balance_resp.mock is True
    assert balance_resp.balances["annual"].remaining_days == 11


def test_idempotency_contracts():
    test_id = uuid.uuid4()
    key = make_payroll_idempotency_key(test_id)
    assert key == f"mock-hris:payroll:v1:{test_id}"
    assert IDEMPOTENCY_KEY_HEADER == "Idempotency-Key"
    assert N8N_API_KEY_HEADER == "X-N8N-API-KEY"

    # Deterministic payload hash
    payload1 = {"leave_id": str(test_id), "net_working_days": 2}
    payload2 = {"net_working_days": 2, "leave_id": str(test_id)}
    assert compute_payload_hash(payload1) == compute_payload_hash(payload2)
