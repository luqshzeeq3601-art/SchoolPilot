# 🏫 SchoolPilot — Institutional AI Operations & Workflow Automation Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3+-61DAFB.svg?logo=react&logoColor=black)](https://reactjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%20%2B%20pgvector-336791.svg?logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![n8n](https://img.shields.io/badge/n8n-Community%20Edition-FF6584.svg?logo=n8n&logoColor=white)](https://n8n.io)
[![Ollama](https://img.shields.io/badge/Ollama-Local%20Inference-white.svg?logo=ollama&logoColor=black)](https://ollama.com)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Cost](https://img.shields.io/badge/Development%20Cost-RM0%20(100%25%20Self--Hosted)-brightgreen.svg)]()

> **SchoolPilot** is an institutional operations assistant and workflow automation platform designed specifically for schools, private academies, and learning centres. Built with a strict **RM0 development cost constraint**, it runs entirely on local inference and self-hosted open-source infrastructure with zero external API dependencies.

---

## 📌 Problem Solved: The "Human Router" Bottleneck

School administrators and operations staff spend dozens of hours every week acting as manual human routers:
1. **Repetitive Policy Questions**: Fielding the same questions regarding leave entitlements, examination invigilation, emergency duty rules, and medical certificate (MC) protocols scattered across PDFs and handbook circulars.
2. **Friction in Administrative Actions**: Teachers find policies, but must switch tools or fill paper forms to submit leave, nominate relief teachers, and notify department heads.
3. **Approval Delays & Opaque Trails**: Leave requests get lost in chat groups or email inboxes without clear approver routing or immutable compliance records.
4. **Subscription & Privacy Barriers**: Commercial cloud AI tools cost thousands annually in per-seat subscriptions and pose data privacy risks with sensitive employee records.

**SchoolPilot solves this** by pairing **local RAG with verifiable citations** and **conversational guided action forms** routed directly into **visual n8n approval pipelines** — 100% on-premises with zero token costs.

---

## 🏛️ System Architecture

### High-Level Architecture Overview

The system uses a decoupled microservice architecture with 5 core layers — all self-hosted and orchestrated via Docker Compose:

![System Architecture Flowchart — 5-layer technical flow showing Client Layer (React 18) → API Gateway (FastAPI) → Automation Engine (n8n) → AI Inference (Ollama) → Persistent Storage (PostgreSQL + pgvector)](docs/System%20Architecture%20Flowchart.png)

*▲ End-to-end architecture: React Frontend → FastAPI Gateway → n8n Workflow Engine → Ollama Local AI → PostgreSQL + pgvector. Each layer is labelled with its key technologies and responsibilities.*

---

### Detailed Component Interaction Map

Full data flow between all system components including request/response paths, authentication, and AI inference routing:

![SchoolPilot AI System Architecture — Detailed component diagram showing React Frontend with Teacher/HoD/Admin roles, FastAPI Gateway with JWT Auth and Business Logic, n8n Automation with Leave Approval and RAG Orchestration workflows, Ollama AI with Qwen 2.5 LLM and nomic-embed-text, and PostgreSQL + pgvector for relational data and vector embeddings](docs/choolPilot%20AI%20System%20Architecture.png)

*▲ Detailed interaction map: labeled request/response arrows between React Frontend, FastAPI Central API Router (JWT Auth, Request Routing, Business Logic), n8n Automation (Leave Approval, RAG Orchestration), Ollama AI (LLM & Embeddings), and PostgreSQL + pgvector (User Data, Leave Records, Audit Logs, Document Embeddings).*

---

### Mermaid Technical Diagram

```mermaid
flowchart TD
    subgraph Client["Frontend Client (React 18 + Vite)"]
        UI["Tailwind UI & Lucide Icons"]
        AuthContext["Auth Context (JWT + RBAC)"]
        UI --> AuthContext
    end

    subgraph API["Backend Gateway (FastAPI Python 3.12)"]
        Router["REST Router (/api/v1)"]
        AuthM["Security & RBAC Layer"]
        Parser["Document Chunker & Parser<br/>(PDF, DOCX, MD, TXT)"]
        Retriever["pgvector HNSW Cosine Search"]
        Generator["Ollama LLM Client (JSON Schema)"]
        AuditLog["Immutable Audit Logger"]
    end

    subgraph Automation["Automation Engine (n8n Self-Hosted)"]
        ChatWf["RAG Chat Webhook<br/>(/webhook/chat-query)"]
        LeaveWf["Leave Approval Routing<br/>(/webhook/leave-approval)"]
    end

    subgraph Storage["Persistence & Vectors (PostgreSQL 16)"]
        RelationalDB[("Relational DB<br/>users, leave_requests, audit_logs")]
        VectorDB[("Vector Store<br/>documents, document_chunks (768-dim)")]
    end

    subgraph LocalAI["Local AI Engine (Ollama Host Daemon)"]
        Embedder["nomic-embed-text<br/>(768 dimensions)"]
        LLM["qwen2.5:7b / llama3.1:8b<br/>(Local GPU/CPU Inference)"]
    end

    %% Client communication
    UI -->|HTTP / REST API| Router
    Router --> AuthM
    AuthM --> RelationalDB
    Router --> AuditLog --> RelationalDB

    %% Ingestion Flow
    UI -->|Upload Policy Document| Parser
    Parser -->|Batch Texts| Embedder
    Embedder -->|768-dim Embeddings| VectorDB

    %% Hybrid Orchestration Flow
    UI -->|Primary: Query via Webhook| ChatWf
    ChatWf -->|Authenticated POST| Router
    UI -.->|Fallback: Direct API| Router

    Router --> Retriever
    Retriever -->|Cosine Similarity Query| VectorDB
    VectorDB -->|Top K Excerpts + Metadata| Retriever
    Retriever --> Generator
    Generator -->|Prompt + Context| LLM
    LLM -->|Cited JSON Response| Generator
    Generator --> UI

    %% Leave Workflow
    UI -->|Submit Guided Leave| Router
    Router --> LeaveWf
    LeaveWf -->|Route HoD / Admin Approver| RelationalDB
```

---

## 🔄 How It Works

### AI Knowledge Pipeline — From Documents to Answers

This diagram shows the complete end-to-end RAG (Retrieval-Augmented Generation) pipeline: how school policy documents are ingested, chunked, embedded, stored, retrieved, and served back as grounded answers with citations.

![SchoolPilot AI Knowledge Pipeline — 7-step flow: (1) Document Upload (PDF, DOCX, TXT) → (2) Text Chunking with metadata → (3) Vector Embedding via Ollama nomic-embed-text → (4) pgvector Storage in PostgreSQL → (5) Semantic Retrieval via similarity search → (6) FastAPI query processing and RAG orchestration → (7) React Web Dashboard with chat interface and document management](docs/SchoolPilot%20AI%20Knowledge%20Pipeline.png)

*▲ RAG Pipeline: Documents are uploaded, chunked with heading metadata, embedded locally via Ollama (nomic-embed-text), stored in pgvector, and retrieved via cosine similarity to generate cited answers through the FastAPI backend.*

---

### Automated HR Leave Approval Workflow

The leave approval process is fully automated in 5 steps — from natural language request to audit-logged completion:

![Automated HR Leave Approval Workflow — 5-step flow: (1) Request — Employee submits leave request in chat via natural conversation → (2) AI Assist — AI Assistant verifies policy compliance via RAG, checks leave rules and handbook citations → (3) Validate — Automated validation and conflict check for overlaps and missing fields → (4) Approve — Approval routing to Head of Department for review → (5) Complete — Instant notification and PostgreSQL audit log update, fully tracked](docs/Automated%20HR%20Leave%20Approval%20Workflow.png)

*▲ Leave Automation: From natural language chat request through AI policy verification, automated validation, department-based HoD routing, to immutable audit trail recording — all orchestrated via n8n.*

---

## 🛠️ Technology Stack (Strict RM0 Cost)

| Layer | Technology | Key Capabilities |
|---|---|---|
| **Frontend** | React 18 + Vite + TypeScript + Tailwind CSS | Role-based navigation, accessible modals, responsive mobile drawers, real-time citation cards |
| **Backend API** | FastAPI (Python 3.12) + Pydantic v2 + SQLAlchemy 2.0 | Async request handling, Pydantic validation, RBAC route security, PyMuPDF / python-docx extraction |
| **Database & Vectors** | PostgreSQL 16 + `pgvector` | HNSW cosine similarity vector indexing (`m=16, ef_construction=64`), relational integrity |
| **Workflow Engine** | n8n Community Edition (Self-Hosted) | Visual event triggers, department-based approver routing, webhook authentication |
| **Local AI Inference** | Ollama (`qwen2.5:7b` + `nomic-embed-text`) | Open-weights LLM inference with strict JSON schema enforcement and zero external data transfer |
| **Security** | PyJWT (HS256) + Passlib (bcrypt) | Stateless tokens, constant-time API key verification, granular role permissions |
| **Orchestration** | Docker Compose | Multi-container networking, healthchecks, volume persistence, one-click Windows launcher (`run.bat`) |

---

## ✨ Key Features

### 1. 📚 Policy & SOP Q&A with Verbatim Citations (RAG Core)
- Upload institutional handbooks, examination guidelines, and administrative circulars (`.pdf`, `.docx`, `.md`, `.txt`).
- Heading-aware document parsing with context enrichment (chunk index, page number, section title).
- Semantic search powered by `nomic-embed-text` (768-dim) and `pgvector` HNSW cosine indexing.
- Responses contain **verbatim citations** with clickable source expanders showing the exact excerpt, page, and document.

### 2. ⚡ Guided Actions: Leave Intent Detection & Form Auto-Population
- Detects actionable administrative intent from natural conversational input (e.g. *"I have a high fever and need emergency leave tomorrow, Mr. Lee will cover"*).
- Automatically extracts structured parameters: `leave_type`, `start_date`, `end_date`, `reason`, and `covering_teacher`.
- Renders an interactive, pre-filled submission form directly within the chat stream.

### 3. 🔀 Hybrid n8n Workflow Automation & Resilient Fallback
- **Primary Route**: Requests trigger visual n8n event workflows for approver assignment based on teacher department (e.g. Science & Math vs. Humanities).
- **Fail-Safe Fallback**: If n8n times out or is offline, FastAPI automatically executes internal direct RAG retrieval with zero user downtime.

### 4. 👥 Role-Based Access Control (RBAC)
- **Teacher**: Ask policy questions, submit leave requests with relief teacher nomination, monitor personal request history.
- **Head of Department (HoD)**: Review departmental leave queue, approve/reject applications with remarks, monitor staff availability.
- **School Administrator**: Central operational dashboard, document ingestion management, real-time integration health probes, immutable audit trail.

### 5. 🛡️ Immutable Audit Trail & Live Integration Health
- Append-only audit logger tracking document ingestion, leave submissions, approvals, rejections, and chat queries with actor metadata and JSON diffs.
- Live server-side health checks for PostgreSQL, pgvector indices, Ollama model availability, and n8n webhook latency.

---

## 📸 Screenshots & User Guide

### 🔐 Login & Authentication

The login screen includes **Quick Switch** buttons for instant demo persona switching between Admin, HoD, and Teacher roles.

![Login Screen — SchoolPilot authentication page with branded background, staff email and password fields, Quick Switch demo accounts for Admin (Pn. Zaleha), HoD (Dr. Ramesh), and Teacher (Cikgu Azman), and institutional footer](docs/screenshots/login-desktop.png)

*▲ Desktop login page with institutional branding, password visibility toggle, and one-click Quick Switch demo accounts.*

#### Login Error Handling

Clear inline validation feedback when credentials are incorrect — no ambiguous error states:

![Login Error State — Invalid email or password alert displayed in red banner above the form fields, with the invalid email shown in the input field](docs/screenshots/login-error-state.png)

*▲ Error state: "Invalid email or password" banner shown with clear visual feedback and intact Quick Switch buttons for recovery.*

---

### 💬 Policy Assistant — AI-Powered Chat Interface

#### Welcome Screen & Category Quick Start

Staff are greeted with guided category cards (School Policies, Leave & Attendance, HR & Administration, Find a Regulation) and example prompts:

![Chat Welcome — Interactive category cards with icons for School Policies, Leave & Attendance, HR & Administration, and Find a Regulation. Includes example prompt suggestions and a welcoming greeting from the SchoolPilot AI assistant](docs/screenshots/chat-welcome-desktop.png)

*▲ Desktop chat welcome screen with categorized quick-start cards and conversational example prompts to guide first-time users.*

#### RAG Grounded Response with Confidence & Citations

Answers include a confidence badge and verbatim source citations. Click to expand the exact excerpt, document name, and page number:

| RAG Grounded Answer & Confidence Badge | Expandable Source Quotations & Citations |
|:---:|:---:|
| ![Policy Assistant response with confidence badge (High/Medium/Low) and cited answer referencing the Staff Operational Handbook](docs/screenshots/chat-rag-response.png) | ![Citation expanded view showing the exact verbatim quote, source document name, page number, and section title](docs/screenshots/chat-citation-expanded.png) |
| *AI-generated answer with confidence level and source attribution* | *Expanded citation card with exact excerpt, document name, and page number* |

#### n8n Workflow-Orchestrated Response

When n8n is active, queries are routed through the visual automation engine for enhanced orchestration:

![Chat response routed via n8n RAG workflow — answer generated through the n8n webhook pipeline with citation metadata returned from the automation engine](docs/screenshots/chat-n8n-response.png)

*▲ Response orchestrated through n8n webhook: the query is sent to the automation engine, which calls FastAPI's vector retriever and returns a grounded answer with citations.*

---

### ⚡ Guided Leave Application — From Chat to Submission

Teachers can request leave in natural language. The AI extracts leave details and auto-populates a structured form inline:

| Natural Language Leave Extraction Form | Real-Time Submission Confirmation |
|:---:|:---:|
| ![Guided Leave Form — AI-extracted fields (leave type, dates, reason, covering teacher) pre-populated from natural language input, rendered as an editable inline form in the chat stream](docs/screenshots/chat-leave-form.png) | ![Leave Submitted Badge — Green success confirmation badge shown inline after leave request is submitted, with request ID and status](docs/screenshots/chat-leave-submitted-badge.png) |
| *AI parses "I need emergency leave tomorrow, Mr. Lee will cover" into structured form fields* | *Instant submission confirmation with request ID and pending status badge* |

---

### 📋 Leave Management — Role-Based Views

#### Teacher View: Personal Leave Tabs

Teachers can filter their personal leave history by status — Pending and Approved tabs:

| Pending Leave Requests | Approved Leave Requests |
|:---:|:---:|
| ![Leave Tab — Pending: list of teacher's submitted leave requests awaiting HoD review, showing leave type, dates, reason, and "Pending" status badge](docs/screenshots/leave-tab-pending.png) | ![Leave Tab — Approved: list of teacher's approved leave requests showing leave type, dates, reason, approver name, and "Approved" status badge](docs/screenshots/leave-tab-approved.png) |
| *Teacher's pending leave queue awaiting department head review* | *Approved requests with approver name and decision timestamp* |

#### Leave Detail Cards

Detailed view of individual leave requests showing full metadata, status, and approval chain:

| Pending Leave Detail | Approved Leave Detail |
|:---:|:---:|
| ![Leave Pending — Detailed view of a single pending leave request card showing leave type, dates, reason, covering teacher, and current "Pending" status](docs/screenshots/leave-pending.png) | ![Leave Approved — Detailed view of an approved leave request card showing leave type, dates, reason, covering teacher, approver name, remarks, and "Approved" status](docs/screenshots/leave-approved.png) |
| *Full pending request detail with covering teacher and submission timestamp* | *Approved request showing HoD remarks and approval timestamp* |

#### HoD View: Departmental Approval Queue

Head of Department reviews pending requests from their department with approve/reject actions and remarks:

| HoD Departmental Review Queue | Rejection Modal with Remarks |
|:---:|:---:|
| ![HoD Leaves Dashboard — Departmental queue showing all pending leave requests from teachers in the HoD's department, with Approve and Reject action buttons on each row](docs/screenshots/hod-leaves-dashboard.png) | ![Leave Reject Modal — Modal dialog for HoD to enter rejection reason/remarks before declining a leave request, with Cancel and Confirm Reject buttons](docs/screenshots/leave-reject-modal.png) |
| *HoD sees only their department's pending requests with quick approve/reject* | *Rejection requires mandatory remarks — all decisions are audit-logged* |

---

### 🛠️ Admin Console — Operations Dashboard

#### Administrative Overview & System Health

The admin dashboard provides a unified command centre with key metrics, quick-access cards, and the system audit trail:

![Admin Dashboard — Administrative Console showing Pending Approvals count, Indexed Documents count, pgvector Chunks count, Automations Engine connection status, quick-access cards for Staff Leave Management, Manage Documents, and Launch Policy Assistant, and the System Audit Trail & Compliance Log with searchable event filters](docs/screenshots/admin-dashboard.png)

*▲ Full admin dashboard: KPI cards (pending approvals, indexed documents, pgvector chunks, n8n engine status), quick-action shortcuts, and the searchable audit trail with category filters.*

#### Live Integration Status Monitor

Real-time health checks for all system services — accessible from the admin dashboard via "View integration status":

![Integration Status Modal — Live health status for FastAPI Backend (v1.0.0, UP), PostgreSQL + pgvector (16.2, 3ms, UP), Local Ollama (llama3:8b + nomic-embed-text, 12ms, UP), and n8n Workflows (Policy RAG Webhook + Leave Approval Dispatch, 18ms, UP). Shows webhook endpoint URLs with copy buttons and "Open n8n dashboard" link](docs/screenshots/admin-n8n-integration-status.png)

*▲ Integration health modal: all four services showing UP with response latency, version info, model details, and n8n webhook endpoint URLs.*

---

### 📄 Document Management & Audit Trail

#### Document Repository & Vector Ingestion

Admins manage the institutional knowledge base — uploaded documents are chunked and embedded into pgvector:

| Document Repository & Vector Status | Upload Success Confirmation |
|:---:|:---:|
| ![Document Repository — List of ingested policy documents showing document name, file type, upload date, chunk count, and vector embedding status](docs/screenshots/documents.png) | ![Document Upload Success — Green success notification confirming document was parsed, chunked, embedded, and indexed into pgvector](docs/screenshots/document-uploaded-success.png) |
| *Repository listing with chunk counts and vector embedding status per document* | *Upload confirmation: document parsed, chunked, and embedded into pgvector* |

#### Immutable Audit Trail & JSON Inspector

Every system action is logged with actor metadata, timestamps, and JSON diffs — fully searchable:

| Searchable Audit Trail | Audit Log JSON Inspector |
|:---:|:---:|
| ![Audit Trail — Searchable log of all system events (leave submissions, approvals, rejections, document uploads, chat queries) with actor name, action type, timestamp, and target resource](docs/screenshots/audit-logs.png) | ![Audit Log Inspect Modal — Detailed JSON view of a single audit event showing full request payload, actor metadata, timestamp, and before/after state diff](docs/screenshots/audit-log-inspect-modal.png) |
| *Filterable audit trail with Leave, Policy Q&A, and Documents category tabs* | *JSON inspector modal: full event payload, actor metadata, and state diffs* |

---

### 🔧 n8n Workflow Engine — Visual Automation

The n8n self-hosted workflow engine handles leave routing and RAG orchestration via visual node-based pipelines:

| Leave Approval Routing Workflow | RAG Chat Orchestration Workflow |
|:---:|:---:|
| ![n8n Leave Approval Workflow — Active workflow with 89 executions: Webhook Trigger (POST /leave-approval) → Validate & Route Approver (JavaScript Department Classifier routing to hod.science@cempaka) → Respond to Webhook (Confirm Dispatch with pending_review status). Execution #1904 Success: Leave request lv_001 routed to Science & Mathematics HoD](docs/screenshots/n8n-workflow-leave-approval.png) | ![n8n RAG Chat Workflow — Active workflow with 142 executions: Webhook Trigger (POST /chat-query) → FastAPI Vector Retriever (Ollama + pgvector via authenticated HTTP call) → Respond to Webhook (Return JSON payload with answer and citations). Execution #4829 Success: 3 nodes executed in 242ms, 2 policy citations returned](docs/screenshots/n8n-workflow-rag-chat.png) |
| *Leave routing: Webhook → Department Classifier → HoD Assignment → Dispatch Confirmation* | *RAG pipeline: Webhook → FastAPI Vector Retriever → JSON Response with citations* |

---

### 📱 Cross-Platform Mobile & Responsive Views

SchoolPilot is fully responsive across desktop, tablet, and mobile breakpoints:

#### Mobile Views — Chat, Leave, Navigation

| Mobile Chat Welcome | Mobile Leave List | Mobile Navigation Drawer |
|:---:|:---:|:---:|
| ![Mobile Chat Welcome — Policy assistant category cards and example prompts on a 375×667 mobile viewport](docs/screenshots/chat-welcome-mobile.png) | ![Mobile Leave List — Teacher's leave request history on a mobile viewport with status badges and compact card layout](docs/screenshots/leave-mobile-375x667.png) | ![Mobile Navigation Drawer — Slide-out hamburger menu showing Policy Q&A, Leave Requests, and Admin navigation links with user avatar and logout](docs/screenshots/navigation-mobile-drawer.png) |
| *Chat welcome with stacked category cards on mobile* | *Leave history with compact status cards* | *Slide-out nav drawer with role-aware menu items* |

#### Mobile & Tablet — Login Across Breakpoints

| Tablet Landscape (1024×768) | Tablet Portrait (768×1024) | Mobile (375×667) |
|:---:|:---:|:---:|
| ![Login — Tablet Landscape: full-width login form with background image and Quick Switch buttons at 1024×768](docs/screenshots/login-tablet-1024x768.png) | ![Login — Tablet Portrait: vertically stacked login form with Quick Switch buttons at 768×1024](docs/screenshots/login-tablet-768x1024.png) | ![Login — Mobile: compact single-column login form with stacked Quick Switch buttons at 375×667](docs/screenshots/login-mobile-375x667.png) |
| *Landscape tablet: side-by-side layout with background art* | *Portrait tablet: centered card with visible branding* | *Mobile: full-width compact login with stacked controls* |

#### Mobile & Tablet — Admin Dashboard Across Breakpoints

| Admin Dashboard — Tablet Landscape (1024×768) | Admin Dashboard — Mobile (375×667) |
|:---:|:---:|
| ![Admin Dashboard Tablet — KPI cards, quick-action shortcuts, and audit trail at 1024×768 tablet landscape viewport](docs/screenshots/admin-dashboard-1024x768.png) | ![Admin Dashboard Mobile — Stacked KPI cards and vertically scrolling audit trail on a 375×667 mobile viewport](docs/screenshots/admin-dashboard-375x667.png) |
| *Tablet: full dashboard with grid layout and audit trail visible* | *Mobile: stacked cards with scrollable compact layout* |

---

## 🔒 Security & Role Permissions Matrix

| Capability | Teacher (`teacher`) | Head of Department (`hod`) | Administrator (`admin`) |
|---|:---:|:---:|:---:|
| **Ask Policy Questions (RAG)** | ✅ | ✅ | ✅ |
| **Submit Leave Request** | ✅ | ✅ | ✅ |
| **View Personal Leave History** | ✅ | ✅ | ✅ |
| **Approve/Reject Department Leaves** | ❌ | ✅ *(Same Department)* | ✅ *(All Departments)* |
| **Upload / Delete Policy Documents** | ❌ | ❌ | ✅ |
| **View System Health & Status** | ❌ | ❌ | ✅ |
| **Inspect Immutable Audit Logs** | ❌ | ❌ | ✅ |

---

## 🚀 Quick Start Guide

### Prerequisites
- [Docker Desktop](https://www.docker.com/) (with WSL 2 enabled on Windows).
- [Ollama](https://ollama.com/) running natively on your host machine.

### Step 1: Pull Local Open-Weights Models
```bash
# Pull local embedding model (~274 MB)
ollama pull nomic-embed-text

# Pull local instruction-tuned LLM (~4.7 GB)
ollama pull qwen2.5:7b
```

### Step 2: Configure Environment
```bash
# Copy example configuration
cp .env.example .env
```

### Step 3: Launch Containers

**Option A — Windows One-Click Launcher**:
Double-click `run.bat` or execute in PowerShell:
```cmd
run.bat
```

**Option B — Standard Docker Compose**:
```bash
docker compose up -d --build
```

### Step 4: Access Application Endpoints
- **Staff & Admin Web Portal**: [http://localhost:5173](http://localhost:5173)
- **FastAPI Interactive API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs) (or [http://localhost:8005/docs](http://localhost:8005/docs) when mapped)
- **n8n Automation Engine**: [http://localhost:5678](http://localhost:5678)

---

## 👥 Demo Personas (Pre-Seeded)

All demo accounts share the password: `Password123!`

| Role | Name | Email | Department | Description |
|---|---|---|---|---|
| **Admin** | Puan Hajah Zaleha | `admin@cempaka.edu.my` | School Operations | Full oversight, document ingestion, health monitor, audit inspection |
| **HoD** | Dr. Ramesh Krishnan | `hod.science@cempaka.edu.my` | Science & Mathematics | Reviews and approves Science department leave applications |
| **HoD** | Mrs. Catherine Wong | `hod.humanities@cempaka.edu.my` | Humanities & Languages | Reviews Humanities department applications |
| **Teacher** | Cikgu Azman | `teacher.azman@cempaka.edu.my` | Science & Mathematics | Queries handbook policies, submits emergency medical leaves |
| **Teacher** | Mr. Lee Wei Hong | `teacher.lee@cempaka.edu.my` | Science & Mathematics | Nominated relief teacher for science classes |
| **Teacher** | Ms. Priya Nair | `teacher.priya@cempaka.edu.my` | Humanities & Languages | English and literature instructional staff |

*(The login screen includes a 1-click **Quick Switch** for instant persona demonstration).*

---

## 🧪 Ingesting Sample Institutional Documents

To seed the synthetic Sri Cempaka Staff Operational Handbook and Leave SOP into pgvector:
```bash
docker exec schoolpilot_backend python seed_data.py
```
Or upload any `.pdf`, `.docx`, or `.md` file directly via the **Documents** tab in the admin portal.

---

## 🧪 Testing & Verification

Run the automated test suite across backend unit tests, RBAC security gates, and integration suites:

```bash
# Run backend pytest suite (33 tests across 6 modules)
$env:PYTHONPATH="backend"; pytest backend/tests -v

# Run frontend build & type check
cd frontend && npm run build

# Run live E2E verification
python backend/scripts/verify_live_e2e.py
```

See [docs/testing.md](docs/testing.md) for full details on testing fixtures, coverage, and Playwright accessibility audits.

---

## 📖 Architectural Decision Records (ADRs)

Key architectural decisions are documented in `docs/decisions/`:
- [ADR-001: Hybrid Orchestration (n8n Webhooks with FastAPI Fallback)](docs/decisions/ADR-001-hybrid-n8n-orchestration.md)
- [ADR-002: Local Self-Hosted AI Infrastructure (Ollama + pgvector HNSW)](docs/decisions/ADR-002-self-hosted-local-ai.md)
- [ADR-003: Role-Based Access Control and Immutable Audit Logging](docs/decisions/ADR-003-rbac-and-audit-trail.md)

See [docs/architecture.md](docs/architecture.md) for the in-depth system architecture specification.

---

## ⚠️ Known Limitations & Future Roadmap

- **Single-Node Deployment**: Currently configured for single-host institutional deployment; future work will include multi-replica backend scaling and distributed Redis caching.
- **OCR Ingestion**: Scanned image PDFs rely on Tesseract OCR; future enhancements will add layout-aware vision models for complex tables.
- **WhatsApp / Telegram Bot Connector**: Direct webhook connectors to n8n for emergency broadcast notifications to staff mobile channels.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
