import math
from fastapi import Request, status
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response, JSONResponse
from app.core.config import settings
from app.core.redis import redis_manager
from app.core.logging import logger
from app.features.auth.services import decode_token

from app.core.metrics import (
    linkforge_rate_limit_allowed_total,
    linkforge_rate_limit_blocked_total,
    safe_inc
)

# Redis Lua Script for Atomic Token Bucket Rate Limiting
LUA_RATE_LIMITER = """
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])

-- Get current time from Redis server to avoid clock drift
local time_arr = redis.call('TIME')
local current_time = tonumber(time_arr[1]) + (tonumber(time_arr[2]) / 1000000)

-- Fetch current state
local state = redis.call('HMGET', key, 'tokens', 'last_updated')
local tokens = tonumber(state[1])
local last_updated = tonumber(state[2])

if not tokens then
    -- Bucket initialization
    tokens = capacity
    last_updated = current_time
else
    -- Calculate refilled tokens
    local delta = math.max(0, current_time - last_updated)
    local refilled = delta * refill_rate
    tokens = math.min(capacity, tokens + refilled)
end

local allowed = false
local retry_after = 0
local requested = 1

if tokens >= requested then
    tokens = tokens - requested
    last_updated = current_time
    allowed = true
else
    -- Time until at least 1 token is available
    retry_after = math.ceil((requested - tokens) / refill_rate)
end

-- Write back updated state using HSET
redis.call('HSET', key, 'tokens', tokens, 'last_updated', last_updated)

-- Key expires if untouched for more than one rate limit window
local window = math.ceil(capacity / refill_rate)
redis.call('EXPIRE', key, window * 2)

-- Return allowed status (0/1), remaining tokens (rounded down), and retry_after
return { allowed and 1 or 0, math.floor(tokens), retry_after }
"""

async def evaluate_limit(key: str, limit: int, window: int) -> tuple[bool, int, int]:
    """
    Evaluates the rate limit bucket for the given key in Redis.
    Fails open by returning (True, limit, 0) if Redis is down.
    """
    refill_rate = limit / window
    try:
        if redis_manager.client is None:
            redis_manager.init_client()
            
        res = await redis_manager.client.eval(
            LUA_RATE_LIMITER,
            1,
            key,
            limit,
            refill_rate
        )
        return bool(res[0]), int(res[1]), int(res[2])
    except Exception as e:
        logger.warning("Redis rate limit check failed, falling open", error=str(e), key=key)
        return True, limit, 0

class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        path = request.url.path.rstrip("/")
        method = request.method

        # 1. Scope /api/v1/auth/login and /api/v1/auth/register (IP scope)
        if method == "POST" and path in ("/api/v1/auth/login", "/api/v1/auth/register"):
            client_ip = request.headers.get("x-real-ip") or request.headers.get("x-forwarded-for") or request.client.host
            if client_ip and "," in client_ip:
                client_ip = client_ip.split(",")[0].strip()
            
            # Isolated namespace for authentication IP limit
            key = f"v1:ratelimit:auth:ip:{client_ip}"
            allowed, remaining, retry_after = await evaluate_limit(key, settings.AUTH_RATE_LIMIT, settings.AUTH_RATE_WINDOW)

            if not allowed:
                safe_inc(linkforge_rate_limit_blocked_total, labels={"scope": "auth_ip"})
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Rate limit exceeded."},
                    headers={
                        "X-RateLimit-Limit": str(settings.AUTH_RATE_LIMIT),
                        "X-RateLimit-Remaining": str(remaining),
                        "Retry-After": str(retry_after)
                    }
                )
            
            safe_inc(linkforge_rate_limit_allowed_total, labels={"scope": "auth_ip"})
            response = await call_next(request)
            response.headers["X-RateLimit-Limit"] = str(settings.AUTH_RATE_LIMIT)
            response.headers["X-RateLimit-Remaining"] = str(remaining)
            return response

        # 2. Scope POST /api/v1/links (Both IP and User scopes)
        elif method == "POST" and path == "/api/v1/links":
            client_ip = request.headers.get("x-real-ip") or request.headers.get("x-forwarded-for") or request.client.host
            if client_ip and "," in client_ip:
                client_ip = client_ip.split(",")[0].strip()
            
            # Isolated namespace for links IP limit
            ip_key = f"v1:ratelimit:links:ip:{client_ip}"
            
            # Step A: Evaluate IP Limit
            ip_allowed, ip_remaining, ip_retry = await evaluate_limit(ip_key, settings.LINK_CREATE_RATE_LIMIT, settings.LINK_CREATE_RATE_WINDOW)
            if not ip_allowed:
                safe_inc(linkforge_rate_limit_blocked_total, labels={"scope": "link_ip"})
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Rate limit exceeded."},
                    headers={
                        "X-RateLimit-Limit": str(settings.LINK_CREATE_RATE_LIMIT),
                        "X-RateLimit-Remaining": str(ip_remaining),
                        "Retry-After": str(ip_retry)
                    }
                )

            safe_inc(linkforge_rate_limit_allowed_total, labels={"scope": "link_ip"})

            # Step B: Evaluate User Limit if authenticated
            user_id = None
            auth_header = request.headers.get("authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
                payload = decode_token(token)
                if payload and payload.get("type") == "access":
                    user_id = payload.get("sub")

            if user_id:
                # Isolated namespace for links User limit
                user_key = f"v1:ratelimit:links:user:{user_id}"
                user_allowed, user_remaining, user_retry = await evaluate_limit(user_key, settings.LINK_CREATE_RATE_LIMIT, settings.LINK_CREATE_RATE_WINDOW)
                if not user_allowed:
                    safe_inc(linkforge_rate_limit_blocked_total, labels={"scope": "link_user"})
                    return JSONResponse(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        content={"detail": "Rate limit exceeded."},
                        headers={
                            "X-RateLimit-Limit": str(settings.LINK_CREATE_RATE_LIMIT),
                            "X-RateLimit-Remaining": str(user_remaining),
                            "Retry-After": str(user_retry)
                        }
                    )
                
                safe_inc(linkforge_rate_limit_allowed_total, labels={"scope": "link_user"})
                # Both allowed: proceed and set rate limiting headers
                response = await call_next(request)
                response.headers["X-RateLimit-Limit"] = str(settings.LINK_CREATE_RATE_LIMIT)
                response.headers["X-RateLimit-Remaining"] = str(min(ip_remaining, user_remaining))
                return response
            else:
                # Unauthenticated links request
                response = await call_next(request)
                response.headers["X-RateLimit-Limit"] = str(settings.LINK_CREATE_RATE_LIMIT)
                response.headers["X-RateLimit-Remaining"] = str(ip_remaining)
                return response

        # Non-rate-limited routes
        return await call_next(request)
