from typing import Optional, Dict, Any
from pydantic import BaseModel


class N8nChatPayload(BaseModel):
    query: str
    user_id: str
    user_email: str
    user_role: str
    department: str


class N8nLeaveApprovalPayload(BaseModel):
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
