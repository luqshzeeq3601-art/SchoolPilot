import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict
from app.leave.models import LeaveStatus, LeaveType


class LeaveCreateRequest(BaseModel):
    leave_type: LeaveType = Field(..., description="Category of leave")
    start_date: date = Field(..., description="Start date of leave")
    end_date: date = Field(..., description="End date of leave")
    reason: str = Field(..., min_length=5, max_length=1000, description="Reason for leave")
    covering_teacher: Optional[str] = Field(None, max_length=255, description="Nominated relief teacher")

    @field_validator("end_date")
    @classmethod
    def validate_dates(cls, v, info):
        if "start_date" in info.data and v < info.data["start_date"]:
            raise ValueError("end_date cannot be earlier than start_date")
        return v


class LeaveUpdateRequest(BaseModel):
    leave_type: Optional[LeaveType] = Field(None, description="Category of leave")
    start_date: Optional[date] = Field(None, description="Start date of leave")
    end_date: Optional[date] = Field(None, description="End date of leave")
    reason: Optional[str] = Field(None, min_length=5, max_length=1000, description="Reason for leave")
    covering_teacher: Optional[str] = Field(None, max_length=255, description="Nominated relief teacher")

    @field_validator("end_date")
    @classmethod
    def validate_dates(cls, v, info):
        if v and "start_date" in info.data and info.data["start_date"] and v < info.data["start_date"]:
            raise ValueError("end_date cannot be earlier than start_date")
        return v


class LeaveReviewRequest(BaseModel):
    notes: Optional[str] = Field(None, max_length=1000, description="Review remarks or reason")


class LeaveSummaryResponse(BaseModel):
    annual_used: int = Field(0, description="Annual leave days used this year")
    annual_total: int = Field(14, description="Total annual leave days entitlement")
    medical_used: int = Field(0, description="Medical leave days used this year")
    medical_total: int = Field(14, description="Total medical leave days entitlement")
    emergency_used: int = Field(0, description="Emergency leave days used this year")
    emergency_total: int = Field(7, description="Total emergency leave days entitlement")
    pending_count: int = Field(0, description="Pending requests count")
    approved_count: int = Field(0, description="Approved requests count")
    rejected_count: int = Field(0, description="Rejected requests count")


class LeaveResponse(BaseModel):
    id: uuid.UUID
    teacher_id: uuid.UUID
    teacher_name: Optional[str] = None
    teacher_email: Optional[str] = None
    teacher_department: Optional[str] = None
    leave_type: LeaveType
    start_date: date
    end_date: date
    reason: str
    covering_teacher: Optional[str] = None
    status: LeaveStatus
    submitted_at: datetime
    reviewed_by: Optional[uuid.UUID] = None
    reviewer_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class N8nStatusCallback(BaseModel):
    leave_id: uuid.UUID
    status: LeaveStatus
    review_notes: Optional[str] = Field(None, max_length=1000)
    n8n_execution_id: Optional[str] = Field(None, max_length=100)
