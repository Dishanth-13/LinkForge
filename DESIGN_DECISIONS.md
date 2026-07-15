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

---

# Design Decisions: Milestone 3 (Link Service)

This section details the architectural choices, tradeoffs, and design patterns established during Milestone 3 of the LinkForge project.

---

## 9. Deterministic Base62 Encoding for URL Shortening

### Decided Approach
We implemented a pure, deterministic Base62 encoding algorithm utilizing the character set `0-9a-zA-Z`. We map database sequential `BIGINT` auto-increment primary keys to Base62 strings.

### Alternatives Considered
*   **UUID-based Short Codes**: Standard 36-character string UUIDs (too long, defies the purpose of a shortener).
*   **Random String Generation**: Generating random alphanumeric characters and checking for uniqueness in loops (causes database read-write race conditions and lookup overhead as the database grows).
*   **Hashids / External Libraries**: External dependency inclusion.

### Trade-offs & Rationale
*   *Pros*:
    *   **Collision Free**: Mapping directly to a sequence ID guarantees that no two generated short codes will ever collide.
    *   **High Index Efficiency**: Primary keys are sequential, avoiding B-tree index fragmentation in PostgreSQL.
*   *Cons*:
    *   **Information Leakage**: Sequentially mapped codes can be decoded back to integers (e.g. `1`, `2`, `3`), allowing adversaries to estimate link creation velocity and counts. (We will introduce an obfuscation layer like LCG or block cipher in scaling revisions if required).

### Interview Talking Points
> *"We implemented a custom, pure mathematical Base62 encoder to map database auto-increment BIGINT IDs into short URLs. This guarantees collision-free short codes while eliminating the overhead of checking for random duplicates in database loops. It also preserves sequential keys for PostgreSQL B-tree optimization, preventing index fragmentation."*

---

## 10. Tenant-Scoped Custom Aliases

### Decided Approach
We enforced custom alias uniqueness scoped strictly to the organization level: `UNIQUE (organization_id, custom_alias)`.

### Alternatives Considered
*   **Global Custom Alias Uniqueness**: Blocking duplicates globally (e.g. only one `/github` alias allowed across the entire system).

### Trade-offs & Rationale
*   *Pros*:
    *   **SaaS Multi-Tenancy Alignment**: Tenants (Organizations) expect control over their URL namespaces (e.g. Acme Corp and Beta Corp both want a `/docs` or `/github` short link).
*   *Cons*:
    *   **Redirection Ambiguity**: If multiple organizations configure the same custom alias, resolving `GET /docs` globally becomes ambiguous unless scoped by request hostname or subdomain. (We handle this by resolving to the earliest active mapping on shared domains, preparing the infrastructure for custom tenant domain lookups).

---

## 11. Redirect HTTP Codes: 302 Found vs. 307 Temporary Redirect

### Decided Approach
We chose **HTTP 302 Found** for standard link redirection.

### Alternatives Considered
*   **HTTP 307 Temporary Redirect**: Preserves request HTTP verb.
*   **HTTP 301 Moved Permanently**: Browsers cache the redirect destination locally.

### Trade-offs & Rationale
*   *Pros*:
    *   **Flexibility**: Unlike 301, HTTP 302 is not cached by client browsers, ensuring every click hits our redirect endpoint so we capture telemetry.
    *   **Target Verb Adaptation**: Allows changing destination locations in the future without client-side verb restrictions.
*   *Cons*:
    *   Slightly higher network round-trip overhead compared to 301 cached redirects. (An absolute requirement to capture click counts).---

# Design Decisions: Milestone 4 (Redis Caching)

This section details the architectural choices, tradeoffs, and design patterns established during Milestone 4 (Redis Read-Through Cache) of the LinkForge project.

---

## 12. Version-Prefixed Redis Cache Keys

### Decided Approach
We prefixed all Redis cache keys with a versions label, mapping to `v1:link:code:{code}` (where `code` is either the Base62 short_code or custom_alias).

