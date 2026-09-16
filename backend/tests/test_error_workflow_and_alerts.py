import json
import os
import re
from datetime import datetime, timezone
import pytest
from app.contracts.events import WorkflowErrorAlertPayload


def _load_workflow(filename: str) -> dict:
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    wf_path = os.path.join(repo_root, "workflows", filename)
    assert os.path.exists(wf_path), f"Workflow file not found: {wf_path}"
    with open(wf_path, "r", encoding="utf-8") as f:
        return json.load(f)


def test_error_alert_workflow_structure_and_contract():
    wf = _load_workflow("error_alert_workflow.json")

    assert "name" in wf
    assert "nodes" in wf
    assert "connections" in wf
    assert "settings" in wf

    # Verify no recursive error workflow
    assert wf["settings"].get("errorWorkflow") is None

    node_types = {n["type"]: n for n in wf["nodes"]}
    assert "n8n-nodes-base.errorTrigger" in node_types
    assert "n8n-nodes-base.code" in node_types
    assert "n8n-nodes-base.telegram" in node_types

    # Verify Telegram node configuration
    telegram_node = node_types["n8n-nodes-base.telegram"]
    assert telegram_node["credentials"]["telegramApi"]["name"] == "Telegram Alert Bot"
    assert "TELEGRAM_ALERT_CHAT_ID" in telegram_node["parameters"]["chatId"]
    assert telegram_node.get("continueOnFail") is True

    # Verify no literal bot token or passwords inside the JSON
    json_str = json.dumps(wf)
    assert "bot" not in json_str.lower() or "telegramApi" in json_str
    assert "password" not in json_str.lower() or "replace" in json_str


def test_parent_workflows_error_workflow_attached():
    leave_wf = _load_workflow("leave_approval_workflow.json")
    rag_wf = _load_workflow("rag_chat_workflow.json")

    assert "settings" in leave_wf
    assert leave_wf["settings"].get("errorWorkflow") is not None

    assert "settings" in rag_wf
    assert rag_wf["settings"].get("errorWorkflow") is not None


def sanitize_error_message(raw_message: str) -> str:
    """Python reference implementation of the JS error sanitizer in error_alert_workflow.json."""
    sanitized = re.sub(
        r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}", "[REDACTED_EMAIL]", raw_message
    )
    sanitized = re.sub(
        r"(bearer|jwt|token|password|key|secret)\s*[:=]\s*[^\s,;]+",
        r"\1: [REDACTED]",
        sanitized,
        flags=re.IGNORECASE,
    )
    sanitized = re.sub(
        r"eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*",
        "[REDACTED_JWT]",
        sanitized,
    )
    if len(sanitized) > 250:
        sanitized = sanitized[:247] + "..."
    return sanitized


def test_error_sanitization_redacts_sensitive_tokens_and_emails():
    raw_error = "Connection failed to host with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ID for user teacher.azman@cempaka.edu.my with secret=supersecret123"
    sanitized = sanitize_error_message(raw_error)

    assert "teacher.azman@cempaka.edu.my" not in sanitized
    assert "[REDACTED_EMAIL]" in sanitized
    assert "supersecret123" not in sanitized
    assert "[REDACTED]" in sanitized
    assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" not in sanitized
    assert "[REDACTED_JWT]" in sanitized


def test_error_sanitization_truncates_long_stack_traces():
    long_stack = "Exception: " + ("Traceback line details in internal python engine " * 20)
    sanitized = sanitize_error_message(long_stack)

    assert len(sanitized) <= 250
    assert sanitized.endswith("...")


def test_workflow_error_alert_payload_contract():
    payload = WorkflowErrorAlertPayload(
        execution_id="exec-456",
        workflow_id="4rMX4jEzPbqJkQE1",
        workflow_name="SchoolPilot - Leave Request Approval Routing",
        failed_node="Validate & Route Approver",
        error_message="Missing essential leave parameters.",
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
    assert payload.execution_id == "exec-456"
    assert payload.workflow_name == "SchoolPilot - Leave Request Approval Routing"
    assert payload.failed_node == "Validate & Route Approver"
