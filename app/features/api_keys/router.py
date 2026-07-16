import uuid
from typing import Sequence
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.features.users.models import User
from app.features.api_keys.schemas import APIKeyCreate, APIKeyResponse, APIKeyCreatedResponse
from app.features.api_keys.services import (
    create_api_key,
    list_api_keys,
    revoke_api_key,
    regenerate_api_key
)

router = APIRouter(prefix="/api-keys", tags=["API Keys"])

@router.get("", response_model=Sequence[APIKeyResponse])
async def list_keys(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Sequence[APIKeyResponse]:
    """
    Returns all API keys for the authenticated organization.
    """
    keys = await list_api_keys(db, current_user.organization_id)
    return keys

@router.post("", response_model=APIKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_key(
    payload: APIKeyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> APIKeyCreatedResponse:
    """
    Creates a new API key. Returns the plaintext key exactly once.
    """
    key_obj, plain_key = await create_api_key(
        db,
        organization_id=current_user.organization_id,
        created_by=current_user.id,
        payload=payload
    )
    
    # Map model attributes + plain text key to response
    response_data = APIKeyCreatedResponse(
        id=key_obj.id,
        organization_id=key_obj.organization_id,
        name=key_obj.name,
        environment=key_obj.environment,
        key_prefix=key_obj.key_prefix,
        permissions=key_obj.permissions,
        created_by=key_obj.created_by,
        created_at=key_obj.created_at,
        last_used_at=key_obj.last_used_at,
        revoked_at=key_obj.revoked_at,
        plain_text_key=plain_key
    )
    return response_data

@router.delete("/{key_id}", response_model=APIKeyResponse)
async def revoke_key(
    key_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> APIKeyResponse:
    """
    Revokes the specified API key, permanently disabling it.
    """
    key_obj = await revoke_api_key(db, key_id, current_user.organization_id)
    if not key_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found or access denied"
        )
    return key_obj

@router.post("/{key_id}/regenerate", response_model=APIKeyCreatedResponse)
async def regenerate_key(
    key_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> APIKeyCreatedResponse:
    """
    Revokes the existing key and returns a replacement key with the same scopes.
    """
    result = await regenerate_api_key(
        db,
        key_id=key_id,
        organization_id=current_user.organization_id,
        created_by=current_user.id
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found or access denied"
        )
        
    key_obj, plain_key = result
    
    response_data = APIKeyCreatedResponse(
        id=key_obj.id,
        organization_id=key_obj.organization_id,
        name=key_obj.name,
        environment=key_obj.environment,
        key_prefix=key_obj.key_prefix,
        permissions=key_obj.permissions,
        created_by=key_obj.created_by,
        created_at=key_obj.created_at,
        last_used_at=key_obj.last_used_at,
        revoked_at=key_obj.revoked_at,
        plain_text_key=plain_key
    )
    return response_data
