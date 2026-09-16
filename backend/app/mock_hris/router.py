import secrets
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import settings
from app.users.models import User
from app.auth.dependencies import get_current_user
from app.contracts.mock_hris import (
    MockHrisSyncRequest,
    MockHrisSyncResponse,
    MockHrisBalanceResponse,
)
from app.contracts.idempotency import IDEMPOTENCY_KEY_HEADER, N8N_API_KEY_HEADER
from app.mock_hris.service import sync_payroll_idempotent, get_all_user_balances

router = APIRouter(prefix="/mock-hris", tags=["Mock HRIS Integration"])


def verify_n8n_service_key(
    x_n8n_api_key: Optional[str] = Header(default=None, alias="X-N8N-API-KEY"),
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
) -> str:
    """Validate incoming service key using constant-time string comparison."""
    key1 = x_n8n_api_key if isinstance(x_n8n_api_key, str) else None
    key2 = x_api_key if isinstance(x_api_key, str) else None
    provided_key = key1 or key2
    if not provided_key:
        raise HTTPException(
            status_code=401,
            detail="Missing required service key header (X-N8N-API-KEY).",
        )
    if not secrets.compare_digest(provided_key, settings.N8N_API_KEY):
        raise HTTPException(
            status_code=401,
            detail="Invalid service key provided in X-N8N-API-KEY.",
        )
    return provided_key


@router.post(
    "/sync-payroll",
    response_model=MockHrisSyncResponse,
    summary="Idempotent Mock HRIS Payroll Deduction Sync",
    description="Synchronizes approved leave working days to synthetic mock HRIS payroll balance with strict idempotency.",
)
async def sync_payroll(
    payload: MockHrisSyncRequest,
    request: Request,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    _key: str = Depends(verify_n8n_service_key),
    db: AsyncSession = Depends(get_db),
):
    if not idempotency_key or not idempotency_key.strip():
        raise HTTPException(
            status_code=422,
            detail={
                "code": "MISSING_IDEMPOTENCY_KEY",
                "message": "Idempotency-Key header is required for payroll synchronization.",
                "retryable": False,
            },
        )

    client_ip = request.client.host if request.client else None
    raw_dict = payload.model_dump()

    return await sync_payroll_idempotent(
        db=db,
        request=payload,
        idempotency_key=idempotency_key.strip(),
        raw_payload=raw_dict,
        client_ip=client_ip,
    )


@router.get(
    "/balances/{user_id}",
    response_model=MockHrisBalanceResponse,
    summary="Get Simulated User Leave Balances",
    description="Lookup current mock HRIS balance entitlements and usage for a specific user.",
)
async def get_user_balances(
    user_id: uuid.UUID,
    year: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Teachers can view their own balances; HoD/Admin can view any
    if current_user.role.value == "teacher" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Forbidden: Cannot access other staff balances.")

    return await get_all_user_balances(db=db, user_id=user_id, year=year)
