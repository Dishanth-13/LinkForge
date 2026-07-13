import redis.asyncio as aioredis
from app.core.config import settings
from app.core.logging import logger

class RedisClientManager:
    def __init__(self):
        self.client: aioredis.Redis | None = None

    def init_client(self) -> None:
        """
        Initializes the async Redis connection client.
        Uses connection timeouts to prevent blocking in failure scenarios.
        """
        logger.info("Initializing async Redis client pool", url=settings.REDIS_URL)
        self.client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,      # Decode byte responses to strings automatically
            socket_timeout=5.0,         # Max wait time for socket operations
            socket_connect_timeout=5.0, # Max wait time for TCP connection
        )

    async def close(self) -> None:
        """
        Closes the Redis client pool.
        """
        if self.client:
            logger.info("Closing Redis connection pool")
            await self.client.aclose()
            self.client = None

redis_manager = RedisClientManager()

async def get_redis() -> aioredis.Redis:
    """
    FastAPI dependency yielding the active Redis client.
    Ensures the client is initialized before yielding.
    """
    if redis_manager.client is None:
        redis_manager.init_client()
    assert redis_manager.client is not None
    return redis_manager.client