### Trade-offs & Rationale
*   *Pros*:
    *   **Forward Compatibility**: If we modify the cached JSON payload schema in future releases (e.g. adding tenant details or telemetry metrics), we can simply bump the version to `v2:`. The system will automatically fetch misses using the new payload shape without requiring manual cache flushing or script evictions of `v1` keys.
*   *Cons*:
    *   Slightly longer key sizes, resulting in a minimal increase in Redis memory usage (negligible for standard production instances).

### Interview Talking Points
> *"To ensure seamless future updates to our cached data structures, we prefix all Redis keys with a schema version (e.g. `v1:link:code:`). This allows us to evolve the serialized JSON structure in production without manual cache clearing or running migrations, simply by bumping the version label in settings."*

---

## 13. Post-Commit Cache Eviction Hooks

### Decided Approach
We trigger cache evictions in the router controllers *after* the PostgreSQL transaction successfully commits (`db.commit()`), rather than executing deletion queries before the commit or in the service functions.

### Trade-offs & Rationale
*   *Pros*:
    *   **Data Integrity**: Prevents race conditions where a cached key is evicted, but the DB update rolls back due to a constraint check failure, leaving the cache populated with correct data while keeping the system consistent.
    *   **Transactional Alignment**: Ensures we only clear keys when mutations are guaranteed to be saved in PostgreSQL (the source of truth).
*   *Cons*:
    *   Requires tracking key strings (`old_short_code`, `old_custom_alias`) in the router before database mutation occurs.

---

## 14. Fail-Safe Offline Degradation

### Decided Approach
We catch all Redis network operations inside `try...except Exception` blocks, logging warnings with structlog, and falling back directly to PostgreSQL queries.

### Trade-offs & Rationale
*   *Pros*:
    *   **High Availability**: A Redis cluster crash or network partition will not crash the LinkForge redirect service. The service degrades gracefully to database speed instead of throwing 500 errors.
*   *Cons*:
    *   Database connection pool exhaustion risk if Redis goes offline during high-traffic events. (An acceptable risk compared to immediate downtime; mitigated by DB scaling and connection pooling limits).

### Interview Talking Points
> *"High availability of redirections is a critical SLA. We wrapped all Redis operations in try-except blocks to catch connection or socket timeouts. If Redis becomes unavailable, the system logs a structured warning and degrades gracefully by routing lookups directly to PostgreSQL, keeping the service online."*

---

# Design Decisions: Milestone 5 (Redis Token Bucket Rate Limiting)

This section details the architectural choices, tradeoffs, and design patterns established during Milestone 5 (Redis Rate Limiting) of the LinkForge project.

---

## 15. Token Bucket Algorithm over Fixed/Sliding Window

### Decided Approach
We implemented the **Token Bucket** algorithm for distributed rate limiting instead of Fixed Window or Sliding Window Log options.

### Alternatives Considered
*   **Fixed Window**: Simple `INCR` + `EXPIRE` counters. (Rejected because it permits twice the rate limit at window boundaries).
*   **Sliding Window Log**: Uses Redis Sorted Sets (`ZSET`) storing timestamps of every hit. (Rejected because of $O(\log N)$ command overhead and high Redis memory consumption as hits grow).

### Trade-offs & Rationale
*   *Pros*:
    *   **Smooth Rate Control**: Refills tokens continuously with time, neutralizing boundary bursts.
    *   **Memory Efficiency**: Requires only 2 hash fields (`tokens`, `last_updated`) per bucket key, keeping Redis memory usage strictly constant ($O(1)$) regardless of traffic volume.
    *   **Burst Capacity**: Permits safe bursts up to the bucket capacity while maintaining the sustained refill rate over time.
*   *Cons*:
    *   Slightly more complex mathematical logic requiring a custom Redis Lua script.

---

## 16. Server-Side Redis TIME Calculation

### Decided Approach
We calculate the current execution time using the Redis server-side `TIME` command (`redis.call('TIME')`) within the Lua script instead of injecting client-side or application-side timestamps.

