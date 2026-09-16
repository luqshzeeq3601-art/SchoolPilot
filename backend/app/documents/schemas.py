import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict


class DocumentBase(BaseModel):
    filename: str
    file_type: str
    metadata_: Dict[str, Any] = {}


class DocumentResponse(DocumentBase):
    id: uuid.UUID
    file_hash: str
    uploaded_by: uuid.UUID
    created_at: datetime
    chunk_count: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class DocumentChunkResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    chunk_index: int
    page_number: int
    section_title: Optional[str] = None
    content: str
    metadata_: Dict[str, Any] = {}

    model_config = ConfigDict(from_attributes=True)


class DocumentUploadResponse(BaseModel):
    document_id: uuid.UUID
    filename: str
    chunks_created: int
    message: str
