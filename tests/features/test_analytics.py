import uuid
import pytest
from datetime import datetime, timedelta, timezone
from fastapi import status
from sqlalchemy import select
from app.features.users.models import User
from app.features.links.models import Link
from app.features.analytics.models import ClickEvent

async def create_test_tenant(async_client, org_name: str, email: str):
    """
    Registers a new tenant/user and logs them in to get an access token.
    """
    await async_client.post("/api/v1/auth/register", json={
        "org_name": org_name,
        "email": email,
        "password": "securepassword123"
    })
    login_res = await async_client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "securepassword123"
    })
    return login_res.json()["access_token"]

@pytest.mark.asyncio
async def test_analytics_requires_authentication(async_client):
    """
    Verify that unauthenticated requests to the analytics overview return 401.
    """
    res = await async_client.get("/api/v1/analytics/overview")
    assert res.status_code == status.HTTP_401_UNAUTHORIZED

@pytest.mark.asyncio
async def test_analytics_invalid_range(async_client):
    """
    Verify that requests with an invalid range parameter return 400.
    """
    token = await create_test_tenant(async_client, "Org Validation", "validate@test.com")
    headers = {"Authorization": f"Bearer {token}"}
    res = await async_client.get("/api/v1/analytics/overview?range=invalid", headers=headers)
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "Invalid range parameter" in res.json()["detail"]

