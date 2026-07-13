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

---

# Design Decisions: Milestone 2 (Identity Service)

This section details the architectural choices, tradeoffs, and design patterns established during Milestone 2 of the LinkForge project.

---

## 5. Symmetric (HS256) vs. Asymmetric (RS256) JWT Signing

### Decided Approach
We chose **Symmetric HS256** (HMAC-SHA256) signing for JWT tokens.

### Alternatives Considered
*   **Asymmetric RS256 (RSA Signature)**: Using a private key to sign tokens and a public key to verify them.

### Trade-offs & Rationale
*   **Why HS256 is appropriate for LinkForge (Modular Monolith)**:
    *   In a modular monolith, the component generating the tokens (the Auth slice) and the components validating the tokens (Links/Analytics slices) share the same application memory space and config files. A shared symmetric secret key (`JWT_SECRET_KEY`) can be safely kept in the environment variables and accessed by all slices.
    *   HS256 has lower computational overhead than RS256 for both token generation and signature verification.
*   **When RS256 becomes preferable**:
    *   If LinkForge scales out and we split the Auth slice into an independent Identity Provider (IdP) service, or if external microservices need to validate tokens independently, RS256 becomes preferable.
    *   With RS256, only the IdP needs access to the private key (to sign tokens). All other microservices can retrieve the public key (e.g., via a JWKS endpoint) to verify signatures, preventing key exposure. If a resource microservice is compromised, the private signing key remains secure.

### Interview Talking Points
> *"For a modular monolith like LinkForge, symmetric HS256 signing is highly appropriate because the authentication issuer and the resource consumers reside in the same codebase and share configuration states. This minimizes cryptographic verification overhead and secret rotation complexity. If we decouple the Identity Provider into a standalone service or allow third-party integrations, we would transition to asymmetric RS256 signing so that consumer services verify tokens using a public key without exposing the private signing secret."*

---

## 6. PostgreSQL-Only Storage for Refresh Tokens

### Decided Approach
We chose to persist and track refresh tokens exclusively in PostgreSQL tables using the `RefreshToken` model. We did not introduce a Redis caching layer for refresh sessions in this milestone.

### Alternatives Considered
*   **Redis Cache Tracking**: Storing refresh sessions in Redis with a TTL.
*   **Purely Stateless JWTs**: Storing refresh state on the client side only (highly insecure, makes revocation impossible).

### Trade-offs & Rationale
*   *Pros*:
    *   **Transactional Integrity**: Token generation, rotation, and revocation can be handled in single ACID database transactions alongside user creations or audit events, ensuring 100% consistent state.
    *   **Auditing and Simplicity**: Refresh token rotation happens infrequently (typically every 15 minutes to once a day per user). The extra database query has no impact on system hot paths like redirects. Storing it in PostgreSQL provides an audit trail of session logins, rotation histories, and suspicious reuse behaviors.
*   *Cons*:
    *   Minor performance overhead (one DB write/read per session refresh) compared to Redis. We will cache these in Redis in future milestones if session load scales.

### Interview Talking Points
> *"We chose to track refresh tokens in PostgreSQL rather than using Redis in this milestone to guarantee transactional consistency (ACID) and keep the architecture simple. Because token refreshes are low-frequency write operations, the database load is negligible. This model allows us to perform strict relational integrity checks and maintain an audit log of active user sessions, while maintaining the option to add a Redis cache layer later as session concurrency scales."*

---

## 7. Strongly-Typed Enums for User Roles

### Decided Approach
We chose to implement the user role using a standard Python `Enum` class mapped to a `VARCHAR(20)` column in the database, instead of checking roles via raw strings.

### Trade-offs & Rationale
*   *Pros*:
    *   **Type Safety**: Prevents typos in code (e.g., `"viewer"` vs `"vewer"`) which could lead to critical authorization bypass bugs.
    *   **Centralized Policies**: Defines allowed roles in a single, authoritative location.
    *   **Cons**:
        *   Database schema changes if we need to add/remove roles, although mapping to a `VARCHAR(20)` column in PostgreSQL allows us to control enum logic at the application layer while remaining flexible at the DB level.

---

## 8. OpenAPI Security Schema: HTTPBearer over OAuth2PasswordBearer

### Decided Approach
We chose **HTTPBearer** (Authorization: Bearer <JWT>) for the Swagger OpenAPI security configuration, deprecating the use of the `OAuth2PasswordBearer` scheme. 

### Alternatives Considered
*   **OAuth2PasswordBearer Flow**: Direct interactive Swagger authorization form requesting username/password and sending `application/x-www-form-urlencoded` payloads to a login url.

### Trade-offs & Rationale
*   *Pros*:
    *   **API Purity**: The JSON-based `/auth/login` endpoint remains clean and single-purpose, without requiring a secondary, hidden form-based fallback login route (`/login/form`) purely for Swagger UI compatibility.
    *   **Production Alignment**: Emulates the exact HTTP headers (`Authorization: Bearer <JWT>`) sent by frontend client apps and programmatic API scripts, providing an accurate, representative description of API interactions.
*   *Cons*:
    *   Swagger UI cannot directly authenticate the user via an interactive username/password popup. Developers must call `/auth/login` manually to fetch the JWT access token and paste it into Swagger's authorization field.

### Interview Talking Points
> *"To ensure that our REST API contracts remain strictly aligned with production clients, we configured the OpenAPI security schema to use HTTPBearer instead of the standard OAuth2PasswordBearer flow. This avoids polluting our endpoints with helper fallback routes designed solely to support Swagger UI's form-urlencoded authentication form, while maintaining a pure JSON request/response contract for credential verification."*


