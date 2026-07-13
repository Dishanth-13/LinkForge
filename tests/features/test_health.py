import pytest
from unittest.mock import AsyncMock
from fastapi import status
from app.main import app
from app.core.database import get_db
from app.core.redis import get_redis

@pytest.mark.asyncio
async def test_liveness_probe(async_client):
    """
    Verifies that the /live probe returns 200 OK and basic status message.
    """
    response = await async_client.get("/live")
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"status": "ok", "environment": "up"}

@pytest.mark.asyncio
async def test_readiness_probe_healthy(async_client):
    """
    Verifies that /ready returns 200 OK when both PostgreSQL and Redis pings succeed.
    """
    mock_db = AsyncMock()
    mock_db.execute.return_value = None  # Mock successful SELECT 1

    mock_redis = AsyncMock()
    mock_redis.ping.return_value = True  # Mock successful ping

    # Inject mock overrides
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_redis] = lambda: mock_redis

    try:
        response = await async_client.get("/ready")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "ok"
        assert data["components"]["database"] == "healthy"
        assert data["components"]["redis"] == "healthy"
    finally:
        app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_readiness_probe_unhealthy_db(async_client):
    """
    Verifies that /ready returns 503 Service Unavailable when the database is unreachable.
    """
    mock_db = AsyncMock()
    mock_db.execute.side_effect = Exception("Connection timeout")  # Mock database failure

    mock_redis = AsyncMock()
    mock_redis.ping.return_value = True

    # Inject mock overrides
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_redis] = lambda: mock_redis

    try:
        response = await async_client.get("/ready")
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        data = response.json()
        assert data["status"] == "error"
        assert data["components"]["database"] == "unhealthy"
        assert data["components"]["redis"] == "healthy"
    finally:
        app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_readiness_probe_unhealthy_redis(async_client):
    """
    Verifies that /ready returns 503 Service Unavailable when Redis is unreachable.
    """
    mock_db = AsyncMock()
    mock_db.execute.return_value = None

    mock_redis = AsyncMock()
    mock_redis.ping.side_effect = Exception("Redis connection refused")  # Mock Redis failure

    # Inject mock overrides
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_redis] = lambda: mock_redis

    try:
        response = await async_client.get("/ready")
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        data = response.json()
        assert data["status"] == "error"
        assert data["components"]["database"] == "healthy"
        assert data["components"]["redis"] == "unhealthy"
    finally:
        app.dependency_overrides.clear()
