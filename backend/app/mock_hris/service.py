import uuid
from datetime import datetime, timezone, date
from typing import Any, Dict, Optional
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.leave.models import LeaveRequest, LeaveStatus, LeaveType
from app.leave.working_days import calculate_working_days
from app.mock_hris.models import MockHrisBalance, MockHrisSync, DEMO_DEFAULT_ENTITLEMENTS
from app.contracts.mock_hris import (
    MockHrisSyncRequest,
    MockHrisSyncResponse,
    MockHrisBalanceItem,
    MockHrisBalanceResponse,
)
from app.contracts.idempotency import compute_payload_hash
from app.audit.logger import log_audit_event
from app.audit.models import AuditAction


async def get_or_create_user_balance(
    db: AsyncSession, user_id: uuid.UUID, leave_type: LeaveType, year: int, for_update: bool = False
) -> MockHrisBalance:
    """Fetch user balance row with optional row-level lock or initialize default entitlement."""
    stmt = select(MockHrisBalance).where(
        MockHrisBalance.user_id == user_id,
        MockHrisBalance.leave_type == leave_type,
        MockHrisBalance.year == year,
    )
    if for_update:
        stmt = stmt.with_for_update()

    balance = (await db.execute(stmt)).scalar_one_or_none()
    if balance is None:
        entitlement = DEMO_DEFAULT_ENTITLEMENTS.get(leave_type, 0)
        balance = MockHrisBalance(
            user_id=user_id,
            leave_type=leave_type,
            year=year,
            entitlement_days=entitlement,
            used_days=0,
        )
        db.add(balance)
        await db.flush()
    return balance


async def get_all_user_balances(
    db: AsyncSession, user_id: uuid.UUID, year: Optional[int] = None
) -> MockHrisBalanceResponse:
    """Retrieve all leave type balances for a given user and calendar year."""
    target_year = year or date.today().year
    balances_map: Dict[str, MockHrisBalanceItem] = {}

    for lt in LeaveType:
        bal = await get_or_create_user_balance(db, user_id, lt, target_year, for_update=False)
        remaining = bal.entitlement_days - bal.used_days if lt != LeaveType.UNPAID else 999
        balances_map[lt.value] = MockHrisBalanceItem(
            entitlement_days=bal.entitlement_days,
            used_days=bal.used_days,
            remaining_days=remaining,
        )

    return MockHrisBalanceResponse(
        user_id=user_id,
        year=target_year,
        balances=balances_map,
        mock=True,
    )


