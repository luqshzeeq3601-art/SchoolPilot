import re
from datetime import date
from typing import Any, Dict, List, Optional, Tuple
from app.leave.models import LeaveType
from app.contracts.extraction import (
    ExtractionValidationStatus,
    ExtractionValidationError,
    ExtractionValidationResult,
)
from app.chat.schemas import LeaveFields

ALLOWED_LEAVE_TYPES = {t.value for t in LeaveType}
ISO_DATE_REGEX = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def parse_iso_date(value: Any) -> Optional[date]:
    """Parse date from ISO string YYYY-MM-DD or date object."""
    if isinstance(value, date):
        return value
    if not isinstance(value, str):
        return None
    val_str = value.strip()
    if not ISO_DATE_REGEX.match(val_str):
        return None
    try:
        return date.fromisoformat(val_str)
    except (ValueError, TypeError):
        return None


def validate_leave_fields(
    raw_fields: Dict[str, Any] | LeaveFields | None,
) -> Tuple[bool, Optional[LeaveFields], ExtractionValidationResult]:
    """
    Canonical validation gate for leave extraction.
    Enforces strict typing, ISO dates, date order, and reason bounds.
    """
    if raw_fields is None:
        return (
            False,
            None,
            ExtractionValidationResult(
                status=ExtractionValidationStatus.NEEDS_CLARIFICATION,
                missing_fields=["leave_type", "start_date", "end_date", "reason"],
                errors=[
                    ExtractionValidationError(
                        field="all",
                        code="missing_all_fields",
                        message="Please provide leave type, dates, and reason for your request.",
                    )
                ],
            ),
        )

    if isinstance(raw_fields, LeaveFields):
        data = raw_fields.model_dump(exclude_none=False)
    else:
        data = dict(raw_fields)

    errors: List[ExtractionValidationError] = []
    missing_fields: List[str] = []

    # 1. Validate leave_type
    raw_type = data.get("leave_type")
    sanitized_type: Optional[str] = None
    if not raw_type:
        missing_fields.append("leave_type")
        errors.append(
            ExtractionValidationError(
                field="leave_type",
                code="missing_required_field",
                message="Leave type is required (e.g. emergency, medical, annual, compassionate).",
            )
        )
    else:
        normalized_type = str(raw_type).strip().lower()
        if normalized_type not in ALLOWED_LEAVE_TYPES:
            errors.append(
                ExtractionValidationError(
                    field="leave_type",
                    code="invalid_leave_type",
                    message=f"Invalid leave type '{raw_type}'. Allowed types: {', '.join(sorted(ALLOWED_LEAVE_TYPES))}.",
                )
            )
        else:
            sanitized_type = normalized_type

    # 2. Validate start_date
    raw_start = data.get("start_date")
    parsed_start: Optional[date] = None
    if not raw_start:
        missing_fields.append("start_date")
        errors.append(
            ExtractionValidationError(
                field="start_date",
                code="missing_required_field",
                message="Start date is required in YYYY-MM-DD format.",
            )
        )
    else:
        parsed_start = parse_iso_date(raw_start)
        if parsed_start is None:
            errors.append(
                ExtractionValidationError(
                    field="start_date",
                    code="invalid_date_format",
                    message=f"Invalid start date '{raw_start}'. Must be in YYYY-MM-DD ISO format.",
                )
            )

    # 3. Validate end_date
    raw_end = data.get("end_date")
    parsed_end: Optional[date] = None
    if not raw_end:
        missing_fields.append("end_date")
        errors.append(
            ExtractionValidationError(
                field="end_date",
                code="missing_required_field",
                message="End date is required in YYYY-MM-DD format.",
            )
        )
    else:
        parsed_end = parse_iso_date(raw_end)
        if parsed_end is None:
            errors.append(
                ExtractionValidationError(
                    field="end_date",
                    code="invalid_date_format",
                    message=f"Invalid end date '{raw_end}'. Must be in YYYY-MM-DD ISO format.",
                )
            )

    # 4. Validate date range order
    if parsed_start and parsed_end and parsed_end < parsed_start:
        errors.append(
            ExtractionValidationError(
                field="end_date",
                code="invalid_date_range",
                message=f"End date ({parsed_end.isoformat()}) cannot be earlier than start date ({parsed_start.isoformat()}).",
            )
        )

    # 5. Validate reason
    raw_reason = data.get("reason")
    sanitized_reason: Optional[str] = None
    if not raw_reason:
        missing_fields.append("reason")
        errors.append(
            ExtractionValidationError(
                field="reason",
                code="missing_required_field",
                message="Reason is required (minimum 5 characters).",
            )
        )
    else:
        trimmed_reason = str(raw_reason).strip()
        if len(trimmed_reason) < 5:
            errors.append(
                ExtractionValidationError(
                    field="reason",
                    code="reason_too_short",
                    message=f"Reason is too short ({len(trimmed_reason)} characters). Minimum 5 characters required.",
                )
            )
        elif len(trimmed_reason) > 1000:
            errors.append(
                ExtractionValidationError(
                    field="reason",
                    code="reason_too_long",
                    message=f"Reason exceeds maximum allowed length of 1000 characters.",
                )
            )
        else:
            sanitized_reason = trimmed_reason

    # 6. Validate covering_teacher
    raw_covering = data.get("covering_teacher")
    sanitized_covering: Optional[str] = None
    if raw_covering:
        sanitized_covering = str(raw_covering).strip()[:255]

    # Construct sanitized LeaveFields
    sanitized_fields = LeaveFields(
        leave_type=sanitized_type or (str(raw_type) if raw_type else None),
        start_date=parsed_start.isoformat() if parsed_start else (str(raw_start) if raw_start else None),
        end_date=parsed_end.isoformat() if parsed_end else (str(raw_end) if raw_end else None),
        reason=sanitized_reason or (str(raw_reason) if raw_reason else None),
        covering_teacher=sanitized_covering,
    )

    is_valid = len(errors) == 0
    status = (
        ExtractionValidationStatus.VALID
        if is_valid
        else (
            ExtractionValidationStatus.NEEDS_CLARIFICATION
            if (missing_fields or errors)
            else ExtractionValidationStatus.INVALID
        )
    )

    validation_result = ExtractionValidationResult(
        status=status,
        missing_fields=missing_fields,
        errors=errors,
    )

    return (is_valid, sanitized_fields, validation_result)
