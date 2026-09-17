import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.database import get_db
from app.users.models import User, UserRole
from app.users.schemas import (
    UserCreate,
    UserUpdate,
    UserStatusToggle,
    UserPasswordReset,
    UserResponse,
)
from app.auth.dependencies import get_current_user, require_roles
from app.auth.jwt import get_password_hash
from app.audit.logger import log_audit_event
from app.audit.models import AuditAction


router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/staff", response_model=List[UserResponse])
async def list_staff_members(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List active staff members to assist in selecting covering teachers."""
    stmt = select(User).where(User.is_active.is_(True)).order_by(User.full_name)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("", response_model=List[UserResponse])
async def list_all_users(
    search: Optional[str] = Query(None, description="Search by name or email"),
    role: Optional[UserRole] = Query(None, description="Filter by role"),
    department: Optional[str] = Query(None, description="Filter by department"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only: Retrieve all system users with optional search and filters."""
    stmt = select(User).order_by(User.created_at.desc())

    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(or_(User.full_name.ilike(term), User.email.ilike(term)))

    if role:
        stmt = stmt.where(User.role == role)

    if department:
        stmt = stmt.where(User.department == department)

    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only: Register a new system user account."""
    normalized_email = data.email.lower().strip()

    # Check for duplicate email
    stmt = select(User).where(User.email == normalized_email)
    existing_user = (await db.execute(stmt)).scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"User with email '{normalized_email}' already exists.",
        )

    new_user = User(
        email=normalized_email,
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name.strip(),
        role=data.role,
        department=data.department.strip(),
        is_active=data.is_active,
    )
    db.add(new_user)
    await db.flush()

    await log_audit_event(
        db=db,
        action=AuditAction.USER_CREATED,
        resource_type="user",
        resource_id=str(new_user.id),
        user_id=current_user.id,
        user_email=current_user.email,
        details={
            "target_email": new_user.email,
            "target_name": new_user.full_name,
            "role": new_user.role.value,
            "department": new_user.department,
            "is_active": new_user.is_active,
        },
    )
    await db.commit()
    await db.refresh(new_user)
    return new_user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user_by_id(
    user_id: uuid.UUID,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only: Fetch details for a specific user."""
    stmt = select(User).where(User.id == user_id)
    target_user = (await db.execute(stmt)).scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return target_user


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only: Update user name, role, or department."""
    stmt = select(User).where(User.id == user_id)
    target_user = (await db.execute(stmt)).scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    # Guard: Prevent admin from removing their own admin role
    if target_user.id == current_user.id and data.role is not None and data.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot demote their own admin role to avoid system lockout.",
        )

    old_details = {
        "full_name": target_user.full_name,
        "role": target_user.role.value,
        "department": target_user.department,
    }

    if data.full_name is not None:
        target_user.full_name = data.full_name.strip()
    if data.role is not None:
        target_user.role = data.role
    if data.department is not None:
        target_user.department = data.department.strip()

    await log_audit_event(
        db=db,
        action=AuditAction.USER_UPDATED,
        resource_type="user",
        resource_id=str(target_user.id),
        user_id=current_user.id,
        user_email=current_user.email,
        details={
            "target_email": target_user.email,
            "previous": old_details,
            "updated": {
                "full_name": target_user.full_name,
                "role": target_user.role.value,
                "department": target_user.department,
            },
        },
    )
    await db.commit()
    await db.refresh(target_user)
    return target_user


@router.patch("/{user_id}/status", response_model=UserResponse)
async def toggle_user_status(
    user_id: uuid.UUID,
    data: UserStatusToggle,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only: Activate or deactivate a user account."""
    stmt = select(User).where(User.id == user_id)
    target_user = (await db.execute(stmt)).scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    # Guard: Prevent admin from deactivating themselves
    if target_user.id == current_user.id and not data.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot deactivate their own account.",
        )

    target_user.is_active = data.is_active

    await log_audit_event(
        db=db,
        action=AuditAction.USER_STATUS_CHANGED,
        resource_type="user",
        resource_id=str(target_user.id),
        user_id=current_user.id,
        user_email=current_user.email,
        details={
            "target_email": target_user.email,
            "is_active": target_user.is_active,
        },
    )
    await db.commit()
    await db.refresh(target_user)
    return target_user


@router.post("/{user_id}/reset-password", status_code=status.HTTP_200_OK)
async def reset_user_password(
    user_id: uuid.UUID,
    data: UserPasswordReset,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only: Reset user password."""
    stmt = select(User).where(User.id == user_id)
    target_user = (await db.execute(stmt)).scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    target_user.hashed_password = get_password_hash(data.new_password)

    await log_audit_event(
        db=db,
        action=AuditAction.USER_PASSWORD_RESET,
        resource_type="user",
        resource_id=str(target_user.id),
        user_id=current_user.id,
        user_email=current_user.email,
        details={
            "target_email": target_user.email,
        },
    )
    await db.commit()
    return {"message": f"Password for user '{target_user.email}' reset successfully."}
