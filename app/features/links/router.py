import uuid
from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.dependencies import get_current_user, get_current_organization
from app.features.users.models import User
from app.features.links.schemas import LinkCreate, LinkUpdate, LinkResponse
from app.features.links.service import (
    create_link,
    get_link_by_id,
    list_links,
    update_link,
    soft_delete_link,
    resolve_link_by_code,
    increment_click_count_atomic,
    get_cached_link,
    set_link_cache,
    delete_link_cache
)
from app.features.audit.services import log_audit_event
from app.features.analytics.publishers import TelemetryPublisher
from app.features.links.models import Link
from pydantic import BaseModel, field_validator

# Define routers
router = APIRouter(prefix="/links", tags=["Links"])
redirect_router = APIRouter(tags=["Redirection"])

# Dedicated list wrapper schema to serialize BIGINT cursor correctly
class LinkListResponse(BaseModel):
    links: List[LinkResponse]
    next_cursor: Optional[str] = None

    @field_validator("next_cursor", mode="before")
    @classmethod
    def serialize_cursor(cls, v: any) -> Optional[str]:
        if v is None:
            return None
        return str(v)

@router.post("/", response_model=LinkResponse, status_code=status.HTTP_201_CREATED)
async def create_new_link(
    request: Request,
    payload: LinkCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization)
):
    """
    Creates a new short URL or custom alias under the authenticated user's organization.
    Generates a security AuditEvent tracking the action.
    """
    try:
        link = await create_link(
            db, 
            organization_id=organization_id, 
            created_by=current_user.id, 
            payload=payload
        )
        
        request_id = getattr(request.state, "request_id", "unknown")
        await log_audit_event(
            db,
            request_id=request_id,
            event_type="link.created",
            organization_id=organization_id,
            actor_user_id=current_user.id,
            metadata={"link_id": str(link.id), "short_code": link.short_code, "original_url": link.original_url}
        )
        
        await db.commit()
        return link
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create link: {str(e)}"
        )

@router.get("/{link_id}", response_model=LinkResponse)
async def get_link_details(
    link_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization)
):
    """
    Queries metadata details for a specific link.
    Strictly enforced by organization_id tenant boundary.
    """
    link = await get_link_by_id(db, link_id, organization_id)
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Link not found or has been deleted."
        )
    return link

@router.get("/", response_model=LinkListResponse)
async def get_all_links(
    limit: int = Query(20, ge=1, le=100),
    cursor: Optional[int] = Query(None, description="Cursor link ID (integer)"),
    title: Optional[str] = Query(None),
    original_url: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    exclude_expired: bool = Query(False),
    include_only_expired: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization)
):
    """
    Retrieves a list of links scoped to the tenant organization.
    Supports title searches, URL searches, active filters, expired logic, and Cursor Pagination.
    """
    records, next_cursor = await list_links(
        db,
        organization_id=organization_id,
        limit=limit,
        cursor=cursor,
        title=title,
        original_url=original_url,
        is_active=is_active,
        exclude_expired=exclude_expired,
        include_only_expired=include_only_expired
    )
    
    return {"links": records, "next_cursor": next_cursor}

@router.patch("/{link_id}", response_model=LinkResponse)
async def modify_link(
    link_id: int,
    payload: LinkUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization)
):
    """
    Modifies link metadata (title, description, expiration, active status).
    Generates a security AuditEvent tracking modifications.
    """
    try:
        # Pre-load existing link to capture current cache keys
        existing_link = await get_link_by_id(db, link_id, organization_id)
        if not existing_link:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Link not found or access denied."
            )
        old_short_code = existing_link.short_code
        old_custom_alias = existing_link.custom_alias

        link = await update_link(db, link_id, organization_id, payload)
        if not link:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Link not found or access denied."
            )
            
        request_id = getattr(request.state, "request_id", "unknown")
        await log_audit_event(
            db,
            request_id=request_id,
            event_type="link.updated",
            organization_id=organization_id,
            actor_user_id=current_user.id,
            metadata={
                "link_id": str(link.id),
                "short_code": link.short_code,
                "updated_fields": payload.model_dump(exclude_unset=True)
            }
        )
        
        await db.commit()

        # Invalidate old and new cache keys after commit
        await delete_link_cache(old_short_code, old_custom_alias)
        await delete_link_cache(link.short_code, link.custom_alias)

        return link
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update link: {str(e)}"
        )

