from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.users.models import User
from app.users.schemas import UserResponse
from app.auth.schemas import LoginRequest, TokenResponse
from app.auth.jwt import verify_password, create_access_token, get_password_hash
from app.auth.dependencies import get_current_user


router = APIRouter(prefix="/auth", tags=["Authentication"])

# Pre-computed dummy hash so unknown-email logins cost one bcrypt verify,
# closing the timing oracle that would otherwise enumerate valid emails.
_DUMMY_HASH = get_password_hash("dummy-password-for-timing-mitigation-!@#")


@router.post("/login", response_model=TokenResponse)
async def login(credentials: LoginRequest, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.email == credentials.email.lower().strip())
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        verify_password(credentials.password, _DUMMY_HASH)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    token_data = {
        "sub": user.email,
        "user_id": str(user.id),
        "role": user.role.value,
        "department": user.department,
    }
    access_token = create_access_token(data=token_data)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        department=user.department,
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return current_user
