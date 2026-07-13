import uuid
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from structlog.contextvars import bind_contextvars, clear_contextvars

class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        """
        Extracts or generates an X-Request-ID trace token, attaches it to the 
        request state and structlog context variables, executes the request, and 
        returns the ID in the response headers.
        """
        request_id = request.headers.get("X-Request-ID")
        if not request_id:
            request_id = str(uuid.uuid4())

        # Bind to structlog context vars so all subsequent logs automatically print request_id
        bind_contextvars(request_id=request_id)

        # Store in request state for access in endpoints if needed
        request.state.request_id = request_id

        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            return response
        finally:
            # Clear context variables at the end of the request execution to prevent leaks
            clear_contextvars()
