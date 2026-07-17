import uuid
from typing import List, Callable, Optional, Literal
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from structlog.contextvars import bind_contextvars
from pydantic import BaseModel
from app.core.database import get_db
from app.features.auth.services import decode_token
from app.features.users.models import User, UserRole
from app.features.users.services import get_user_by_id

# Use HTTPBearer security schema for Swagger UI authorization
security_scheme = HTTPBearer(auto_error=False)

class AuthContext(BaseModel):
    organization_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    api_key_id: Optional[uuid.UUID] = None
    auth_method: Literal["jwt", "api_key"]
    permissions: list[str] = []


async def get_auth_context(
    db: AsyncSession = Depends(get_db),
    token_creds: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key")
) -> AuthContext:
    """
    Validates credentials using either Bearer JWT or X-API-Key.
    Updates last_used_at for verified API keys.
    """
    from app.features.api_keys.services import authenticate_api_key
    
    # 1. API Key Auth
    if x_api_key:
        api_key_obj = await authenticate_api_key(db, x_api_key)
        if not api_key_obj:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or revoked API key"
            )
        # Bind tenant metadata to structlog
        bind_contextvars(api_key_id=str(api_key_obj.id), organization_id=str(api_key_obj.organization_id))
        
        return AuthContext(
            organization_id=api_key_obj.organization_id,
            user_id=api_key_obj.created_by,
            api_key_id=api_key_obj.id,
            auth_method="api_key",
            permissions=api_key_obj.permissions
        )
        
    # 2. Bearer JWT Auth
    if token_creds:
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
        
        user = await get_user_by_id(db, user_id=user_id, organization_id=org_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User session is invalid or account is deactivated",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        bind_contextvars(user_id=str(user.id), organization_id=str(user.organization_id))
        
        return AuthContext(
            organization_id=user.organization_id,
            user_id=user.id,
            auth_method="jwt",
            permissions=[]
        )
        
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication credentials were not provided",
        headers={"WWW-Authenticate": "Bearer"},
    )

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    auth_ctx: AuthContext = Depends(get_auth_context)
) -> User:
    """
    Decodes credentials (JWT or API Key) via get_auth_context, and retrieves
    the associated active User. Binds metadata to logging contextvars.
    """
    if not auth_ctx.user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user = await get_user_by_id(db, user_id=auth_ctx.user_id, organization_id=auth_ctx.organization_id)
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