async def sync_payroll_idempotent(
    db: AsyncSession,
    request: MockHrisSyncRequest,
    idempotency_key: str,
    raw_payload: Dict[str, Any],
    client_ip: Optional[str] = None,
) -> MockHrisSyncResponse:
    """
    Authoritative, idempotent payroll deduction simulation for approved leave.
    Atomically handles key locking, balance check, deduction, and replay caching.
    """
    request_hash = compute_payload_hash(raw_payload)

    # 1. Check existing idempotency key with row lock
    stmt_sync = select(MockHrisSync).where(
        MockHrisSync.idempotency_key == idempotency_key
    ).with_for_update()
    existing_sync = (await db.execute(stmt_sync)).scalar_one_or_none()

    if existing_sync is not None:
        # Same key but changed body -> 422 Unprocessable Entity
        if existing_sync.request_hash != request_hash:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH",
                    "message": "Idempotency key was previously used with a different request payload.",
                    "retryable": False,
                },
            )

        # Successful previous sync -> Replay stored result
        if existing_sync.status == "completed" and existing_sync.stored_response:
            stored = dict(existing_sync.stored_response)
            stored["replayed"] = True
            return MockHrisSyncResponse.model_validate(stored)

        # Permanent previous failure
        if existing_sync.status == "failed":
            raise HTTPException(
                status_code=400,
                detail={
                    "code": existing_sync.error_code or "PREVIOUS_SYNC_FAILED",
                    "message": existing_sync.error_message or "Previous sync attempt failed permanently.",
                    "retryable": False,
                },
            )

    # 2. Fetch authoritative leave record from PostgreSQL
    stmt_leave = select(LeaveRequest).where(LeaveRequest.id == request.leave_id)
    leave = (await db.execute(stmt_leave)).scalar_one_or_none()

    if leave is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "LEAVE_NOT_FOUND",
                "message": f"Leave request '{request.leave_id}' was not found in the primary database.",
                "retryable": False,
            },
        )

    if leave.status != LeaveStatus.APPROVED:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "LEAVE_NOT_APPROVED",
                "message": f"Leave request must be 'approved' before syncing with payroll. Current status: '{leave.status.value}'.",
                "retryable": False,
            },
        )

    # 3. Verify net working days against authoritative backend calculation
    expected_working_days = calculate_working_days(leave.start_date, leave.end_date)
    if request.net_working_days != expected_working_days:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "DAYS_MISMATCH",
                "message": f"Provided net_working_days ({request.net_working_days}) does not match authoritative calculated working days ({expected_working_days}).",
                "retryable": False,
            },
        )

    # 4. Lock balance row and perform deduction
    leave_year = leave.start_date.year
    balance = await get_or_create_user_balance(
        db=db,
        user_id=leave.teacher_id,
        leave_type=leave.leave_type,
        year=leave_year,
        for_update=True,
    )

    balance_before = balance.entitlement_days - balance.used_days
    deducted_days = 0

    if leave.leave_type == LeaveType.UNPAID:
        # Unpaid leave does not decrement paid balance
        deducted_days = 0
        balance_after = balance_before
    else:
        if balance_before < expected_working_days:
            # Record failed sync attempt
            failed_sync = MockHrisSync(
                idempotency_key=idempotency_key,
                leave_id=leave.id,
                request_hash=request_hash,
                status="failed",
                attempt_count=1,
                net_working_days=expected_working_days,
                balance_before=balance_before,
                balance_after=balance_before,
                stored_response={},
                error_code="INSUFFICIENT_BALANCE",
                error_message=f"Insufficient balance. Available: {balance_before} days, required: {expected_working_days} days.",
                n8n_execution_id=request.n8n_execution_id,
            )
            db.add(failed_sync)
            await db.commit()

            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INSUFFICIENT_BALANCE",
                    "message": f"Insufficient {leave.leave_type.value} leave balance. Available: {balance_before} days, required: {expected_working_days} days.",
                    "retryable": False,
                },
            )

        balance.used_days += expected_working_days
        deducted_days = expected_working_days
        balance_after = balance.entitlement_days - balance.used_days

    # 5. Create sync record and audit event
    sync_id = uuid.uuid4()
    now_utc = datetime.now(timezone.utc)

    response_data = {
        "mock": True,
        "integration": "mock_hris_payroll",
        "status": "synced",
        "sync_id": str(sync_id),
        "leave_id": str(leave.id),
        "deducted_days": deducted_days,
        "balance_before": balance_before,
        "balance_after": balance_after,
        "processed_at": now_utc.isoformat(),
        "replayed": False,
    }

    sync_record = MockHrisSync(
        id=sync_id,
        idempotency_key=idempotency_key,
        leave_id=leave.id,
        request_hash=request_hash,
        status="completed",
        attempt_count=1,
        net_working_days=expected_working_days,
        balance_before=balance_before,
        balance_after=balance_after,
        stored_response=response_data,
        n8n_execution_id=request.n8n_execution_id,
    )
    db.add(sync_record)

    await log_audit_event(
        db=db,
        action=AuditAction.MOCK_HRIS_SYNC,
        resource_type="mock_hris_payroll",
        resource_id=str(sync_id),
        user_id=leave.teacher_id,
        user_email=leave.teacher.email if leave.teacher else None,
        details={
            "leave_id": str(leave.id),
            "leave_type": leave.leave_type.value,
            "deducted_days": deducted_days,
            "balance_before": balance_before,
            "balance_after": balance_after,
            "idempotency_key": idempotency_key,
            "n8n_execution_id": request.n8n_execution_id,
        },
        ip_address=client_ip,
    )

    await db.commit()

    return MockHrisSyncResponse(
        mock=True,
        integration="mock_hris_payroll",
        status="synced",
        sync_id=sync_id,
        leave_id=leave.id,
        deducted_days=deducted_days,
        balance_before=balance_before,
        balance_after=balance_after,
        processed_at=now_utc,
        replayed=False,
    )
