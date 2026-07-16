import uuid
import secrets
from datetime import datetime, timezone
from typing import Optional, Tuple, Sequence
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.logging import logger
from app.features.api_keys.models import APIKey
from app.features.api_keys.schemas import APIKeyCreate

# Initialize Argon2id Password Hasher with same OWASP-recommended parameters
ph = PasswordHasher(
    time_cost=3,          # 3 iterations
    memory_cost=65536,    # 64 MiB memory
    parallelism=4,         # 4 parallel threads
    hash_len=32,          # 32 bytes key length
    salt_len=16           # 16 bytes salt length
)

def generate_key_material(environment: str) -> Tuple[str, str, str]:
    """
    Generates a cryptographically secure API key.
    Returns:
        tuple: (plain_text_key, key_prefix, hashed_key)
    """
    # Generate 32 bytes of secure random material (length approx 43 characters)
    token = secrets.token_urlsafe(32)
    
    # Prefix mapping
    env_prefix = "lf_live_" if environment == "production" else "lf_test_"
    
    plain_text_key = f"{env_prefix}{token}"
    # Prefix is env_prefix + first 8 characters of random token
    key_prefix = f"{env_prefix}{token[:8]}"
    
    # Hash the entire plain_text_key using Argon2id
    hashed_key = ph.hash(plain_text_key)
    
    return plain_text_key, key_prefix, hashed_key

async def create_api_key(
    db: AsyncSession,
    organization_id: uuid.UUID,
    created_by: uuid.UUID,
    payload: APIKeyCreate
) -> Tuple[APIKey, str]:
    """
    Creates and persists a new API key record.
    Returns:
        tuple: (APIKey, plain_text_key)
    """
    plain, prefix, hashed = generate_key_material(payload.environment)
    
    api_key = APIKey(
        organization_id=organization_id,
        name=payload.name,
        environment=payload.environment,
        key_prefix=prefix,
        key_hash=hashed,
        permissions=[p.value for p in payload.permissions],
        created_by=created_by
    )
    
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    
    logger.info("API Key created successfully", key_id=str(api_key.id), org_id=str(organization_id))
    return api_key, plain

async def list_api_keys(
    db: AsyncSession,
    organization_id: uuid.UUID
) -> Sequence[APIKey]:
    """
    Lists all API keys scoped to the organization.
    """
    query = select(APIKey).where(APIKey.organization_id == organization_id).order_on=APIKey.created_at.desc()
    # Wait, SQLAlchemy order_by, not order_on. Let's fix that!
    query = select(APIKey).where(APIKey.organization_id == organization_id).order_by(APIKey.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()

async def revoke_api_key(
    db: AsyncSession,
    key_id: uuid.UUID,
    organization_id: uuid.UUID
) -> Optional[APIKey]:
    """
    Revokes an existing API key, preventing future authentication.
    """
    query = select(APIKey).where(
        APIKey.id == key_id,
        APIKey.organization_id == organization_id
    )
    result = await db.execute(query)
    api_key = result.scalar_one_or_none()
    
    if not api_key:
        return None
        
    if api_key.revoked_at is None:
        api_key.revoked_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(api_key)
        logger.info("API Key revoked successfully", key_id=str(key_id), org_id=str(organization_id))
        
    return api_key

async def regenerate_api_key(
    db: AsyncSession,
    key_id: uuid.UUID,
    organization_id: uuid.UUID,
    created_by: uuid.UUID
) -> Optional[Tuple[APIKey, str]]:
    """
    Revokes the current key and creates a replacement key with the same name,
    permissions, and environment.
    Returns:
        tuple: (new_APIKey, new_plain_text_key)
    """
    # Find existing key
    query = select(APIKey).where(
        APIKey.id == key_id,
        APIKey.organization_id == organization_id
    )
    result = await db.execute(query)
    old_key = result.scalar_one_or_none()
    
    if not old_key:
        return None
        
    # Mark old key as revoked
    if old_key.revoked_at is None:
        old_key.revoked_at = datetime.now(timezone.utc)
        
    # Generate new key
    plain, prefix, hashed = generate_key_material(old_key.environment)
    
    new_key = APIKey(
        organization_id=organization_id,
        name=old_key.name,
        environment=old_key.environment,
        key_prefix=prefix,
        key_hash=hashed,
        permissions=old_key.permissions,
        created_by=created_by
    )
    
    db.add(new_key)
    await db.commit()
    await db.refresh(new_key)
    
    logger.info(
        "API Key regenerated successfully",
        old_key_id=str(key_id),
        new_key_id=str(new_key.id),
        org_id=str(organization_id)
    )
    return new_key, plain

async def authenticate_api_key(
    db: AsyncSession,
    raw_key: str
) -> Optional[APIKey]:
    """
    Validates a raw API key string.
    If valid, updates last_used_at and returns the APIKey record.
    """
    raw_key = raw_key.strip()
    if not (raw_key.startswith("lf_live_") or raw_key.startswith("lf_test_")):
        return None
        
    # Extract the prefix (env_prefix + first 8 characters of random token)
    # Total prefix length is 16: "lf_live_" (8) + "xxxx" (8) = 16
    if len(raw_key) < 16:
        return None
        
    prefix = raw_key[:16]
    
    query = select(APIKey).where(
        APIKey.key_prefix == prefix,
        APIKey.revoked_at == None
    )
    result = await db.execute(query)
    candidates = result.scalars().all()
    
    for key_obj in candidates:
        try:
            if ph.verify(key_obj.key_hash, raw_key):
                # Update last used timestamp
                key_obj.last_used_at = datetime.now(timezone.utc)
                await db.commit()
                return key_obj
        except VerifyMismatchError:
            continue
        except Exception as e:
            logger.error("Argon2id key verification failed", error=str(e))
            continue
            
    return None
