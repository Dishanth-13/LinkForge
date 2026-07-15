import uuid
from datetime import datetime, timezone
from typing import Optional, List, Tuple
from fastapi import HTTPException, status
from sqlalchemy import select, update, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.features.links.models import Link
from app.features.links.schemas import LinkCreate, LinkUpdate

# Core Base62 Character Set
BASE62_CHARSET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

def encode_base62(num: int) -> str:
    """
    Deterministic conversion of a positive integer to a Base62 string.
    """
    if num < 0:
        raise ValueError("Cannot encode negative numbers")
    if num == 0:
        return BASE62_CHARSET[0]
    
    arr = []
    base = len(BASE62_CHARSET)
    while num > 0:
        num, rem = divmod(num, base)
        arr.append(BASE62_CHARSET[rem])
    arr.reverse()
    return "".join(arr)

def decode_base62(code: str) -> int:
    """
    Decodes a Base62 string back into its original positive integer.
    """
    base = len(BASE62_CHARSET)
    num = 0
    for char in code:
        idx = BASE62_CHARSET.find(char)
        if idx == -1:
            raise ValueError(f"Invalid Base62 character: {char}")
        num = num * base + idx
    return num

async def check_alias_exists(db: AsyncSession, organization_id: uuid.UUID, alias: str) -> bool:
    """
    Checks if a custom alias already exists within the tenant organization scope.
    """
    query = select(Link).where(
        Link.organization_id == organization_id,
        Link.custom_alias == alias,
        Link.is_active == True
    )
    result = await db.execute(query)
    return result.scalar_one_or_none() is not None

async def create_link(
    db: AsyncSession,
    organization_id: uuid.UUID,
    created_by: uuid.UUID,
    payload: LinkCreate
) -> Link:
    """
    Creates a new Link record in the database.
    Assigns sequential BIGINT ID, encodes it into Base62, and validates alias conflicts.
    """
    if payload.custom_alias:
        # Validate tenant-scoped custom alias conflict
        if await check_alias_exists(db, organization_id, payload.custom_alias):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Custom alias '{payload.custom_alias}' already exists for this organization."
            )
            
    # Generate temporary unique code to satisfy DB not-null & unique constraints
    temp_code = f"temp_{uuid.uuid4().hex[:16]}"
    
    link = Link(
        organization_id=organization_id,
        created_by=created_by,
        original_url=payload.original_url,
        short_code=temp_code,
        custom_alias=payload.custom_alias,
        title=payload.title,
        description=payload.description,
        expires_at=payload.expires_at,
        is_active=True,
        click_count=0
    )
    
    db.add(link)
    await db.flush()  # Populates link.id from database auto-increment sequence
    
    # Calculate deterministic Base62 code
    link.short_code = encode_base62(link.id)
    await db.flush()
    
    return link

