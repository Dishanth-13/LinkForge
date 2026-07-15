# LinkForge

### Enterprise Link Management & Analytics Platform

LinkForge is a high-performance, multi-tenant backend platform designed as a production-grade modular monolith. It demonstrates modern backend software engineering concepts including shared-database SaaS isolation, token refresh session rotation, custom audit logs, request tracing, and asynchronous query pooling.

---

## Current Status

*   **Current Version**: `v0.7.0` (Observability & Metrics)
*   **Completed Milestones**:
    *   **Milestone 1**: Foundation setup (Scaffolding, Async PG Database setups, custom logging, and health probes).
    *   **Milestone 2**: Identity Service (SaaS organizations, User management, Argon2id passwords, and JWT session rotation).
    *   **Milestone 3**: Link Engine (Base62 URL shortening, custom aliases, metadata, and redirection lookup).
    *   **Milestone 4**: Caching (Redis read-through caching for redirects, post-commit active eviction, and offline fallback resiliency).
    *   **Milestone 5**: Rate Limiting (Distributed Token Bucket rate limiting middleware utilizing Redis TIME and Lua scripting).
    *   **Milestone 6**: Asynchronous Events (Redis task queue, Celery background worker, click telemetry ClickEvent database persistence, and User-Agent parsing).
    *   **Milestone 7**: Observability (Prometheus metrics client, request timing middleware, low-cardinality endpoint normalization, allowed/blocked rate limits, and passive scraping).
*   **Current Milestone**: **Milestone 8**: API Keys (Programmatic token generation, SHA-256 secure hashing, and role validation).
*   **Upcoming Milestones**: API Key authorization validation and integration.

---

## Backend Engineering Concepts Demonstrated

This platform showcases the following production-grade backend engineering concepts:

*   **Multi-Tenant Architecture**: Tenant isolation using a shared-database, shared-schema pattern scoped strictly via tenant keys (`organization_id`).
*   **Vertical Slice Architecture**: Features grouped by cohesive capabilities (auth, users, organizations, etc.) rather than decoupled layers.
*   **JWT & HTTP Bearer Authorization**: Stateless authentication via symmetric HS256 JWT tokens transmitted over standard HTTP Bearer headers.
*   **Refresh Token Rotation (RTR)**: Stateful session rotation tracking with Postgres hash validation. Replaying a token triggers immediate family session revocation.
*   **HttpOnly Cookie Protection**: Refresh tokens delivered in secure `HttpOnly`, `SameSite=Lax` cookies scoped strictly to the `/api/v1/auth` path.
*   **Role-Based Access Control (RBAC)**: Authorization checks using a typed Python `UserRole` enum (`owner`, `admin`, `member`, `viewer`).
*   **Asynchronous Database Access**: Non-blocking queries executing over SQLAlchemy 2.0 (`AsyncSession`) and `asyncpg`.
*   **Declarative Schema Migrations**: Version-controlled PostgreSQL table schemas managed using Alembic.
*   **Request Tracing Middleware**: End-to-end tracing propagating unique correlation tokens (`X-Request-ID`) across async calls.
*   **Structured JSON Logging**: Rich logging scopes mapped using `structlog` formatting (JSON in production, colorized in development).

---

## System Architecture

LinkForge is structured as a modular monolith. Slices communicate via in-memory service layers to keep latency low while enforcing high database-level boundaries.

```mermaid
graph TD
    Client[Client / API Developer] -->|HTTP Request with Trace ID| Nginx[Nginx Reverse Proxy]
    Nginx -->|Route Redirection| FastAPI_Redirect[FastAPI Redirect Handler]
    Nginx -->|Route REST / Admin APIs| FastAPI_API[FastAPI REST API]
    
    FastAPI_Redirect -->|1. Cache Lookup| Redis_Cache[(Redis Cache & Rate Limiter)]
    FastAPI_Redirect -->|2. Cache Miss: DB Lookup| PostgreSQL[(PostgreSQL DB)]
    FastAPI_Redirect -->|3. Publish Event: link.clicked| Redis_Queue{Redis Event Broker}
    
    FastAPI_API -->|CRUD & Security Operations| PostgreSQL
    FastAPI_API -->|Rate Limiting Check| Redis_Cache
    
    Redis_Queue -->|Fetch Event| Celery_Worker[Celery Background Event Worker]
    Celery_Worker -->|4. Parse User-Agent & Geolocation| Celery_Worker
    Celery_Worker -->|5. Write Click Telemetry| PostgreSQL
```

