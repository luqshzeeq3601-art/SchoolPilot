import uuid
from datetime import datetime, timezone
import enum
from sqlalchemy import String, DateTime, Enum, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class AuditAction(str, enum.Enum):
    DOCUMENT_UPLOAD = "document_upload"
    DOCUMENT_DELETE = "document_delete"
    CHAT_QUERY = "chat_query"
    LEAVE_SUBMITTED = "leave_submitted"
    LEAVE_APPROVED = "leave_approved"
    LEAVE_REJECTED = "leave_rejected"
    LEAVE_UPDATED = "leave_updated"
    LEAVE_DELETED = "leave_deleted"
    N8N_WORKFLOW_TRIGGERED = "n8n_workflow_triggered"
    N8N_WORKFLOW_CALLBACK = "n8n_workflow_callback"
    MOCK_HRIS_SYNC = "mock_hris_sync"
    USER_CREATED = "user_created"
    USER_UPDATED = "user_updated"
    USER_STATUS_CHANGED = "user_status_changed"
    USER_PASSWORD_RESET = "user_password_reset"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    user_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    action: Mapped[AuditAction] = mapped_column(
        Enum(AuditAction, name="audit_action", native_enum=False),
        nullable=False,
    )
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    details: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"), default=dict)
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
