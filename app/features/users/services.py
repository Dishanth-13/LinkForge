import uuid
from datetime import datetime, timezone
from typing import Optional, Sequence
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.features.users.models import User, UserRole
from app.features.auth.services import hash_password
from app.core.logging import logger

async def create_user(
    db: AsyncSession,
    organization_id: uuid.UUID,
    email: str,
    password_clear: str,
    role: UserRole = UserRole.MEMBER
) -> User:
    """
    Hashes password using Argon2id and adds the new User to the session.
    Does not commit directly.
    """
    hashed = hash_password(password_clear)
    user = User(
        organization_id=organization_id,
        email=email.lower().strip(),
        hashed_password=hashed,
        role=role
    )
    db.add(user)
    await db.flush()  # Assings UUID ID
    logger.info("User created in database", user_id=str(user.id), email=user.email, role=role.value)
    return user

async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    """
    Queries an active user by email. Skips soft-deleted users.
    """
    query = select(User).where(
        User.email == email.lower().strip(),
        User.deleted_at.is_(None)
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()

async def get_user_by_id(
    db: AsyncSession,
    user_id: uuid.UUID,
    organization_id: uuid.UUID
) -> Optional[User]:
    """
    Queries an active user by ID, strictly enforcing organization-scoping (tenant isolation).
    """
    query = select(User).where(
        User.id == user_id,
        User.organization_id == organization_id,
        User.deleted_at.is_(None)
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()

async def list_users_by_organization(
    db: AsyncSession,
    organization_id: uuid.UUID
) -> Sequence[User]:
    """
    Lists all active users belonging to a specific organization.
    """
    query = select(User).where(
        User.organization_id == organization_id,
        User.deleted_at.is_(None)
    )
    result = await db.execute(query)
    return result.scalars().all()

async def soft_delete_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    organization_id: uuid.UUID
) -> bool:
    """
    Flags a user record as deleted inside their organization scope.
    """
    query = select(User).where(
        User.id == user_id,
        User.organization_id == organization_id,
        User.deleted_at.is_(None)
    )
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    if not user:
        return False
        
    user.deleted_at = datetime.now(timezone.utc)
    user.is_active = False
    await db.flush()
    logger.info("User flagged as soft-deleted", user_id=str(user_id), organization_id=str(organization_id))
    return True
