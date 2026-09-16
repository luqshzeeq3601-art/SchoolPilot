import asyncio
import logging
import httpx
from typing import Optional, Dict, Any
from app.config import settings
from app.n8n.schemas import N8nChatPayload, N8nLeaveApprovalPayload

logger = logging.getLogger(__name__)

RETRYABLE_STATUS_CODES = {408, 429, 500, 502, 503, 504}


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


async def trigger_n8n_leave_approval(
    payload: N8nLeaveApprovalPayload,
    max_retries: int = 3,
    initial_delay: float = 0.5,
) -> bool:
    """
    Triggers the n8n leave approval workflow with bounded retry for transient failures.
    Non-retryable 4xx client errors fail fast without retry.
    """
    url = f"{settings.N8N_WEBHOOK_URL.rstrip('/')}/leave-approval"
    headers = {
        "X-API-Key": settings.N8N_API_KEY,
        "Content-Type": "application/json",
    }

    payload_dict = payload.model_dump()
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=payload_dict, headers=headers)
                if response.status_code in (200, 201, 202):
                    return True

                if response.status_code in RETRYABLE_STATUS_CODES:
                    logger.warning(
                        "n8n webhook returned retryable status %s on attempt %s/%s for leave %s",
                        response.status_code,
                        attempt + 1,
                        max_retries,
                        payload.leave_id,
                    )
                else:
                    # Non-retryable error (e.g. 400, 401, 403, 404, 422)
                    logger.error(
                        "n8n webhook returned non-retryable status %s for leave %s. Aborting retries.",
                        response.status_code,
                        payload.leave_id,
                    )
                    return False
        except (httpx.TimeoutException, httpx.NetworkError, httpx.TransportError) as exc:
            logger.warning(
                "n8n webhook network/timeout exception on attempt %s/%s for leave %s: %s",
                attempt + 1,
                max_retries,
                payload.leave_id,
                exc,
            )
        except Exception as exc:
            logger.error(
                "Unexpected error during n8n webhook invocation for leave %s: %s",
                payload.leave_id,
                exc,
            )
            return False

        if attempt < max_retries - 1:
            delay = initial_delay * (2 ** attempt)
            await asyncio.sleep(delay)

    logger.error(
        "Failed to deliver n8n webhook for leave %s after %s attempts.",
        payload.leave_id,
        max_retries,
    )
    return False