async def get_link_by_id(
    db: AsyncSession,
    link_id: int,
    organization_id: uuid.UUID
) -> Optional[Link]:
    """
    Queries a single Link record by ID under a strict tenant isolation boundary.
    """
    query = select(Link).where(
        Link.id == link_id,
        Link.organization_id == organization_id,
        Link.is_active == True
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()

async def list_links(
    db: AsyncSession,
    organization_id: uuid.UUID,
    limit: int = 20,
    cursor: Optional[int] = None,
    title: Optional[str] = None,
    original_url: Optional[str] = None,
    is_active: Optional[bool] = None,
    exclude_expired: bool = False,
    include_only_expired: bool = False
) -> Tuple[List[Link], Optional[int]]:
    """
    Queries a paginated list of Link records for an organization using Cursor Pagination.
    Links are ordered by created_at DESC (mapped directly to ID DESC).
    """
    # Enforce strict organization-scoping (Tenant Isolation)
    filters = [Link.organization_id == organization_id]
    
    if cursor is not None:
        # Seek records older than cursor (ID descending)
        filters.append(Link.id < cursor)
        
    if title:
        filters.append(Link.title.ilike(f"%{title}%"))
        
    if original_url:
        filters.append(Link.original_url.ilike(f"%{original_url}%"))
        
    if is_active is not None:
        filters.append(Link.is_active == is_active)
        
    now = datetime.now(timezone.utc)
    if exclude_expired:
        filters.append(or_(Link.expires_at.is_(None), Link.expires_at > now))
        
    if include_only_expired:
        filters.append(and_(Link.expires_at.is_not(None), Link.expires_at <= now))
        
    # Query limit + 1 records to check if a next page exists
    query = select(Link).where(*filters).order_by(Link.id.desc()).limit(limit + 1)
    result = await db.execute(query)
    records = list(result.scalars().all())
    
    next_cursor = None
    if len(records) > limit:
        # We have a next page. Extract cursor from the extra record and slice.
        next_cursor = records[limit - 1].id
        records = records[:limit]
        
    return records, next_cursor

async def update_link(
    db: AsyncSession,
    link_id: int,
    organization_id: uuid.UUID,
    payload: LinkUpdate
) -> Optional[Link]:
    """
    Modifies properties of an existing link under strict tenant isolation.
    """
    link = await get_link_by_id(db, link_id, organization_id)
    if not link:
        return None
        
    if payload.title is not None:
        link.title = payload.title
    if payload.description is not None:
        link.description = payload.description
    if payload.expires_at is not None:
        link.expires_at = payload.expires_at
    if payload.is_active is not None:
        link.is_active = payload.is_active
        
    await db.flush()
    return link

async def soft_delete_link(
    db: AsyncSession,
    link_id: int,
    organization_id: uuid.UUID
) -> bool:
    """
    Soft-deletes a Link by turning off its is_active flag.
    """
    link = await get_link_by_id(db, link_id, organization_id)
    if not link:
        return False
        
    link.is_active = False
    await db.flush()
    return True

async def resolve_link_by_code(
    db: AsyncSession,
    code: str
) -> Optional[Link]:
    """
    Resolves a short code or custom alias to an active, non-expired Link.
    Resolves to the oldest matching record if there is an alias collision across tenants.
    """
    now = datetime.now(timezone.utc)
    query = select(Link).where(
        or_(Link.short_code == code, Link.custom_alias == code),
        Link.is_active == True,
        or_(Link.expires_at.is_(None), Link.expires_at > now)
    ).order_by(Link.created_at.asc())
    
    result = await db.execute(query)
    return result.scalars().first()

async def increment_click_count_atomic(
    db: AsyncSession,
    link_id: int
) -> None:
    """
    Executes an atomic SQL counter increment for redirects.
    """
    query = update(Link).where(Link.id == link_id).values(click_count=Link.click_count + 1)
    await db.execute(query)
    await db.flush()


# ==========================================
# Redis Cache Management Helpers
# ==========================================

import json
from app.core.redis import redis_manager
from app.core.config import settings
from app.core.logging import logger

CACHE_VERSION = "v1"

def get_cache_key(code: str) -> str:
    return f"{CACHE_VERSION}:link:code:{code}"

async def get_cached_link(code: str) -> Optional[dict]:
    """
    Attempts to read cached link properties from Redis.
    Bypasses and logs warnings if Redis is down.
    """
    if not redis_manager.client:
        return None
    try:
        data = await redis_manager.client.get(get_cache_key(code))
        if data:
            return json.loads(data)
    except Exception as e:
        logger.warning("Redis read operation failed", error=str(e), key=code)
    return None

async def set_link_cache(link: Link) -> None:
    """
    Caches link target info in Redis. Writes keys for both short_code and custom_alias if set.
    """
    if not redis_manager.client:
        return
    try:
        expires_str = link.expires_at.isoformat() if link.expires_at else None
        payload = {
            "id": str(link.id),
            "organization_id": str(link.organization_id),
            "original_url": link.original_url,
            "expires_at": expires_str,
            "is_active": link.is_active
        }
        serialized = json.dumps(payload)
        
        # Write short_code key
        await redis_manager.client.set(
            get_cache_key(link.short_code),
            serialized,
            ex=settings.CACHE_TTL_SECONDS
        )
        
        # Write custom_alias key if set
        if link.custom_alias:
            await redis_manager.client.set(
                get_cache_key(link.custom_alias),
                serialized,
                ex=settings.CACHE_TTL_SECONDS
            )
    except Exception as e:
        logger.warning("Redis write operation failed", error=str(e), link_id=str(link.id))

async def delete_link_cache(short_code: str, custom_alias: Optional[str] = None) -> None:
    """
    Invalidates cached link target keys.
    """
    if not redis_manager.client:
        return
    try:
        keys = [get_cache_key(short_code)]
        if custom_alias:
            keys.append(get_cache_key(custom_alias))
        await redis_manager.client.delete(*keys)
    except Exception as e:
        logger.warning("Redis delete operation failed", error=str(e), short_code=short_code)

