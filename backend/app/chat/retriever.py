from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.documents.models import Document, DocumentChunk
from app.documents.embedder import embed_query_text


async def retrieve_relevant_chunks(
    db: AsyncSession,
    query: str,
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    """
    Embed the user query and perform pgvector cosine similarity search
    to find the most relevant policy handbook chunks.
    """
    query_vector = await embed_query_text(query)

    # Cosine distance in pgvector: DocumentChunk.embedding.cosine_distance(query_vector)
    # Cosine distance = 1 - cosine_similarity (0 means identical, 2 means opposite)
    distance_expr = DocumentChunk.embedding.cosine_distance(query_vector)
    stmt = (
        select(
            DocumentChunk,
            Document.filename,
            distance_expr.label("distance"),
        )
        .join(Document, DocumentChunk.document_id == Document.id)
        .order_by(distance_expr.asc())
        .limit(top_k)
    )

    result = await db.execute(stmt)
    rows = result.all()

    retrieved = []
    for idx, (chunk, filename, distance) in enumerate(rows, 1):
        retrieved.append({
            "source_id": idx,
            "document_name": filename,
            "page_number": chunk.page_number,
            "section_title": chunk.section_title or "General",
            "content": chunk.content,
            "similarity_score": round(1.0 - float(distance), 4),
        })

    return retrieved


def format_context_prompt(chunks: List[Dict[str, Any]]) -> str:
    """Format retrieved chunks into numbered context references for the LLM."""
    if not chunks:
        return "No relevant school policy documents found in the database."

    formatted_blocks = []
    for c in chunks:
        block = (
            f"[Source {c['source_id']}] (File: {c['document_name']}, Page: {c['page_number']}, Section: {c['section_title']}):\n"
            f"{c['content']}"
        )
        formatted_blocks.append(block)

    return "\n\n---\n\n".join(formatted_blocks)
