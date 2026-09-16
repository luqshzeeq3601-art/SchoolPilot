import enum
from typing import Optional
from pydantic import BaseModel, Field


class LeaveApprovalEventType(str, enum.Enum):
    LEAVE_SUBMITTED = "leave_submitted"
    LEAVE_APPROVED = "leave_approved"
    LEAVE_REJECTED = "leave_rejected"


class WorkflowErrorAlertPayload(BaseModel):
    execution_id: str = Field(..., description="n8n execution identifier")
    workflow_id: Optional[str] = Field(None, description="n8n workflow identifier")
    workflow_name: str = Field(..., description="Name of the failing workflow")
    failed_node: str = Field(..., description="Name of the node where failure occurred")
    error_message: str = Field(..., description="Sanitized, non-sensitive failure message")
    timestamp: str = Field(..., description="ISO 8601 timestamp of failure event")
