import sys
import time
from contextlib import contextmanager
from prometheus_client import Counter, Histogram, Gauge
from app.core.logging import logger

# 1. HTTP Traffic Metrics
linkforge_http_requests_total = Counter(
    "linkforge_http_requests_total",
    "Total number of HTTP requests processed by the application",
    labelnames=["method", "endpoint", "status"]
)

linkforge_http_request_duration_seconds = Histogram(
    "linkforge_http_request_duration_seconds",
    "HTTP request execution latency in seconds",
    labelnames=["method", "endpoint"]
)

# 2. Redis Cache Performance Metrics
linkforge_cache_hits_total = Counter(
    "linkforge_cache_hits_total",
    "Total number of read-through cache hits in Redis"
)

linkforge_cache_misses_total = Counter(
    "linkforge_cache_misses_total",
    "Total number of read-through cache misses triggering database lookup"
)

linkforge_cache_invalidations_total = Counter(
    "linkforge_cache_invalidations_total",
    "Total number of cache evictions executed upon mutations or deletions"
)

# 3. Redirect Success Metrics
linkforge_redirects_total = Counter(
    "linkforge_redirects_total",
    "Total count of resolved shortened link redirections",
    labelnames=["cache"]  # values: "hit" or "miss"
)

# 4. Token Bucket Rate Limiting Metrics
linkforge_rate_limit_allowed_total = Counter(
    "linkforge_rate_limit_allowed_total",
    "Total number of requests allowed by the rate limiter checks",
    labelnames=["scope"]  # values: "auth_ip", "link_user", "link_ip"
)

linkforge_rate_limit_blocked_total = Counter(
    "linkforge_rate_limit_blocked_total",
    "Total number of requests blocked with HTTP 429 by rate limiter checks",
    labelnames=["scope"]  # values: "auth_ip", "link_user", "link_ip"
)

# 5. Celery Asynchronous Telemetry Queue Metrics
linkforge_click_events_published_total = Counter(
    "linkforge_click_events_published_total",
    "Total telemetry click events successfully published to Celery broker"
)

linkforge_click_events_processed_total = Counter(
    "linkforge_click_events_processed_total",
    "Total telemetry click events successfully processed and saved by Celery worker"
)

linkforge_click_events_failed_total = Counter(
    "linkforge_click_events_failed_total",
    "Total telemetry click events that failed execution and exhausted retries"
)

# 6. Service-Level Database Latency Metrics
linkforge_db_query_duration_seconds = Histogram(
    "linkforge_db_query_duration_seconds",
    "Duration of service-level PostgreSQL database query operations in seconds",
    labelnames=["operation"]  # values: "redirect_lookup", "create_link", "update_link", "pagination_queries", "telemetry_insert"
)

# 7. Deployment Info / Build Metadata
linkforge_build_info = Gauge(
    "linkforge_build_info",
    "Exposes application build, environment, and runtime versions as static metadata info",
    labelnames=["version", "environment", "python_version"]
)


# ==========================================
# SAFE METRICS MUTATION HELPERS (FAIL-OPEN)
# ==========================================

def safe_inc(counter: Counter, labels: dict = None, amount: float = 1.0) -> None:
    """
    Safely increments a counter. Prevents any metrics observation failures
    from interrupting standard application request handling.
    """
    try:
        if labels:
            counter.labels(**labels).inc(amount)
        else:
            counter.inc(amount)
    except Exception as e:
        logger.warning(
            "Failed to increment Prometheus counter",
            error=str(e),
            metric=counter._name
        )

def safe_observe(histogram: Histogram, value: float, labels: dict = None) -> None:
    """
    Safely records a latency value on a histogram.
    """
    try:
        if labels:
            histogram.labels(**labels).observe(value)
        else:
            histogram.observe(value)
    except Exception as e:
        logger.warning(
            "Failed to record Prometheus histogram observation",
            error=str(e),
            metric=histogram._name
        )


@contextmanager
def db_latency_tracker(operation: str):
    """
    Helper context manager to easily measure database query execution duration.
    """
    start_time = time.perf_counter()
    try:
        yield
    finally:
        duration = time.perf_counter() - start_time
        safe_observe(linkforge_db_query_duration_seconds, duration, {"operation": operation})