@pytest.mark.asyncio
async def test_analytics_tenant_isolation_and_filters(async_client, db_session):
    """
    Perform a full integration check verifying tenant isolation, link filters,
    time range constraints, and aggregation correctness.
    """
    # 1. Register Org A and Org B
    token_a = await create_test_tenant(async_client, "Org A", "user_a@test.com")
    token_b = await create_test_tenant(async_client, "Org B", "user_b@test.com")

    # Resolve database records for the users
    stmt_a = select(User).where(User.email == "user_a@test.com")
    res_a = await db_session.execute(stmt_a)
    user_a = res_a.scalar_one()

    stmt_b = select(User).where(User.email == "user_b@test.com")
    res_b = await db_session.execute(stmt_b)
    user_b = res_b.scalar_one()

    # Create Link A (Org A) and Link B (Org B)
    link_a = Link(
        organization_id=user_a.organization_id,
        created_by=user_a.id,
        original_url="https://google.com",
        short_code="googA",
        is_active=True,
    )
    db_session.add(link_a)

    link_b = Link(
        organization_id=user_b.organization_id,
        created_by=user_b.id,
        original_url="https://github.com",
        short_code="gitB",
        is_active=True,
    )
    db_session.add(link_b)
    await db_session.commit()

    # Insert ClickEvents for Org A (Link A)
    # Event 1: Today, Chrome, Windows, Desktop, referer=google
    now = datetime.now(timezone.utc)
    click_a1 = ClickEvent(
        id=uuid.uuid4(),
        link_id=link_a.id,
        organization_id=user_a.organization_id,
        timestamp=now,
        ip_hash="hash1",
        user_agent="UA1",
        referer="https://google.com",
        country=None,
        device_type="desktop",
        browser="Chrome 124",
        os="Windows 11",
    )
    # Event 2: Today, Safari, macOS, Mobile, referer=None
    click_a2 = ClickEvent(
        id=uuid.uuid4(),
        link_id=link_a.id,
        organization_id=user_a.organization_id,
        timestamp=now - timedelta(hours=2),
        ip_hash="hash2",
        user_agent="UA2",
        referer=None,
        country=None,
        device_type="mobile",
        browser="Safari 17",
        os="macOS 14",
    )
    # Event 3: 5 days ago (still in 7d range, but not in 24h)
    click_a3 = ClickEvent(
        id=uuid.uuid4(),
        link_id=link_a.id,
        organization_id=user_a.organization_id,
        timestamp=now - timedelta(days=5),
        ip_hash="hash3",
        user_agent="UA3",
        referer="https://github.com",
        country=None,
        device_type="desktop",
        browser="Chrome 124",
        os="Windows 11",
    )
    # Event 4: 15 days ago (in 30d range, not in 7d range)
    click_a4 = ClickEvent(
        id=uuid.uuid4(),
        link_id=link_a.id,
        organization_id=user_a.organization_id,
        timestamp=now - timedelta(days=15),
        ip_hash="hash4",
        user_agent="UA4",
        referer="https://twitter.com",
        country=None,
        device_type="desktop",
        browser="Firefox 125",
        os="Linux",
    )
    db_session.add_all([click_a1, click_a2, click_a3, click_a4])

    # Insert ClickEvents for Org B (Link B)
    click_b1 = ClickEvent(
        id=uuid.uuid4(),
        link_id=link_b.id,
        organization_id=user_b.organization_id,
        timestamp=now,
        ip_hash="hash5",
        user_agent="UA5",
        referer="https://linkedin.com",
        country=None,
        device_type="desktop",
        browser="Chrome 124",
        os="Windows 11",
    )
    db_session.add(click_b1)
    await db_session.commit()

    # ─── Test 1: Tenant Isolation ───
    # Query Org A (Default: 7d range)
    headers_a = {"Authorization": f"Bearer {token_a}"}
    res = await async_client.get("/api/v1/analytics/overview", headers=headers_a)
    assert res.status_code == status.HTTP_200_OK
    data = res.json()

    # Default 7d range should return 3 events (click_a1, click_a2, click_a3). click_a4 is 15d ago, click_b1 is Org B.
    assert data["total_clicks"] == 3
    assert data["unique_visitors"] == 3
    assert data["top_browser"] == "Chrome 124"
    assert len(data["recent_clicks"]) == 3

    # Check device distribution aggregates
    devices = {item["name"]: item["count"] for item in data["device_distribution"]}
    assert devices.get("desktop") == 2
    assert devices.get("mobile") == 1

    # Check browser distribution aggregates
    browsers = {item["name"]: item["count"] for item in data["browser_distribution"]}
    assert browsers.get("Chrome 124") == 2
    assert browsers.get("Safari 17") == 1

    # Check referrer distribution aggregates (Direct/Email mapped for None)
    referrers = {item["name"]: item["count"] for item in data["referrer_distribution"]}
    assert referrers.get("https://google.com") == 1
    assert referrers.get("https://github.com") == 1
    assert referrers.get("Direct / Email") == 1

    # ─── Test 2: Time Range Filter ───
    # Query Org A with 24h range -> should return 2 events (click_a1, click_a2)
    res_24h = await async_client.get("/api/v1/analytics/overview?range=24h", headers=headers_a)
    assert res_24h.status_code == status.HTTP_200_OK
    data_24h = res_24h.json()
    assert data_24h["total_clicks"] == 2

    # Query Org A with 30d range -> should return all 4 events
    res_30d = await async_client.get("/api/v1/analytics/overview?range=30d", headers=headers_a)
    assert res_30d.status_code == status.HTTP_200_OK
    data_30d = res_30d.json()
    assert data_30d["total_clicks"] == 4

    # ─── Test 3: Link Filter ───
    # Create another link under Org A and add a click
    link_a2 = Link(
        organization_id=user_a.organization_id,
        created_by=user_a.id,
        original_url="https://yahoo.com",
        short_code="yahA",
        is_active=True,
    )
    db_session.add(link_a2)
    await db_session.commit()

    click_a2_1 = ClickEvent(
        id=uuid.uuid4(),
        link_id=link_a2.id,
        organization_id=user_a.organization_id,
        timestamp=now,
        ip_hash="hash6",
        user_agent="UA6",
        referer="https://yahoo.com",
        country=None,
        device_type="desktop",
        browser="Firefox 125",
        os="Linux",
    )
    db_session.add(click_a2_1)
    await db_session.commit()

    # Query without link filter (7d range) -> should return 4 clicks (3 from link_a + 1 from link_a2)
    res_all = await async_client.get("/api/v1/analytics/overview", headers=headers_a)
    assert res_all.json()["total_clicks"] == 4

    # Query with link filter = link_a2 -> should return 1 click
    res_filtered = await async_client.get(f"/api/v1/analytics/overview?link_id={link_a2.id}", headers=headers_a)
    assert res_filtered.status_code == status.HTTP_200_OK
    data_filtered = res_filtered.json()
    assert data_filtered["total_clicks"] == 1
    assert data_filtered["recent_clicks"][0]["short_code"] == "yahA"
