import uuid
from datetime import date, datetime, timezone
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import httpx
from fastapi import HTTPException

from app.users.models import User, UserRole
from app.leave.models import LeaveRequest, LeaveStatus, LeaveType
from app.leave.schemas import LeaveReviewRequest
from app.leave.router import approve_leave_request, reject_leave_request
from app.contracts.events import LeaveApprovalEventType
from app.n8n.schemas import N8nLeaveApprovalPayload
from app.n8n.client import trigger_n8n_leave_approval


@pytest.mark.asyncio
async def test_approve_leave_request_dispatches_event_and_commits_db():
    mock_db = AsyncMock()
    leave_id = uuid.uuid4()
    teacher_id = uuid.uuid4()
    hod_id = uuid.uuid4()

    teacher = User(
        id=teacher_id,
        email="teacher@cempaka.edu.my",
        full_name="Cikgu Aminah",
        role=UserRole.TEACHER,
        department="Mathematics",
    )
    hod = User(
        id=hod_id,
        email="hod@cempaka.edu.my",
        full_name="Encik Razak",
        role=UserRole.HOD,
        department="Mathematics",
    )

    leave_rec = LeaveRequest(
        id=leave_id,
        teacher_id=teacher_id,
        teacher=teacher,
        leave_type=LeaveType.ANNUAL,
        start_date=date(2026, 9, 20),
        end_date=date(2026, 9, 22),
        reason="Attending curriculum symposium.",
        covering_teacher="Encik Borhan",
        status=LeaveStatus.PENDING,
        submitted_at=datetime.now(timezone.utc),
    )

    # Mock DB query result
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = leave_rec
    mock_result.scalar_one.return_value = leave_rec
    mock_db.execute.return_value = mock_result

    review_data = LeaveReviewRequest(notes="Approved. Please hand over lesson plans.")

    with patch("app.leave.router.trigger_n8n_leave_approval", new_callable=AsyncMock) as mock_trigger:
        mock_trigger.return_value = True

        response = await approve_leave_request(
            leave_id=leave_id,
            review_data=review_data,
            current_user=hod,
            db=mock_db,
        )

        # Assert DB commit occurred
        assert mock_db.commit.called
        assert leave_rec.status == LeaveStatus.APPROVED
        assert leave_rec.reviewed_by == hod_id
        assert leave_rec.review_notes == "Approved. Please hand over lesson plans."

        # Assert n8n trigger received event_type leave_approved
        assert mock_trigger.called
        called_payload: N8nLeaveApprovalPayload = mock_trigger.call_args[0][0]
        assert called_payload.event_type == LeaveApprovalEventType.LEAVE_APPROVED.value
        assert called_payload.leave_id == str(leave_id)
        assert called_payload.teacher_id == str(teacher_id)
        assert called_payload.teacher_name == "Cikgu Aminah"
        assert called_payload.department == "Mathematics"

        # Assert response schema
        assert response.status == LeaveStatus.APPROVED
        assert response.id == leave_id


@pytest.mark.asyncio
async def test_approve_leave_request_persists_even_if_n8n_fails():
    mock_db = AsyncMock()
    leave_id = uuid.uuid4()
    teacher_id = uuid.uuid4()
    admin_id = uuid.uuid4()

    teacher = User(
        id=teacher_id,
        email="teacher2@cempaka.edu.my",
        full_name="Cikgu Saloma",
        role=UserRole.TEACHER,
        department="Science",
    )
    admin = User(
        id=admin_id,
        email="admin@cempaka.edu.my",
        full_name="Pengetua Hassan",
        role=UserRole.ADMIN,
        department="Administration",
    )

    leave_rec = LeaveRequest(
        id=leave_id,
        teacher_id=teacher_id,
        teacher=teacher,
        leave_type=LeaveType.MEDICAL,
        start_date=date(2026, 9, 21),
        end_date=date(2026, 9, 21),
        reason="Medical checkup at clinic.",
        status=LeaveStatus.PENDING,
        submitted_at=datetime.now(timezone.utc),
    )

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = leave_rec
    mock_result.scalar_one.return_value = leave_rec
    mock_db.execute.return_value = mock_result

    with patch("app.leave.router.trigger_n8n_leave_approval", new_callable=AsyncMock) as mock_trigger:
        # Simulate webhook failure (e.g. n8n container temporarily down)
        mock_trigger.return_value = False

        response = await approve_leave_request(
            leave_id=leave_id,
            review_data=None,
            current_user=admin,
            db=mock_db,
        )

        # The DB state MUST still be committed as approved
        assert mock_db.commit.called
        assert leave_rec.status == LeaveStatus.APPROVED
        assert response.status == LeaveStatus.APPROVED


