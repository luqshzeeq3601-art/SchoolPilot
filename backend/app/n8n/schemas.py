from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from app.contracts.events import LeaveApprovalEventType, WorkflowErrorAlertPayload


class N8nChatPayload(BaseModel):
    query: str
    user_id: str
    user_email: str
    user_role: str
    department: str


class N8nLeaveApprovalPayload(BaseModel):
    event_type: str = Field(default=LeaveApprovalEventType.LEAVE_SUBMITTED.value, description="Lifecycle event type")
    leave_id: str
    teacher_id: str
    teacher_name: str
    teacher_email: str
    department: str
    leave_type: str
    start_date: str
    end_date: str
    reason: str
    covering_teacher: Optional[str] = None
    submitted_at: str

