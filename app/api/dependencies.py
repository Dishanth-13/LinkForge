import uuid
from typing import List, Callable
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from structlog.contextvars import bind_contextvars
from app.core.database import get_db
from app.features.auth.services import decode_token
from app.features.users.models import User, UserRole
from app.features.users.services import get_user_by_id

# Use HTTPBearer security schema for Swagger UI authorization
security_scheme = HTTPBearer(auto_error=False)

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token_creds: HTTPAuthorizationCredentials = Depends(security_scheme)
) -> User:
    """
    Decodes the JWT access token and retrieves the associated active User.
    Binds the user ID and organization ID to logging contextvars.
    """
    if not token_creds:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    token = token_creds.credentials
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user_id_str = payload.get("sub")
    org_id_str = payload.get("org_id")
    if not user_id_str or not org_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed authentication claims",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user_id = uuid.UUID(user_id_str)
    org_id = uuid.UUID(org_id_str)
    
    # Query database to confirm user status
    user = await get_user_by_id(db, user_id=user_id, organization_id=org_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User session is invalid or user has been deactivated",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is deactivated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Bind tenant metadata to structlog context variables automatically
    bind_contextvars(user_id=str(user.id), organization_id=str(user.organization_id))
    
    return user

async def get_current_organization(
    current_user: User = Depends(get_current_user)
) -> uuid.UUID:
    """
    Dependency that yields the authenticated user's organization ID.
    Enforces tenant boundaries for request routing.
    """
    return current_user.organization_id

def require_role(allowed_roles: List[UserRole]) -> Callable[[User], User]:
    """
    FastAPI dependency factory that restricts endpoint access to specific roles.
    Raises HTTP 403 Forbidden if permissions are insufficient.
    """
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action"
            )
        return current_user
    return dependency
