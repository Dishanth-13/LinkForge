import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.features.users.models import User
from app.features.audit.schemas import AuditEventsListResponse
from app.features.audit.services import list_audit_events

router = APIRouter(prefix="/events", tags=["Events"])

@router.get("", response_model=AuditEventsListResponse, status_code=status.HTTP_200_OK)
async def get_events(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    event_type: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    actor_user_id: Optional[uuid.UUID] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> AuditEventsListResponse:
    """
    Retrieves filtered and paginated administrative activity audit logs
    for the authenticated organization.
    """
    events, total = await list_audit_events(
        db=db,
        organization_id=current_user.organization_id,
        limit=limit,
        offset=offset,
        event_type=event_type,
        resource_type=resource_type,
        actor_user_id=actor_user_id,
        start_date=start_date,
        end_date=end_date
    )
    
    return AuditEventsListResponse(
        events=events,
        total_count=total
    )
