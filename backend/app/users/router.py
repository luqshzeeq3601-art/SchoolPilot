from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.users.models import User, UserRole
from app.users.schemas import UserResponse
from app.auth.dependencies import get_current_user


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
