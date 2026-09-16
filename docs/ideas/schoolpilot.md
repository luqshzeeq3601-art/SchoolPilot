# SchoolPilot — RAG + Guided Actions Platform

## Problem Statement

**How might we** help school administrators and teachers get instant, cited answers to operational questions — and seamlessly transition from "what's the policy?" to "do the thing" — without paid AI services, IT expertise, or changes to existing school systems?

## Target User

**Primary:** School administrator / operations staff — the "human router" who fields every question, processes every form, and tracks every approval.
**Secondary:** Teachers — need quick answers and frictionless request submissions.
**Initial Market:** Private schools and tuition/learning centres in Malaysia.

## Tech Stack (Strict RM0 Cost)
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: FastAPI (Python 3.12) + Pydantic v2 + SQLAlchemy 2.0 (asyncpg)
- **Automation**: n8n Community Edition (Self-hosted)
- **Database & Vectors**: PostgreSQL 16 + pgvector
- **Local AI Inference**: Ollama (`qwen2.5:7b` / `llama3.1:8b` + `nomic-embed-text`)
- **Deployment**: Docker Compose
- **Auth**: JWT (Role-Based: Teacher, HoD, Admin)
