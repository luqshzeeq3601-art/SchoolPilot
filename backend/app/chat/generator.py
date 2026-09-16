import json
import logging
from typing import List, Dict, Any
from app.config import settings
from app.documents.embedder import get_ollama_client
from app.chat.schemas import PolicyRAGResponse, Citation
from app.chat.retriever import format_context_prompt

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are SchoolPilot, an AI operations specialist for school administrators and teachers.
Your task is to provide accurate, professional, and clear answers to staff questions grounded STRICTLY in the provided school operational documents and SOPs.

Rules:
1. Answer ONLY based on the provided [Source X] excerpts. If the information is not in the context, explicitly state that the policy documents do not specify this.
2. In your JSON response:
   - Put the main answer text inside the "answer" field.
   - For every source you rely on, add an item to the "citations" array with source_id, document_name, page_number, section_title, and exact_quote.
   - Do NOT write raw citation lists inside the "answer" field.
3. Keep the tone professional, supportive, and concise.
4. Set confidence to 'high' if clear exact policy exists, 'medium' if partially addressed, or 'low' if uncertain.
5. Return strictly valid JSON adhering to the provided schema.
"""


async def generate_policy_answer(
    query: str,
    retrieved_chunks: List[Dict[str, Any]],
    attachment_context: str | None = None,
    attachment_name: str | None = None,
) -> PolicyRAGResponse:
    """Generate a cited policy answer using Ollama with strict JSON schema enforcement."""
    try:
        client = await get_ollama_client()
        context_text = format_context_prompt(retrieved_chunks)
        if attachment_context and attachment_context.strip():
            attachment_block = (
                f"[Uploaded Attachment: {attachment_name or 'file'} — session-only, "
                f"prioritise for questions about this file]\n{attachment_context.strip()}"
            )
            context_text = f"{attachment_block}\n\n---\n\n{context_text}" if context_text else attachment_block

        user_prompt = f"""Question from staff member:
"{query}"

School Policy & SOP Context:
{context_text}

Provide your structured answer adhering to the schema. Ensure the 'citations' array is populated for each source used."""

        response = await client.chat(
            model=settings.LLM_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            format="json",
            options={"temperature": 0.0, "num_ctx": 4096},
        )
        raw_content = response.message.content
        parsed = PolicyRAGResponse.model_validate_json(raw_content)

        # Fallback enrichment: If LLM left citations list empty, map from retrieved chunks
        # or from the session attachment so the UI still shows a grounded source.
        if not parsed.citations and (retrieved_chunks or attachment_context):
            if not retrieved_chunks and attachment_context and attachment_name:
                snippet = attachment_context.strip().split("\n")[0][:150]
                parsed.citations = [
                    Citation(
                        source_id=1,
                        document_name=f"Uploaded: {attachment_name}",
                        page_number=1,
                        section_title="Uploaded attachment",
                        exact_quote=snippet or attachment_context.strip()[:150],
                    )
                ]
            elif retrieved_chunks:
                source_map = {c["source_id"]: c for c in retrieved_chunks}
                import re
                # Check if answer contains [Source X]
                mentioned_ids = [int(m) for m in re.findall(r"\[Source\s+(\d+)\]", parsed.answer)]
                if not mentioned_ids:
                    # Use top 2 retrieved chunks
                    mentioned_ids = [c["source_id"] for c in retrieved_chunks[:2]]

                fallback_citations = []
                for sid in set(mentioned_ids):
                    if sid in source_map:
                        sc = source_map[sid]
                        # Extract a clean snippet
                        clean_excerpt = sc["content"].split("\n")[-1] if "\n" in sc["content"] else sc["content"][:150]
                        fallback_citations.append(
                            Citation(
                                source_id=sid,
                                document_name=sc["document_name"],
                                page_number=sc["page_number"],
                                section_title=sc.get("section_title"),
                                exact_quote=clean_excerpt.strip() or sc["content"][:120],
                            )
                        )
                parsed.citations = fallback_citations

        # Clean answer text if model duplicated citations as text at the bottom
        if "\n\nCitations:\n" in parsed.answer:
            parsed.answer = parsed.answer.split("\n\nCitations:\n")[0].strip()

        return parsed
    except Exception as e:
        logger.error("Model generation failed: %s", str(e), exc_info=True)
        # Fallback in case of local model parsing error
        fallback_citations = []
        if retrieved_chunks:
            first_c = retrieved_chunks[0]
            fallback_citations.append(
                Citation(
                    source_id=first_c["source_id"],
                    document_name=first_c["document_name"],
                    page_number=first_c["page_number"],
                    section_title=first_c.get("section_title"),
                    exact_quote=first_c["content"][:150],
                )
            )

        return PolicyRAGResponse(
            answer="Unable to generate a cited response from the operational policy assistant at this moment. Please try again shortly.",
            confidence="low",
            citations=fallback_citations,
            relevant_policies=[],
        )
