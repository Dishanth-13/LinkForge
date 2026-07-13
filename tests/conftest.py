import pytest
from collections.abc import AsyncGenerator
from httpx import ASGITransport, AsyncClient
from app.main import app

@pytest.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """
    Provides an async HTTP client for executing integration tests on FastAPI routes.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
