"""Live integration health checks for the admin console.

Probes each dependency server-side (so the browser never needs
direct access to Ollama/n8n) and returns per-service status,
latency, and safe connection details. Admin-only.
"""

import time
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_roles
from app.config import settings
from app.database import get_db
from app.documents.models import Document, DocumentChunk
from app.leave.models import LeaveRequest, LeaveStatus
from app.users.models import User, UserRole

router = APIRouter(prefix="/system", tags=["System"])


async def _check_database(db: AsyncSession) -> Dict[str, Any]:
    started = time.perf_counter()
    try:
        await db.execute(text("SELECT 1"))
        latency_ms = round((time.perf_counter() - started) * 1000)
        return {"status": "up", "latency_ms": latency_ms}
    except Exception as exc:
        return {"status": "down", "latency_ms": None, "error": str(exc)[:200]}


async def _check_ollama() -> Dict[str, Any]:
    base = settings.OLLAMA_BASE_URL.rstrip("/")
    started = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{base}/api/tags")
        latency_ms = round((time.perf_counter() - started) * 1000)
        if resp.status_code != 200:
            return {
                "status": "down",
                "base_url": base,
                "latency_ms": latency_ms,
                "error": f"Ollama returned HTTP {resp.status_code}. Is the Ollama service running?",
            }
        models: List[str] = []
        try:
            models = [m.get("name", "") for m in resp.json().get("models", []) if m.get("name")]
        except Exception:
            models = []
        return {
            "status": "up",
            "base_url": base,
            "latency_ms": latency_ms,
            "llm_model": settings.LLM_MODEL,
            "embedding_model": settings.EMBEDDING_MODEL,
            "models": models,
        }
    except Exception as exc:
        return {
            "status": "down",
            "base_url": base,
            "latency_ms": None,
            "error": f"Ollama unreachable at {base}. Start Ollama and pull '{settings.LLM_MODEL}' + '{settings.EMBEDDING_MODEL}'. ({str(exc)[:120]})",
        }


async def _check_n8n() -> Dict[str, Any]:
    base = settings.N8N_WEBHOOK_URL.rstrip("/")
    workflows = [
        {"name": "RAG chat", "url": f"{base}/chat-query"},
        {"name": "Leave approval", "url": f"{base}/leave-approval"},
    ]
    started = time.perf_counter()
    try:
        # Webhook paths only accept POST, so any HTTP response (even 404/405)
        # proves the n8n host is reachable. Only a connection error means down.
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.get(base)
        latency_ms = round((time.perf_counter() - started) * 1000)
        return {"status": "up", "webhook_base": base, "latency_ms": latency_ms, "workflows": workflows}
    except Exception as exc:
        return {
            "status": "down",
            "webhook_base": base,
            "latency_ms": None,
            "workflows": workflows,
            "error": f"n8n unreachable at {base}. Start n8n and activate the chat + leave workflows. ({str(exc)[:120]})",
        }


@router.get("/status")
async def get_system_status(
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    database = await _check_database(db)
    ollama = await _check_ollama()
    n8n = await _check_n8n()

    doc_count: Optional[int] = None
    chunk_total = 0
    leave_total = 0
    leave_pending = 0
    try:
        doc_count = (await db.execute(select(func.count(Document.id)))).scalar() or 0
        chunk_total = (await db.execute(select(func.count(DocumentChunk.id)))).scalar() or 0
        leave_total = (await db.execute(select(func.count(LeaveRequest.id)))).scalar() or 0
        leave_pending = (
            await db.execute(
                select(func.count(LeaveRequest.id)).where(LeaveRequest.status == LeaveStatus.PENDING)
            )
        ).scalar() or 0
    except Exception:
        pass

    overall = (
        "operational"
        if database.get("status") == "up" and ollama.get("status") == "up" and n8n.get("status") == "up"
        else "degraded"
    )

    return {
        "overall": overall,
        "backend": {"status": "up", "version": "1.0.0"},
        "database": {**database, "detail": "PostgreSQL 16 + pgvector (HNSW cosine index)"},
        "ollama": ollama,
        "n8n": n8n,
        "stats": {
            "documents": doc_count,
            "vector_chunks": chunk_total,
            "leaves_total": leave_total,
            "leaves_pending": leave_pending,
        },
    }
