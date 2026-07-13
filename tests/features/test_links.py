import pytest
from datetime import datetime, timedelta, timezone
from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.features.links.service import encode_base62, decode_base62
from app.features.links.models import Link
from app.features.audit.models import AuditEvent

# Registration helper
async def setup_test_tenant(async_client, org_name: str, email: str) -> dict:
    await async_client.post("/api/v1/auth/register", json={
        "org_name": org_name,
        "email": email,
        "password": "secure_password_123"
    })
    login_res = await async_client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "secure_password_123"
    })
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
async def test_base62_encoding_decoding():
    """
    Tests deterministic Base62 encoding and decoding math properties.
    """
    # Small numbers
    assert encode_base62(0) == "0"
    assert encode_base62(9) == "9"
    assert encode_base62(10) == "a"
    assert encode_base62(35) == "z"
    assert encode_base62(36) == "A"
    assert encode_base62(61) == "Z"
    
    # Large numbers
    large_num = 9223372036854775807
    encoded = encode_base62(large_num)
    assert decode_base62(encoded) == large_num
    
    # Round-trip checks
    for val in (123, 4567, 987654321, 555555):
        assert decode_base62(encode_base62(val)) == val
        
    with pytest.raises(ValueError):
        encode_base62(-1)
        
    with pytest.raises(ValueError):
        decode_base62("invalid@char")

@pytest.mark.asyncio
async def test_link_url_validation(async_client):
    """
    Tests URL schema filters and SSRF/local network mitigations.
    """
    headers = await setup_test_tenant(async_client, "URL Org", "url@test.com")
    
    # Valid URLs
    valid_urls = [
        "https://github.com/Dishanth-13",
        "http://example.com/some/path?q=query&term=test",
        "https://fastapi.tiangolo.com/"
    ]
    for url in valid_urls:
        res = await async_client.post("/api/v1/links/", json={"original_url": url}, headers=headers)
        assert res.status_code == status.HTTP_201_CREATED
        
    # Invalid URLs (malformed or bad protocol)
    invalid_urls = [
        "ftp://files.example.com",
        "javascript:alert(1)",
        "file:///etc/passwd",
        "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
        "just_a_string"
    ]
    for url in invalid_urls:
        res = await async_client.post("/api/v1/links/", json={"original_url": url}, headers=headers)
        assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
    # SSRF / Local network loopback attempts
    ssrf_urls = [
        "http://localhost/admin",
        "http://127.0.0.1:8000/docs",
        "http://192.168.1.1/router",
        "http://169.254.169.254/latest/meta-data/"
    ]
    for url in ssrf_urls:
        res = await async_client.post("/api/v1/links/", json={"original_url": url}, headers=headers)
        assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

@pytest.mark.asyncio
async def test_link_crud_lifecycle(async_client):
    """
    Verifies creation, retrieval, listing, updates, and soft deletes.
    """
    headers = await setup_test_tenant(async_client, "CRUD Org", "crud@test.com")
    
    # 1. Create Link
    create_res = await async_client.post(
        "/api/v1/links/", 
        json={
            "original_url": "https://google.com",
            "title": "Search Engine",
            "description": "Default landing page for Google search"
        },
        headers=headers
    )
    assert create_res.status_code == status.HTTP_201_CREATED
    data = create_res.json()
    assert data["original_url"] == "https://google.com"
    assert data["title"] == "Search Engine"
    assert data["click_count"] == 0
    assert data["is_active"] is True
    
    link_id = int(data["id"])
    
    # 2. Get Link metadata
    get_res = await async_client.get(f"/api/v1/links/{link_id}", headers=headers)
    assert get_res.status_code == status.HTTP_200_OK
    assert get_res.json()["title"] == "Search Engine"
    
    # 3. Update Link metadata
    patch_res = await async_client.patch(
        f"/api/v1/links/{link_id}",
        json={"title": "Google Search", "description": "Updated desc"},
        headers=headers
    )
    assert patch_res.status_code == status.HTTP_200_OK
    assert patch_res.json()["title"] == "Google Search"
    assert patch_res.json()["description"] == "Updated desc"
    
    # 4. Soft Delete Link
    del_res = await async_client.delete(f"/api/v1/links/{link_id}", headers=headers)
    assert del_res.status_code == status.HTTP_200_OK
    
    # Verify that the link is no longer accessible via normal retrieve path
    get_deleted_res = await async_client.get(f"/api/v1/links/{link_id}", headers=headers)
    assert get_deleted_res.status_code == status.HTTP_404_NOT_FOUND

@pytest.mark.asyncio
async def test_tenant_scoped_custom_alias_uniqueness(async_client):
    """
    Asserts custom aliases are unique within a tenant but allowed across tenants.
    """
    headers_a = await setup_test_tenant(async_client, "Org A", "org-a@test.com")
    headers_b = await setup_test_tenant(async_client, "Org B", "org-b@test.com")
    
    # Tenant A creates alias 'my-alias' (must succeed)
    res1 = await async_client.post(
        "/api/v1/links/",
        json={"original_url": "https://apple.com", "custom_alias": "my-alias"},
        headers=headers_a
    )
    assert res1.status_code == status.HTTP_201_CREATED
    
    # Tenant A attempts to create duplicate alias 'my-alias' (must fail with 409 Conflict)
    res2 = await async_client.post(
        "/api/v1/links/",
        json={"original_url": "https://microsoft.com", "custom_alias": "my-alias"},
        headers=headers_a
    )
    assert res2.status_code == status.HTTP_409_CONFLICT
    
    # Tenant B creates same alias 'my-alias' (must succeed - verifies tenant scoping!)
    res3 = await async_client.post(
        "/api/v1/links/",
        json={"original_url": "https://linux.org", "custom_alias": "my-alias"},
        headers=headers_b
    )
    assert res3.status_code == status.HTTP_201_CREATED

