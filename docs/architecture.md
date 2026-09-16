# SchoolPilot — System Architecture & Technical Specification

## 1. System Overview

**SchoolPilot** is an institutional operations assistant and workflow automation platform designed specifically for schools, private academies, and learning centres. Built with a strict **RM0 software licensing constraint**, it operates entirely on local inference and self-hosted open-source technologies.

The platform bridges the gap between static policy documents (staff handbooks, SOPs, examination invigilation circulars) and actionable administrative workflows (guided leave applications, relief teacher assignment, multi-tier approvals, and compliance audit logging).

```mermaid
flowchart TD
    subgraph Client["Frontend Layer (React 18 + Vite)"]
        UI["User Interface<br/>(Tailwind CSS + Lucide)"]
        State["Auth Context & Router<br/>(JWT + RBAC Guards)"]
    end

    subgraph Gateway["Backend API (FastAPI)"]
        Router["FastAPI REST Router<br/>(/api/v1)"]
        AuthM["Auth & Security Middleware<br/>(HS256 JWT)"]
        Chunker["Document Chunker & Parser<br/>(PDF, DOCX, MD, TXT)"]
        Retriever["pgvector HNSW Retriever<br/>(Cosine Distance)"]
        Generator["Ollama LLM Client<br/>(JSON Schema Enforcement)"]
        AuditM["Audit Logger<br/>(Immutable Trail)"]
    end

    subgraph Automation["Workflow Automation (n8n)"]
        ChatWf["RAG Orchestration Workflow<br/>(/webhook/chat-query)"]
        LeaveWf["Leave Routing Workflow<br/>(/webhook/leave-approval)"]
    end

    subgraph Storage["Persistent Data (PostgreSQL 16)"]
        PGDB[("Relational DB<br/>users, leave_requests, audit_logs")]
        VectorStore[("Vector DB<br/>documents, document_chunks")]
    end

    subgraph AI["Local AI Inference (Ollama)"]
        Embedder["nomic-embed-text<br/>(768 dimensions)"]
        LLM["qwen2.5:7b / llama3.1:8b<br/>(Instruction-Tuned)"]
    end

    UI --> Router
    Router --> AuthM
    AuthM --> PGDB
    Router --> AuditM --> PGDB

    %% RAG Ingestion Flow
    UI -->|Upload Policy Document| Chunker
    Chunker -->|Batch Texts| Embedder
    Embedder -->|768-dim Vectors| VectorStore

    %% Hybrid Query Flow
    UI -->|Policy Query (Primary)| ChatWf
    ChatWf -->|Authenticated POST| Router
    UI -.->|Direct API (Fallback)| Router

    Router --> Retriever
    Retriever -->|Cosine Similarity Search| VectorStore
    VectorStore -->|Top K Chunks + Metadata| Retriever
    Retriever --> Generator
    Generator -->|Context + Query| LLM
    LLM -->|Grounded Answer + Citations| Generator
    Generator --> UI

    %% Leave Workflow Flow
    UI -->|Submit Guided Leave| Router
    Router --> LeaveWf
    LeaveWf -->|Route HoD / Admin Approver| PGDB
```

---

## 2. Component Breakdown

### 2.1 Frontend Client (`frontend/`)
- **Technology**: React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons.
- **Routing & State**: React Router v6 with `ProtectedRoute` guards enforcing role-based routing (`teacher`, `hod`, `admin`).
- **Features**:
  - **Policy Assistant**: Conversational view with grounded citation cards (expandable source quotes, document names, page numbers).
  - **Guided Action Forms**: Instant detection of actionable leave intent, auto-populating structured leave applications directly in the chat stream.
  - **Leave Management**: Role-tailored views — Teachers see personal request status; HoDs review pending departmental queues with approve/reject modals; Admins view all institutional leave.
  - **Administrative Console**: Document repository with drag-and-drop vector ingestion, live integration health monitor, and searchable audit trail with JSON payload viewer.

### 2.2 Backend Application (`backend/app/`)
- **Technology**: FastAPI (Python 3.12), Pydantic v2, SQLAlchemy 2.0 (asyncpg), PyJWT, bcrypt.
- **Modules**:
  - `auth`: Cryptographic password hashing (bcrypt), JWT generation/validation, inter-service API key verification.
  - `users`: User identity models, role enumerations (`teacher`, `hod`, `admin`), departmental assignments.
  - `documents`: Multi-format parsing (PDF via PyMuPDF, DOCX via python-docx, Markdown/TXT), context-enriched chunking, batch vector embedding.
  - `chat`: Retriever engine (HNSW cosine similarity), JSON-enforced Ollama prompt generator, leave intent extraction.
  - `leave`: Leave request lifecycle (pending, approved, rejected, cancelled), date range validation, relief teacher assignment.
  - `audit`: Append-only audit logger capturing actor, action, timestamp, IP, and state delta JSON.
  - `system`: Server-side integration status probes for PostgreSQL, Ollama models, and n8n webhooks.

### 2.3 Local AI Inference (Ollama)
- **Embedding Model**: `nomic-embed-text`
  - Dimensions: 768
  - Context window: 8,192 tokens
  - Task: Vectorizes document chunks and user queries for semantic retrieval.
- **LLM**: `qwen2.5:7b` (or `llama3.1:8b`)
  - Format: Strictly validated JSON adhering to `PolicyRAGResponse` schema.
  - Persona: Institutional AI operations specialist. Grounded strictly in provided context excerpts.

### 2.4 Workflow Engine (n8n Community Edition)
- **Workflows**:
  - `rag_chat_workflow.json`: Receives incoming chat webhook, authenticates against FastAPI via `X-N8N-API-KEY`, executes retrieval and generation, and returns synthesized answers.
  - `leave_approval_workflow.json`: Receives leave submission payloads, evaluates teacher department, assigns corresponding HoD approver (`hod.science@cempaka.edu.my` or `hod.humanities@cempaka.edu.my`), and triggers notification routing.

### 2.5 Relational & Vector Storage (PostgreSQL 16 + pgvector)
- **Relational Tables**: `users`, `leave_requests`, `audit_logs`.
- **Vector Tables**: `documents`, `document_chunks` (with 768-dim `vector(768)` column).
- **Index**: HNSW index with `vector_cosine_ops` (`m=16`, `ef_construction=64`).

---

## 3. RAG Pipeline & Document Ingestion

```
Raw Document (PDF, DOCX, MD, TXT)
       │
       ▼
Heading-Aware Extractor (Preserves Title, Page, Sections)
       │
       ▼
Context Enrichment (Prepends "[Document: X | Section: Y]")
       │
       ▼
Recursive Token Splitter (Chunk size: 450-800 tokens, Overlap: 80 tokens)
       │
       ▼
Ollama Batch Embedder (nomic-embed-text -> 768-dim float array)
       │
       ▼
PostgreSQL pgvector (HNSW Cosine Index)
```

---

## 4. Security & Compliance Architecture

1. **Authentication**: Stateless HS256 JWT tokens with configurable expiration (default 24 hours).
2. **Authorization (RBAC)**: Role checks applied at route handler level using FastAPI dependency injection (`require_roles([UserRole.ADMIN, ...])`).
3. **Inter-Service Security**: Internal API key authentication (`X-N8N-API-KEY`) verified via constant-time string comparison (`secrets.compare_digest`) to prevent timing attacks.
4. **Data Isolation & Sovereignty**: All documents, embeddings, and chat histories remain strictly on-premises on the institutional server with zero external data leakage.
5. **Immutable Audit Logging**: Every administrative action, document modification, and approval decision is recorded with actor metadata and payload snapshots.
