import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.users.models import User, UserRole
from app.leave.models import LeaveRequest, LeaveStatus, LeaveType
from app.leave.schemas import (
    LeaveCreateRequest,
    LeaveUpdateRequest,
    LeaveReviewRequest,
    LeaveResponse,
    LeaveSummaryResponse,
    N8nStatusCallback,
)
from app.auth.dependencies import get_current_user, require_roles, verify_n8n_webhook_auth
from app.n8n.client import trigger_n8n_leave_approval
from app.n8n.schemas import N8nLeaveApprovalPayload
from app.contracts.events import LeaveApprovalEventType
from app.audit.logger import log_audit_event
from app.audit.models import AuditAction


router = APIRouter(prefix="/leave", tags=["Leave Workflows"])


def build_leave_response(lr: LeaveRequest, reviewer_override: Optional[User] = None) -> LeaveResponse:
    reviewer = reviewer_override if reviewer_override is not None else getattr(lr, "reviewer", None)
    reviewer_name = reviewer.full_name if reviewer else None
    return LeaveResponse(
        id=lr.id,
        teacher_id=lr.teacher_id,
        teacher_name=lr.teacher.full_name if lr.teacher else None,
        teacher_email=lr.teacher.email if lr.teacher else None,
        teacher_department=lr.teacher.department if lr.teacher else None,
        leave_type=lr.leave_type,
        start_date=lr.start_date,
        end_date=lr.end_date,
        reason=lr.reason,
        covering_teacher=lr.covering_teacher,
        status=lr.status,
        submitted_at=lr.submitted_at,
        reviewed_by=lr.reviewed_by,
        reviewer_name=reviewer_name,
        reviewed_at=lr.reviewed_at,
        review_notes=lr.review_notes,
    )


def validate_hod_authorization(leave_rec: LeaveRequest, current_user: User):
    """Ensure HoDs only review requests from their own department and cannot self-approve."""
    if current_user.role == UserRole.HOD:
        if leave_rec.teacher_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="HoD cannot approve or reject their own leave application. Institutional admin approval required.",
            )
        if leave_rec.teacher and leave_rec.teacher.department != current_user.department:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"HoD cannot review leave for staff in '{leave_rec.teacher.department}'. Restricted to '{current_user.department}'.",
            )