@pytest.mark.asyncio
async def test_custom_alias_validators(async_client):
    """
    Tests validation rules (alphanumeric restrictions, reserved path checks, size limits).
    """
    headers = await setup_test_tenant(async_client, "Alias Rules Org", "alias@test.com")
    
    # Space character (invalid)
    res = await async_client.post(
        "/api/v1/links/",
        json={"original_url": "https://google.com", "custom_alias": "my alias"},
        headers=headers
    )
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    # Reserved keyword path (invalid)
    res = await async_client.post(
        "/api/v1/links/",
        json={"original_url": "https://google.com", "custom_alias": "health"},
        headers=headers
    )
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    # Exceed max length limits (invalid)
    res = await async_client.post(
        "/api/v1/links/",
        json={"original_url": "https://google.com", "custom_alias": "a" * 51},
        headers=headers
    )
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

@pytest.mark.asyncio
async def test_link_expirations(async_client, db_session: AsyncSession):
    """
    Tests past expiration block during input and GET 404 response on expired links.
    """
    headers = await setup_test_tenant(async_client, "Expiry Org", "expiry@test.com")
    
    # 1. Past expiration block (invalid)
    past_time = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    res = await async_client.post(
        "/api/v1/links/",
        json={"original_url": "https://google.com", "expires_at": past_time},
        headers=headers
    )
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    # 2. Future expiration setting (valid)
    future_time = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    res2 = await async_client.post(
        "/api/v1/links/",
        json={"original_url": "https://google.com", "expires_at": future_time},
        headers=headers
    )
    assert res2.status_code == status.HTTP_201_CREATED
    short_code = res2.json()["short_code"]
    link_id = int(res2.json()["id"])
    
    # Verify link resolves successfully
    redirect_res = await async_client.get(f"/{short_code}")
    assert redirect_res.status_code == status.HTTP_302_FOUND
    
    # 3. Simulate expired state by modifying database timestamp to the past
    query = select(Link).where(Link.id == link_id)
    result = await db_session.execute(query)
    link_record = result.scalar_one_or_none()
    link_record.expires_at = datetime.now(timezone.utc) - timedelta(minutes=10)
    await db_session.commit()
    
    # Evict cache key manually since we updated database state directly
    from app.features.links.service import delete_link_cache
    await delete_link_cache(short_code)
    
    # Verify redirect resolved path now returns 404
    redirect_res_expired = await async_client.get(f"/{short_code}")
    assert redirect_res_expired.status_code == status.HTTP_404_NOT_FOUND

@pytest.mark.asyncio
async def test_redirection_and_atomic_clicks(async_client, db_session: AsyncSession):
    """
    Tests HTTP 302 Found redirect responses and atomic click increments.
    """
    headers = await setup_test_tenant(async_client, "Redirect Org", "redirect@test.com")
    
    res = await async_client.post(
        "/api/v1/links/",
        json={"original_url": "https://wikipedia.org"},
        headers=headers
    )
    short_code = res.json()["short_code"]
    link_id = int(res.json()["id"])
    
    # Perform redirect 1
    red_res1 = await async_client.get(f"/{short_code}")
    assert red_res1.status_code == status.HTTP_302_FOUND
    assert red_res1.headers["Location"] == "https://wikipedia.org"
    
    # Perform redirect 2
    red_res2 = await async_client.get(f"/{short_code}")
    assert red_res2.status_code == status.HTTP_302_FOUND
    
    # Verify click count has incremented to 2 in database
    db_session.expire_all()  # Force reload from DB
    query = select(Link).where(Link.id == link_id)
    result = await db_session.execute(query)
    link = result.scalar_one_or_none()
    assert link.click_count == 2

@pytest.mark.asyncio
async def test_search_and_pagination(async_client):
    """
    Verifies searching by title, URL pattern matching, and cursor pagination mechanics.
    """
    headers = await setup_test_tenant(async_client, "Pagination Org", "pages@test.com")
    
    # Insert test dataset
    urls = [
        ("https://github.com", "Git Hub Profile", "git"),
        ("https://gitlab.com", "Git Lab Profile", "git"),
        ("https://google.com", "Google Homepage", "search"),
        ("https://bing.com", "Bing Homepage", "search"),
        ("https://fastapi.com", "FastAPI Specs", "framework")
    ]
    for url, title, desc in urls:
        await async_client.post(
            "/api/v1/links/",
            json={"original_url": url, "title": title, "description": desc},
            headers=headers
        )
        
    # Test title search
    search_res = await async_client.get("/api/v1/links/?title=Homepage", headers=headers)
    assert search_res.status_code == status.HTTP_200_OK
    assert len(search_res.json()["links"]) == 2  # Google, Bing
    
    # Test URL search
    search_url_res = await async_client.get("/api/v1/links/?original_url=git", headers=headers)
    assert len(search_url_res.json()["links"]) == 2  # github, gitlab
    
    # Test Pagination Limits
    page1 = await async_client.get("/api/v1/links/?limit=2", headers=headers)
    assert len(page1.json()["links"]) == 2
    next_cursor = page1.json()["next_cursor"]
    assert next_cursor is not None
    
    # Test Page 2 fetch using cursor
    page2 = await async_client.get(f"/api/v1/links/?limit=2&cursor={next_cursor}", headers=headers)
    assert len(page2.json()["links"]) == 2