@router.delete("/{link_id}", status_code=status.HTTP_200_OK)
async def delete_link(
    link_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization)
):
    """
    Soft-deletes a link, marking is_active = false.
    Generates a security AuditEvent logging deletion.
    """
    try:
        # Fetch link first to get code for audits and cache invalidation
        link = await get_link_by_id(db, link_id, organization_id)
        if not link:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Link not found or access denied."
            )
        old_short_code = link.short_code
        old_custom_alias = link.custom_alias
            
        await soft_delete_link(db, link_id, organization_id)
        
        request_id = getattr(request.state, "request_id", "unknown")
        await log_audit_event(
            db,
            request_id=request_id,
            event_type="link.deleted",
            organization_id=organization_id,
            actor_user_id=current_user.id,
            metadata={"link_id": str(link.id), "short_code": link.short_code}
        )
        
        await db.commit()

        # Invalidate cache keys after commit
        await delete_link_cache(old_short_code, old_custom_alias)

        return {"status": "success", "message": "Link soft-deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete link: {str(e)}"
        )

@redirect_router.get("/{short_code}")
async def redirect_to_url(
    short_code: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Global Redirection Endpoint.
    Resolves the short code or custom alias using Redis (falling back to Postgres),
    increments the click counter atomically, publishes an asynchronous click event,
    and redirects the client via HTTP 302 Found.
    """
    # Parse client request details for telemetry tracking
    user_agent = request.headers.get("user-agent", "")
    referer = request.headers.get("referer")
    ip_address = request.headers.get("x-real-ip") or request.headers.get("x-forwarded-for") or request.client.host
    if ip_address and "," in ip_address:
        ip_address = ip_address.split(",")[0].strip()

    # 1. Cache lookup
    cached = await get_cached_link(short_code)
    if cached:
        is_active = cached.get("is_active", True)
        expires_at_str = cached.get("expires_at")
        
        is_expired = False
        if expires_at_str:
            try:
                expires_at = datetime.fromisoformat(expires_at_str)
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                if expires_at < datetime.now(timezone.utc):
                    is_expired = True
            except Exception:
                is_expired = True
                
        if not is_active or is_expired:
            # Clear invalid cache keys
            await delete_link_cache(short_code)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="The link does not exist, has expired, or is inactive."
            )
            
        # Cache Hit flow: Increment count atomically in PostgreSQL, publish telemetry, and redirect
        link_id = int(cached["id"])
        await increment_click_count_atomic(db, link_id)
        await db.commit()
        
        # Resolve organization_id with safe fallback for backward-compatible cache payloads
        org_id_str = cached.get("organization_id")
        if org_id_str:
            org_id = uuid.UUID(org_id_str)
        else:
            link_db = await db.get(Link, link_id)
            org_id = link_db.organization_id if link_db else None

        if org_id:
            TelemetryPublisher.publish_click_event(
                link_id=link_id,
                organization_id=org_id,
                ip_address=ip_address,
                user_agent=user_agent,
                referer=referer
            )
        
        return RedirectResponse(
            url=cached["original_url"],
            status_code=status.HTTP_302_FOUND
        )

    # 2. Cache Miss / Redis offline flow: query PostgreSQL database
    link = await resolve_link_by_code(db, short_code)
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The link does not exist, has expired, or is inactive."
        )
        
    # Populate the Redis cache
    await set_link_cache(link)
    
    # Increment counter atomically in PostgreSQL
    await increment_click_count_atomic(db, link.id)
    await db.commit()
    
    TelemetryPublisher.publish_click_event(
        link_id=link.id,
        organization_id=link.organization_id,
        ip_address=ip_address,
        user_agent=user_agent,
        referer=referer
    )
    
    return RedirectResponse(
        url=link.original_url,
        status_code=status.HTTP_302_FOUND
    )
