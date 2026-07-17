import pytest
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession
from app.features.audit.models import AuditEvent
from app.features.audit.services import log_audit_event

@pytest.mark.asyncio
async def test_audit_events_lifecycle_and_tenant_isolation(async_client, db_session: AsyncSession):
    # 1. Register Org A + Login
    await async_client.post("/api/v1/auth/register", json={
        "org_name": "Org A",
        "email": "user_a@acme.com",
        "password": "secure_password_123"
    })
    login_a = await async_client.post("/api/v1/auth/login", json={
        "email": "user_a@acme.com",
        "password": "secure_password_123"
    })
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 2. Register Org B + Login
    await async_client.post("/api/v1/auth/register", json={
        "org_name": "Org B",
        "email": "user_b@acme.com",
        "password": "secure_password_123"
    })
    login_b = await async_client.post("/api/v1/auth/login", json={
        "email": "user_b@acme.com",
        "password": "secure_password_123"
    })
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 3. Create a link in Org A to trigger link.created audit log
    create_link_res = await async_client.post("/api/v1/links/", json={
        "original_url": "https://github.com",
        "title": "GitHub Homepage",
        "custom_alias": "gh-a"
    }, headers=headers_a)
    assert create_link_res.status_code == status.HTTP_201_CREATED
    link_data = create_link_res.json()
    link_id = link_data["id"]

    # 4. Fetch events for Org A
    events_a_res = await async_client.get("/api/v1/events?limit=10", headers=headers_a)
    assert events_a_res.status_code == status.HTTP_200_OK
    data_a = events_a_res.json()
    assert data_a["total_count"] >= 3  # org.created, user.registered, link.created, and potentially user.login
    
    # Verify events contain required fields and actor email joined dynamically
    created_event = [e for e in data_a["events"] if e["event_type"] == "link.created"][0]
    assert created_event["resource_type"] == "link"
    assert created_event["resource_id"] == str(link_id)
    assert created_event["actor"]["email"] == "user_a@acme.com"
    assert "user_a@acme.com created link \"gh-a\"" in created_event["human_readable_message"]

    # 5. Fetch events for Org B and verify Tenant Isolation (Org B cannot see Org A's events)
    events_b_res = await async_client.get("/api/v1/events?limit=10", headers=headers_b)
    assert events_b_res.status_code == status.HTTP_200_OK
    data_b = events_b_res.json()
    
    # Org B should not see "link.created" for "gh-a"
    link_created_in_b = [e for e in data_b["events"] if e["event_type"] == "link.created"]
    assert len(link_created_in_b) == 0

@pytest.mark.asyncio
async def test_audit_events_pagination_and_ordering(async_client, db_session: AsyncSession):
    # 1. Register Org + Login
    await async_client.post("/api/v1/auth/register", json={
        "org_name": "Paging Org",
        "email": "pager@acme.com",
        "password": "secure_password_123"
    })
    login_res = await async_client.post("/api/v1/auth/login", json={
        "email": "pager@acme.com",
        "password": "secure_password_123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Generate 5 links to create multiple logs
    for i in range(5):
        await async_client.post("/api/v1/links/", json={
            "original_url": "https://google.com",
            "title": f"Google {i}",
            "custom_alias": f"google-{i}"
        }, headers=headers)

    # 2. Get with limit=2, offset=0
    page_1_res = await async_client.get("/api/v1/events?limit=2&offset=0", headers=headers)
    assert page_1_res.status_code == status.HTTP_200_OK
    p1 = page_1_res.json()
    assert len(p1["events"]) == 2
    
    # 3. Get with limit=2, offset=2
    page_2_res = await async_client.get("/api/v1/events?limit=2&offset=2", headers=headers)
    assert page_2_res.status_code == status.HTTP_200_OK
    p2 = page_2_res.json()
    assert len(p2["events"]) == 2

    # Verify pagination is distinct
    p1_ids = {e["id"] for e in p1["events"]}
    p2_ids = {e["id"] for e in p2["events"]}
    assert p1_ids.isdisjoint(p2_ids)

    # Verify Ordering (newest first, DESC timestamp)
    all_res = await async_client.get("/api/v1/events?limit=100", headers=headers)
    events = all_res.json()["events"]
    timestamps = [e["timestamp"] for e in events]
    assert timestamps == sorted(timestamps, reverse=True)

@pytest.mark.asyncio
async def test_audit_events_filters(async_client, db_session: AsyncSession):
    # 1. Register Org + Login
    await async_client.post("/api/v1/auth/register", json={
        "org_name": "Filtering Org",
        "email": "filter@acme.com",
        "password": "secure_password_123"
    })
    login_res = await async_client.post("/api/v1/auth/login", json={
        "email": "filter@acme.com",
        "password": "secure_password_123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create link event
    await async_client.post("/api/v1/links/", json={
        "original_url": "https://google.com",
        "title": "Google Link",
        "custom_alias": "filter-google"
    }, headers=headers)

    # Create API key event
    await async_client.post("/api/v1/api-keys", json={
        "name": "Prod Secret Key",
        "environment": "production",
        "permissions": ["READ_LINKS"]
    }, headers=headers)

    # 2. Filter by event_type = "link.created"
    res_type = await async_client.get("/api/v1/events?event_type=link.created", headers=headers)
    data_type = res_type.json()["events"]
    assert len(data_type) > 0
    for e in data_type:
        assert e["event_type"] == "link.created"

    # 3. Filter by resource_type = "api_key"
    res_res = await async_client.get("/api/v1/events?resource_type=api_key", headers=headers)
    data_res = res_res.json()["events"]
    assert len(data_res) > 0
    for e in data_res:
        assert e["resource_type"] == "api_key"

    # 4. Filter by date range (assert past range contains events, future range does not)
    now = datetime.now(timezone.utc)
    start_date_str = (now - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
    end_date_str = (now + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
    
    res_date = await async_client.get(f"/api/v1/events?start_date={start_date_str}&end_date={end_date_str}", headers=headers)
    assert res_date.status_code == status.HTTP_200_OK
    assert len(res_date.json()["events"]) > 0

    future_date_str = (now + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
    res_future = await async_client.get(f"/api/v1/events?start_date={future_date_str}", headers=headers)
    assert res_future.status_code == status.HTTP_200_OK
    assert len(res_future.json()["events"]) == 0