---

## Technology Stack

### Implemented Infrastructure (Core Stack)
| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **API Framework** | FastAPI | Asynchronous REST routing |
| **Runtime Engine** | Python 3.13 | Backend application interpreter |
| **Database** | PostgreSQL 16 | Relational data repository |
| **ORM** | SQLAlchemy 2.0 | Asynchronous query mapper |
| **Migrations** | Alembic | Schema versioning |
| **Testing** | Pytest | Async integration tests with isolated rollbacks |
| **Logging** | Structlog | Context-rich JSON structured logging |

### Planned Infrastructure (Target Stack)
| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Cache & Limiter** | Redis 7 | Read-through caching, rate limit tokens, and event queuing |
| **Event Pipeline** | Celery | Asynchronous background telemetry parsing |
| **Observability** | Prometheus / Grafana | Telemetry metric collection and dashboard reporting |

---

## Project Structure

```text
linkforge/
├── alembic/                 # Database migrations and version scripts
├── app/                     # Core application source
│   ├── api/                 # Core API dependencies and security schemes
│   ├── core/                # Database engines, configurations, and logger settings
│   ├── middleware/          # HTTP middlewares (request correlation tracking)
│   └── features/            # Feature slices (Vertical Slices)
│       ├── audit/           # Security audit event logs
│       ├── auth/            # Token generation, logins, logout, and RTR helpers
│       ├── health/          # System connection status checks
│       ├── links/           # Shortening, aliases, and redirect services
│       ├── organizations/   # SaaS organizations (Tenants)
│       └── users/           # User credentials and RBAC
├── docs/                    # Schema models and architecture specs
├── tests/                   # Automated pytest suites (isolated transactional DB test beds)
├── docker-compose.yml       # Docker configurations for PostgreSQL and Redis services
├── pytest.ini               # Test configuration properties
└── requirements.txt         # Core dependencies manifest
```

---

## Development Roadmap

*   **Milestone 1: Foundation (Completed)**: Scaffolding, Async DB setups, Docker database/cache configuration, Request ID tracing, structured logging, health probes.
*   **Milestone 2: Identity Service (Completed)**: Registration, Tenant Scoping, User management, JWT token issue, Audit Logging system.
*   **Milestone 3: Link Engine (Completed)**: Base62 conversion mapping, URL Shortening engine, Custom Aliases, Expiration constraints, Redirection, atomic click count.
*   **Milestone 4: Caching (Completed)**: Redis read-through caching, post-commit active eviction, and offline connection grace fallback.
*   **Milestone 5: Rate Limiting (Completed)**: Distributed Token Bucket rate limiting middleware utilizing Redis TIME and Lua scripting.
*   **Milestone 6: Analytics (Completed)**: Redis task queue, Celery background worker, User-Agent browser/OS/device metadata parsing, SHA-256 IP privacy hashing, database savepoint idempotency.
*   **Milestone 7: Observability (Completed)**: Prometheus client metrics integration, HTTP request latency tracking, low-cardinality endpoint normalization middleware, allowed/blocked rate limits, and passive metrics scraping.
*   **Milestone 8: API Keys (Current)**: Programmatic token generation, SHA-256 secure hashing, role validation.

---

## Getting Started

### Prerequisites
*   [Docker Desktop](https://www.docker.com/products/docker-desktop/) (v20.10+)
*   [Python 3.13](https://www.python.org/downloads/)

### Installation & Run Steps
1.  Initialize virtual environment:
    ```bash
    python -m venv .venv
    ```
2.  Activate the environment:
    *   **Windows**: `.venv\Scripts\activate`
    *   **Linux/macOS**: `source .venv/bin/activate`
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Copy environment configurations:
    Create a `.env` file in the root directory (referencing `.env.example`).
5.  Launch local database services:
    ```bash
    docker compose up -d
    ```
6.  Apply database tables:
    ```bash
    alembic upgrade head
    ```
7.  Run the web server:
    ```bash
    uvicorn app.main:app --reload
    ```
8.  Execute tests:
    ```bash
    python -m pytest
    ```

API specs are interactive and available locally at [http://localhost:8000/docs](http://localhost:8000/docs).

---

## License

Distributed under the MIT License. See `LICENSE` for details.
