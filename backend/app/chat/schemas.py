import uuid
from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class Citation(BaseModel):
    source_id: int = Field(..., description="1-indexed numeric identifier for cited chunk")
    document_name: str = Field(..., description="Filename of referenced document")
    page_number: int = Field(..., description="Page number where statement is found")
    section_title: Optional[str] = Field(None, description="Section heading")
    exact_quote: str = Field(..., description="Direct verbatim sentence/clause from document")


class LeaveFields(BaseModel):
    leave_type: Optional[str] = Field(
        None, description="Category of leave: emergency, medical, annual, compassionate, etc."
    )
    start_date: Optional[str] = Field(
        None, description="Start date in YYYY-MM-DD format if mentioned"
    )
    end_date: Optional[str] = Field(
        None, description="End date in YYYY-MM-DD format if mentioned"
    )
    reason: Optional[str] = Field(
        None, description="Declared reason or circumstance for taking leave"
    )
    covering_teacher: Optional[str] = Field(
        None, description="Nominated colleague to cover relief classes if mentioned"
    )


class IntentClassification(BaseModel):
    intent: Literal["info_query", "leave_request"] = Field(
        ..., description="'leave_request' if user expresses desire/intent to apply or take leave; 'info_query' otherwise"
    )
    confidence: float = Field(..., description="Confidence score between 0.0 and 1.0")
    extracted_fields: Optional[LeaveFields] = Field(
        None, description="Leave attributes extracted if intent is leave_request"
    )


class PolicyRAGResponse(BaseModel):
    answer: str = Field(
        ..., description="Helpful, professional response grounded strictly in the provided context"
    )
    confidence: Literal["high", "medium", "low"] = Field(
        ..., description="Confidence level based on retrieved context"
    )
    citations: List[Citation] = Field(
        default_factory=list, description="Verbatim citations with page numbers"
    )
    relevant_policies: List[str] = Field(
        default_factory=list, description="Titles of relevant policy sections cited"
    )


class ChatQueryRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=1000)
    use_n8n: bool = Field(
        True, description="Attempt primary n8n workflow first with direct API fallback"
    )


class ChatQueryResponse(BaseModel):
    query: str
    answer: str
    confidence: str
    citations: List[Citation]
    relevant_policies: List[str]
    intent: Literal["info_query", "leave_request"]
    detected_leave_fields: Optional[LeaveFields] = None
    orchestration_mode: Literal["n8n_primary", "direct_api_fallback", "direct_api", "direct_api_with_attachment"]