@router.post("/request", response_model=LeaveResponse, status_code=status.HTTP_201_CREATED)
async def submit_leave_request(
    data: LeaveCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    leave_rec = LeaveRequest(
        teacher_id=current_user.id,
        leave_type=data.leave_type,
        start_date=data.start_date,
        end_date=data.end_date,
        reason=data.reason,
        covering_teacher=data.covering_teacher,
        status=LeaveStatus.PENDING,
    )
    db.add(leave_rec)
    await db.flush()

    # Trigger n8n approval automation workflow in background
    n8n_payload = N8nLeaveApprovalPayload(
        leave_id=str(leave_rec.id),
        teacher_id=str(current_user.id),
        teacher_name=current_user.full_name,
        teacher_email=current_user.email,
        department=current_user.department,
        leave_type=leave_rec.leave_type.value,
        start_date=leave_rec.start_date.isoformat(),
        end_date=leave_rec.end_date.isoformat(),
        reason=leave_rec.reason,
        covering_teacher=leave_rec.covering_teacher,
        submitted_at=leave_rec.submitted_at.isoformat(),
    )
    await trigger_n8n_leave_approval(n8n_payload)

    # Audit logging
    await log_audit_event(
        db=db,
        action=AuditAction.LEAVE_SUBMITTED,
        resource_type="leave_request",
        resource_id=str(leave_rec.id),
        user_id=current_user.id,
        user_email=current_user.email,
        details={
            "leave_type": leave_rec.leave_type.value,
            "start_date": leave_rec.start_date.isoformat(),
            "end_date": leave_rec.end_date.isoformat(),
            "covering_teacher": leave_rec.covering_teacher,
        },
    )
    await db.commit()

    # Re-fetch with relationship loaded
    stmt = (
        select(LeaveRequest)
        .options(selectinload(LeaveRequest.teacher), selectinload(LeaveRequest.reviewer))
        .where(LeaveRequest.id == leave_rec.id)
    )
    reloaded = (await db.execute(stmt)).scalar_one()
    return build_leave_response(reloaded)


@router.get("/", response_model=List[LeaveResponse])
async def list_leave_requests(
    status_filter: Optional[LeaveStatus] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(LeaveRequest)
        .options(selectinload(LeaveRequest.teacher), selectinload(LeaveRequest.reviewer))
        .order_by(desc(LeaveRequest.submitted_at))
    )

    if current_user.role == UserRole.TEACHER:
        stmt = stmt.where(LeaveRequest.teacher_id == current_user.id)
    elif current_user.role == UserRole.HOD:
        # HoD sees requests from teachers in their own department
        stmt = stmt.join(User, LeaveRequest.teacher_id == User.id).where(
            User.department == current_user.department
        )
    # Admin sees all records

    if status_filter:
        stmt = stmt.where(LeaveRequest.status == status_filter)

    result = await db.execute(stmt)
    records = result.scalars().all()
    return [build_leave_response(r) for r in records]


@router.patch("/{leave_id}/approve", response_model=LeaveResponse)
async def approve_leave_request(
    leave_id: uuid.UUID,
    review_data: Optional[LeaveReviewRequest] = None,
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HOD])),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(LeaveRequest)
        .options(selectinload(LeaveRequest.teacher), selectinload(LeaveRequest.reviewer))
        .where(LeaveRequest.id == leave_id)
    )
    leave_rec = (await db.execute(stmt)).scalar_one_or_none()
    if not leave_rec:
        raise HTTPException(status_code=404, detail="Leave request not found")

    if leave_rec.status != LeaveStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Only pending requests can be approved (current status: {leave_rec.status.value}).",
        )

    validate_hod_authorization(leave_rec, current_user)

    leave_rec.status = LeaveStatus.APPROVED
    leave_rec.reviewed_by = current_user.id
    leave_rec.reviewed_at = datetime.now(timezone.utc)
    if review_data and review_data.notes:
        leave_rec.review_notes = review_data.notes.strip()

    await log_audit_event(
        db=db,
        action=AuditAction.LEAVE_APPROVED,
        resource_type="leave_request",
        resource_id=str(leave_id),
        user_id=current_user.id,
        user_email=current_user.email,
        details={"status": "approved", "notes": leave_rec.review_notes},
    )
    await db.commit()

    # Re-fetch with relationships loaded
    reload_stmt = (
        select(LeaveRequest)
        .options(selectinload(LeaveRequest.teacher), selectinload(LeaveRequest.reviewer))
        .where(LeaveRequest.id == leave_id)
    )
    reloaded = (await db.execute(reload_stmt)).scalar_one()

    # Trigger n8n leave approved event (for subworkflow HRIS payroll sync) after DB commit
    teacher = reloaded.teacher
    n8n_payload = N8nLeaveApprovalPayload(
        event_type=LeaveApprovalEventType.LEAVE_APPROVED.value,
        leave_id=str(reloaded.id),
        teacher_id=str(reloaded.teacher_id),
        teacher_name=teacher.full_name if teacher else "Unknown",
        teacher_email=teacher.email if teacher else "unknown@school.edu",
        department=teacher.department if teacher else "General",
        leave_type=reloaded.leave_type.value,
        start_date=reloaded.start_date.isoformat(),
        end_date=reloaded.end_date.isoformat(),
        reason=reloaded.reason,
        covering_teacher=reloaded.covering_teacher,
        submitted_at=reloaded.submitted_at.isoformat(),
    )
    await trigger_n8n_leave_approval(n8n_payload)

    return build_leave_response(reloaded, reviewer_override=current_user)


