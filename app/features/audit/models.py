import uuid
from datetime import datetime, timezone
from typing import Optional, Any
from sqlalchemy import String, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # organization_id is nullable (e.g. failed login attempts, where org is not resolved)
    organization_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    
    # actor_user_id is nullable (e.g. unauthenticated requests, system-triggered events)
    actor_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    
    # request_id for end-to-end request tracing
    request_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    
    # event_type indicates the action (e.g., 'user.login', 'api_key.revoked')
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    
    # timestamp of the audit event
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        index=True
    )
    
    # Custom metadata dict. Column name is "metadata", property is "metadata_json" 
    # to avoid overriding the SQLAlchemy Declarative base metadata class attribute.
    metadata_json: Mapped[Optional[dict[str, Any]]] = mapped_column("metadata", JSONB, nullable=True)

    def __repr__(self) -> str:
        return f"<AuditEvent {self.event_type} id={self.id} actor={self.actor_user_id}>"
