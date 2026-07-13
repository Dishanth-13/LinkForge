import uuid
import hashlib
import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Tuple
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.logging import logger
from app.features.auth.models import RefreshToken
from app.features.users.models import User

# Initialize Argon2id Password Hasher with OWASP-recommended parameters
ph = PasswordHasher(
    time_cost=3,          # 3 iterations
    memory_cost=65536,    # 64 MiB memory
    parallelism=4,         # 4 parallel threads
    hash_len=32,          # 32 bytes key length
    salt_len=16           # 16 bytes salt length
)

def hash_password(password: str) -> str:
    """
    Hashes a plaintext password using Argon2id.
    """
    return ph.hash(password)

def verify_password(password: str, hashed_password: str) -> bool:
    """
    Verifies a plaintext password against an Argon2id hash.
    Returns False on verification mismatch or generic execution exceptions.
    """
    try:
        return ph.verify(hashed_password, password)
    except VerifyMismatchError:
        return False
    except Exception as e:
        logger.error("Argon2id password verification failed", error=str(e))
        return False

def create_access_token(user_id: uuid.UUID, organization_id: uuid.UUID, role: str) -> str:
    """
    Generates a stateless JWT access token signed with symmetric HS256.
    Contains user ID, organization mapping, and role claims.
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    payload = {
        "sub": str(user_id),
        "org_id": str(organization_id),
        "role": str(role),
        "exp": int(expire.timestamp()),
        "iat": int(now.timestamp()),
        "jti": str(uuid.uuid4()),
        "type": "access"
    }
    
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def create_refresh_token(user_id: uuid.UUID, jti: str) -> str:
    """
    Generates a JWT refresh token signed with symmetric HS256.
    The token payload embeds a unique jti which correlates with a database RefreshToken record.
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    payload = {
        "sub": str(user_id),
        "exp": int(expire.timestamp()),
        "iat": int(now.timestamp()),
        "jti": jti,
        "type": "refresh"
    }
    
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def decode_token(token: str) -> Optional[dict[str, Any]]:
    """
    Decodes a JWT token using settings configuration.
    Catches and handles ExpiredSignatureError and InvalidTokenError safely.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Token signature has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning("Token validation failed", error=str(e))
        return None

def hash_token_secret(token_string: str) -> str:
    """
    Computes a SHA-256 hash of a plaintext token string to prevent exposing active secrets
    directly inside datastores (mitigates database leakage exposure).
    """
    return hashlib.sha256(token_string.encode("utf-8")).hexdigest()

# ==========================================
# Database Refresh Session Management (RTR)
# ==========================================

async def issue_refresh_token_session(
    db: AsyncSession,
    user_id: uuid.UUID,
    parent_jti: Optional[str] = None
) -> Tuple[str, RefreshToken]:
    """
    Creates a new refresh token, hashes it, and persists the metadata record
    in PostgreSQL for session tracking.
    """
    jti = str(uuid.uuid4())
    raw_token = create_refresh_token(user_id, jti)
    token_hash = hash_token_secret(raw_token)
    
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    session = RefreshToken(
        user_id=user_id,
        jti=jti,
        token_hash=token_hash,
        parent_jti=parent_jti,
        expires_at=expires_at
    )
    
    db.add(session)
    await db.flush()  # Commit handled by request transaction logic
    
    logger.debug("Issued refresh token session in database", user_id=str(user_id), jti=jti)
    return raw_token, session

async def revoke_all_user_sessions(db: AsyncSession, user_id: uuid.UUID) -> int:
    """
    Emergency session termination: Revokes all active refresh tokens belonging to a user.
    Called when a refresh token replay attack is detected.
    """
    query = select(RefreshToken).where(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked_at.is_(None)
    )
    result = await db.execute(query)
    tokens = result.scalars().all()
    
    now = datetime.now(timezone.utc)
    count = 0
    for token in tokens:
        token.revoked_at = now
        count += 1
        
    await db.flush()
    logger.warning("Revoked all active user sessions due to breach detection", user_id=str(user_id), count=count)
    return count

async def rotate_refresh_token_session(
    db: AsyncSession,
    raw_token: str
) -> Tuple[str, str]:
    """
    Implements Refresh Token Rotation (RTR).
    Verifies the JWT and the PostgreSQL record.
    If valid:
      - Revokes the current token.
      - Issues a new access token and a rotated refresh token.
    If the token is valid but was ALREADY revoked:
      - Triggers breach alarm.
      - Revokes all sessions for the associated user.
      - Raises jwt.InvalidTokenError.
    """
    payload = decode_token(raw_token)
    if not payload or payload.get("type") != "refresh":
        raise jwt.InvalidTokenError("Invalid or expired session token")
        
    jti = payload.get("jti")
    user_id_str = payload.get("sub")
    if not jti or not user_id_str:
        raise jwt.InvalidTokenError("Missing token properties")
        
    user_id = uuid.UUID(user_id_str)
    
    # Query token in DB
    query = select(RefreshToken).where(RefreshToken.jti == jti)
    result = await db.execute(query)
    session = result.scalar_one_or_none()
    
    if not session:
        raise jwt.InvalidTokenError("Session not found")
        
    # Verify hash integrity to match exactly
    incoming_hash = hash_token_secret(raw_token)
    if session.token_hash != incoming_hash:
        raise jwt.InvalidTokenError("Session integrity check failed")
        
    now = datetime.now(timezone.utc)
    
    # Check if token is expired
    if session.expires_at < now:
        # Flag as revoked/expired if not already
        if not session.revoked_at:
            session.revoked_at = now
            await db.flush()
        raise jwt.InvalidTokenError("Session expired")
        
    # Check if token was ALREADY revoked (Breach Replay Attack!)
    if session.revoked_at is not None:
        logger.error(
            "CRITICAL: Refresh token reuse detected! Replay breach threat.",
            jti=jti,
            user_id=str(user_id)
        )
        # Revoke everything for security
        await revoke_all_user_sessions(db, user_id)
        raise jwt.InvalidTokenError("Session breach detected. Re-authentication required.")
        
    # Valid token: Perform rotation
    session.revoked_at = now
    
    # Generate new session pair
    new_refresh_token, _ = await issue_refresh_token_session(db, user_id, parent_jti=jti)
    
    # Load user to populate access token claims (role, org_id)
    user_query = select(User).where(User.id == user_id, User.deleted_at.is_(None))
    user_result = await db.execute(user_query)
    user = user_result.scalar_one_or_none()
    
    if not user or not user.is_active:
        raise jwt.InvalidTokenError("User associated with session is deactivated")
        
    new_access_token = create_access_token(user.id, user.organization_id, user.role.value)
    
    return new_access_token, new_refresh_token


# ==========================================
# Cookie Management Helpers
# ==========================================

from fastapi import Response

def set_refresh_cookie(response: Response, token: str) -> None:
    """
    Sets the refresh token in an HttpOnly secure cookie.
    Enforces Secure=True strictly in production environments.
    """
    is_production = settings.ENVIRONMENT == "production"
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=is_production,
        samesite="lax",
        max_age=7 * 24 * 60 * 60,  # 7 days
        path="/api/v1/auth"
    )

def delete_refresh_cookie(response: Response) -> None:
    """
    Deletes the refresh token cookie.
    """
    response.delete_cookie(
        key="refresh_token",
        path="/api/v1/auth"
    )

