import hashlib
import json
import uuid
from typing import Any, Dict

IDEMPOTENCY_KEY_HEADER: str = "Idempotency-Key"
N8N_API_KEY_HEADER: str = "X-N8N-API-KEY"
PAYROLL_IDEMPOTENCY_PREFIX: str = "mock-hris:payroll:v1:"


def make_payroll_idempotency_key(leave_id: uuid.UUID | str) -> str:
    """Generate deterministic idempotency key for leave payroll sync."""
    return f"{PAYROLL_IDEMPOTENCY_PREFIX}{leave_id}"


def compute_payload_hash(data: Dict[str, Any]) -> str:
    """Compute SHA-256 hash of normalized JSON payload."""
    serialized = json.dumps(data, sort_keys=True, default=str)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()
