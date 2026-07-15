import time
import re
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response
from app.core.metrics import (
    linkforge_http_requests_total,
    linkforge_http_request_duration_seconds,
    safe_inc,
    safe_observe
)

# Regex pattern for isolating UUIDs in paths
UUID_PATTERN = re.compile(r"/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.IGNORECASE)

def normalize_path(path: str) -> str:
    """
    Normalizes variable subpaths (IDs, short codes, UUIDs) to static placeholders.
    Prevents cardinality explosion on Prometheus labels.
    """
    path = path.rstrip("/")
    if not path:
        return "/"
        
    # Ignore administrative/documentation static assets
    if path in ("/metrics", "/docs", "/redoc", "/openapi.json"):
        return path
        
    # 1. Normalize links dynamic routes (e.g. /api/v1/links/123 -> /api/v1/links/{id})
    if path.startswith("/api/v1/links") and path != "/api/v1/links":
        parts = path.split("/")
        # Check if the part after links is an integer ID
        if len(parts) > 4 and parts[4].isdigit():
            return "/api/v1/links/{id}"
            
    # 2. Normalize UUID templates (e.g. /api/v1/organizations/uuid -> /api/v1/organizations/{id})
    path = UUID_PATTERN.sub("/{id}", path)
    
    # 3. Normalize global redirection code (e.g. /5A -> /{short_code})
    # If the path has only 1 segment and doesn't start with /api
    if not path.startswith("/api") and len(path.split("/")) == 2:
        return "/{short_code}"
        
    return path

class HttpMetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        method = request.method
        raw_path = request.url.path
        normalized_path = normalize_path(raw_path)
        
        start_time = time.perf_counter()
        
        try:
            response = await call_next(request)
            status_code = str(response.status_code)
        except Exception as e:
            status_code = "500"
            
            # Observe duration and increment requests count for failed request before raising
            duration = time.perf_counter() - start_time
            safe_observe(
                linkforge_http_request_duration_seconds,
                duration,
                labels={"method": method, "endpoint": normalized_path}
            )
            safe_inc(
                linkforge_http_requests_total,
                labels={"method": method, "endpoint": normalized_path, "status": status_code}
            )
            raise e
            
        duration = time.perf_counter() - start_time
        
        safe_observe(
            linkforge_http_request_duration_seconds,
            duration,
            labels={"method": method, "endpoint": normalized_path}
        )
        safe_inc(
            linkforge_http_requests_total,
            labels={"method": method, "endpoint": normalized_path, "status": status_code}
        )
        
        return response
