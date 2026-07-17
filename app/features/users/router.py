import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.dependencies import get_current_user, require_role
from app.features.users.models import User, UserRole
from app.features.users.schemas import UserCreate, UserRead
from app.features.users.services import (
    create_user,
    list_users_by_organization,
    get_user_by_email,
    get_user_by_id,
    soft_delete_user
)
from app.features.audit.services import log_audit_event

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/me", response_model=UserRead)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns the profile metadata of the current authenticated user.
    """
    return current_user

@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def add_user(
    request: Request,
    payload: UserCreate,
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """
    Adds a new User to the current user's Organization.
    Restricted to Owners and Admins. Enforces tenant isolation.
    """
    # Verify email uniqueness
    existing_user = await get_user_by_email(db, payload.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists"
        )
        
    # Prevent Admins from creating Owners
    if payload.role == UserRole.OWNER and current_user.role != UserRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admins cannot create Owner profiles"
        )
        
    try:
        new_user = await create_user(
            db,
            organization_id=current_user.organization_id,
            email=payload.email,
            password_clear=payload.password,
            role=payload.role
        )
        
        request_id = getattr(request.state, "request_id", "unknown")
        await log_audit_event(
            db,
            request_id=request_id,
            event_type="user.created",
            organization_id=current_user.organization_id,
            actor_user_id=current_user.id,
            resource_type="user",
            resource_id=str(new_user.id),
            metadata={
                "user_email": new_user.email,
                "role": new_user.role.value
            }
        )
        
        await db.commit()
        return new_user
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add user: {str(e)}"
        )

@router.get("/", response_model=List[UserRead])
async def list_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Lists all active users belonging to the current user's organization scope.
    """
    users = await list_users_by_organization(db, current_user.organization_id)
    return users

@router.delete("/{user_id}", status_code=status.HTTP_200_OK)
async def delete_user(
    request: Request,
    user_id: uuid.UUID,
    current_user: User = Depends(require_role([UserRole.OWNER, UserRole.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """
    Soft-deletes a user from the organization scope.
    Enforces hierarchical checks:
      - Users cannot delete themselves.
      - Admins cannot delete Owners or other Admins.
      - Owners can delete Admins, Members, and Viewers.
    """
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Self-deletion is not permitted"
        )
        
    target_user = await get_user_by_id(db, user_id=user_id, organization_id=current_user.organization_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in organization scope"
        )
        
    # Enforce hierarchy permissions
    if target_user.role == UserRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_430_FORBIDDEN if hasattr(status, "HTTP_403_FORBIDDEN") else status.HTTP_403_FORBIDDEN,
            detail="Owner accounts cannot be deleted"
        )
        
    if target_user.role == UserRole.ADMIN and current_user.role != UserRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin accounts can only be deleted by the Organization Owner"
        )
        
    try:
        success = await soft_delete_user(db, user_id=user_id, organization_id=current_user.organization_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User delete action failed"
            )
            
        request_id = getattr(request.state, "request_id", "unknown")
        await log_audit_event(
            db,
            request_id=request_id,
            event_type="user.deleted",
            organization_id=current_user.organization_id,
            actor_user_id=current_user.id,
            resource_type="user",
            resource_id=str(user_id),
            metadata={"user_email": target_user.email}
        )
        
        await db.commit()
        return {"status": "success", "message": "User soft deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete user: {str(e)}"
        )
