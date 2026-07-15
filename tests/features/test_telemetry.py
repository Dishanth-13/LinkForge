import uuid
import hashlib
import pytest
from unittest.mock import patch, MagicMock
from fastapi import status
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from app.features.analytics.models import ClickEvent
from app.features.analytics.publishers import TelemetryPublisher
from app.features.analytics.tasks import async_process_click_telemetry, process_click_telemetry
from tests.features.test_links import setup_test_tenant

# Mock context manager to share the transactional db_session inside tasks
class MockAsyncSessionContext:
    def __init__(self, session):
        self.session = session
    async def __aenter__(self):
        self.original_commit = self.session.commit
        self.session.commit = self.session.flush
        return self.session
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        self.session.commit = self.original_commit

@pytest.mark.asyncio
async def test_telemetry_publication_on_redirect(async_client, db_session):
    """
    Verifies that performing a link redirect publishes a click telemetry event to Celery.
    """
    headers = await setup_test_tenant(async_client, "Telemetry Org", "tele@test.com")

    # 1. Create a link
    res = await async_client.post(
        "/api/v1/links/",
        json={"original_url": "https://wikipedia.org"},
        headers=headers
    )
    link_data = res.json()
    short_code = link_data["short_code"]
    link_id = link_data["id"]

    # 2. Perform redirect and assert TelemetryPublisher is called with apply_async
    with patch("app.features.analytics.publishers.process_click_telemetry.apply_async") as mock_apply:
        red_res = await async_client.get(
            f"/{short_code}",
            headers={"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15", "Referer": "https://twitter.com"}
        )
        assert red_res.status_code == status.HTTP_302_FOUND
        mock_apply.assert_called_once()
        
        # Verify event payload structure
        payload = mock_apply.call_args[1]["args"][0]
        assert payload["event_version"] == 1
        assert payload["link_id"] == int(link_id)
        assert "event_id" in payload
        assert "timestamp" in payload
        assert "ip_address" in payload
        assert payload["user_agent"] == "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15"
        assert payload["referer"] == "https://twitter.com"

@pytest.mark.asyncio
async def test_worker_telemetry_consumption_and_parsing(async_client, db_session):
    """
    Verifies that the Celery task correctly parses User-Agent headers, OS, device,
    hashes the IP address using SHA-256, and stores ClickEvent to the database.
    """
    headers = await setup_test_tenant(async_client, "Worker Org", "worker@tele.com")

    res = await async_client.post(
        "/api/v1/links/",
        json={"original_url": "https://reddit.com"},
        headers=headers
    )
    link_data = res.json()
    link_id = int(link_data["id"])
    org_id = uuid.UUID(link_data["organization_id"])

    # Build a simulated click payload
    event_id = uuid.uuid4()
    ip_address = "185.120.44.5"
    payload = {
        "event_id": str(event_id),
        "event_version": 1,
        "link_id": link_id,
        "organization_id": str(org_id),
        "timestamp": "2026-07-15T10:00:00Z",
        "ip_address": ip_address,
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36",
        "referer": "https://google.com"
    }

    # Execute task with transactional session patched in
    with patch("app.features.analytics.tasks.SessionLocal", return_value=MockAsyncSessionContext(db_session)):
        await async_process_click_telemetry(None, payload)

    # Assert ClickEvent records are inserted and parsed correctly
    result = await db_session.execute(select(ClickEvent).where(ClickEvent.id == event_id))
    click_event = result.scalar_one_or_none()

    assert click_event is not None
    assert click_event.link_id == link_id
    assert click_event.organization_id == org_id
    assert click_event.ip_hash == hashlib.sha256(ip_address.encode("utf-8")).hexdigest()
    assert click_event.device_type == "desktop"
    assert "Chrome" in click_event.browser
    assert "Windows" in click_event.os
    assert click_event.referer == "https://google.com"
    assert click_event.country is None

@pytest.mark.asyncio
async def test_worker_idempotency_duplicate_protection(async_client, db_session):
    """
    Verifies that running the task twice with the same event_id behaves idempotently
    and does not duplicate database records or raise IntegrityErrors.
    """
    headers = await setup_test_tenant(async_client, "Idempotent Org", "idemp@tele.com")

    res = await async_client.post(
        "/api/v1/links/",
        json={"original_url": "https://github.com"},
        headers=headers
    )
    link_data = res.json()
    link_id = int(link_data["id"])
    org_id = uuid.UUID(link_data["organization_id"])

    event_id = uuid.uuid4()
    payload = {
        "event_id": str(event_id),
        "event_version": 1,
        "link_id": link_id,
        "organization_id": str(org_id),
        "timestamp": "2026-07-15T11:00:00Z",
        "ip_address": "127.0.0.1",
        "user_agent": "Mozilla/5.0",
        "referer": None
    }

    # Run the same event twice
    with patch("app.features.analytics.tasks.SessionLocal", return_value=MockAsyncSessionContext(db_session)):
        await async_process_click_telemetry(None, payload)
        await async_process_click_telemetry(None, payload)  # Second execution

    # Verify only one ClickEvent exists
    result = await db_session.execute(select(ClickEvent).where(ClickEvent.id == event_id))
    events = result.scalars().all()
    assert len(events) == 1

@pytest.mark.asyncio
async def test_telemetry_publisher_fail_open(async_client, db_session):
    """
    Verifies that if the Redis Broker is down during event publishing,
    the publisher fails open, logging a warning but redirecting successfully.
    """
    headers = await setup_test_tenant(async_client, "Resilience Org", "resil@tele.com")

    res = await async_client.post(
        "/api/v1/links/",
        json={"original_url": "https://aws.amazon.com"},
        headers=headers
    )
    short_code = res.json()["short_code"]

    # Mock apply_async to raise connection refusal error
    with patch("app.features.analytics.publishers.process_click_telemetry.apply_async", side_effect=Exception("Redis connection lost")):
        red_res = await async_client.get(f"/{short_code}")
        assert red_res.status_code == status.HTTP_302_FOUND
        assert red_res.headers["Location"] == "https://aws.amazon.com"

@pytest.mark.asyncio
async def test_worker_retry_mechanics(db_session):
    """
    Verifies that the Celery task triggers self.retry on operational exceptions (e.g. Postgres down).
    """
    payload = {
        "event_id": str(uuid.uuid4()),
        "event_version": 1,
        "link_id": 9999,
        "organization_id": str(uuid.uuid4()),
        "timestamp": "2026-07-15T12:00:00Z",
        "ip_address": "127.0.0.1",
        "user_agent": "Mozilla/5.0",
        "referer": None
    }

    mock_self = MagicMock()
    mock_self.retry = MagicMock()
    mock_self.request.retries = 2

    # Mock SessionLocal to throw OperationalError
    with patch("app.features.analytics.tasks.SessionLocal", side_effect=OperationalError("mock_statement", "mock_params", Exception("DB connection timeout"))):
        # We expect it to raise self.retry which is mocked
        try:
            await async_process_click_telemetry(mock_self, payload)
        except Exception:
            pass
            
        mock_self.retry.assert_called_once()
        args, kwargs = mock_self.retry.call_args
        assert kwargs["countdown"] == 20  # 2^2 * 5 = 20 seconds backoff
