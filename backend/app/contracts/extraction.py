import enum
from typing import List
from pydantic import BaseModel, Field


class ExtractionValidationStatus(str, enum.Enum):
    VALID = "valid"
    NEEDS_CLARIFICATION = "needs_clarification"
    INVALID = "invalid"


class ExtractionValidationError(BaseModel):
    field: str = Field(..., description="Name of the field failing validation")
    code: str = Field(..., description="Machine-readable error code (e.g. invalid_enum, inverted_dates)")
    message: str = Field(..., description="Human-readable clarification or error description")


class ExtractionValidationResult(BaseModel):
    status: ExtractionValidationStatus = Field(
        ..., description="Validation disposition: valid, needs_clarification, or invalid"
    )
    missing_fields: List[str] = Field(
        default_factory=list, description="List of required leave fields not extracted"
    )
    errors: List[ExtractionValidationError] = Field(
        default_factory=list, description="Validation issues identified in extracted fields"
    )
