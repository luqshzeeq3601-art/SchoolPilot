import uuid
from datetime import date, datetime, timezone
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException

from app.config import settings
from app.users.models import User, UserRole
from app.leave.models import LeaveRequest, LeaveStatus, LeaveType
from app.mock_hris.models import MockHrisBalance, MockHrisSync, DEMO_DEFAULT_ENTITLEMENTS
from app.mock_hris.router import verify_n8n_service_key
from app.mock_hris.service import (
    sync_payroll_idempotent,
    get_all_user_balances,
    get_or_create_user_balance,
)
from app.contracts.mock_hris import MockHrisSyncRequest
from app.contracts.idempotency import make_payroll_idempotency_key, compute_payload_hash


def test_verify_n8n_service_key():
    # 1. Valid key
    assert verify_n8n_service_key(x_n8n_api_key=settings.N8N_API_KEY) == settings.N8N_API_KEY
    assert verify_n8n_service_key(x_api_key=settings.N8N_API_KEY) == settings.N8N_API_KEY

    # 2. Missing key -> 401
    with pytest.raises(HTTPException) as exc1:
        verify_n8n_service_key(x_n8n_api_key=None, x_api_key=None)
    assert exc1.value.status_code == 401
    assert "Missing required service key" in exc1.value.detail

    # 3. Invalid key -> 401
    with pytest.raises(HTTPException) as exc2:
        verify_n8n_service_key(x_n8n_api_key="wrong_invalid_secret_key_123")
    assert exc2.value.status_code == 401
    assert "Invalid service key" in exc2.value.detail


@pytest.mark.asyncio
async def test_sync_payroll_leave_not_found():
    mock_db = AsyncMock()
    # Mock return None when searching for leave
    mock_execute_result = MagicMock()
    mock_execute_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_execute_result

    req = MockHrisSyncRequest(leave_id=uuid.uuid4(), net_working_days=2)
    with pytest.raises(HTTPException) as exc:
        await sync_payroll_idempotent(
            db=mock_db,
            request=req,
            idempotency_key=make_payroll_idempotency_key(req.leave_id),
            raw_payload=req.model_dump(),
        )
    assert exc.value.status_code == 404
    assert exc.value.detail["code"] == "LEAVE_NOT_FOUND"


@pytest.mark.asyncio
async def test_sync_payroll_leave_not_approved():
    mock_db = AsyncMock()
    leave_id = uuid.uuid4()
    teacher_id = uuid.uuid4()

    pending_leave = LeaveRequest(
        id=leave_id,
        teacher_id=teacher_id,
        leave_type=LeaveType.EMERGENCY,
        start_date=date(2026, 9, 16),
        end_date=date(2026, 9, 17),
        reason="Family matter",
        status=LeaveStatus.PENDING,
    )

    # First query for idempotency sync -> None, second query for LeaveRequest -> pending_leave
    res_sync = MagicMock()
    res_sync.scalar_one_or_none.return_value = None
    res_leave = MagicMock()
    res_leave.scalar_one_or_none.return_value = pending_leave

    mock_db.execute.side_effect = [res_sync, res_leave]

    req = MockHrisSyncRequest(leave_id=leave_id, net_working_days=2)
    with pytest.raises(HTTPException) as exc:
        await sync_payroll_idempotent(
            db=mock_db,
            request=req,
            idempotency_key=make_payroll_idempotency_key(leave_id),
            raw_payload=req.model_dump(),
        )
    assert exc.value.status_code == 400
    assert exc.value.detail["code"] == "LEAVE_NOT_APPROVED"