### Trade-offs & Rationale
*   *Pros*:
    *   **Anti-Clock Drift**: Neutralizes clock drift across multiple distributed FastAPI server instances. If server A's clock is 5 seconds ahead of server B's, they still evaluate rates against the exact same, single source of time truth (the Redis server's system clock).
*   *Cons*:
    *   A minor execution latency overhead in Redis from calling the internal OS time function during script execution (microsecond-level, negligible).

### Interview Talking Points
> *"In a distributed system, relying on application nodes for timestamps introduces clock drift vulnerabilities. If one server's clock runs fast, rate limit refills are computed incorrectly. We resolved this by querying the Redis server-side `TIME` command directly inside our Lua script, guaranteeing a unified clock source for all nodes."*

## 17. Dual-Bucket Enforcement (IP and User)

### Decided Approach
We apply both IP-scoped and User-scoped rate limiters sequentially for the `POST /api/v1/links` URL creation endpoint.

### Trade-offs & Rationale
*   *Pros*:
    *   **Multi-Vector Protection**: Prevents a single malicious actor from exhausting their user quota from different IPs (brute-forcing limits) and protects the server against DDoS creation attempts from a single IP using multiple compromised user tokens.
*   *Cons*:
    *   Increases Redis network commands to two evaluation checks for link creation requests. (Mitigated by combining evaluation code in Python, but still hits Redis twice).

---

# Design Decisions: Milestone 6 (Asynchronous Click Telemetry Pipeline)

This section details the architectural choices, tradeoffs, and design patterns established during Milestone 6 (Asynchronous Click Telemetry Pipeline) of the LinkForge project.

---

## 18. Celery Task Queue over Redis Streams Native Consumers

### Decided Approach
We chose Celery on Redis (using Redis lists/queues under the hood) instead of implementing native Redis Streams consumer loops.

### Trade-offs & Rationale
*   *Pros*:
    *   **Out-of-the-box Concurrency & Execution**: Celery natively manages worker scaling, threading/prefork execution pools, serialization/deserialization, and resultbackends.
    *   **Standard Ecosystem integration**: Adopts Python's industry standard asynchronous task framework, avoiding the need to write and maintain complex custom polling/looping TCP code in Python.
    *   **Robust retry hooks**: Integrates decorators like `self.retry()` with exponential backoffs out-of-the-box.
*   *Cons*:
    *   Increases startup complexity by introducing a standalone `celery worker` process that runs alongside the application server.

---

## 19. TelemetryPublisher Service Abstraction

### Decided Approach
We isolated all Celery task enqueuing behind a `TelemetryPublisher` class service abstraction in the `analytics` feature slice.

### Trade-offs & Rationale
*   *Pros*:
    *   **Loose Coupling (VSA Principles)**: The `links` feature controllers do not import or call Celery tasks directly, separating routing interfaces from messaging mechanics.
    *   **Standardized Payloads**: Centralizes event validation (injecting `event_version = 1`, timestamps, generating UUID `event_id` keys) in one place.
    *   **Fail-Open Ingress Safety**: Wraps `.apply_async()` inside try-except. If Redis goes down, the publisher logs warnings and fails open, preventing analytics failures from blocking redirection requests.
*   *Cons*:
    *   Minimal function call overhead, but provides significant maintainability benefits.

---

## 20. SQL Savepoint-Based Idempotency

### Decided Approach
We execute database writes inside the worker task inside a SQL nested transaction (`db.begin_nested()`).

### Trade-offs & Rationale
*   *Pros*:
    *   **Exactly-Once Write Semantics**: If a click event is processed twice due to network delivery issues, the duplicate `event_id` raises a unique primary key violation.
    *   **No Transaction Poisoning**: SQLAlchemy automatically rolls back the nested transaction (savepoint) without rolling back or poisoning the parent transaction context. This prevents `PendingRollbackError` exceptions and preserves other operations.
*   *Cons*:
    *   Savepoints add a tiny overhead on the PostgreSQL server side (e.g. generating internal subtransaction markers).

### Interview Talking Points
> *"To handle duplicate task execution idempotently, we map our `ClickEvent` database primary key to the unique `event_id` generated by the publisher. When a retry or network replays the task, the database raises a unique key violation. We isolate this violation using SQLAlchemy savepoints (`begin_nested()`). If the constraint fails, the savepoint rolls back safely, allowing the worker to return a successful no-op without poisoning the main session transaction."*

---

## 21. Privacy-Preserving SHA-256 IP Hashing

### Decided Approach
We calculate a SHA-256 hash of the client's raw IP address (`ip_address`) inside the worker task before writing it to PostgreSQL, and never write raw IP addresses to relational storage.

### Trade-offs & Rationale
*   *Pros*:
    *   **Compliance & Privacy**: Storing raw IP addresses violates privacy regulations (like GDPR) as they are classified as Personally Identifiable Information (PII). Hashing them preserves user privacy.
    *   **Uniqueness Tracking**: A SHA-256 hash behaves as a deterministic fingerprint. We can still count unique visitors or perform analytics aggregation queries using the hash value while keeping user identities anonymous.
*   *Cons*:
    *   We cannot recover the original IP address if forensic inspection is needed (an intentional compliance tradeoff).

---

# Design Decisions: Milestone 7 (Observability & Prometheus Metrics)

This section details the architectural choices, tradeoffs, and design patterns established during Milestone 7 (Observability & Prometheus Metrics) of the LinkForge project.

---

## 22. Centralized In-Memory Metrics Registry & Standard Per-Process Scraping

### Decided Approach
We declared all metrics inside a single global module (`app/core/metrics.py`) and expose them via a passive `/metrics` endpoint. In alignment with standard Prometheus architecture, metrics are kept lightweight and local to each process's memory space. We avoid using Redis or shared-file synchronization layers, and instead treat the FastAPI web process and Celery worker process as independent scrape targets in production.

### Trade-offs & Rationale
*   *Pros*:
    *   **Single Source of Truth**: Simplifies metric discovery, avoiding scattered metrics initializations.
    *   **Shared Registry Code**: Both the Uvicorn FastAPI process and the Celery worker process import from the same module, ensuring identical metric names, types, and labels are defined.
    *   **Zero Scraping Overhead**: Serving metrics directly from in-memory process collectors avoids network roundtrips to Redis or disk database page lookups at scrape time, making `/metrics` reads extremely fast (<1ms).
    *   **Production Scraping Standard**: Keeps the application stateless. Prometheus aggregates independent scrape endpoints at query time, which is the recommended Prometheus deployment pattern.
*   *Cons*:
    *   A single metrics scrape endpoint on the API port does not expose the Celery worker metrics; the worker must expose its own port (e.g. `9100`) for independent scraping.

---

## 23. Path Normalization for Cardinality Control

### Decided Approach
We strip raw request subpaths (such as UUIDs, dynamic link short codes, and integer IDs) and replace them with static templates (e.g. `/{short_code}`, `/api/v1/links/{id}`) before generating Prometheus endpoint label values.

### Trade-offs & Rationale
*   *Pros*:
    *   **Cardinality Safety**: Prevents memory exhaustion on Prometheus scraping nodes by capping the label combination matrix.
    *   **Aggregated Analytics**: Allows developers to view aggregate latency distribution profiles for the entire `/links` route family rather than isolated charts per dynamic link.
*   *Cons*:
    *   Requires regex parsing checks inside the HTTP requests middleware (mitigated by optimizing subpath splitting rules).

### Interview Talking Points
> *"In a production URL shortener, exposing raw paths directly in Prometheus labels leads to cardinality explosion. A million unique link short codes would create a million unique metric series, crashing the metrics engine. We resolved this by implementing a path normalization middleware that groups all dynamic paths into high-level templates like `/{short_code}` and `/api/v1/links/{id}` before they hit the Prometheus labels registry."*

---

## 24. Fail-Open Safe Metrics Mutation Helpers

### Decided Approach
We wrap all counter increments and histogram timings inside `safe_inc()` and `safe_observe()` handlers that catch all exceptions, write structured warnings to logger, and return control safely.

### Trade-offs & Rationale
*   *Pros*:
    *   **Application Availability Priority**: Observability should never cause application downtime. If a metrics update fails (e.g., due to memory constraints or registry lock timeouts), the system log emits a warning and request processing continues.
*   *Cons*:
    *   Increases function call nesting, but keeps feature code clean and error-resilient.



