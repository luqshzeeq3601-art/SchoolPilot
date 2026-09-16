import pytest
from datetime import date
from pydantic import ValidationError
from app.leave.schemas import LeaveCreateRequest
from app.leave.models import LeaveType


def test_valid_leave_create_request():
    req = LeaveCreateRequest(
        leave_type=LeaveType.EMERGENCY,
        start_date=date(2026, 9, 20),
        end_date=date(2026, 9, 21),
        reason="Family medical emergency requiring attendance.",
        covering_teacher="Mr. Lee Wei Hong",
    )
    assert req.leave_type == LeaveType.EMERGENCY
    assert req.start_date == date(2026, 9, 20)
    assert req.covering_teacher == "Mr. Lee Wei Hong"


def test_invalid_leave_dates_raises_validation_error():
    with pytest.raises(ValidationError):
        LeaveCreateRequest(
            leave_type=LeaveType.EMERGENCY,
            start_date=date(2026, 9, 22),
            end_date=date(2026, 9, 20),  # End date before start date
            reason="Invalid date test.",
        )


def test_short_leave_reason_raises_validation_error():
    with pytest.raises(ValidationError):
        LeaveCreateRequest(
            leave_type=LeaveType.EMERGENCY,
            start_date=date(2026, 9, 20),
            end_date=date(2026, 9, 20),
            reason="Sick",  # Less than min_length=5
        )


def test_valid_leave_update_request():
    from app.leave.schemas import LeaveUpdateRequest, LeaveSummaryResponse
    req = LeaveUpdateRequest(
        leave_type=LeaveType.ANNUAL,
        reason="Attending convocation ceremony in Kuala Lumpur.",
    )
    assert req.leave_type == LeaveType.ANNUAL
    assert req.reason == "Attending convocation ceremony in Kuala Lumpur."
    assert req.start_date is None


def test_invalid_leave_update_dates():
    from app.leave.schemas import LeaveUpdateRequest
    with pytest.raises(ValidationError):
        LeaveUpdateRequest(
            start_date=date(2026, 9, 25),
            end_date=date(2026, 9, 20),
        )


def test_leave_summary_response():
    from app.leave.schemas import LeaveSummaryResponse
    summary = LeaveSummaryResponse(
        annual_used=3,
        annual_total=14,
        medical_used=2,
        medical_total=14,
        emergency_used=1,
        emergency_total=7,
        pending_count=1,
        approved_count=5,
        rejected_count=0,
    )
    assert summary.annual_used == 3
    assert summary.annual_total == 14
    assert summary.pending_count == 1

