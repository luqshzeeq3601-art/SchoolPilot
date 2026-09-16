import json
from datetime import date
from app.config import settings
from app.documents.embedder import get_ollama_client
from app.chat.schemas import IntentClassification, LeaveFields


INTENT_PROMPT = f"""Analyze the staff member's message and determine if they are merely asking an informational question ("info_query"), OR expressing an intent/desire to actually apply or take leave ("leave_request").

Today's date is: {date.today().isoformat()}

Examples:
- "What is the policy for emergency leave?" -> intent: "info_query"
- "How many days of MC do I have?" -> intent: "info_query"
- "I need emergency leave tomorrow because my car broke down" -> intent: "leave_request", leave_type: "emergency", reason: "car broke down"
- "I want to apply for medical leave for next Monday, Mr. Lee will cover" -> intent: "leave_request", leave_type: "medical", covering_teacher: "Mr. Lee"
- "Can I take leave next week?" -> intent: "info_query" (asking about possibility, not applying yet)
- "Please submit my emergency leave for today" -> intent: "leave_request", leave_type: "emergency"

If intent is "leave_request", extract all mentioned fields (leave_type, start_date, end_date, reason, covering_teacher). If a field is not mentioned, leave it null.
Return valid JSON adhering to the schema.
"""


async def classify_intent_and_extract_fields(query: str) -> IntentClassification:
    """Detect whether user query is informational or an actionable leave submission."""
    client = await get_ollama_client()

    try:
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
        if "intent" not in data:
            data["intent"] = "info_query"
        if "confidence" not in data:
            data["confidence"] = 0.95
        if data.get("intent") == "leave_request" and "extracted_fields" not in data:
            extracted = {}
            for field in ["leave_type", "start_date", "end_date", "reason", "covering_teacher"]:
                if field in data and data[field] is not None:
                    extracted[field] = data[field]
            if extracted:
                data["extracted_fields"] = extracted
        return IntentClassification.model_validate(data)
    except Exception:
        # Graceful fallback: basic regex/keyword matching if LLM call fails
        query_lower = query.lower()
        is_actionable = any(phrase in query_lower for phrase in [
            "i want to apply", "i need to apply", "apply for leave", "submit leave",
            "taking leave tomorrow", "i need emergency leave", "apply emergency leave",
            "apply medical leave"
        ])
        if is_actionable:
            leave_type = "emergency" if "emergency" in query_lower else ("medical" if "medical" in query_lower else "annual")
            return IntentClassification(
                intent="leave_request",
                confidence=0.85,
                extracted_fields=LeaveFields(leave_type=leave_type, reason=query),
            )
        return IntentClassification(
            intent="info_query",
            confidence=0.9,
            extracted_fields=None,
        )