@pytest.mark.asyncio
async def test_reject_leave_request_commits_and_never_dispatches_hris_sync():
    mock_db = AsyncMock()
    leave_id = uuid.uuid4()
    teacher_id = uuid.uuid4()
    hod_id = uuid.uuid4()

    teacher = User(
        id=teacher_id,
        email="teacher3@cempaka.edu.my",
        full_name="Mr. David Tan",
        role=UserRole.TEACHER,
        department="English",
    )
    hod = User(
        id=hod_id,
        email="hod_eng@cempaka.edu.my",
        full_name="Madam Noraini",
        role=UserRole.HOD,
        department="English",
    )

    leave_rec = LeaveRequest(
        id=leave_id,
        teacher_id=teacher_id,
        teacher=teacher,
        leave_type=LeaveType.ANNUAL,
        start_date=date(2026, 9, 20),
        end_date=date(2026, 9, 21),
        reason="Personal holiday trip.",
        status=LeaveStatus.PENDING,
        submitted_at=datetime.now(timezone.utc),
    )

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = leave_rec
    mock_db.execute.return_value = mock_result

    review_data = LeaveReviewRequest(notes="Clashes with major national exam briefing.")

    with patch("app.leave.router.trigger_n8n_leave_approval", new_callable=AsyncMock) as mock_trigger:
        response = await reject_leave_request(
            leave_id=leave_id,
            review_data=review_data,
            current_user=hod,
            db=mock_db,
        )

        # Assert rejection committed
        assert mock_db.commit.called
        assert leave_rec.status == LeaveStatus.REJECTED
        assert leave_rec.review_notes == "Clashes with major national exam briefing."
        assert response.status == LeaveStatus.REJECTED

        # Rejection MUST NOT trigger n8n leave approval webhook
        assert not mock_trigger.called


@pytest.mark.asyncio
async def test_n8n_client_success():
    payload = N8nLeaveApprovalPayload(
        event_type="leave_approved",
        leave_id=str(uuid.uuid4()),
        teacher_id=str(uuid.uuid4()),
        teacher_name="Test Teacher",
        teacher_email="teacher@cempaka.edu.my",
        department="Science",
        leave_type="annual",
        start_date="2026-09-20",
        end_date="2026-09-22",
        reason="Annual leave test",
        submitted_at=datetime.now(timezone.utc).isoformat(),
    )

    mock_resp = MagicMock()
    mock_resp.status_code = 200

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp
        result = await trigger_n8n_leave_approval(payload, max_retries=3, initial_delay=0.01)
        assert result is True
        assert mock_post.call_count == 1


@pytest.mark.asyncio
async def test_n8n_client_retry_transient_failures_then_success():
    payload = N8nLeaveApprovalPayload(
        event_type="leave_approved",
        leave_id=str(uuid.uuid4()),
        teacher_id=str(uuid.uuid4()),
        teacher_name="Test Teacher",
        teacher_email="teacher@cempaka.edu.my",
        department="Science",
        leave_type="annual",
        start_date="2026-09-20",
        end_date="2026-09-22",
        reason="Annual leave test",
        submitted_at=datetime.now(timezone.utc).isoformat(),
    )

    resp_503 = MagicMock()
    resp_503.status_code = 503

    resp_200 = MagicMock()
    resp_200.status_code = 200

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        # First 2 calls fail with 503, 3rd call succeeds with 200
        mock_post.side_effect = [resp_503, resp_503, resp_200]
        result = await trigger_n8n_leave_approval(payload, max_retries=3, initial_delay=0.01)
        assert result is True
        assert mock_post.call_count == 3


@pytest.mark.asyncio
async def test_n8n_client_fail_fast_on_non_retryable_client_error():
    payload = N8nLeaveApprovalPayload(
        event_type="leave_approved",
        leave_id=str(uuid.uuid4()),
        teacher_id=str(uuid.uuid4()),
        teacher_name="Test Teacher",
        teacher_email="teacher@cempaka.edu.my",
        department="Science",
        leave_type="annual",
        start_date="2026-09-20",
        end_date="2026-09-22",
        reason="Annual leave test",
        submitted_at=datetime.now(timezone.utc).isoformat(),
    )

    resp_400 = MagicMock()
    resp_400.status_code = 400

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = resp_400
        result = await trigger_n8n_leave_approval(payload, max_retries=3, initial_delay=0.01)
        # Should fail fast without retry
        assert result is False
        assert mock_post.call_count == 1


@pytest.mark.asyncio
async def test_n8n_client_exhausts_retries_on_network_timeout():
    payload = N8nLeaveApprovalPayload(
        event_type="leave_approved",
        leave_id=str(uuid.uuid4()),
        teacher_id=str(uuid.uuid4()),
        teacher_name="Test Teacher",
        teacher_email="teacher@cempaka.edu.my",
        department="Science",
        leave_type="annual",
        start_date="2026-09-20",
        end_date="2026-09-22",
        reason="Annual leave test",
        submitted_at=datetime.now(timezone.utc).isoformat(),
    )

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = httpx.ConnectTimeout("Connection timed out")
        result = await trigger_n8n_leave_approval(payload, max_retries=3, initial_delay=0.01)
        assert result is False
        assert mock_post.call_count == 3
