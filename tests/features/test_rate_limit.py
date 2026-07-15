import asyncio
import pytest
from unittest.mock import patch
from fastapi import status
from app.core.redis import redis_manager
from app.core.config import settings
from tests.features.test_links import setup_test_tenant

@pytest.mark.asyncio
async def test_auth_rate_limiting_ip_exhaustion(async_client):
    """
    Verifies that IP-scoped rate limits on auth endpoints block requests
    after 5 attempts and return HTTP 429 with correct headers.
    """
    # Use a dummy email to test rate limits on login
    login_payload = {"email": "rate_limit_test@test.com", "password": "wrong_password"}
    
    # Clean up Redis key for test isolation
    test_ip = "127.0.0.1"
    ip_key = f"v1:ratelimit:auth:ip:{test_ip}"
    await redis_manager.client.delete(ip_key)
    
    # First 5 requests should return 401 Unauthorized (not 429) since rate limit passes
    for _ in range(5):
        res = await async_client.post("/api/v1/auth/login", json=login_payload)
        assert res.status_code == status.HTTP_401_UNAUTHORIZED
        assert "X-RateLimit-Limit" in res.headers
        assert "X-RateLimit-Remaining" in res.headers
        
    # The 6th request must be rejected with 429 Too Many Requests
    res_limit = await async_client.post("/api/v1/auth/login", json=login_payload)
    assert res_limit.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert res_limit.json()["detail"] == "Rate limit exceeded."
    
    # Verify standard rate-limiting headers
    assert res_limit.headers["X-RateLimit-Limit"] == "5"
    assert res_limit.headers["X-RateLimit-Remaining"] == "0"
    assert "Retry-After" in res_limit.headers
    assert int(res_limit.headers["Retry-After"]) > 0

@pytest.mark.asyncio
async def test_link_rate_limiting_user_exhaustion(async_client):
    """
    Verifies that User-scoped rate limits on link creation endpoints block requests
    once the token bucket is exhausted, by simulating bucket depletion in Redis.
    """
    headers = await setup_test_tenant(async_client, "Limit Tenant", "limiter@user.com")
    
    # Create one link to resolve user payload inside requests and establish connection
    res = await async_client.post(
        "/api/v1/links/",
        json={"original_url": "https://google.com"},
        headers=headers
    )
    assert res.status_code == status.HTTP_201_CREATED
    
    # Retrieve the user ID from current credentials to get the Redis key
    me_res = await async_client.get("/api/v1/users/me", headers=headers)
    user_id = me_res.json()["id"]
    
    user_key = f"v1:ratelimit:links:user:{user_id}"
    
    # Verify rate limit headers exist on links creation
    assert "X-RateLimit-Limit" in res.headers
    assert int(res.headers["X-RateLimit-Remaining"]) < 60
    
    # Exhaust the user bucket manually in Redis to avoid executing 60 sequential HTTP requests
    # Set tokens to 0
    await redis_manager.client.hset(user_key, "tokens", 0)
    
    # Try creating another link (must fail with 429)
    res_limit = await async_client.post(
        "/api/v1/links/",
        json={"original_url": "https://wikipedia.org"},
        headers=headers
    )
    assert res_limit.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert res_limit.headers["X-RateLimit-Remaining"] == "0"
    assert "Retry-After" in res_limit.headers

@pytest.mark.asyncio
async def test_rate_limiter_lazy_refill(async_client):
    """
    Verifies that the Token Bucket refill logic correctly restores tokens over time.
    """
    test_ip = "127.0.0.2"
    ip_key = f"v1:ratelimit:auth:ip:{test_ip}"
    await redis_manager.client.delete(ip_key)
    
    # Set mock IP headers in client requests to target different IP bucket
    client_headers = {"X-Forwarded-For": test_ip}
    login_payload = {"email": "test_refill@test.com", "password": "wrong_password"}
    
    # Run 5 requests to deplete the bucket
    for _ in range(5):
        await async_client.post("/api/v1/auth/login", json=login_payload, headers=client_headers)
        
    # Verify bucket is exhausted
    res = await async_client.post("/api/v1/auth/login", json=login_payload, headers=client_headers)
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY or res.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    
    # Manually shift last_updated back in time (e.g. 30 seconds ago) in Redis
    # Refill rate = 5 / 60 = 0.0833 tokens per second.
    # 30 seconds * 0.0833 = 2.5 tokens refilled.
    state = await redis_manager.client.hmget(ip_key, "tokens", "last_updated")
    last_updated = float(state[1])
    await redis_manager.client.hset(ip_key, "last_updated", last_updated - 30)
    
    # Try calling route again (should now be allowed as we have 2 tokens!)
    res_refilled = await async_client.post("/api/v1/auth/login", json=login_payload, headers=client_headers)
    assert res_refilled.status_code == status.HTTP_401_UNAUTHORIZED
    assert int(res_refilled.headers["X-RateLimit-Remaining"]) >= 1

@pytest.mark.asyncio
async def test_rate_limiter_concurrent_bursts(async_client):
    """
    Tests atomic properties of concurrent requests.
    """
    test_ip = "127.0.0.3"
    ip_key = f"v1:ratelimit:auth:ip:{test_ip}"
    await redis_manager.client.delete(ip_key)
    
    headers = {"X-Forwarded-For": test_ip}
    login_payload = {"email": "burst@test.com", "password": "wrong_password"}
    
    # Fire 8 concurrent requests simultaneously
    tasks = [
        async_client.post("/api/v1/auth/login", json=login_payload, headers=headers)
        for _ in range(8)
    ]
    responses = await asyncio.gather(*tasks)
    
    status_codes = [r.status_code for r in responses]
    
    # 5 should pass to credentials checks (401), 3 should fail with rate limits (429)
    assert status_codes.count(status.HTTP_401_UNAUTHORIZED) == 5
    assert status_codes.count(status.HTTP_429_TOO_MANY_REQUESTS) == 3

@pytest.mark.asyncio
async def test_rate_limiter_fail_open_resilience(async_client):
    """
    Verifies that rate limiting failures (e.g. Redis connection timeout)
    fail open gracefully, allowing requests to complete.
    """
    login_payload = {"email": "fail_open@test.com", "password": "wrong_password"}
    
    # Mock Redis client eval command to raise an exception
    with patch.object(redis_manager.client, "eval", side_effect=Exception("Redis Connection Refused")):
        # Request should complete with 401 Unauthorized (meaning limit checks fell open and bypassed to auth verification)
        res = await async_client.post("/api/v1/auth/login", json=login_payload)
        assert res.status_code == status.HTTP_401_UNAUTHORIZED
        assert "X-RateLimit-Limit" in res.headers
        assert "X-RateLimit-Remaining" in res.headers
