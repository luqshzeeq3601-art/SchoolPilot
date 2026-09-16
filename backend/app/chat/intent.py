import json
import logging
from datetime import date
from typing import Any, Dict, Optional
from app.config import settings
from app.documents.embedder import get_ollama_client
from app.chat.schemas import IntentClassification, LeaveFields
from app.contracts.extraction import (
    ExtractionValidationStatus,
    ExtractionValidationError,
    ExtractionValidationResult,
)
from app.leave.validator import validate_leave_fields

logger = logging.getLogger(__name__)

INTENT_PROMPT = f"""Analyze the staff member's message and determine if they are merely asking an informational question ("info_query"), OR expressing an intent/desire to actually apply or take leave ("leave_request").

Today's date is: {date.today().isoformat()}

Allowed leave types: emergency, medical, annual, compassionate, maternity, paternity, unpaid.

Examples:
- "What is the policy for emergency leave?" -> intent: "info_query"
- "How many days of MC do I have?" -> intent: "info_query"
- "I need emergency leave tomorrow because my car broke down" -> intent: "leave_request", leave_type: "emergency", start_date: "YYYY-MM-DD", end_date: "YYYY-MM-DD", reason: "car broke down"
- "I want to apply for medical leave for next Monday, Mr. Lee will cover" -> intent: "leave_request", leave_type: "medical", covering_teacher: "Mr. Lee"
- "Can I take leave next week?" -> intent: "info_query" (asking about possibility, not applying yet)
- "Please submit my emergency leave for today" -> intent: "leave_request", leave_type: "emergency"

If intent is "leave_request", extract all mentioned fields:
- leave_type: one of emergency, medical, annual, compassionate, maternity, paternity, unpaid
- start_date: in YYYY-MM-DD format (convert relative dates like 'today', 'tomorrow', 'next Monday' using today's date)
- end_date: in YYYY-MM-DD format
- reason: the declared reason for leave
- covering_teacher: nominated relief teacher if mentioned

If a field is not mentioned or cannot be determined, set it to null.
Return valid JSON adhering to:
{{
  "intent": "info_query" | "leave_request",
  "confidence": float (0.0 to 1.0),
  "extracted_fields": {{
    "leave_type": string | null,
    "start_date": string | null,
    "end_date": string | null,
    "reason": string | null,
    "covering_teacher": string | null
  }}
}}
"""


def _build_retry_prompt(errors: list[ExtractionValidationError], missing_fields: list[str]) -> str:
    err_descriptions = "\n".join(f"- {e.field}: {e.message}" for e in errors)
    missing_desc = ", ".join(missing_fields) if missing_fields else "None"
    return f"""The previous extraction had validation issues:
{err_descriptions}
Missing required fields: {missing_desc}

Today's date is: {date.today().isoformat()}
Please re-extract the leave fields from the user's message with strict adherence to:
- Valid leave_type: emergency, medical, annual, compassionate, maternity, paternity, unpaid
- Valid ISO dates: YYYY-MM-DD (start_date <= end_date)
- Reason: minimum 5 characters

If a required field is truly not mentioned in the user message, set it to null.
Return valid JSON only."""


async def classify_intent_and_extract_fields(
    query: str, client: Any = None, max_retries: int = 1
) -> IntentClassification:
    """Detect whether user query is informational or an actionable leave submission with strict validation gate."""
    if client is None:
        client = await get_ollama_client()

    retry_count = 0
    try:
        # Pass 1: Primary LLM classification & extraction
        response = await client.chat(
            model=settings.LLM_MODEL,
            messages=[
                {"role": "system", "content": INTENT_PROMPT},
                {"role": "user", "content": query},
            ],
            format="json",
            options={"temperature": 0.0, "num_ctx": 2048},
        )
        data = json.loads(response.message.content)
        intent = data.get("intent", "info_query")
        confidence = float(data.get("confidence", 0.95))

        if intent != "leave_request":
            return IntentClassification(
                intent="info_query",
                confidence=confidence,
                extracted_fields=None,
                extraction_validation=None,
            )

        raw_fields = data.get("extracted_fields") or {}
        if not isinstance(raw_fields, dict):
            raw_fields = {}
        # Also check top-level keys if LLM flattened them
        for f in ["leave_type", "start_date", "end_date", "reason", "covering_teacher"]:
            if f in data and f not in raw_fields:
                raw_fields[f] = data[f]

        is_valid, sanitized_fields, val_result = validate_leave_fields(raw_fields)

        # If valid on pass 1, return immediately
        if is_valid:
            return IntentClassification(
                intent="leave_request",
                confidence=confidence,
                extracted_fields=sanitized_fields,
                extraction_validation=val_result,
            )

        # Pass 2: Exactly ONE schema-constrained re-extraction retry if validation failed
        if retry_count < max_retries:
            retry_count += 1
            logger.info(f"Triggering re-extraction retry {retry_count}/{max_retries} for query: {query}")
            try:
                retry_prompt = _build_retry_prompt(val_result.errors, val_result.missing_fields)
                retry_response = await client.chat(
                    model=settings.LLM_MODEL,
                    messages=[
                        {"role": "system", "content": INTENT_PROMPT},
                        {"role": "user", "content": query},
                        {"role": "assistant", "content": response.message.content},
                        {"role": "user", "content": retry_prompt},
                    ],
                    format="json",
                    options={"temperature": 0.0, "num_ctx": 2048},
                )
                retry_data = json.loads(retry_response.message.content)
                retry_raw_fields = retry_data.get("extracted_fields") or {}
                if not isinstance(retry_raw_fields, dict):
                    retry_raw_fields = {}
                for f in ["leave_type", "start_date", "end_date", "reason", "covering_teacher"]:
                    if f in retry_data and f not in retry_raw_fields:
                        retry_raw_fields[f] = retry_data[f]

                is_valid2, sanitized_fields2, val_result2 = validate_leave_fields(retry_raw_fields)
                return IntentClassification(
                    intent="leave_request",
                    confidence=confidence,
                    extracted_fields=sanitized_fields2,
                    extraction_validation=val_result2,
                )
            except Exception as re_err:
                logger.warning(f"Re-extraction retry failed: {re_err}")

        # If retry also failed or was skipped, return the initial validation result
        return IntentClassification(
            intent="leave_request",
            confidence=confidence,
            extracted_fields=sanitized_fields,
            extraction_validation=val_result,
        )

    except Exception as exc:
        logger.warning(f"Intent classification LLM call encountered error: {exc}. Using fallback.")
        # Graceful fallback: basic keyword matching if LLM call fails
        query_lower = query.lower()
        is_actionable = any(
            phrase in query_lower
            for phrase in [
                "i want to apply",
                "i need to apply",
                "apply for leave",
                "submit leave",
                "taking leave tomorrow",
                "i need emergency leave",
                "apply emergency leave",
                "apply medical leave",
            ]
        )
        if is_actionable:
            leave_type = (
                "emergency"
                if "emergency" in query_lower
                else ("medical" if "medical" in query_lower else "annual")
            )
            raw_fallback = {"leave_type": leave_type, "reason": query}
            _, sanitized_fallback, val_fallback = validate_leave_fields(raw_fallback)
            return IntentClassification(
                intent="leave_request",
                confidence=0.85,
                extracted_fields=sanitized_fallback,
                extraction_validation=val_fallback,
            )
        return IntentClassification(
            intent="info_query",
            confidence=0.9,
            extracted_fields=None,
            extraction_validation=None,
        )