@router.patch("/{leave_id}/reject", response_model=LeaveResponse)
async def reject_leave_request(
    leave_id: uuid.UUID,
    review_data: LeaveReviewRequest,
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HOD])),
    db: AsyncSession = Depends(get_db),
):
    if not review_data.notes or not review_data.notes.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A specific reason or note is required when rejecting a leave application.",
        )

    stmt = (
        select(LeaveRequest)
        .options(selectinload(LeaveRequest.teacher), selectinload(LeaveRequest.reviewer))
        .where(LeaveRequest.id == leave_id)
    )
    leave_rec = (await db.execute(stmt)).scalar_one_or_none()
    if not leave_rec:
        raise HTTPException(status_code=404, detail="Leave request not found")

    if leave_rec.status != LeaveStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Only pending requests can be rejected (current status: {leave_rec.status.value}).",
        )

    validate_hod_authorization(leave_rec, current_user)

    leave_rec.status = LeaveStatus.REJECTED
    leave_rec.reviewed_by = current_user.id
    leave_rec.reviewed_at = datetime.now(timezone.utc)
    leave_rec.review_notes = review_data.notes.strip()

    await log_audit_event(
        db=db,
        action=AuditAction.LEAVE_REJECTED,
        resource_type="leave_request",
        resource_id=str(leave_id),
        user_id=current_user.id,
        user_email=current_user.email,
        details={"status": "rejected", "notes": leave_rec.review_notes},
    )
    await db.commit()
    await db.refresh(leave_rec)
    return build_leave_response(leave_rec, reviewer_override=current_user)


@router.get("/summary", response_model=LeaveSummaryResponse)
async def get_leave_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Calculate leave day usage and entitlement stats for the current user."""
    current_year = datetime.now(timezone.utc).year
    stmt = select(LeaveRequest).where(LeaveRequest.teacher_id == current_user.id)
    result = await db.execute(stmt)
    records = result.scalars().all()

    annual_used = 0
    medical_used = 0
    emergency_used = 0
    pending_count = 0
    approved_count = 0
    rejected_count = 0

    for lr in records:
        if lr.status == LeaveStatus.PENDING:
            pending_count += 1
        elif lr.status == LeaveStatus.APPROVED:
            approved_count += 1
            # Clip multi-year spans to the current year so cross-year leave
            # is not over-counted in a single year's entitlement.
            year_start = datetime(current_year, 1, 1, tzinfo=timezone.utc).date()
            year_end = datetime(current_year, 12, 31, tzinfo=timezone.utc).date()
            clipped_start = max(lr.start_date, year_start)
            clipped_end = min(lr.end_date, year_end)
            if clipped_end >= clipped_start:
                days = (clipped_end - clipped_start).days + 1
                if lr.leave_type == LeaveType.ANNUAL:
                    annual_used += days
                elif lr.leave_type == LeaveType.MEDICAL:
                    medical_used += days
                elif lr.leave_type == LeaveType.EMERGENCY:
                    emergency_used += days
        elif lr.status == LeaveStatus.REJECTED:
            rejected_count += 1

    return LeaveSummaryResponse(
        annual_used=annual_used,
        annual_total=14,
        medical_used=medical_used,
        medical_total=14,
        emergency_used=emergency_used,
        emergency_total=7,
        pending_count=pending_count,
        approved_count=approved_count,
        rejected_count=rejected_count,
    )


@router.get("/{leave_id}", response_model=LeaveResponse)
async def get_leave_request(
    leave_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve details for a single leave request."""
    stmt = (
        select(LeaveRequest)
        .options(selectinload(LeaveRequest.teacher), selectinload(LeaveRequest.reviewer))
        .where(LeaveRequest.id == leave_id)
    )
    leave_rec = (await db.execute(stmt)).scalar_one_or_none()
    if not leave_rec:
        raise HTTPException(status_code=404, detail="Leave request not found")

    if current_user.role == UserRole.TEACHER and leave_rec.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this leave request")
    elif (
        current_user.role == UserRole.HOD
        and leave_rec.teacher
        and leave_rec.teacher.department != current_user.department
    ):
        raise HTTPException(
            status_code=403, detail="Not authorized to view leave request from another department"
        )

    return build_leave_response(leave_rec)


