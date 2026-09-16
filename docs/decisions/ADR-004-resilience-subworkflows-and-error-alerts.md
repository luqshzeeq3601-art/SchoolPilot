# ADR-004: Resilience, Sub-Workflows, and Error Alerting

## Status
Accepted

## Context
Initial workflow orchestration handled approver routing in a monolithic n8n workflow. Failures in external integrations were untracked, and AI extraction of leave parameters from chat queries had loose validation, allowing invalid dates or missing required fields to slip through to the user interface.

## Decision
1. **Strict AI Validation & Repair Gate**:
   - Implemented `validate_leave_fields` in FastAPI backend checking `start_date <= end_date`, future date validation, length constraints, and required fields.
   - Incorporated a bounded single-retry repair prompt for the LLM when initial extraction produces invalid fields, before falling back gracefully to manual input.
   - Prevented frontend form defaults from silently masking missing AI dates.

2. **Parent & Child Sub-Workflow Architecture**:
   - Decomposed the leave approval workflow into a parent orchestrator (`leave_approval_workflow.json`) and modular sub-workflows:
     - `leave_routing_child.json`: Department-based approver classification and notification dispatch.
     - `hris_sync_child.json`: Working-day calculation (Monday–Friday) and Mock HRIS payroll synchronization.

3. **Error Alert Workflow & Sanitization**:
   - Created `error_alert_workflow.json` as a centralized error handler configured via `settings.errorWorkflow: "ErrAlert00000001"` in parent workflows.
   - Sanitized and redacted sensitive personal/medical employee details before dispatching failure notifications.
   - Configured `errorWorkflow: null` on the error alert workflow itself to eliminate recursive failure loops.

## Consequences
- Resilient failure recovery with clear audit trails.
- Zero payload or medical privacy leakage during alert broadcasts.
- Modular workflow maintenance and testability.
