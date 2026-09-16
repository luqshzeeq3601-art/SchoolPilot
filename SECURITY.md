# Security Policy & Hardening Guidelines

## 1. Supported Versions

Security updates are applied to the latest release of SchoolPilot:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

---

## 2. Reporting a Vulnerability

If you discover a security vulnerability in SchoolPilot, please report it responsibly:

1. **Do not disclose vulnerabilities in public GitHub issues.**
2. Email your findings and reproduction steps to the security maintainers or open a **Private Vulnerability Advisory** via GitHub Security.
3. Include:
   - Detailed description of the vulnerability.
   - Steps or proof-of-concept scripts to reproduce the issue.
   - Potential impact on confidential school records or system integrity.
4. Maintainers will acknowledge reports within 48 business hours and coordinate fix timelines before public disclosure.

---

## 3. Security Architecture & Controls

### 3.1 Authentication & Authorization
- **JWT Authentication**: User sessions use stateless HS256 JWT tokens. Token validity is verified on every authenticated API route.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions distinguish `teacher`, `hod` (Head of Department), and `admin` roles. Route-level dependency injection (`require_roles`) enforces boundaries on both backend and frontend routes.
- **Departmental Isolation**: HoDs are restricted to approving/rejecting leave applications within their designated academic department.
- **Inter-Service Authentication**: n8n webhook callbacks and internal API invocations require an internal secret key (`X-N8N-API-KEY`) validated using constant-time string comparison (`secrets.compare_digest`) to prevent timing side-channel attacks.

### 3.2 Data Isolation & Sovereignty
- **100% Local Inference**: LLM text generation (`qwen2.5:7b`) and document embedding (`nomic-embed-text`) execute on-premises via local Ollama daemons. Zero confidential policy data, staff medical records, or student information leaves the institutional perimeter.
- **Database Storage**: All embeddings and relational records are stored in self-hosted PostgreSQL with `pgvector` HNSW cosine indexing.

### 3.3 Audit Logging & Non-Repudiation
- All state-altering operations (document upload, document deletion, leave submission, approval, rejection, and policy queries) are recorded in an append-only `audit_logs` table with actor identity, IP address, timestamp, and JSON state deltas.

---

## 4. Known Local-Development Limitations & Production Deployment Checklist

When deploying SchoolPilot to institutional production environments, complete the following hardening steps:

1. **Override Default JWT Secret**:
   - The default development value (`schoolpilot_jwt_secret_key_production_32chars_minimum`) emits a security warning on startup. Generate and set a unique cryptographically random 32+ character key:
     ```bash
     openssl rand -hex 32
     ```
2. **Rotate n8n API Key & Encryption Keys**:
   - Update `N8N_API_KEY` and `N8N_ENCRYPTION_KEY` in `.env` before public or school-wide deployment.
3. **Configure HTTPS / TLS Termination**:
   - In production, place a reverse proxy (e.g., NGINX, Traefik, or Caddy) in front of the FastAPI backend and React frontend with valid TLS certificates.
4. **Restrict CORS Origins**:
   - Limit `CORS_ORIGINS` in `.env` to the institutional production domain (e.g. `https://ops.school.edu.my`).
5. **Database Credentials**:
   - Replace default PostgreSQL password (`postgres`) with a strong managed password in production.
