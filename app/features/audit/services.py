import uuid
from datetime import datetime
from typing import Any, Optional, Sequence
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
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
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
        resource_type=resource_type,
        resource_id=resource_id,
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


async def list_audit_events(
    db: AsyncSession,
    organization_id: uuid.UUID,
    limit: int = 20,
    offset: int = 0,
    event_type: Optional[str] = None,
    resource_type: Optional[str] = None,
    actor_user_id: Optional[uuid.UUID] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> tuple[Sequence[AuditEvent], int]:
    """
    Retrieves filtered and paginated audit events scoped to the organization.
    Uses joinedload to fetch actor information in a single query.
    Returns a tuple of (events, total_count).
    """
    from sqlalchemy import select, func
    from sqlalchemy.orm import joinedload
    
    filters = [AuditEvent.organization_id == organization_id]
    
    if event_type:
        filters.append(AuditEvent.event_type == event_type)
    if resource_type:
        filters.append(AuditEvent.resource_type == resource_type)
    if actor_user_id:
        filters.append(AuditEvent.actor_user_id == actor_user_id)
    if start_date:
        filters.append(AuditEvent.timestamp >= start_date)
    if end_date:
        filters.append(AuditEvent.timestamp <= end_date)
        
    # Count total events matching filters
    count_query = select(func.count()).select_from(AuditEvent).where(*filters)
    count_result = await db.execute(count_query)
    total_count = count_result.scalar_one()
    
    # Retrieve paginated audit logs, joined with Actor user info
    query = (
        select(AuditEvent)
        .where(*filters)
        .options(joinedload(AuditEvent.actor))
        .order_by(AuditEvent.timestamp.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    events = result.scalars().all()
    
    return events, total_count
