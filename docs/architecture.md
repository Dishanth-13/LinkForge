# LinkForge Architecture Specification

This document details the software and systems architecture for LinkForge, an enterprise-grade multi-tenant link management platform.

---

## 1. System Topology

LinkForge is structured as a **modular monolith** to minimize deployment complexity and network hop overhead, while ensuring clean feature separation.

```
+-------------------------------------------------------------+
|                        Nginx (Proxy)                        |
+-------------------------------------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                      FastAPI Web App                        |
|                                                             |
|  +--------------------+  +--------------------+  +-------+  |
|  | /health, /ready    |  | /api/v1/links      |  | Auth  |  |
|  +--------------------+  +--------------------+  +-------+  |
+-------------------------------------------------------------+
          |                         |                  |
          v (Cache / Lock)          v (Query / Log)    | (Queue Event)
+------------------+       +------------------+        v
|   Redis Cache    |       |   PostgreSQL DB  |  +------------+
| (Redirection)    |       |  (Truth / Audit) |  | Redis Queue|
+------------------+       +------------------+  +------------+
                                                        |
                                                        v
                                                  +------------+
                                                  | Celery Wkr |
                                                  +------------+
```

---

## 2. Vertical Slice Boundaries

The codebase is partitioned into distinct vertical features within `app/features/`:
1.  **Auth**: User onboarding, JWT issuing, token validation.
2.  **Users**: Profile management, RBAC configuration.
3.  **Links**: Base62 short-code mappings, custom aliases, redirect routing, caching, and eviction triggers.
4.  **Audit**: Security-sensitive operations database recording.

Each feature slice contains its own router, schemas, models, and services, minimizing cross-domain dependencies. Common infrastructural components live in `app/core/`.

---

## 3. End-to-End Tracing & Request flow

To support observability, every request is assigned an `X-Request-ID`.
1.  **Ingress**: The request hits Nginx.
2.  **Middleware**: FastAPI's `RequestIdMiddleware` processes the request:
    *   Reads `X-Request-ID` or generates a UUID4 trace ID.
    *   Registers the trace ID in Python `contextvars`.
3.  **Log Integration**: Every log generated during the request lifecycle (including database queries) automatically captures this trace ID.
4.  **Egress**: The `X-Request-ID` is returned in response headers, allowing developers and client consumers to track request footprints.

---

## 4. Redis Read-Through Caching Architecture

To achieve low-latency redirects (sub-100ms from cache) and protect PostgreSQL from heavy read scaling, a caching layer is implemented for the redirect pipeline.

### 4.1 Cache Key Design
*   **Version Prefix**: Every key is prefixed with a schema version (e.g. `v1:`) to allow schema migrations without manual flushes.
*   **Dual-Key Entry**: When a link is cached, it is stored under both:
    *   `v1:link:code:{short_code}`
    *   `v1:link:code:{custom_alias}` (if custom alias exists)
*   **Payload Shape**: Serialized JSON mapping containing only redirection-critical properties:
    ```json
    {
      "id": "database_bigint_id",
      "original_url": "destination_url",
      "expires_at": "ISO_timestamp_or_null",
      "is_active": true
    }
    ```

### 4.2 Caching Flow (Redirection Resolution)
1.  **Cache Probe**: On `GET /{short_code}`, check Redis.
2.  **Cache Hit**:
    *   Deserialize the cached payload.
    *   Validate expiration and active status entirely from the cached properties (zero DB reads).
    *   If valid, execute an atomic PostgreSQL query to increment click count: `UPDATE links SET click_count = click_count + 1 WHERE id = :id`.
    *   Return `HTTP 302 Found` redirect.
3.  **Cache Miss / Fallback**:
    *   Query PostgreSQL for the link details.
    *   If valid, cache the result in Redis with a configurable TTL (e.g. `CACHE_TTL_SECONDS = 3600`).
    *   Increment click count and commit Postgres transaction.
    *   Return `HTTP 302 Found` redirect.

### 4.3 Cache Invalidation (Consistency Policy)
The application guarantees cache consistency through **active invalidation**:
*   Whenever a link is updated (`PATCH /api/v1/links/{id}`) or soft-deleted (`DELETE /api/v1/links/{id}`), the cache invalidation triggers delete commands for the related Redis keys.
*   **Transaction-safe Eviction**: The deletion is executed *after* the PostgreSQL transaction commits successfully (`db.commit()`), preventing race conditions where rolled-back states pollute the cache.

### 4.4 Fault Tolerance & Resiliency
If the Redis connection fails or times out:
*   The application catches the connection exception.
*   Logs a structured `warning` through `structlog` to alert operations.
*   Bypasses the caching layer, falling back directly to PostgreSQL to resolve the redirect.
*   This ensures that link redirects remain fully functional even under cache outages.

