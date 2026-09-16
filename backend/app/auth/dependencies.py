import secrets
import uuid
from typing import List, Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.auth.jwt import decode_access_token
from app.users.models import User, UserRole
from app.config import settings


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def verify_n8n_webhook_auth(
    request: Request,
) -> bool:
    """Validate incoming inter-service requests from n8n webhooks using constant-time check."""
    internal_key = request.headers.get("X-N8N-API-KEY") or request.headers.get("X-API-Key")
    if not internal_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing required webhook authentication header",
        )
    if not secrets.compare_digest(internal_key, settings.N8N_API_KEY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid webhook API key",
        )
    return True


async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    # 1. Check internal N8N API key for inter-service calls (with constant-time verification)
    internal_key = request.headers.get("X-N8N-API-KEY") or request.headers.get("X-API-Key")
    if internal_key and secrets.compare_digest(internal_key, settings.N8N_API_KEY):
        user_email = request.headers.get("X-User-Email")
        if not user_email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Inter-service authentication requires explicit X-User-Email header",
            )
        stmt = select(User).where(User.email == user_email.lower().strip(), User.is_active.is_(True))
        result = await db.execute(stmt)
        internal_user = result.scalar_one_or_none()
        if not internal_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Inter-service user '{user_email}' not found or inactive",
            )
        return internal_user

    # 2. Check standard JWT Bearer token
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id_str: str = payload.get("user_id")
    if not user_id_str:
        raise credentials_exception

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise credentials_exception

    stmt = select(User).where(User.id == user_uuid, User.is_active.is_(True))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    return user


def require_roles(allowed_roles: List[UserRole]):
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted for role: {current_user.role.value}",
            )
        return current_user
    return role_checker
