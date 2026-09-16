# ADR-005: Mock HRIS Payroll API, Entitlements, and Idempotency

## Status
Accepted

## Context
Approved leave requests required automated deduction from employee leave balances and synchronization with payroll systems. In the absence of an external HRIS vendor integration, an institutional Mock HRIS was required with idempotent execution, row-level concurrency protection, and realistic Malaysian educational leave policies.

## Decision
1. **Mock HRIS Endpoints & Database Persistence**:
   - Implemented `/api/v1/mock-hris/sync-payroll` and balance inspection endpoints in FastAPI.
   - Created PostgreSQL persistence models `MockHrisBalance` and `MockHrisSync` with unique indexes and foreign keys.
   - Seeded synthetic default entitlements: Annual (14), Medical (14), Emergency (7), Compassionate (3), Maternity (98), Paternity (7), Unpaid (0).

2. **Idempotency & Concurrency Hardening**:
   - Enforced canonical idempotency keys with format `mock-hris:payroll:v1:<leave_id>` and SHA-256 payload fingerprinting (`compute_payload_hash`).
   - Implemented row-level locking (`with_for_update`) during balance updates to prevent race conditions during concurrent deduction attempts.
   - On replay with identical hash, returned the cached original sync response (`HTTP 200`). On replay with conflicting payload hash, rejected with `HTTP 409 Conflict`.

3. **Decoupled Approval Event Dispatch**:
   - HoD approval persists directly in PostgreSQL before initiating asynchronous n8n event dispatch.
   - Client webhook invocations implement exponential backoff with bounded retries (max 3 attempts) for transient errors (`408, 429, 5xx`), while failing fast on non-retryable `4xx` client errors.

## Consequences
- Guaranteed exactly-once balance deductions even with workflow retries.
- Zero data loss or approval rollbacks caused by transient downstream integration hiccups.
- Fully auditable payroll synchronization logs.
