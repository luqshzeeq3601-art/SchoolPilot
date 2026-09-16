import pytest
import uuid
from datetime import date
from unittest.mock import AsyncMock, MagicMock
from app.leave.validator import validate_leave_fields, parse_iso_date
from app.leave.models import LeaveType
from app.contracts.extraction import (
    ExtractionValidationStatus,
    ExtractionValidationError,
    ExtractionValidationResult,
)
from app.chat.schemas import LeaveFields, IntentClassification
from app.chat.intent import classify_intent_and_extract_fields
from app.leave.schemas import LeaveCreateRequest
from pydantic import ValidationError


def test_validator_valid_complete_extraction():
    raw = {
        "leave_type": "emergency",
        "start_date": "2026-09-20",
        "end_date": "2026-09-21",
        "reason": "Family medical emergency",
        "covering_teacher": "Mr. Lee Wei Hong",
    }
    is_valid, sanitized, result = validate_leave_fields(raw)
    assert is_valid is True
    assert result.status == ExtractionValidationStatus.VALID
    assert len(result.errors) == 0
    assert len(result.missing_fields) == 0
    assert sanitized.leave_type == "emergency"
    assert sanitized.start_date == "2026-09-20"
    assert sanitized.end_date == "2026-09-21"
    assert sanitized.reason == "Family medical emergency"
    assert sanitized.covering_teacher == "Mr. Lee Wei Hong"


def test_validator_missing_fields():
    # Missing all fields
    is_valid, sanitized, result = validate_leave_fields(None)
    assert is_valid is False
    assert result.status == ExtractionValidationStatus.NEEDS_CLARIFICATION
    assert "leave_type" in result.missing_fields
    assert "start_date" in result.missing_fields
    assert "end_date" in result.missing_fields
    assert "reason" in result.missing_fields

    # Missing reason and end_date
    partial = {
        "leave_type": "medical",
        "start_date": "2026-09-20",
    }
    is_valid, sanitized, result = validate_leave_fields(partial)
    assert is_valid is False
    assert "end_date" in result.missing_fields
    assert "reason" in result.missing_fields
    assert "leave_type" not in result.missing_fields
    assert "start_date" not in result.missing_fields


def test_validator_invalid_enum():
    bad_type = {
        "leave_type": "vacation_holiday",  # invalid enum
        "start_date": "2026-09-20",
        "end_date": "2026-09-21",
        "reason": "Going on a holiday",
    }
    is_valid, sanitized, result = validate_leave_fields(bad_type)
    assert is_valid is False
    type_errors = [e for e in result.errors if e.field == "leave_type"]
    assert len(type_errors) == 1
    assert type_errors[0].code == "invalid_leave_type"


def test_validator_malformed_dates():
    malformed = {
        "leave_type": "annual",
        "start_date": "20-09-2026",  # Non-ISO
        "end_date": "tomorrow",      # String instead of ISO
        "reason": "Personal rest day",
    }
    is_valid, sanitized, result = validate_leave_fields(malformed)
    assert is_valid is False
    date_errors = [e for e in result.errors if e.field in ("start_date", "end_date")]
    assert len(date_errors) == 2
    assert all(e.code == "invalid_date_format" for e in date_errors)


def test_validator_reversed_dates():
    reversed_range = {
        "leave_type": "annual",
        "start_date": "2026-09-25",
        "end_date": "2026-09-20",  # end before start
        "reason": "Personal rest day",
    }
    is_valid, sanitized, result = validate_leave_fields(reversed_range)
    assert is_valid is False
    order_errors = [e for e in result.errors if e.code == "invalid_date_range"]
    assert len(order_errors) == 1
    assert "cannot be earlier than start date" in order_errors[0].message


