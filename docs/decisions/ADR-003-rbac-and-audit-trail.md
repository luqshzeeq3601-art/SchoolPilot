# ADR-003: Role-Based Access Control (RBAC) and Immutable Audit Logging

## Status
Accepted

## Date
2026-09-16

## Context
Educational institutions require strict separation of concerns among instructional staff, academic department heads, and central administrative officers. Furthermore, decisions affecting leave approvals, document updates, and policy interpretations require full traceability for compliance audits.

## Decision
1. **Three-Tier Role Hierarchy**:
   - **Teacher (`teacher`)**: Ask policy questions, submit leave requests with relief teacher nomination, review own leave history. Restricted from viewing other teachers' records or modifying documents.
   - **Head of Department (`hod`)**: Review and action (approve/reject with remarks) departmental leave applications, inspect staff availability, access policy Q&A.
   - **School Administrator (`admin`)**: Complete platform oversight, manage institution-wide documents, inspect live system health across Ollama/n8n/PostgreSQL, view immutable audit logs with JSON payload inspector.
2. **Immutable Audit Trail**:
   - All state-changing operations (`document_uploaded`, `document_deleted`, `leave_submitted`, `leave_approved`, `leave_rejected`, `chat_query`) write an append-only row to the `audit_logs` table.
   - Every log record stores the timestamp, actor email, actor role, IP address, action code, resource ID, and a JSON snapshot of input parameters/state changes.

## Consequences
### Positive
- Strict security boundaries enforced in both backend API dependencies (`require_roles`) and frontend route guards (`ProtectedRoute`).
- Complete traceability for institutional accountability with 1-click JSON inspection in the administrative console.
