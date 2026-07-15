import os
os.environ["ENVIRONMENT"] = "testing"

import pytest
from collections.abc import AsyncGenerator
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.main import app
from app.core.database import get_db, engine
from app.core.redis import redis_manager

@pytest.fixture(autouse=True)
async def init_redis_client():
    """
    Ensures the Redis connection client is initialized for tests.
    Bound directly to the active test event loop to prevent Closed Loop errors.
    Clears rate limit keys before each test to prevent test rate limit exhaustion.
    """
    redis_manager.init_client()
    try:
        keys = await redis_manager.client.keys("v1:ratelimit:*")
        if keys:
            await redis_manager.client.delete(*keys)
    except Exception:
        pass
    yield
    await redis_manager.close()

@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Yields a transactional AsyncSession that is automatically rolled back 
    after the test finishes. This guarantees database state isolation.
    """
    connection = await engine.connect()
    transaction = await connection.begin()
    
    # Create a session bound to the connection
    session = AsyncSession(bind=connection, expire_on_commit=False)
    
    yield session
    
    # Clean up session and rollback all transactions executed in the test
    await session.close()
    await transaction.rollback()
    await connection.close()

@pytest.fixture(autouse=True)
async def override_get_db(db_session: AsyncSession):
    """
    Automatically overrides FastAPI's get_db dependency to use the active 
    transactional test session.
    """
    app.dependency_overrides[get_db] = lambda: db_session
    yield
    app.dependency_overrides.pop(get_db, None)

@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """
    Provides an async HTTP client for executing integration tests on FastAPI routes.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
