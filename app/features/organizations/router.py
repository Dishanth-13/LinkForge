from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.features.users.models import User
from app.features.organizations.schemas import OrganizationRead
from app.features.organizations.services import get_organization

router = APIRouter(prefix="/organizations", tags=["Organizations"])

@router.get("/me", response_model=OrganizationRead)
async def get_my_organization(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns the metadata of the organization the current authenticated user belongs to.
    """
    org = await get_organization(db, current_user.organization_id)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    return org
