import httpx
from typing import Optional, Dict, Any
from app.config import settings
from app.n8n.schemas import N8nChatPayload, N8nLeaveApprovalPayload


async def trigger_n8n_chat_workflow(payload: N8nChatPayload) -> Optional[Dict[str, Any]]:
    """
    Attempts to execute the primary RAG chat workflow in n8n.
    Returns parsed dict on success, or None on failure/timeout to trigger direct fallback.
    """
    url = f"{settings.N8N_WEBHOOK_URL.rstrip('/')}/chat-query"
    headers = {
        "X-API-Key": settings.N8N_API_KEY,
        "Content-Type": "application/json",
    }
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, json=payload.model_dump(), headers=headers)
            if response.status_code == 200:
                data = response.json()
                # Validate that answer field exists
                if isinstance(data, dict) and "answer" in data:
                    return data
            return None
    except Exception:
        # n8n unreachable, timed out, or workflow inactive -> return None to engage direct fallback
        return None


async def trigger_n8n_leave_approval(payload: N8nLeaveApprovalPayload) -> bool:
    """
    Triggers the n8n leave approval workflow.
    Fire-and-forget async invocation with error handling.
    """
    url = f"{settings.N8N_WEBHOOK_URL.rstrip('/')}/leave-approval"
    headers = {
        "X-API-Key": settings.N8N_API_KEY,
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload.model_dump(), headers=headers)
            return response.status_code in (200, 201, 202)
    except Exception:
        return False
