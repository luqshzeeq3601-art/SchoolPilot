from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.users.models import User
from app.auth.dependencies import get_current_user
from app.chat.schemas import ChatQueryRequest, ChatQueryResponse, Citation
from app.chat.retriever import retrieve_relevant_chunks
from app.chat.generator import generate_policy_answer
from app.chat.intent import classify_intent_and_extract_fields
from app.chat.attachments import (
    MAX_CHAT_FILE_BYTES,
    build_attachment_context,
    extract_attachment_text,
    validate_chat_file,
)
from app.n8n.client import trigger_n8n_chat_workflow
from app.n8n.schemas import N8nChatPayload
from app.audit.logger import log_audit_event
from app.audit.models import AuditAction


router = APIRouter(prefix="/chat", tags=["Chat & RAG"])


@router.post("/query", response_model=ChatQueryResponse)
async def handle_chat_query(
    request: ChatQueryRequest,
    http_request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = request.query.strip()
    orchestration_mode = "direct_api"
    answer_text = ""
    confidence = "high"
    citations = []
    relevant_policies = []

    # 1. Check for actionable leave intent and extract fields
    intent_result = await classify_intent_and_extract_fields(query)

    # 2. Try primary n8n orchestration if requested
    if request.use_n8n:
        n8n_payload = N8nChatPayload(
            query=query,
            user_id=str(current_user.id),
            user_email=current_user.email,
            user_role=current_user.role.value,
            department=current_user.department,
        )
        n8n_result = await trigger_n8n_chat_workflow(n8n_payload)
        if n8n_result and "answer" in n8n_result:
            orchestration_mode = "n8n_primary"
            answer_text = n8n_result.get("answer", "")
            confidence = n8n_result.get("confidence", "high")
            raw_citations = n8n_result.get("citations", [])
            citations = [Citation(**c) for c in raw_citations if isinstance(c, dict)]
            relevant_policies = n8n_result.get("relevant_policies", [])

    # 3. Direct API fallback if n8n was not used, failed, or timed out
    if not answer_text:
        if request.use_n8n:
            orchestration_mode = "direct_api_fallback"

        retrieved_chunks = await retrieve_relevant_chunks(db=db, query=query, top_k=5)
        rag_response = await generate_policy_answer(query=query, retrieved_chunks=retrieved_chunks)

        answer_text = rag_response.answer
        confidence = rag_response.confidence
        citations = rag_response.citations
        relevant_policies = rag_response.relevant_policies

    # 4. Record audit event
    client_ip = http_request.client.host if http_request.client else None
    await log_audit_event(
        db=db,
        action=AuditAction.CHAT_QUERY,
        resource_type="chat",
        user_id=current_user.id,
        user_email=current_user.email,
        details={
            "query": query,
            "intent": intent_result.intent,
            "mode": orchestration_mode,
            "citations_count": len(citations),
        },
        ip_address=client_ip,
    )
    await db.commit()

    return ChatQueryResponse(
        query=query,
        answer=answer_text,
        confidence=confidence,
        citations=citations,
        relevant_policies=relevant_policies,
        intent=intent_result.intent,
        detected_leave_fields=intent_result.extracted_fields,
        extraction_validation=intent_result.extraction_validation,
        orchestration_mode=orchestration_mode,
    )


@router.post("/query-with-file", response_model=ChatQueryResponse)
async def handle_chat_query_with_file(
    http_request: Request,
    query: str = Form(..., min_length=2, max_length=1000),
    use_n8n: bool = Form(False),
    file: UploadFile | None = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Text query + optional single PDF/PNG/JPG attachment (Option A: OCR -> text LLM).

    Attachment is session-only: extracted text is injected as extra RAG context
    and never written to the global Document tables.
    """
    query = query.strip()
    attachment_context = ""
    attachment_name: str | None = None
    attachment_chars = 0

    if file is not None and file.filename:
        contents = await file.read(MAX_CHAT_FILE_BYTES + 1)
        try:
            attachment_name = validate_chat_file(file.filename, contents)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        raw_text = extract_attachment_text(attachment_name, contents)
        if not raw_text.strip():
            raw_text = "(No readable text found in the attachment. Tell the user the file could not be read and ask for a clearer PDF or photo.)"
        attachment_context = build_attachment_context(attachment_name, raw_text)
        attachment_chars = len(attachment_context)

    # Intent is classified on the text query (attachment supplements context)
    intent_result = await classify_intent_and_extract_fields(query)

    # NOTE: n8n is intentionally skipped for attachments in Option A MVP —
    # extracted text goes straight to direct RAG so behaviour is deterministic.
    orchestration_mode = "direct_api_with_attachment" if attachment_name else "direct_api"

    retrieved_chunks = await retrieve_relevant_chunks(db=db, query=query, top_k=5)
    rag_response = await generate_policy_answer(
        query=query,
        retrieved_chunks=retrieved_chunks,
        attachment_context=attachment_context or None,
        attachment_name=attachment_name,
    )

    client_ip = http_request.client.host if http_request.client else None
    await log_audit_event(
        db=db,
        action=AuditAction.CHAT_QUERY,
        resource_type="chat",
        user_id=current_user.id,
        user_email=current_user.email,
        details={
            "query": query,
            "intent": intent_result.intent,
            "mode": orchestration_mode,
            "citations_count": len(rag_response.citations),
            "attachment": attachment_name,
            "attachment_chars": attachment_chars,
        },
        ip_address=client_ip,
    )
    await db.commit()

    return ChatQueryResponse(
        query=query,
        answer=rag_response.answer,
        confidence=rag_response.confidence,
        citations=rag_response.citations,
        relevant_policies=rag_response.relevant_policies,
        intent=intent_result.intent,
        detected_leave_fields=intent_result.extracted_fields,
        extraction_validation=intent_result.extraction_validation,
        orchestration_mode=orchestration_mode,
    )
