from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.core.config import settings
from app.core.logging import logger
from app.core.redis import redis_manager
from app.middleware.request_id import RequestIdMiddleware
from app.features.health.router import router as health_router
from app.features.auth.router import router as auth_router
from app.features.users.router import router as user_router
from app.features.organizations.router import router as org_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages the startup and shutdown lifecycles of the application.
    Initializes backing client pools on startup and safely tears them down on shutdown.
    """
    logger.info("Initializing LinkForge application", environment=settings.ENVIRONMENT)
    
    # Initialize connection clients (Redis)
    redis_manager.init_client()
    
    yield
    
    # Cleanup connection clients on graceful shutdown
    logger.info("Initiating LinkForge application shutdown sequence")
    await redis_manager.close()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="LinkForge Enterprise Link Infrastructure Platform Backend APIs",
    version="0.1.0",
    lifespan=lifespan,
)

# Apply tracing middleware first so all request logs capture request_id
app.add_middleware(RequestIdMiddleware)

# Register functional features
app.include_router(health_router)
app.include_router(auth_router, prefix="/api/v1")
app.include_router(user_router, prefix="/api/v1")
app.include_router(org_router, prefix="/api/v1")
