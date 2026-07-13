import uuid
from typing import Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.features.audit.models import AuditEvent
from app.core.logging import logger

async def log_audit_event(
    db: AsyncSession,
    request_id: str,
    event_type: str,
    organization_id: Optional[uuid.UUID] = None,
    actor_user_id: Optional[uuid.UUID] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> AuditEvent:
    """
    Persists a security-sensitive action audit log to the database.
    Does not commit the transaction directly, allowing the caller to manage the transaction boundary.
    """
    event = AuditEvent(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        request_id=request_id,
        event_type=event_type,
        metadata_json=metadata,
    )
    db.add(event)
    await db.flush()  # Fluches to database to assign ID
    
    logger.info(
        "Audit event registered",
        event_id=str(event.id),
        event_type=event_type,
        actor_user_id=str(actor_user_id) if actor_user_id else None,
        organization_id=str(organization_id) if organization_id else None,
        request_id=request_id
    )
    return event
