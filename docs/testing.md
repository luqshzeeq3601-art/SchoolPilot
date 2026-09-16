# SchoolPilot — Testing Strategy & Verification Guide

## 1. Overview

SchoolPilot maintains a multi-layered verification strategy combining automated unit tests, backend security and integration suites, live end-to-end multi-role workflows, and automated accessibility (WCAG 2.1 AA) audits.

---

## 2. Test Suites Structure

```
backend/tests/
├── conftest.py                   # Pytest fixtures, test database setup, mock tokens
├── test_audit_fixes.py           # Security regressions, bounds checks, rate limits, headers
├── test_auth.py                  # Password hashing, JWT token lifecycle, invalid tokens
├── test_documents.py             # Document parsers, chunking logic, context enrichment
├── test_leave.py                 # Leave request creation, date validation, approval states
├── test_security_hardening.py    # RBAC authorization, SQL injection, input sanitization
└── test_integration_flow.py      # Multi-role live workflow (Teacher -> HoD -> Admin)

scripts/
└── run_e2e_audit.mjs             # Playwright multi-role browser audit & Axe-core WCAG AA
```

---

## 3. Running Automated Tests

### 3.1 Backend Test Suite (Pytest)

Run all backend unit, security, and integration tests:

```bash
# Set PYTHONPATH to backend and execute pytest
$env:PYTHONPATH="backend"; pytest backend/tests -v
```

Expected output:
```text
backend/tests/test_audit_fixes.py::test_approve_non_pending_rejected PASSED
backend/tests/test_auth.py::test_password_hashing PASSED
backend/tests/test_auth.py::test_jwt_token_generation_and_decoding PASSED
backend/tests/test_documents.py::test_markdown_chunking_and_context_enrichment PASSED
backend/tests/test_integration_flow.py::test_01_authentication_roles PASSED
backend/tests/test_integration_flow.py::test_02_document_rag_retrieval PASSED
backend/tests/test_integration_flow.py::test_03_intent_detection_actionable_leave PASSED
backend/tests/test_integration_flow.py::test_04_full_leave_request_approval_audit_flow PASSED
backend/tests/test_leave.py::test_valid_leave_create_request PASSED
backend/tests/test_security_hardening.py::test_hod_cross_department_forbidden PASSED
...
======================= 33 passed in ~45s =======================
```

### 3.2 Frontend Build & TypeScript Type Checking

Validate TypeScript contracts, component props, and production Vite bundling:

```bash
cd frontend
npm run build
```

Expected output:
```text
> schoolpilot-frontend@1.0.0 build
> tsc && vite build

vite v5.4.21 building for production...
✓ 1589 modules transformed.
✓ built in ~2.8s
```

### 3.3 Live Backend E2E Workflow Verification

Execute a standalone verification of all 5 operational steps against a running Docker or local instance:

```bash
python backend/scripts/verify_live_e2e.py
```

Validates:
1. **Teacher Login**: Token issuance and role metadata.
2. **Policy RAG Query**: Context retrieval, grounded citation generation, and actionable leave intent detection.
3. **Guided Leave Submission**: Auto-fill submission and database persistence.
4. **HoD Queue & Approval**: Pending queue filtering, review notes attachment, and state transition to `approved`.
5. **Admin Audit Verification**: Immutable audit record verification and timestamp validation.

### 3.4 Multi-Role Browser E2E & Accessibility Audit (Playwright + Axe-core)

Execute the full browser audit across responsive breakpoints (1440x900, 1024x768, 768x1024, 375x667):

```bash
node scripts/run_e2e_audit.mjs
```

Audits:
- Login page validation & password toggle interaction.
- Teacher policy Q&A, citation modal expansions, and leave form rendering.
- HoD queue actions and rejection modal with keyboard Escape navigation.
- Admin dashboard metrics, document uploads, and audit log JSON inspector.
- WCAG 2.1 AA accessibility standards evaluated with `axe-core`.

---

## 4. Quality Assurance Summary

| Test Area | Tool / Framework | Target / Threshold | Result |
|---|---|---|---|
| **Backend Unit & Logic** | Pytest 9 + AsyncIO | 100% Pass | **33 / 33 Passed** |
| **Frontend Typing & Build** | TypeScript 5.6 + Vite | 0 Errors | **0 Errors, Clean Build** |
| **RBAC Security Hardening** | Pytest + HTTPX | All unauthorized paths blocked (403) | **Passed** |
| **Cross-Platform Responsive** | Playwright (Desktop, Tablet, Mobile) | Zero layout overflow or clipping | **Passed** |
| **Accessibility Standards** | Axe-core Playwright | WCAG 2.1 AA compliance | **0 Blocking Violations** |
