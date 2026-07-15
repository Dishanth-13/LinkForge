from contextlib import asynccontextmanager
from fastapi import FastAPI, Response
import prometheus_client
from app.core.config import settings
from app.core.logging import logger
from app.core.redis import redis_manager
from app.middleware.request_id import RequestIdMiddleware
from app.middleware.rate_limiter import RateLimitMiddleware
from app.middleware.metrics import HttpMetricsMiddleware
from app.features.health.router import router as health_router
from app.features.auth.router import router as auth_router
from app.features.users.router import router as user_router
from app.features.organizations.router import router as org_router
from app.features.links.router import router as link_router, redirect_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages the startup and shutdown lifecycles of the application.
    Initializes backing client pools on startup and safely tears them down on shutdown.
    """
    logger.info("Initializing LinkForge application", environment=settings.ENVIRONMENT)
    
    # Initialize connection clients (Redis)
    redis_manager.init_client()
    
    # Initialize static build metadata gauge
    import platform
    from app.core.metrics import linkforge_build_info
    linkforge_build_info.labels(
        version="0.2.0",
        environment=settings.ENVIRONMENT,
        python_version=platform.python_version()
    ).set(1.0)
    
    yield
    
    # Cleanup connection clients on graceful shutdown
    logger.info("Initiating LinkForge application shutdown sequence")
    await redis_manager.close()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="LinkForge Enterprise Link Infrastructure Platform Backend APIs",
    version="0.2.0",
    lifespan=lifespan,
)

# Apply tracing middleware first so all request logs capture request_id
app.add_middleware(RequestIdMiddleware)
app.add_middleware(HttpMetricsMiddleware)
app.add_middleware(RateLimitMiddleware)

@app.get("/metrics", include_in_schema=False)
def metrics():
    """
    Passive Prometheus metrics scraping route.
    """
    return Response(
        content=prometheus_client.generate_latest(),
        media_type="text/plain"
    )

# Register functional features
app.include_router(health_router)
app.include_router(auth_router, prefix="/api/v1")
app.include_router(user_router, prefix="/api/v1")
app.include_router(org_router, prefix="/api/v1")
app.include_router(link_router, prefix="/api/v1")
app.include_router(redirect_router)
