import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
from app.auth.dependencies import verify_n8n_webhook_auth, get_current_user
from app.users.models import User, UserRole
from app.leave.models import LeaveRequest, LeaveType
from app.leave.router import validate_hod_authorization
from app.chat.generator import generate_policy_answer
from app.config import settings


@pytest.mark.asyncio
async def test_webhook_auth_missing_header():
    """Verify that requests without n8n API key are rejected with 401."""
    mock_request = MagicMock()
    mock_request.headers.get.return_value = None
    
    with pytest.raises(HTTPException) as exc_info:
        await verify_n8n_webhook_auth(mock_request)
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_webhook_auth_invalid_header():
    """Verify that requests with incorrect n8n API key are rejected with 403."""
    mock_request = MagicMock()
    mock_request.headers.get.side_effect = lambda key: "wrong_secret_key" if "API" in key else None
    
    with pytest.raises(HTTPException) as exc_info:
        await verify_n8n_webhook_auth(mock_request)
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_webhook_auth_valid_header():
    """Verify that requests with correct n8n API key pass authentication."""
    mock_request = MagicMock()
    mock_request.headers.get.side_effect = lambda key: settings.N8N_API_KEY if "API" in key else None
    
    result = await verify_n8n_webhook_auth(mock_request)
    assert result is True


@pytest.mark.asyncio
async def test_interservice_auth_blocks_unspecified_email():
    """Verify that interservice API key callers cannot auto-escalate to admin without explicit X-User-Email."""
    mock_request = MagicMock()
    mock_request.headers.get.side_effect = lambda key: settings.N8N_API_KEY if "API" in key else None
    mock_db = AsyncMock()

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request=mock_request, token=None, db=mock_db)
    assert exc_info.value.status_code == 401
    assert "explicit X-User-Email" in exc_info.value.detail


def test_hod_cross_department_forbidden():
    """Verify that an HoD cannot approve or reject leaves from other departments."""
    hod_user = User(
        id=uuid.uuid4(),
        email="hod.science@cempaka.edu.my",
        role=UserRole.HOD,
        department="Science & Mathematics",
    )
    humanities_teacher = User(
        id=uuid.uuid4(),
        email="teacher.bm@cempaka.edu.my",
        role=UserRole.TEACHER,
        department="Humanities & Languages",
    )
    leave_rec = LeaveRequest(
        id=uuid.uuid4(),
        teacher_id=humanities_teacher.id,
        teacher=humanities_teacher,
        leave_type=LeaveType.EMERGENCY,
    )

    with pytest.raises(HTTPException) as exc_info:
        validate_hod_authorization(leave_rec, hod_user)
    assert exc_info.value.status_code == 403
    assert "Restricted to 'Science & Mathematics'" in exc_info.value.detail


def test_hod_self_approval_forbidden():
    """Verify that an HoD cannot self-approve their own leave application."""
    hod_id = uuid.uuid4()
    hod_user = User(
        id=hod_id,
        email="hod.science@cempaka.edu.my",
        role=UserRole.HOD,
        department="Science & Mathematics",
    )
    leave_rec = LeaveRequest(
        id=uuid.uuid4(),
        teacher_id=hod_id,
        teacher=hod_user,
        leave_type=LeaveType.ANNUAL,
    )

    with pytest.raises(HTTPException) as exc_info:
        validate_hod_authorization(leave_rec, hod_user)
    assert exc_info.value.status_code == 403
    assert "cannot approve or reject their own leave" in exc_info.value.detail


def test_hod_same_department_allowed():
    """Verify that an HoD can review leaves for teachers within their own department."""
    hod_user = User(
        id=uuid.uuid4(),
        email="hod.science@cempaka.edu.my",
        role=UserRole.HOD,
        department="Science & Mathematics",
    )
    science_teacher = User(
        id=uuid.uuid4(),
        email="teacher.azman@cempaka.edu.my",
        role=UserRole.TEACHER,
        department="Science & Mathematics",
    )
    leave_rec = LeaveRequest(
        id=uuid.uuid4(),
        teacher_id=science_teacher.id,
        teacher=science_teacher,
        leave_type=LeaveType.EMERGENCY,
    )

    # Should not raise exception
    validate_hod_authorization(leave_rec, hod_user)


def test_admin_review_any_department_allowed():
    """Verify that institutional admins can review leaves across any department."""
    admin_user = User(
        id=uuid.uuid4(),
        email="admin@cempaka.edu.my",
        role=UserRole.ADMIN,
        department="Administration",
    )
    science_teacher = User(
        id=uuid.uuid4(),
        email="teacher.azman@cempaka.edu.my",
        role=UserRole.TEACHER,
        department="Science & Mathematics",
    )
    leave_rec = LeaveRequest(
        id=uuid.uuid4(),
        teacher_id=science_teacher.id,
        teacher=science_teacher,
        leave_type=LeaveType.EMERGENCY,
    )

    # Should not raise exception
    validate_hod_authorization(leave_rec, admin_user)


@pytest.mark.asyncio
async def test_chat_generator_masks_internal_error():
    """Verify that generator.py catches internal model errors without exposing raw trace/exception."""
    with patch("app.chat.generator.get_ollama_client", side_effect=RuntimeError("Internal DB Connection Refused 192.168.1.5:5432")):
        result = await generate_policy_answer(query="What is the leave policy?", retrieved_chunks=[])
        assert "Internal DB Connection" not in result.answer
        assert "192.168.1.5" not in result.answer
        assert "Unable to generate a cited response" in result.answer
        assert result.confidence == "low"
