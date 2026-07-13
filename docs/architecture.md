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