@pytest.mark.asyncio
async def test_sync_payroll_days_mismatch():
    mock_db = AsyncMock()
    leave_id = uuid.uuid4()
    teacher_id = uuid.uuid4()

    # Wednesday 2026-09-16 to Thursday 2026-09-17 = 2 working days
    approved_leave = LeaveRequest(
        id=leave_id,
        teacher_id=teacher_id,
        leave_type=LeaveType.EMERGENCY,
        start_date=date(2026, 9, 16),
        end_date=date(2026, 9, 17),
        reason="Family matter",
        status=LeaveStatus.APPROVED,
    )

    res_sync = MagicMock()
    res_sync.scalar_one_or_none.return_value = None
    res_leave = MagicMock()
    res_leave.scalar_one_or_none.return_value = approved_leave

    mock_db.execute.side_effect = [res_sync, res_leave]

    # Caller sent net_working_days=5 (mismatch!)
    req = MockHrisSyncRequest(leave_id=leave_id, net_working_days=5)
    with pytest.raises(HTTPException) as exc:
        await sync_payroll_idempotent(
            db=mock_db,
            request=req,
            idempotency_key=make_payroll_idempotency_key(leave_id),
            raw_payload=req.model_dump(),
        )
    assert exc.value.status_code == 422
    assert exc.value.detail["code"] == "DAYS_MISMATCH"


@pytest.mark.asyncio
async def test_sync_payroll_successful_deduction():
    mock_db = AsyncMock()
    leave_id = uuid.uuid4()
    teacher_id = uuid.uuid4()

    approved_leave = LeaveRequest(
        id=leave_id,
        teacher_id=teacher_id,
        leave_type=LeaveType.EMERGENCY,
        start_date=date(2026, 9, 16),
        end_date=date(2026, 9, 17),
        reason="Emergency repair",
        status=LeaveStatus.APPROVED,
    )

    existing_balance = MockHrisBalance(
        id=uuid.uuid4(),
        user_id=teacher_id,
        leave_type=LeaveType.EMERGENCY,
        year=2026,
        entitlement_days=7,
        used_days=1,
    )

    res_sync = MagicMock()
    res_sync.scalar_one_or_none.return_value = None
    res_leave = MagicMock()
    res_leave.scalar_one_or_none.return_value = approved_leave
    res_bal = MagicMock()
    res_bal.scalar_one_or_none.return_value = existing_balance

    mock_db.execute.side_effect = [res_sync, res_leave, res_bal]

    req = MockHrisSyncRequest(leave_id=leave_id, net_working_days=2, n8n_execution_id="exec-101")
    resp = await sync_payroll_idempotent(
        db=mock_db,
        request=req,
        idempotency_key=make_payroll_idempotency_key(leave_id),
        raw_payload=req.model_dump(),
    )

    assert resp.mock is True
    assert resp.status == "synced"
    assert resp.replayed is False
    assert resp.deducted_days == 2
    assert resp.balance_before == 6  # 7 - 1
    assert resp.balance_after == 4   # 7 - 3
    assert existing_balance.used_days == 3


@pytest.mark.asyncio
async def test_sync_payroll_insufficient_balance():
    mock_db = AsyncMock()
    leave_id = uuid.uuid4()
    teacher_id = uuid.uuid4()

    # Mon 2026-09-21 to Fri 2026-09-25 = 5 working days
    approved_leave = LeaveRequest(
        id=leave_id,
        teacher_id=teacher_id,
        leave_type=LeaveType.EMERGENCY,
        start_date=date(2026, 9, 21),
        end_date=date(2026, 9, 25),
        reason="Emergency repairs",
        status=LeaveStatus.APPROVED,
    )

    # Balance only has 2 days available
    existing_balance = MockHrisBalance(
        id=uuid.uuid4(),
        user_id=teacher_id,
        leave_type=LeaveType.EMERGENCY,
        year=2026,
        entitlement_days=7,
        used_days=5,  # 2 remaining
    )

    res_sync = MagicMock()
    res_sync.scalar_one_or_none.return_value = None
    res_leave = MagicMock()
    res_leave.scalar_one_or_none.return_value = approved_leave
    res_bal = MagicMock()
    res_bal.scalar_one_or_none.return_value = existing_balance

    mock_db.execute.side_effect = [res_sync, res_leave, res_bal]

    req = MockHrisSyncRequest(leave_id=leave_id, net_working_days=5)
    with pytest.raises(HTTPException) as exc:
        await sync_payroll_idempotent(
            db=mock_db,
            request=req,
            idempotency_key=make_payroll_idempotency_key(leave_id),
            raw_payload=req.model_dump(),
        )
    assert exc.value.status_code == 400
    assert exc.value.detail["code"] == "INSUFFICIENT_BALANCE"
    assert exc.value.detail["retryable"] is False


