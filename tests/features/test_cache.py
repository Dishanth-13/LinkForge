import json
import pytest
from unittest.mock import AsyncMock, patch
from datetime import datetime, timedelta, timezone
from fastapi import status
from app.core.redis import redis_manager
from app.features.links.service import get_cache_key, encode_base62
from tests.features.test_links import setup_test_tenant

@pytest.mark.asyncio
async def test_cache_miss_and_population(async_client):
    """
    Verifies that the first redirect request causes a cache miss,
    queries PostgreSQL, and populates the Redis cache.
    """
    headers = await setup_test_tenant(async_client, "Cache Miss Org", "miss@cache.com")
    
    # 1. Create a link
    res = await async_client.post(
        "/api/v1/links/",
        json={"original_url": "https://python.org"},
        headers=headers
    )
    data = res.json()
    short_code = data["short_code"]
    
    # Clear cache in case it was populated on create
    key = get_cache_key(short_code)
    await redis_manager.client.delete(key)
    
    # Assert cache is currently empty
    assert await redis_manager.client.get(key) is None
    
    # 2. Perform redirect (triggers read-through population)
    red_res = await async_client.get(f"/{short_code}")
    assert red_res.status_code == status.HTTP_302_FOUND
    
    # 3. Assert Redis is now populated with redirect metadata
    cached_val = await redis_manager.client.get(key)
    assert cached_val is not None
    cached_data = json.loads(cached_val)
    assert cached_data["original_url"] == "https://python.org"
    assert cached_data["is_active"] is True

@pytest.mark.asyncio
async def test_cache_hit_bypass_db(async_client):
    """
    Verifies that a cache hit resolves from Redis directly
    without executing database lookup queries.
    """
    headers = await setup_test_tenant(async_client, "Cache Hit Org", "hit@cache.com")
    
    res = await async_client.post(
        "/api/v1/links/",
        json={"original_url": "https://fastapi.tiangolo.com"},
        headers=headers
    )
    short_code = res.json()["short_code"]
    
    # Pre-populate cache to trigger cache hit path
    # Perform first hit to ensure it is populated
    await async_client.get(f"/{short_code}")
    
    # Assert key exists in Redis
    assert await redis_manager.client.get(get_cache_key(short_code)) is not None
    
    # Mock resolve_link_by_code to raise an exception.
    # If the database is hit, the test will crash. If cache hits, it bypasses the DB query.
    with patch("app.features.links.router.resolve_link_by_code", side_effect=AssertionError("Database was queried on cache hit path!")):
        red_res = await async_client.get(f"/{short_code}")
        assert red_res.status_code == status.HTTP_302_FOUND
        assert red_res.headers["Location"] == "https://fastapi.tiangolo.com"

@pytest.mark.asyncio
async def test_cache_invalidation_on_update(async_client):
    """
    Verifies that updating a link invalidates its Redis cache entry.
    """
    headers = await setup_test_tenant(async_client, "Invalidate Update Org", "update_cache@test.com")
    
    res = await async_client.post(
        "/api/v1/links/",
        json={"original_url": "https://old-target.com", "custom_alias": "my-custom"},
        headers=headers
    )
    data = res.json()
    link_id = int(data["id"])
    short_code = data["short_code"]
    
    # Pre-populate cache by resolving it
    await async_client.get(f"/{short_code}")
    assert await redis_manager.client.get(get_cache_key(short_code)) is not None
    assert await redis_manager.client.get(get_cache_key("my-custom")) is not None
    
    # Update the link custom_alias and URL properties
    patch_res = await async_client.patch(
        f"/api/v1/links/{link_id}",
        json={"title": "New Title"},
        headers=headers
    )
    assert patch_res.status_code == status.HTTP_200_OK
    
    # Assert Redis keys are now deleted (invalidated)
    assert await redis_manager.client.get(get_cache_key(short_code)) is None
    assert await redis_manager.client.get(get_cache_key("my-custom")) is None

@pytest.mark.asyncio
async def test_cache_invalidation_on_delete(async_client):
    """
    Verifies that soft-deleting a link deletes its Redis cache entries.
    """
    headers = await setup_test_tenant(async_client, "Invalidate Del Org", "del_cache@test.com")
    
    res = await async_client.post(
        "/api/v1/links/",
        json={"original_url": "https://delete-me.com"},
        headers=headers
    )
    data = res.json()
    link_id = int(data["id"])
    short_code = data["short_code"]
    
    # Populate cache
    await async_client.get(f"/{short_code}")
    assert await redis_manager.client.get(get_cache_key(short_code)) is not None
    
    # Soft delete link
    del_res = await async_client.delete(f"/api/v1/links/{link_id}", headers=headers)
    assert del_res.status_code == status.HTTP_200_OK
    
    # Assert Redis key has been invalidated
    assert await redis_manager.client.get(get_cache_key(short_code)) is None

@pytest.mark.asyncio
async def test_redis_offline_resilience(async_client):
    """
    Verifies that the application degrades gracefully and resolves redirects
    from PostgreSQL directly when Redis is offline.
    """
    headers = await setup_test_tenant(async_client, "Offline Org", "offline@test.com")
    
    res = await async_client.post(
        "/api/v1/links/",
        json={"original_url": "https://fallback-works.com"},
        headers=headers
    )
    short_code = res.json()["short_code"]
    
    # Mock Redis client read to throw a ConnectionError, simulating Redis being down
    with patch.object(redis_manager.client, "get", side_effect=Exception("Redis Connection Refused")):
        red_res = await async_client.get(f"/{short_code}")
        assert red_res.status_code == status.HTTP_302_FOUND
        assert red_res.headers["Location"] == "https://fallback-works.com"

@pytest.mark.asyncio
async def test_expired_cache_entry_invalidation(async_client):
    """
    Verifies that expired cached payloads return HTTP 404
    and trigger cache deletion to clean up stale states.
    """
    headers = await setup_test_tenant(async_client, "Expired Cache Org", "exp_cache@test.com")
    
    res = await async_client.post(
        "/api/v1/links/",
        json={"original_url": "https://will-expire.com"},
        headers=headers
    )
    data = res.json()
    short_code = data["short_code"]
    
    # Pre-populate custom cache payload with an expired timestamp (10 mins ago)
    expired_time = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    payload = {
        "id": data["id"],
        "original_url": "https://will-expire.com",
        "expires_at": expired_time,
        "is_active": True
    }
    
    key = get_cache_key(short_code)
    await redis_manager.client.set(key, json.dumps(payload))
    
    # Trigger redirection resolver
    red_res = await async_client.get(f"/{short_code}")
    assert red_res.status_code == status.HTTP_404_NOT_FOUND
    
    # Assert cache key was evicted
    assert await redis_manager.client.get(key) is None