@router.put("/{leave_id}", response_model=LeaveResponse)
async def update_leave_request(
    leave_id: uuid.UUID,
    data: LeaveUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a pending leave application or resubmit a rejected application."""
    stmt = (
        select(LeaveRequest)
        .options(selectinload(LeaveRequest.teacher), selectinload(LeaveRequest.reviewer))
        .where(LeaveRequest.id == leave_id)
    )
    leave_rec = (await db.execute(stmt)).scalar_one_or_none()
    if not leave_rec:
        raise HTTPException(status_code=404, detail="Leave request not found")

    # Only owner or admin can edit
    if current_user.role != UserRole.ADMIN and leave_rec.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this leave application")

    if leave_rec.status == LeaveStatus.APPROVED:
        raise HTTPException(
            status_code=400,
            detail="Approved leave applications cannot be modified directly. Please contact administration.",
        )

    # Apply updates
    if data.leave_type is not None:
        leave_rec.leave_type = data.leave_type
    if data.start_date is not None:
        leave_rec.start_date = data.start_date
    if data.end_date is not None:
        leave_rec.end_date = data.end_date
    if data.reason is not None:
        leave_rec.reason = data.reason.strip()
    if data.covering_teacher is not None:
        leave_rec.covering_teacher = data.covering_teacher.strip() or None

    if leave_rec.end_date < leave_rec.start_date:
        raise HTTPException(status_code=422, detail="End date cannot be earlier than start date")

    was_rejected = leave_rec.status == LeaveStatus.REJECTED
    if was_rejected:
        # Reset rejected back to pending upon resubmission
        leave_rec.status = LeaveStatus.PENDING
        leave_rec.submitted_at = datetime.now(timezone.utc)
        leave_rec.reviewed_by = None
        leave_rec.reviewed_at = None
        leave_rec.review_notes = None

    await log_audit_event(
        db=db,
        action=AuditAction.LEAVE_UPDATED,
        resource_type="leave_request",
        resource_id=str(leave_id),
        user_id=current_user.id,
        user_email=current_user.email,
        details={
            "was_resubmission": was_rejected,
            "leave_type": leave_rec.leave_type.value,
            "start_date": leave_rec.start_date.isoformat(),
            "end_date": leave_rec.end_date.isoformat(),
            "covering_teacher": leave_rec.covering_teacher,
        },
    )
    await db.commit()
    await db.refresh(leave_rec)
    return build_leave_response(leave_rec)


@router.delete("/{leave_id}", status_code=status.HTTP_200_OK)
async def delete_leave_request(
    leave_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Withdraw and delete a pending leave request."""
    stmt = select(LeaveRequest).where(LeaveRequest.id == leave_id)
    leave_rec = (await db.execute(stmt)).scalar_one_or_none()
    if not leave_rec:
        raise HTTPException(status_code=404, detail="Leave request not found")

    if current_user.role != UserRole.ADMIN and leave_rec.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this leave application")

    if leave_rec.status == LeaveStatus.APPROVED:
        raise HTTPException(
            status_code=400,
            detail="Approved leave applications cannot be deleted. Please request cancellation through administration.",
        )

    await db.delete(leave_rec)
    await log_audit_event(
        db=db,
        action=AuditAction.LEAVE_DELETED,
        resource_type="leave_request",
        resource_id=str(leave_id),
        user_id=current_user.id,
        user_email=current_user.email,
        details={"deleted_leave_id": str(leave_id)},
    )
    await db.commit()
    return {"status": "success", "message": "Leave application withdrawn and deleted"}


@router.post("/webhook/status", status_code=status.HTTP_200_OK)
async def n8n_status_callback(
    callback: N8nStatusCallback,
    authenticated: bool = Depends(verify_n8n_webhook_auth),
    db: AsyncSession = Depends(get_db),
):
    """Callback endpoint invoked securely by n8n workflow upon status change."""
    stmt = select(LeaveRequest).where(LeaveRequest.id == callback.leave_id)
    leave_rec = (await db.execute(stmt)).scalar_one_or_none()
    if not leave_rec:
        raise HTTPException(status_code=404, detail="Leave request not found")

    if leave_rec.status != LeaveStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Callback rejected: leave already {leave_rec.status.value}.",
        )

    leave_rec.status = callback.status
    if callback.review_notes:
        leave_rec.review_notes = callback.review_notes.strip()
    if callback.n8n_execution_id:
        leave_rec.n8n_execution_id = callback.n8n_execution_id.strip()

    await log_audit_event(
        db=db,
        action=AuditAction.N8N_WORKFLOW_CALLBACK,
        resource_type="leave_request",
        resource_id=str(callback.leave_id),
        details={"status": callback.status.value, "execution_id": callback.n8n_execution_id},
    )
    await db.commit()
    return {"status": "success", "updated_id": str(callback.leave_id)}

