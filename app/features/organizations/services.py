import uuid
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.features.organizations.models import Organization
from app.core.logging import logger

async def create_organization(db: AsyncSession, name: str) -> Organization:
    """
    Creates a new Organization inside the database.
    Does not commit directly, allowing atomic chaining of user creation.
    """
    org = Organization(name=name)
    db.add(org)
    await db.flush()  # Assigns UUID ID
    logger.info("Organization created in database", organization_id=str(org.id), name=name)
    return org

async def get_organization(db: AsyncSession, organization_id: uuid.UUID) -> Optional[Organization]:
    """
    Queries an Organization record by ID.
    """
    query = select(Organization).where(Organization.id == organization_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()
