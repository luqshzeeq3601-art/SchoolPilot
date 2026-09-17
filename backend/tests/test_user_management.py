import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException
from pydantic import ValidationError

from app.users.models import User, UserRole
from app.users.schemas import (
    UserCreate,
    UserUpdate,
    UserStatusToggle,
    UserPasswordReset,
)
from app.users.router import (
    create_user,
    update_user,
    toggle_user_status,
    reset_user_password,
    list_all_users,
)
from app.auth.jwt import verify_password


def test_user_create_validation():
    # Valid
    user_in = UserCreate(
        email="new.teacher@school.edu.my",
        full_name="Cikgu Ahmad",
        password="SecurePassword123!",
        role=UserRole.TEACHER,
        department="Mathematics",
    )
    assert user_in.email == "new.teacher@school.edu.my"
    assert user_in.role == UserRole.TEACHER

    # Invalid short password (< 8 chars)
    with pytest.raises(ValidationError):
        UserCreate(
            email="short.pwd@school.edu.my",
            full_name="Test User",
            password="123",
            role=UserRole.TEACHER,
            department="General",
        )

    # Invalid email format
    with pytest.raises(ValidationError):
        UserCreate(
            email="not-an-email",
            full_name="Test User",
            password="ValidPassword123!",
            role=UserRole.TEACHER,
            department="General",
        )


def test_user_password_reset_validation():
    # Valid
    req = UserPasswordReset(new_password="NewSecretPassword2026!")
    assert req.new_password == "NewSecretPassword2026!"

    # Invalid short password
    with pytest.raises(ValidationError):
        UserPasswordReset(new_password="abc")


@pytest.mark.asyncio
async def test_create_user_success():
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_execute_result = MagicMock()
    mock_execute_result.scalar_one_or_none.return_value = None  # No existing user
    mock_db.execute.return_value = mock_execute_result

    admin_user = User(
        id=uuid.uuid4(),
        email="admin@school.edu.my",
        full_name="System Admin",
        role=UserRole.ADMIN,
        department="Administration",
        is_active=True,
    )

    data = UserCreate(
        email="  NEW.TEACHER@School.EDU.MY  ",
        full_name="Sarah Tan",
        password="Password12345!",
        role=UserRole.TEACHER,
        department="Science",
        is_active=True,
    )

    created = await create_user(data=data, current_user=admin_user, db=mock_db)
    assert created.email == "new.teacher@school.edu.my"
    assert created.full_name == "Sarah Tan"
    assert created.role == UserRole.TEACHER
    assert created.department == "Science"
    assert created.is_active is True
    assert verify_password("Password12345!", created.hashed_password) is True
    mock_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_user_duplicate_email_conflict():
    mock_db = AsyncMock()
    existing_user = User(
        id=uuid.uuid4(),
        email="existing@school.edu.my",
        full_name="Existing User",
        role=UserRole.TEACHER,
    )
    mock_execute_result = MagicMock()
    mock_execute_result.scalar_one_or_none.return_value = existing_user
    mock_db.execute.return_value = mock_execute_result

    admin_user = User(
        id=uuid.uuid4(),
        email="admin@school.edu.my",
        full_name="System Admin",
        role=UserRole.ADMIN,
    )

    data = UserCreate(
        email="existing@school.edu.my",
        full_name="Another User",
        password="Password12345!",
        role=UserRole.TEACHER,
        department="Science",
    )

    with pytest.raises(HTTPException) as exc_info:
        await create_user(data=data, current_user=admin_user, db=mock_db)
    assert exc_info.value.status_code == 409
    assert "already exists" in exc_info.value.detail


@pytest.mark.asyncio
async def test_update_user_prevents_admin_self_demotion():
    admin_id = uuid.uuid4()
    admin_user = User(
        id=admin_id,
        email="admin@school.edu.my",
        full_name="Main Admin",
        role=UserRole.ADMIN,
        department="Administration",
        is_active=True,
    )

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = admin_user
    mock_db.execute.return_value = mock_result

    # Admin trying to change their own role to Teacher
    with pytest.raises(HTTPException) as exc_info:
        await update_user(
            user_id=admin_id,
            data=UserUpdate(role=UserRole.TEACHER),
            current_user=admin_user,
            db=mock_db,
        )
    assert exc_info.value.status_code == 400
    assert "cannot demote their own admin role" in exc_info.value.detail


@pytest.mark.asyncio
async def test_toggle_status_prevents_admin_self_deactivation():
    admin_id = uuid.uuid4()
    admin_user = User(
        id=admin_id,
        email="admin@school.edu.my",
        full_name="Main Admin",
        role=UserRole.ADMIN,
        department="Administration",
        is_active=True,
    )

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = admin_user
    mock_db.execute.return_value = mock_result

    with pytest.raises(HTTPException) as exc_info:
        await toggle_user_status(
            user_id=admin_id,
            data=UserStatusToggle(is_active=False),
            current_user=admin_user,
            db=mock_db,
        )
    assert exc_info.value.status_code == 400
    assert "cannot deactivate their own account" in exc_info.value.detail


@pytest.mark.asyncio
async def test_reset_user_password_updates_hash():
    target_id = uuid.uuid4()
    target_user = User(
        id=target_id,
        email="teacher@school.edu.my",
        full_name="Target Teacher",
        role=UserRole.TEACHER,
        department="History",
        hashed_password="old_hash_value",
        is_active=True,
    )

    admin_user = User(
        id=uuid.uuid4(),
        email="admin@school.edu.my",
        full_name="System Admin",
        role=UserRole.ADMIN,
    )

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = target_user
    mock_db.execute.return_value = mock_result

    res = await reset_user_password(
        user_id=target_id,
        data=UserPasswordReset(new_password="NewComplexPassword999!"),
        current_user=admin_user,
        db=mock_db,
    )

    assert "reset successfully" in res["message"]
    assert verify_password("NewComplexPassword999!", target_user.hashed_password) is True
    mock_db.commit.assert_awaited_once()
