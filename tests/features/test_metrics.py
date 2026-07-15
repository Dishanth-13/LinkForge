import pytest
from unittest.mock import patch, MagicMock
from fastapi import status
from app.core.metrics import (
    linkforge_http_requests_total,
    linkforge_http_request_duration_seconds,
    linkforge_cache_hits_total,
    linkforge_cache_misses_total,
    linkforge_cache_invalidations_total,
    linkforge_redirects_total,
    linkforge_rate_limit_allowed_total,
    linkforge_rate_limit_blocked_total,
    linkforge_click_events_published_total,
    linkforge_click_events_processed_total,
    linkforge_click_events_failed_total,
    linkforge_db_query_duration_seconds,
    linkforge_build_info,
    safe_inc,
    safe_observe
)
from tests.features.test_links import setup_test_tenant

@pytest.mark.asyncio
async def test_get_metrics_endpoint(async_client):
    """
    Verifies that GET /metrics returns HTTP 200 OK and text/plain content.
    """
    response = await async_client.get("/metrics")
    assert response.status_code == status.HTTP_200_OK
    assert "text/plain" in response.headers.get("content-type", "")
    
    # Assert presence of all required metric declarations
    body = response.text
    assert "linkforge_http_requests_total" in body
    assert "linkforge_http_request_duration_seconds" in body
    assert "linkforge_cache_hits_total" in body
    assert "linkforge_cache_misses_total" in body
    assert "linkforge_cache_invalidations_total" in body
    assert "linkforge_redirects_total" in body
    assert "linkforge_rate_limit_allowed_total" in body
    assert "linkforge_rate_limit_blocked_total" in body
    assert "linkforge_click_events_published_total" in body
    assert "linkforge_click_events_processed_total" in body
    assert "linkforge_db_query_duration_seconds" in body
    assert "linkforge_build_info" in body


@pytest.mark.asyncio
async def test_http_endpoint_normalization(async_client):
    """
    Verifies that requests to dynamic endpoints are normalized on labels to avoid cardinality explosion.
    """
    # 1. Access dynamic redirect path
    await async_client.get("/XYZ987")
    
    # 2. Access /metrics and assert path was normalized
    res = await async_client.get("/metrics")
    assert 'endpoint="/{short_code}"' in res.text
    assert 'endpoint="/XYZ987"' not in res.text


@pytest.mark.asyncio
async def test_build_info_metric(async_client):
    """
    Verifies static linkforge_build_info gauge publishes version and env details.
    """
    import platform
    from app.core.config import settings
    linkforge_build_info.labels(
        version="0.2.0",
        environment=settings.ENVIRONMENT,
        python_version=platform.python_version()
    ).set(1.0)
    
    res = await async_client.get("/metrics")
    assert 'linkforge_build_info{environment="testing",python_version=' in res.text


@pytest.mark.asyncio
async def test_redirect_and_cache_metrics_flow(async_client, db_session):
    """
    Creates a link, hits the redirect endpoint, and checks that cache and redirect counters increment.
    """
    headers = await setup_test_tenant(async_client, "Metrics Org", "metrics@test.com")
    
    # Create Link with correct trailing slash
    create_res = await async_client.post(
        "/api/v1/links/",
        json={"original_url": "https://google.com", "title": "Metrics Test"},
        headers=headers
    )
    assert create_res.status_code == status.HTTP_201_CREATED
    short_code = create_res.json()["short_code"]
    
    # Reset counters internally to get a clean differential check
    linkforge_cache_hits_total._value.set(0.0)
    linkforge_cache_misses_total._value.set(0.0)
    linkforge_redirects_total.labels(cache="hit")._value.set(0.0)
    linkforge_redirects_total.labels(cache="miss")._value.set(0.0)
    
    # First Redirect (Cache Miss)
    red1 = await async_client.get(f"/{short_code}")
    assert red1.status_code == status.HTTP_302_FOUND
    
    # Second Redirect (Cache Hit)
    red2 = await async_client.get(f"/{short_code}")
    assert red2.status_code == status.HTTP_302_FOUND
    
    # Check metrics values
    res = await async_client.get("/metrics")
    body = res.text
    
    # Assert misses and hits
    assert 'linkforge_cache_misses_total 1.0' in body
    assert 'linkforge_cache_hits_total 1.0' in body
    assert 'linkforge_redirects_total{cache="miss"} 1.0' in body
    assert 'linkforge_redirects_total{cache="hit"} 1.0' in body


@pytest.mark.asyncio
async def test_rate_limiting_metrics(async_client):
    """
    Simulates rate limiting blocks and verifies rate limit allowed/blocked counters update.
    """
    # Reset rate limit metrics values
    linkforge_rate_limit_allowed_total.labels(scope="auth_ip")._value.set(0.0)
    linkforge_rate_limit_blocked_total.labels(scope="auth_ip")._value.set(0.0)
    
    # Trigger 6 quick login attempts (auth_ip limit is 5)
    for _ in range(6):
        await async_client.post("/api/v1/auth/login", json={"email": "metrics@test.com", "password": "wrong"})
        
    res = await async_client.get("/metrics")
    body = res.text
    
    assert 'linkforge_rate_limit_allowed_total{scope="auth_ip"} 5.0' in body
    assert 'linkforge_rate_limit_blocked_total{scope="auth_ip"} 1.0' in body


@pytest.mark.asyncio
async def test_celery_task_processing_metrics(db_session):
    """
    Invokes the Celery analytics task directly to verify processing/failed metrics increment.
    """
    from app.features.analytics.tasks import async_process_click_telemetry
    from tests.features.test_telemetry import MockAsyncSessionContext
    
    # Reset task metrics
    linkforge_click_events_processed_total._value.set(0.0)
    linkforge_click_events_failed_total._value.set(0.0)
    
    event_data = {
        "event_id": "00000000-0000-0000-0000-000000000000",
        "event_version": 1,
        "link_id": 9999,
        "organization_id": "00000000-0000-0000-0000-000000000000",
        "timestamp": "2026-07-15T10:00:00Z",
        "ip_address": "127.0.0.1",
        "user_agent": "Mozilla/5.0",
        "referer": None
    }
    
    # Mock database logic to verify metrics processing paths
    with patch("app.features.analytics.tasks.SessionLocal", return_value=MockAsyncSessionContext(db_session)):
        # Invoke task async
        await async_process_click_telemetry(None, event_data)
        
        assert linkforge_click_events_processed_total._value.get() == 1.0
 
    # Mocking Hard Failure:
    from unittest.mock import AsyncMock
    linkforge_click_events_failed_total._value.set(0.0)
    with patch("app.features.analytics.tasks.SessionLocal") as mock_session_class:
        mock_db = AsyncMock()
        mock_db.__aenter__.side_effect = ValueError("Unhandled hard database crash")
        mock_session_class.return_value = mock_db
        
        # Expect task to raise error
        with pytest.raises(ValueError):
            await async_process_click_telemetry(None, event_data)
            
        assert linkforge_click_events_failed_total._value.get() == 1.0


@pytest.mark.asyncio
async def test_metrics_fail_safe_behavior():
    """
    Verifies that if a metric increment throws an exception, the request continues without breaking.
    """
    with patch("app.core.metrics.linkforge_cache_hits_total.inc", side_effect=ValueError("Prometheus registry lock failed")):
        # Call safe_inc directly and ensure it catches the exception and returns None
        assert safe_inc(linkforge_cache_hits_total) is None
