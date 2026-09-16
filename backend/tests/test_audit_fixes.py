"""Regression tests for full-code audit fixes (no new features).

Each test fails on the pre-fix code and passes after the smallest safe fix.
"""
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
from pydantic import ValidationError

from app.leave.models import LeaveRequest, LeaveStatus, LeaveType
from app.users.models import User, UserRole
from app.leave.schemas import N8nStatusCallback


def _make_user(role=UserRole.ADMIN, dept="Administration"):
    return User(
        id=uuid.uuid4(),
        email="admin@cempaka.edu.my",
        hashed_password="x",
        full_name="Admin",
        role=role,
        department=dept,
        is_active=True,
    )


def _make_leave(status=LeaveStatus.APPROVED):
    teacher = User(
        id=uuid.uuid4(),
        email="teacher.azman@cempaka.edu.my",
        hashed_password="x",
        full_name="Cikgu Azman",
        role=UserRole.TEACHER,
        department="Science & Mathematics",
        is_active=True,
    )
    return LeaveRequest(
        id=uuid.uuid4(),
        teacher_id=teacher.id,
        teacher=teacher,
        leave_type=LeaveType.EMERGENCY,
        start_date=__import__("datetime").date(2026, 9, 20),
        end_date=__import__("datetime").date(2026, 9, 21),
        reason="Family emergency requiring attendance.",
        status=status,
    )


def _mock_db_with_leave(leave_rec):
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = leave_rec
    mock_db.execute.return_value = mock_result
    return mock_db


@pytest.mark.asyncio
async def test_approve_non_pending_rejected():
    """Approve must only transition PENDING -> APPROVED (replay/state-flip guard)."""
    from app.leave.router import approve_leave_request
    admin = _make_user()
    leave_rec = _make_leave(status=LeaveStatus.APPROVED)
    mock_db = _mock_db_with_leave(leave_rec)
    with patch("app.leave.router.log_audit_event", new=AsyncMock()):
        with pytest.raises(HTTPException) as exc:
            await approve_leave_request(leave_rec.id, None, admin, mock_db)
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_reject_non_pending_rejected():
    """Reject must only transition PENDING -> REJECTED."""
    from app.leave.router import reject_leave_request
    from app.leave.schemas import LeaveReviewRequest
    admin = _make_user()
    leave_rec = _make_leave(status=LeaveStatus.REJECTED)
    mock_db = _mock_db_with_leave(leave_rec)
    with patch("app.leave.router.log_audit_event", new=AsyncMock()):
        with pytest.raises(HTTPException) as exc:
            await reject_leave_request(
                leave_rec.id, LeaveReviewRequest(notes="No cover"), admin, mock_db
            )
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_n8n_callback_non_pending_rejected():
    """n8n webhook must not flip already-finalised requests."""
    from app.leave.router import n8n_status_callback
    leave_rec = _make_leave(status=LeaveStatus.APPROVED)
    mock_db = _mock_db_with_leave(leave_rec)
    cb = N8nStatusCallback(
        leave_id=leave_rec.id, status=LeaveStatus.REJECTED, review_notes="note"
    )
    with pytest.raises(HTTPException) as exc:
        await n8n_status_callback(cb, True, mock_db)
    assert exc.value.status_code in (400, 409)


def test_n8n_callback_bounds():
    """Unbounded review_notes / execution id must be rejected (DoS/DB bloat)."""
    with pytest.raises(ValidationError):
        N8nStatusCallback(
            leave_id=uuid.uuid4(),
            status=LeaveStatus.APPROVED,
            review_notes="x" * 5000,
        )
    with pytest.raises(ValidationError):
        N8nStatusCallback(
            leave_id=uuid.uuid4(),
            status=LeaveStatus.APPROVED,
            n8n_execution_id="y" * 500,
        )


@pytest.mark.asyncio
async def test_login_timing_dummy_verify():
    """Unknown-email login must still cost one bcrypt verify (no enumeration oracle)."""
    from app.auth import router as auth_router
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result
    from app.auth.schemas import LoginRequest
    creds = LoginRequest(email="nobody@cempaka.edu.my", password="Password123!")
    with patch(
        "app.auth.router.verify_password", return_value=False
    ) as mock_verify:
        with pytest.raises(HTTPException) as exc:
            await auth_router.login(creds, mock_db)
        assert exc.value.status_code == 401
        assert mock_verify.called, "login must call verify_password even for unknown user"


def test_document_chunk_cap_constant():
    """Upload path must enforce a max-chunks cap to bound embedding cost."""
    from app.documents import router as doc_router
    assert hasattr(doc_router, "MAX_CHUNKS"), "MAX_CHUNKS cap missing"
    assert 50 <= doc_router.MAX_CHUNKS <= 1000


def test_ollama_no_hardcoded_private_ips():
    """Embedder must not probe hardcoded private IPs."""
    import inspect
    from app.documents import embedder
    src = inspect.getsource(embedder.get_ollama_client)
    assert "172.28.160.1" not in src
    assert "192.168.0.9" not in src


def test_attachment_decompression_guard():
    """OCR path must guard against decompression bombs."""
    import inspect
    from app.chat import attachments
    src = inspect.getsource(attachments)
    assert "MAX_IMAGE_PIXELS" in src or "DecompressionBomb" in src


def test_security_headers_middleware():
    """API must emit baseline security headers."""
    import inspect
    from app import main
    src = inspect.getsource(main)
    assert "X-Content-Type-Options" in src
    assert "X-Frame-Options" in src


def test_n8n_key_default_warning():
    """Default N8N_API_KEY must warn like JWT_SECRET does."""
    import warnings
    from app.config import Settings
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        Settings(
            JWT_SECRET="a" * 40,
            N8N_API_KEY="schoolops_n8n_secret_key_2026",
        )
        assert any("N8N" in str(w.message) for w in caught), \
            "default N8N_API_KEY should emit a security warning"
