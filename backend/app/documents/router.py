import hashlib
import os
import re
import uuid
from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from app.database import get_db
from app.users.models import User, UserRole
from app.documents.models import Document, DocumentChunk
from app.documents.schemas import DocumentResponse, DocumentUploadResponse
from app.documents.chunker import (
    extract_text_from_pdf,
    extract_text_from_docx,
    extract_text_from_markdown,
    split_text_into_chunks,
)
from app.documents.embedder import embed_batch_documents
from app.auth.dependencies import require_roles, get_current_user
from app.audit.logger import log_audit_event
from app.audit.models import AuditAction


router = APIRouter(prefix="/documents", tags=["Documents"])

MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB max
MAX_CHUNKS = 300  # bound embedding cost / Ollama load per upload


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HOD])),
    db: AsyncSession = Depends(get_db),
):
    raw_filename = file.filename or "uploaded_doc"
    # Sanitize filename against directory traversal and control characters
    clean_filename = os.path.basename(raw_filename)
    clean_filename = re.sub(r"[^\w\s\.-]", "_", clean_filename).strip()
    if not clean_filename:
        clean_filename = f"doc_{uuid.uuid4().hex[:8]}.txt"

    # Enforce strict file size limit
    contents = await file.read(MAX_UPLOAD_SIZE_BYTES + 1)
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(contents) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Uploaded file exceeds maximum allowed limit of 25MB.",
        )

    file_hash = hashlib.sha256(contents).hexdigest()

    # Check for duplicate
    stmt = select(Document).where(Document.file_hash == file_hash)
    existing_doc = (await db.execute(stmt)).scalar_one_or_none()
    if existing_doc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Document '{clean_filename}' with identical content already exists.",
        )

    filename_lower = clean_filename.lower()
    try:
        if filename_lower.endswith(".pdf"):
            if not contents.startswith(b"%PDF-"):
                raise HTTPException(status_code=400, detail="Invalid PDF file: Missing %PDF- header signature.")
            pages = extract_text_from_pdf(contents)
            file_type = "pdf"
        elif filename_lower.endswith(".docx"):
            if not contents.startswith(b"PK\x03\x04"):
                raise HTTPException(status_code=400, detail="Invalid DOCX file: Missing valid Zip/DOCX signature.")
            pages = extract_text_from_docx(contents)
            file_type = "docx"
        elif filename_lower.endswith((".md", ".txt")):
            try:
                decoded_text = contents.decode("utf-8")
            except UnicodeDecodeError:
                decoded_text = contents.decode("utf-8", errors="replace")
            pages = extract_text_from_markdown(decoded_text)
            file_type = "markdown" if filename_lower.endswith(".md") else "text"
        else:
            raise HTTPException(
                status_code=400,
                detail="Unsupported file format. Please upload valid PDF, DOCX, MD, or TXT documents.",
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail="Failed to parse document structure. Ensure file is not corrupted.",
        )

    if not pages:
        raise HTTPException(status_code=400, detail="No readable text found in document.")

    # Split into structured chunks
    chunks_data = split_text_into_chunks(pages, clean_filename)
    if not chunks_data:
        raise HTTPException(status_code=400, detail="Document could not be chunked.")

    if len(chunks_data) > MAX_CHUNKS:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Document produces {len(chunks_data)} chunks, exceeding the limit of {MAX_CHUNKS}. Split the file and retry.",
        )

    # Create Document record
    doc_record = Document(
        filename=clean_filename,
        file_hash=file_hash,
        file_type=file_type,
        uploaded_by=current_user.id,
        metadata_={"total_pages": len(pages), "file_size_bytes": len(contents)},
    )
    db.add(doc_record)
    await db.flush()

    # Generate embeddings in batches of 10 to conserve memory
    batch_size = 10
    chunk_contents = [c["content"] for c in chunks_data]
    all_embeddings = []

    for i in range(0, len(chunk_contents), batch_size):
        batch = chunk_contents[i : i + batch_size]
        batch_embeddings = await embed_batch_documents(batch)
        all_embeddings.extend(batch_embeddings)

    for chunk_info, embedding in zip(chunks_data, all_embeddings):
        chunk_rec = DocumentChunk(
            document_id=doc_record.id,
            chunk_index=chunk_info["chunk_index"],
            page_number=chunk_info["page_number"],
            section_title=chunk_info["section_title"],
            content=chunk_info["content"],
            embedding=embedding,
            metadata_={"raw_length": len(chunk_info["raw_text"])},
        )
        db.add(chunk_rec)

    # Record audit log in the same transaction so a doc never exists without audit.
    await log_audit_event(
        db=db,
        action=AuditAction.DOCUMENT_UPLOAD,
        resource_type="document",
        resource_id=str(doc_record.id),
        user_id=current_user.id,
        user_email=current_user.email,
        details={"filename": clean_filename, "chunks": len(chunks_data)},
    )
    await db.commit()

    return DocumentUploadResponse(
        document_id=doc_record.id,
        filename=clean_filename,
        chunks_created=len(chunks_data),
        message="Document parsed, chunked, and embedded successfully into pgvector.",
    )


@router.get("/", response_model=List[DocumentResponse])
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Document, func.count(DocumentChunk.id).label("chunk_count"))
        .outerjoin(DocumentChunk, Document.id == DocumentChunk.document_id)
        .group_by(Document.id)
        .order_by(Document.created_at.desc())
    )
    result = await db.execute(stmt)
    docs = []
    for doc, count in result.all():
        doc_resp = DocumentResponse(
            id=doc.id,
            filename=doc.filename,
            file_hash=doc.file_hash,
            file_type=doc.file_type,
            uploaded_by=doc.uploaded_by,
            metadata_=doc.metadata_,
            created_at=doc.created_at,
            chunk_count=count,
        )
        docs.append(doc_resp)
    return docs


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Document).where(Document.id == document_id)
    doc = (await db.execute(stmt)).scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    deleted_filename = doc.filename
    await db.delete(doc)
    await db.commit()

    await log_audit_event(
        db=db,
        action=AuditAction.DOCUMENT_DELETE,
        resource_type="document",
        resource_id=str(document_id),
        user_id=current_user.id,
        user_email=current_user.email,
        details={"deleted_filename": deleted_filename},
    )
    await db.commit()
    return None