---

## 5. Distributed Rate Limiting Subsystem

To protect resource-intensive endpoints and avoid credential/URL creation spam, LinkForge integrates a distributed rate limiter operating at the HTTP middleware layer.

### 5.1 Token Bucket Lua Implementation
The rate limiter implements the **Token Bucket** algorithm inside a Redis Lua script.
*   **Lazy Refill & Consume**: Refills are calculated on-the-fly when requests arrive to avoid background polling.
*   **Time-Drift Mitigation**: The script calls the Redis server-side `TIME` command (`redis.call('TIME')`) instead of receiving application-instance timestamps, neutralizing clock drift across distributed nodes.
*   **HSET Updates**: Current state values (tokens and last updated timestamps) are updated atomically via `HSET` inside Redis.

### 5.2 Key Namespaces
Rate limits are strictly isolated using scoped prefixes to prevent different endpoints from sharing token states:
*   **Authentication Endpoints** (`/auth/login`, `/auth/register`):
    *   *Limit*: 5 requests per minute.
    *   *Key Format*: `v1:ratelimit:auth:ip:{client_ip}` (tracked by client IP).
*   **Link Creation Endpoint** (`POST /api/v1/links`):
    *   *Limit*: 60 requests per minute.
    *   *Keys Evaluated*: Checks both:
        *   IP-scoped: `v1:ratelimit:links:ip:{client_ip}`
        *   User-scoped: `v1:ratelimit:links:user:{user_id}` (if authenticated).

### 5.3 Response Header Bindings
Standard rate limit metadata is injected onto all HTTP responses matching rate-limited paths:
*   `X-RateLimit-Limit`: Maximum bucket capacity (e.g. `5` or `60`).
*   `X-RateLimit-Remaining`: Rounded-down integer count of available tokens.
*   `Retry-After`: Exists only on `HTTP 429 Too Many Requests` responses, containing the ceil integer seconds until a token refills.

### 5.4 Resiliency & Fail-Open
If Redis is down or connections time out, the middleware intercepts the exception, prints a structured `warning` log via `structlog`, and **fails open**, allowing the request to proceed. Endpoint availability is prioritized over enforcement.

---

## 6. Asynchronous Click Telemetry Pipeline

LinkForge uses an asynchronous event-driven pipeline to parse and persist rich click telemetry without adding latency to the client redirect path.

### 6.1 TelemetryPublisher Service Abstraction
*   The global redirection endpoint (`GET /{short_code}`) calls the `TelemetryPublisher.publish_click_event(...)` service abstraction. It extracts the raw User-Agent string, Referer, and client IP address.
*   **Fail-Open Publishing**: The publisher wraps task queuing in `try...except` and catches broker connection errors, logging structured warnings and falling open. This ensures link redirects remain highly available even if Redis or Celery workers are down.

### 6.2 Redis & Celery Queues
*   The publisher invokes Celery's `.apply_async()` method to queue a JSON event payload into the Redis broker.
*   **Delivery Guarantees**: Celery is configured with `acks_late=True` and `task_reject_on_worker_lost=True`. Workers acknowledge task completion *after* the PostgreSQL transaction successfully commits. If a worker process is terminated mid-task, the event is automatically re-queued.

### 6.3 Event Payload Schema (Version 1)
```json
{
  "event_id": "uuid4_string",
  "event_version": 1,
  "link_id": 12345,
  "organization_id": "org_uuid_string",
  "timestamp": "ISO_8601_timestamp",
  "ip_address": "185.120.44.5",
  "user_agent": "Mozilla/5.0 ...",
  "referer": "https://google.com"
}
```

### 6.4 Worker Telemetry Extraction
The Celery worker consumes task payloads and processes them:
1.  **Metadata Parsing**: Uses `user-agents` to parse browser, operating system, and device type category details.
2.  **Privacy Hashing**: Computes a SHA-256 hash of the raw client IP address. Raw IP addresses are never persisted in PostgreSQL storage.
3.  **Exactly-Once Idempotency**: Executes the write inside a SQL nested transaction (`db.begin_nested()`). If a duplicate `event_id` is re-delivered, PostgreSQL's primary key constraint raises an IntegrityError. The worker catches this exception and returns successfully (no-op), neutralizing duplicate deliveries without corrupting database state.
4.  **Exponential Backoff Retries**: If transient database connection errors (`OperationalError`) occur, the worker catches the error and retries execution using exponential backoff:
    $$\text{countdown} = 2^{\text{retries}} \times 5\text{ seconds}$$

