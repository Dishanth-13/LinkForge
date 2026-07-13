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
+------------------+       +------------------+  | Redis Queue|
                                                 +------------+
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
3.  **API Keys**: API key provisioning, rotation, permission mapping.
4.  **Links**: Base62 short-code mappings, expiring links, redirect routing.
5.  **Analytics**: Geographical and client metadata parsing.
6.  **Audit**: Security-sensitive operations database recording.

Each feature slice contains its own router, schemas, models, and services, minimizing cross-domain dependencies. Common infrastructural components live in `app/core/`.

---

## 3. End-to-End Tracing & Request flow

To support observability, every request is assigned an `X-Request-ID`.
1.  **Ingress**: The request hits Nginx (which can inject a request ID or pass it through).
2.  **Middleware**: FastAPI's `RequestIdMiddleware` processes the request:
    *   Reads `X-Request-ID` or generates a UUID4 trace ID.
    *   Registers the trace ID in Python `contextvars`.
3.  **Log Integration**: Every log generated during the request lifecycle (including database queries) automatically captures this trace ID.
4.  **Egress**: The `X-Request-ID` is returned in response headers, allowing developers and client consumers to track request footprints.
