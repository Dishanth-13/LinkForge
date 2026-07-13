# Design Decisions: Milestone 1 (LinkForge Foundation)

This document details the architectural decisions, trade-offs, and design patterns established during Milestone 1 of the LinkForge project.

---

## 1. Project Directory Structure: Vertical Slice Architecture

### Decided Approach
We chose **Vertical Slice (Feature-Based) Architecture** (i.e. grouping database models, schemas, routers, and services into self-contained domain folders like `features/health/` and `features/audit/`) instead of traditional **Layered Architecture** (e.g. `app/models`, `app/routers`, `app/services`).

### Alternatives Considered
*   **Layered (Layer-by-Layer) Organization**: Organizing folders by technology category. Standard in simple Django or simple FastAPI boilerplate.

### Trade-offs
*   *Pros*:
    *   **High Cohesion**: All code associated with a single business capability lives in one directory. Modifying a feature doesn't require jumping across five different root directories.
    *   **Loose Coupling**: Harder to introduce accidental dependencies between domains because folder structures force architectural boundaries.
    *   **Easier Refactoring**: If we need to extract a feature into a separate microservice/module in the future, we can simply copy its vertical slice folder.
*   *Cons*:
    *   Slightly higher setup overhead and import complexity. Shared database models (like mappings) require distinct imports or shared base utilities in `core/`.

### Scalability & Maintainability
For large teams, vertical slices prevent merge conflicts because developers working on separate features are touch-editing separate directories rather than shared global files like `models.py` or `views.py`.

### Interview Talking Points
> *"I chose a Vertical Slice Architecture over traditional Layered Architecture to enforce high cohesion and low coupling. Under a vertical slice layout, each folder represents a standalone business domain. This makes it trivial to split features out into independent modules or services when scaling, while simplifying navigation and reducing code friction for development teams."*

---

## 2. Asynchronous Database Access (asyncpg & AsyncSession)

### Decided Approach
SQLAlchemy async engine using `asyncpg` as the driver and `AsyncSession` for connection session management.

### Alternatives Considered
*   **Synchronous Access (psycopg2)**: Blocking I/O connections.

### Trade-offs
*   *Pros*:
    *   **Concurrent Request Processing**: Since FastAPI is an asynchronous framework (using ASGI), blocking I/O calls block the event loop. By using `asyncpg`, other requests can be handled while waiting for the database to return data.
*   *Cons*:
    *   Increased code complexity (must use `await` on queries).
    *   Third-party libraries must support async interfaces.
    *   Debugging async event-loop blocking issues requires specialised tools (like `aiomonitor` or `greenlet` tracebacks).

### Failure Scenarios & Mitigations
*   **Pool Starvation**: If connection pools are exhausted, requests block. We mitigated this by setting a strict connection pool configuration (`pool_size=20`, `max_overflow=10`, `pool_pre_ping=True`) to recycle dead connections safely and allow temporary elastic overflows.

### Interview Talking Points
> *"We chose an asynchronous database driver (asyncpg) to ensure that database queries do not block FastAPI's event loop. Under heavy load, blocking calls cause thread starvation, degrading latency. An async connection pool ensures the application can handle high concurrent volume while waiting for I/O operations."*

---

## 3. End-to-End Tracing (Request IDs)

### Decided Approach
FastAPI middleware that generates/propagates `X-Request-ID` and binds it using Python `contextvars` to structlog context.

### Alternatives Considered
*   **Standard Logger extra dicts**: Manually adding `extra={"request_id": request_id}` to every single log statement. (Extremely error-prone and violates DRY).

### Trade-offs
*   *Pros*:
    *   Automatic propagation.
    *   Links web requests to asynchronous logs and worker tasks.
*   *Cons*:
    *   Small performance overhead in context dictionary merging for log rendering.

### Scalability Considerations
In a production deployment, these request IDs can be parsed by log aggregators (e.g. Datadog, Elasticsearch, ClickHouse) to query the entire execution trace of a single HTTP call, drastically lowering MTTR (Mean Time to Resolution).

---

## 4. Structured JSON Logging (structlog)

### Decided Approach
We configure `structlog` to render structured JSON in production (which log forwarders like FluentBit or Vector parse natively) and pretty colorized logs in development.

### Alternatives Considered
*   **Python Standard Library Logging**: Built-in, but outputs raw text and is complex to format with contextvars.

### Trade-offs
*   *Pros*:
    *   Consistent JSON log output without custom formatters.
    *   High performance context variables tracking.
*   *Cons*:
    *   Adds an external dependency (`structlog`).
    *   Requires configuring third-party libraries (like Uvicorn and SQLAlchemy) to redirect their logs to structlog to ensure unified output.
