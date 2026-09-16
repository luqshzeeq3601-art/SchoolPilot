import uuid
from datetime import datetime, timezone
from typing import Dict, Optional
from pydantic import BaseModel, Field


class MockHrisSyncRequest(BaseModel):
    leave_id: uuid.UUID = Field(..., description="Unique ID of the approved leave request")
    net_working_days: int = Field(..., ge=0, description="Calculated Monday-Friday working days to deduct")
    n8n_execution_id: Optional[str] = Field(None, max_length=100, description="n8n workflow execution tracking ID")


class MockHrisSyncResponse(BaseModel):
    mock: bool = Field(True, description="Always true indicating a synthetic demonstration integration")
    integration: str = Field("mock_hris_payroll", description="Integration name identifier")
    status: str = Field("synced", description="Sync outcome status")
    sync_id: uuid.UUID = Field(..., description="Unique identifier for the sync record")
    leave_id: uuid.UUID = Field(..., description="Leave request ID synced")
    deducted_days: int = Field(..., ge=0, description="Number of days deducted from balance")
    balance_before: int = Field(..., description="Balance before sync operation")
    balance_after: int = Field(..., description="Remaining balance after sync operation")
    processed_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), description="Timestamp of execution"
    )
    replayed: bool = Field(False, description="True if response was replayed from idempotency cache")


class MockHrisErrorDetail(BaseModel):
    code: str = Field(..., description="Standardized error code")
    message: str = Field(..., description="Human-readable explanation of rejection")
    retryable: bool = Field(..., description="Whether caller should retry or abort immediately")


class MockHrisBalanceItem(BaseModel):
    entitlement_days: int = Field(..., ge=0)
    used_days: int = Field(..., ge=0)
    remaining_days: int = Field(...)


class MockHrisBalanceResponse(BaseModel):
    user_id: uuid.UUID
    year: int
    balances: Dict[str, MockHrisBalanceItem]
    mock: bool = Field(True, description="Indicates simulated balance storage")
