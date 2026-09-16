import json
import os
from datetime import date
import pytest
from app.leave.working_days import calculate_working_days


def _load_workflow(filename: str) -> dict:
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    wf_path = os.path.join(repo_root, "workflows", filename)
    assert os.path.exists(wf_path), f"Workflow file not found: {wf_path}"
    with open(wf_path, "r", encoding="utf-8") as f:
        return json.load(f)


# --- Working Days Calculator Tests ---

def test_working_days_same_day_weekday():
    # Wednesday 2026-09-16
    assert calculate_working_days(date(2026, 9, 16), date(2026, 9, 16)) == 1
    assert calculate_working_days("2026-09-16", "2026-09-16") == 1


def test_working_days_same_day_weekend():
    # Saturday 2026-09-19
    assert calculate_working_days(date(2026, 9, 19), date(2026, 9, 19)) == 0
    # Sunday 2026-09-20
    assert calculate_working_days(date(2026, 9, 20), date(2026, 9, 20)) == 0


def test_working_days_weekend_only_range():
    # Saturday to Sunday (2026-09-19 to 2026-09-20)
    assert calculate_working_days("2026-09-19", "2026-09-20") == 0


def test_working_days_full_work_week():
    # Monday to Friday (2026-09-21 to 2026-09-25)
    assert calculate_working_days("2026-09-21", "2026-09-25") == 5


def test_working_days_cross_weekend():
    # Thursday to Tuesday (2026-09-17 to 2026-09-22): Thu, Fri, Mon, Tue = 4
    assert calculate_working_days("2026-09-17", "2026-09-22") == 4


def test_working_days_two_full_weeks():
    # Monday 2026-09-21 to Friday 2026-10-02 = 10 working days
    assert calculate_working_days("2026-09-21", "2026-10-02") == 10


def test_working_days_month_and_year_boundaries():
    # Cross month: Sep 30 (Wed) to Oct 2 (Fri) = 3 working days
    assert calculate_working_days("2026-09-30", "2026-10-02") == 3
    # Cross year: Dec 31, 2026 (Thu) to Jan 4, 2027 (Mon) -> Thu, Fri, Mon = 3 working days
    assert calculate_working_days("2026-12-31", "2027-01-04") == 3


def test_working_days_inverted_dates_raises_error():
    with pytest.raises(ValueError) as exc:
        calculate_working_days("2026-09-25", "2026-09-20")
    assert "cannot be earlier than start_date" in str(exc.value)


def test_working_days_invalid_date_format():
    with pytest.raises(ValueError):
        calculate_working_days("invalid-date", "2026-09-20")


# --- Sub-workflows & Parent Contract Tests ---

def test_leave_routing_child_workflow_contract():
    wf = _load_workflow("leave_routing_child.json")
    node_types = {n["type"]: n for n in wf["nodes"]}

    assert "n8n-nodes-base.executeWorkflowTrigger" in node_types
    assert "n8n-nodes-base.code" in node_types
    assert "Validate & Route Approver" in [n["name"] for n in wf["nodes"]]


def test_hris_sync_child_workflow_contract():
    wf = _load_workflow("hris_sync_child.json")
    node_types = {n["type"]: n for n in wf["nodes"]}

    assert "n8n-nodes-base.executeWorkflowTrigger" in node_types
    assert "n8n-nodes-base.code" in node_types
    assert "n8n-nodes-base.httpRequest" in node_types

    http_node = node_types["n8n-nodes-base.httpRequest"]
    assert "mock-hris/sync-payroll" in http_node["parameters"]["url"]
    headers = {p["name"]: p["value"] for p in http_node["parameters"]["headerParameters"]["parameters"]}
    assert "X-N8N-API-KEY" in headers
    assert "Idempotency-Key" in headers
    assert "mock-hris:payroll:v1:" in headers["Idempotency-Key"]


def test_parent_leave_approval_workflow_contract():
    wf = _load_workflow("leave_approval_workflow.json")
    node_types = {n["type"]: n for n in wf["nodes"]}
    node_names = {n["name"]: n for n in wf["nodes"]}

    assert "n8n-nodes-base.webhook" in node_types
    assert "n8n-nodes-base.executeWorkflow" in node_types
    assert "n8n-nodes-base.respondToWebhook" in node_types

    # Verify both sub-workflows are referenced
    exec_nodes = [n for n in wf["nodes"] if n["type"] == "n8n-nodes-base.executeWorkflow"]
    assert len(exec_nodes) == 2
    wf_ids = {n["parameters"]["workflowId"] for n in exec_nodes}
    assert "LeaveRoute00001" in wf_ids
    assert "HrisSync0000001" in wf_ids

    # Verify both wait for sub-workflow completion
    assert all(n["parameters"]["options"]["waitForSubWorkflow"] is True for n in exec_nodes)
