from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings
from app.core.logging import logger

# Establish production-ready async database connection pool
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,  # Set to True for debugging SQL statements
    pool_size=20,          # Size of connection pool
    max_overflow=10,       # Allow up to 10 overflow connections
    pool_pre_ping=True,    # Verify connection health before usage (prevents stale connection errors)
)

# Create session factory for generating AsyncSession instances
SessionLocal = async_sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)

class Base(DeclarativeBase):
    """
    Base class for all SQLAlchemy declarative models.
    Provides standard base mappings for tables.
    """
    pass

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that yields an active SQLAlchemy AsyncSession.
    Ensures rollback on uncaught transaction errors and guarantees connection release.
    """
    async with SessionLocal() as session:
        try:
            yield session
        except Exception as e:
            logger.error("Database session encountered transaction exception", error=str(e))
            await session.rollback()
            raise
        finally:
            await session.close()
