# ADR-001: Hybrid Orchestration Architecture (n8n Webhooks with FastAPI Direct Fallback)

## Status
Accepted

## Date
2026-09-16

## Context
SchoolPilot automates institutional administrative workflows and policy question-answering. The platform requires:
1. Visual, modifiable workflow definitions for approval chains and webhook routing that non-developer school ops staff or DevOps can inspect.
2. High reliability: the staff chatbot must continue responding even if the workflow automation container restarts, undergoes maintenance, or experiences transient latency.
3. Strict RM0 software licensing constraints using self-hosted open-source components.

## Decision
Implement a **hybrid orchestration model**:
- **Primary Route**: Requests from the React frontend are routed via n8n webhook triggers (`/webhook/chat-query` and `/webhook/leave-approval`), enabling visual multi-step event triggers, conditional approver routing, and notification dispatching.
- **Fail-Safe Fallback**: The FastAPI backend includes a direct execution path. If the n8n webhook request encounters a network error, timeout (exceeding 8 seconds), or HTTP failure, FastAPI immediately falls back to direct internal vector retrieval and local Ollama generation.
- **Inter-Service Security**: Inter-service communication between n8n and FastAPI is authenticated using a shared secret header (`X-N8N-API-KEY`) verified with constant-time string comparison (`secrets.compare_digest`).

## Consequences
### Positive
- Workflow logic (e.g., department-based approver assignment) can be visually tuned and audited inside n8n without code redeployments.
- 100% uptime resilience: Chat and leave workflows remain fully functional even if n8n is offline.
- Explicit audit logging records whether each query was orchestrated via `n8n_webhook` or `fastapi_direct`.

### Trade-Offs & Mitigations
- Managing workflow state across two systems requires automated JSON synchronization scripts (`scripts/sync_workflow_json.py`) to keep pre-configured workflows in sync with database migrations.
