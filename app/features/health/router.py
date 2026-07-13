from fastapi import APIRouter, Depends, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import text
import redis.asyncio as aioredis
from app.core.database import get_db
from app.core.redis import get_redis
from app.core.logging import logger

router = APIRouter(tags=["Health"])

@router.get("/live", status_code=status.HTTP_200_OK)
def get_liveness():
    """
    Liveness probe: verifies that the FastAPI application process is up and running.
    Returns 200 OK immediately without checking external dependencies.
    """
    return {"status": "ok", "environment": "up"}

@router.get("/ready")
async def get_readiness(
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis_client: aioredis.Redis = Depends(get_redis)
):
    """
    Readiness probe: validates that backing infrastructure services (PostgreSQL & Redis)
    are reachable and responsive.
    Returns 503 Service Unavailable if any service fails validation.
    """
    db_healthy = False
    redis_healthy = False
    details = {}

    # Validate PostgreSQL connection
    try:
        await db.execute(text("SELECT 1"))
        db_healthy = True
        details["database"] = "healthy"
    except Exception as e:
        logger.error("Readiness probe database failure", error=str(e))
        details["database"] = "unhealthy"

    # Validate Redis connection
    try:
        await redis_client.ping()
        redis_healthy = True
        details["redis"] = "healthy"
    except Exception as e:
        logger.error("Readiness probe Redis failure", error=str(e))
        details["redis"] = "unhealthy"

    if db_healthy and redis_healthy:
        return {"status": "ok", "components": details}

    # Set status to 503 if any check fails
    response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {"status": "error", "components": details}

@router.get("/health")
async def get_health(
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis_client: aioredis.Redis = Depends(get_redis)
):
    """
    General health endpoint. Performs connection checks on all external dependencies.
    """
    return await get_readiness(response, db, redis_client)