def test_validator_reason_bounds():
    # Reason too short (<5 chars)
    short = {
        "leave_type": "emergency",
        "start_date": "2026-09-20",
        "end_date": "2026-09-20",
        "reason": "sick",  # 4 chars
    }
    is_valid, sanitized, result = validate_leave_fields(short)
    assert is_valid is False
    reason_errors = [e for e in result.errors if e.field == "reason"]
    assert len(reason_errors) == 1
    assert reason_errors[0].code == "reason_too_short"

    # Reason too long (>1000 chars)
    long_reason = {
        "leave_type": "emergency",
        "start_date": "2026-09-20",
        "end_date": "2026-09-20",
        "reason": "x" * 1001,
    }
    is_valid, sanitized, result = validate_leave_fields(long_reason)
    assert is_valid is False
    long_errors = [e for e in result.errors if e.code == "reason_too_long"]
    assert len(long_errors) == 1


@pytest.mark.asyncio
async def test_intent_classification_single_retry_success():
    """Verify that a flawed first extraction retries exactly once and succeeds."""
    mock_client = AsyncMock()

    # Pass 1 response: malformed date
    pass1_content = '{"intent": "leave_request", "confidence": 0.9, "extracted_fields": {"leave_type": "emergency", "start_date": "tomorrow", "end_date": "tomorrow", "reason": "car broken"}}'
    # Pass 2 response: fixed ISO dates
    pass2_content = '{"intent": "leave_request", "confidence": 0.95, "extracted_fields": {"leave_type": "emergency", "start_date": "2026-09-17", "end_date": "2026-09-17", "reason": "car broken down on highway"}}'

    msg1 = MagicMock()
    msg1.message.content = pass1_content
    msg2 = MagicMock()
    msg2.message.content = pass2_content

    mock_client.chat.side_effect = [msg1, msg2]

    result = await classify_intent_and_extract_fields("I need emergency leave tomorrow", client=mock_client, max_retries=1)

    assert mock_client.chat.call_count == 2
    assert result.intent == "leave_request"
    assert result.extraction_validation is not None
    assert result.extraction_validation.status == ExtractionValidationStatus.VALID
    assert result.extracted_fields.start_date == "2026-09-17"


@pytest.mark.asyncio
async def test_intent_classification_max_retry_exhausted_returns_clarification():
    """Verify that when retry fails again, max retry count of 1 is strictly enforced and status is needs_clarification."""
    mock_client = AsyncMock()

    # Both passes return missing reason and bad date
    pass_content = '{"intent": "leave_request", "confidence": 0.9, "extracted_fields": {"leave_type": "emergency", "start_date": null, "end_date": null, "reason": null}}'
    msg = MagicMock()
    msg.message.content = pass_content

    mock_client.chat.side_effect = [msg, msg]

    result = await classify_intent_and_extract_fields("I want leave", client=mock_client, max_retries=1)

    # Exactly 2 calls (1 initial + 1 retry)
    assert mock_client.chat.call_count == 2
    assert result.intent == "leave_request"
    assert result.extraction_validation.status == ExtractionValidationStatus.NEEDS_CLARIFICATION
    assert "start_date" in result.extraction_validation.missing_fields
    assert "reason" in result.extraction_validation.missing_fields


def test_leave_create_request_direct_api_validation_bypass_prevention():
    """Verify that LeaveCreateRequest Pydantic model rejects bad inputs from direct API bypass attempts."""
    # 1. Invalid date range
    with pytest.raises(ValidationError) as exc:
        LeaveCreateRequest(
            leave_type=LeaveType.EMERGENCY,
            start_date=date(2026, 9, 20),
            end_date=date(2026, 9, 19),
            reason="Valid reason here",
        )
    assert "end_date cannot be earlier than start_date" in str(exc.value)

    # 2. Short reason
    with pytest.raises(ValidationError) as exc:
        LeaveCreateRequest(
            leave_type=LeaveType.MEDICAL,
            start_date=date(2026, 9, 20),
            end_date=date(2026, 9, 20),
            reason="sick",
        )
    assert "at least 5 characters" in str(exc.value) or "min_length" in str(exc.value) or "String should have at least 5 characters" in str(exc.value)

    # 3. Invalid enum
    with pytest.raises(ValidationError):
        LeaveCreateRequest(
            leave_type="unsupported_type",  # type: ignore
            start_date=date(2026, 9, 20),
            end_date=date(2026, 9, 20),
            reason="Valid reason here",
        )