@pytest.mark.asyncio
async def test_sync_payroll_idempotent_replay():
    mock_db = AsyncMock()
    leave_id = uuid.uuid4()
    sync_id = uuid.uuid4()
    raw_payload = {"leave_id": str(leave_id), "net_working_days": 2, "n8n_execution_id": "exec-101"}
    req_hash = compute_payload_hash(raw_payload)

    stored_response = {
        "mock": True,
        "integration": "mock_hris_payroll",
        "status": "synced",
        "sync_id": str(sync_id),
        "leave_id": str(leave_id),
        "deducted_days": 2,
        "balance_before": 7,
        "balance_after": 5,
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "replayed": False,
    }

    existing_sync = MockHrisSync(
        id=sync_id,
        idempotency_key=make_payroll_idempotency_key(leave_id),
        leave_id=leave_id,
        request_hash=req_hash,
        status="completed",
        attempt_count=1,
        net_working_days=2,
        balance_before=7,
        balance_after=5,
        stored_response=stored_response,
    )

    res_sync = MagicMock()
    res_sync.scalar_one_or_none.return_value = existing_sync
    mock_db.execute.return_value = res_sync

    req = MockHrisSyncRequest(leave_id=leave_id, net_working_days=2, n8n_execution_id="exec-101")
    resp = await sync_payroll_idempotent(
        db=mock_db,
        request=req,
        idempotency_key=make_payroll_idempotency_key(leave_id),
        raw_payload=raw_payload,
    )

    assert resp.mock is True
    assert resp.replayed is True
    assert resp.sync_id == sync_id
    assert resp.balance_after == 5


@pytest.mark.asyncio
async def test_sync_payroll_payload_mismatch_with_same_key():
    mock_db = AsyncMock()
    leave_id = uuid.uuid4()
    sync_id = uuid.uuid4()

    original_payload = {"leave_id": str(leave_id), "net_working_days": 2}
    original_hash = compute_payload_hash(original_payload)

    existing_sync = MockHrisSync(
        id=sync_id,
        idempotency_key=make_payroll_idempotency_key(leave_id),
        leave_id=leave_id,
        request_hash=original_hash,
        status="completed",
        attempt_count=1,
        net_working_days=2,
        balance_before=7,
        balance_after=5,
        stored_response={},
    )

    res_sync = MagicMock()
    res_sync.scalar_one_or_none.return_value = existing_sync
    mock_db.execute.return_value = res_sync

    # Send changed payload with same idempotency key
    different_payload = {"leave_id": str(leave_id), "net_working_days": 4}
    req = MockHrisSyncRequest(leave_id=leave_id, net_working_days=4)

    with pytest.raises(HTTPException) as exc:
        await sync_payroll_idempotent(
            db=mock_db,
            request=req,
            idempotency_key=make_payroll_idempotency_key(leave_id),
            raw_payload=different_payload,
        )
    assert exc.value.status_code == 422
    assert exc.value.detail["code"] == "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH"


@pytest.mark.asyncio
async def test_get_all_user_balances_default_entitlements():
    mock_db = AsyncMock()
    user_id = uuid.uuid4()

    res_mock = MagicMock()
    res_mock.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = res_mock

    result = await get_all_user_balances(db=mock_db, user_id=user_id, year=2026)

    assert result.mock is True
    assert result.user_id == user_id
    assert result.year == 2026
    assert result.balances["annual"].entitlement_days == 14
    assert result.balances["medical"].entitlement_days == 14
    assert result.balances["emergency"].entitlement_days == 7
    assert result.balances["compassionate"].entitlement_days == 3
    assert result.balances["maternity"].entitlement_days == 98
    assert result.balances["paternity"].entitlement_days == 7
