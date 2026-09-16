import httpx
from typing import List, Optional
from ollama import AsyncClient
from app.config import settings

_WORKING_OLLAMA_URL: Optional[str] = None


async def get_ollama_client() -> AsyncClient:
    global _WORKING_OLLAMA_URL
    if _WORKING_OLLAMA_URL:
        return AsyncClient(host=_WORKING_OLLAMA_URL, timeout=90.0)

    candidates = [
        settings.OLLAMA_BASE_URL,
        "http://host.docker.internal:11434",
        "http://localhost:11434",
    ]
    seen = set()
    unique_candidates = [c for c in candidates if c and not (c in seen or seen.add(c))]

    async with httpx.AsyncClient(timeout=1.5) as http_client:
        for url in unique_candidates:
            try:
                r = await http_client.get(f"{url.rstrip('/')}/api/tags")
                if r.status_code == 200:
                    _WORKING_OLLAMA_URL = url
                    return AsyncClient(host=url, timeout=90.0)
            except Exception:
                continue

    return AsyncClient(host=settings.OLLAMA_BASE_URL, timeout=90.0)


async def embed_document_text(text: str) -> List[float]:
    """Embed a document chunk using nomic-embed-text with the search_document prefix."""
    client = await get_ollama_client()
    formatted_input = f"search_document: {text}"
    response = await client.embed(
        model=settings.EMBEDDING_MODEL,
        input=formatted_input,
        options={"num_ctx": 8192},
    )
    return response["embeddings"][0]


async def embed_query_text(query: str) -> List[float]:
    """Embed a search query using nomic-embed-text with the search_query prefix."""
    client = await get_ollama_client()
    formatted_input = f"search_query: {query}"
    response = await client.embed(
        model=settings.EMBEDDING_MODEL,
        input=formatted_input,
        options={"num_ctx": 8192},
    )
    return response["embeddings"][0]


async def embed_batch_documents(texts: List[str]) -> List[List[float]]:
    """Embed a list of document chunks."""
    client = await get_ollama_client()
    formatted_inputs = [f"search_document: {t}" for t in texts]
    response = await client.embed(
        model=settings.EMBEDDING_MODEL,
        input=formatted_inputs,
        options={"num_ctx": 8192},
    )
    return response["embeddings"]
