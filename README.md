# LinkForge

Enterprise Link Management & Analytics Platform

LinkForge is a high-performance, multi-tenant backend platform built to manage, secure, and analyze branded short links at scale. Designed as a production-grade modular monolith, it showcases advanced backend engineering concepts including multi-tenant data isolation, asynchronous event processing, token bucket rate limiting, read-through caching, and end-to-end request tracing.

---

## Project Overview

Modern enterprise systems require robust, high-volume link management infrastructure that goes beyond simple URL shortening. Organizations need to control custom branded domains, govern access using role-based permissions, authenticate API clients securely, limit rate-abuse, and capture redirect click telemetry without impacting the client redirection path.

LinkForge solves these challenges by providing a high-performance redirect pipeline and an asynchronous telemetry processing model that splits the request redirect engine from database persistency by pushing log metadata to an event queue.

## Why LinkForge?

In an enterprise environment, a link is more than a redirection mechanism; it is a critical touchpoint. Modern organizations require branded links to establish user trust, role-based access control to enforce organizational permissions, and detailed analytics to measure performance. Furthermore, developers need API automation for bulk link generation, security-sensitive actions must trigger audit logs, and the platform must run on scalable redirect infrastructure to handle heavy traffic spikes without degrading latency.

## Design Goals

*   Low-latency redirects
*   Multi-tenant SaaS architecture
*   Stateless REST APIs
*   Async-first backend
*   Secure authentication
*   Production-grade observability
*   Modular monolith architecture
*   Horizontal scalability readiness

---

## Key Features

### Foundation & Infrastructure
*   [x] Production Foundation & Directory Scaffold
*   [x] Asynchronous FastAPI Framework
*   [x] Dockerized Container Isolation (PostgreSQL 16 and Redis 7)
*   [x] Asynchronous Database Drivers (asyncpg & AsyncSession pooling)
*   [x] Declarative Database Migrations (Alembic Setup)
*   [x] Custom Logging System (structlog integration)
*   [x] Traceability Middleware (automatic X-Request-ID propagation)
*   [x] Backing Services Connection Health Endpoints (/live, /ready, /health)

### Access Control & Security
*   [x] Identity & Tenant Registration Service
*   [x] Multi-Tenant Organization Isolation Policies
*   [x] Symmetric JWT Authorization (HS256)
*   [ ] Secure API Key Generation, Rotation, and Constant-Time Verification
*   [x] Security Audit Recording Engine (AuditEvent system)

### Link Engines & Caching
*   [ ] URL Shortening Engine (Deterministic BIGINT to Base62 encoder)
*   [ ] Redis Read-Through Redirect Caching (sub-100ms redirects when served from cache)
*   [ ] Token Bucket Rate Limiting (Lua scripts on Redis)

### Observability & Analytics
*   [ ] Redis-backed Event Pipeline
*   [ ] Asynchronous Click Telemetry Processing (User-Agent parsing & Geolocation)
*   [ ] Prometheus Metric Instrumentation (/metrics endpoint)
*   [ ] Grafana Dashboard Telemetry

---

## Engineering Highlights

*   Vertical Slice Architecture
*   Async FastAPI
*   SQLAlchemy 2.0
*   PostgreSQL
*   Redis Read-Through Caching
*   Token Bucket Rate Limiting
*   Structured Logging
*   Request Tracing
*   Alembic Versioning
*   Celery Event Pipeline
*   Dockerized Development
*   Multi-Tenant Design

---

## System Architecture

LinkForge is intentionally implemented as a modular monolith with clear service boundaries. This design choice minimizes network latency and operational overhead during initial stages while ensuring that individual domains are decoupled enough to be extracted into independent microservices if scaling requirements evolve.

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

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **API Framework** | FastAPI | High-performance, async web routing |
| **Runtime Engine** | Python 3.13 | Base programming runtime |
| **Database** | PostgreSQL 16 | Relational data repository |
| **ORM** | SQLAlchemy 2.0 | Async data mapper and queries |
| **Migrations** | Alembic | Schema version control |
| **Cache & Limiter** | Redis 7 | High-speed cache, rate limit bucket, and event broker |
| **Event Pipeline** | Celery | Background event consumer processing |
| **Observability** | Prometheus / Grafana | Metric scraping and system telemetry visualizations |
| **Reverse Proxy** | Nginx | SSL termination, routing, request tracing |
| **Testing** | Pytest | Async integration and unit tests |

---

## Project Structure

```
linkforge/
├── alembic/                 # Alembic migration configuration and scripts
├── app/                     # Main application source directory
│   ├── core/                # Global config, logging, and database connection setups
│   ├── middleware/          # Global HTTP middlewares (trace ID tracking, etc.)
│   ├── features/            # Feature-based vertical slices
│   │   ├── health/          # System status probes (/live, /ready)
│   │   └── audit/           # AuditEvent models and services
│   └── main.py              # Web application entry point
├── docs/                    # Platform system architecture and schema design docs
├── tests/                   # Pytest automation suite
├── docker-compose.yml       # Orchestrates local PostgreSQL and Redis configurations
├── pytest.ini               # Pytest settings and plugin parameters
├── requirements.txt         # Package dependency manifest
└── README.md                # Project documentation
```

---

## Development Roadmap

*   **Milestone 1: Foundation (Completed)**: Scaffolding, Async DB setups, Docker database/cache configuration, Request ID tracing, structured logging, health probes.
*   **Milestone 2: Identity Service (Completed)**: Registration, Tenant Scoping, User management, JWT token issue, Audit Logging system.
*   **Milestone 3: Link Engine**: Base62 conversion mapping, URL Shortening engine, Expiring Links.
*   **Milestone 4: Caching**: Redis integration for short URLs read-through caching.
*   **Milestone 5: Rate Limiting**: Redis Token Bucket rate limiting middleware.
*   **Milestone 6: Analytics**: Redis Event Pipeline, Celery background worker, User-Agent parsing, click telemetry metrics.
*   **Milestone 7: API Keys**: Programmatic token generation, SHA-256 secure hashing, role validation.
*   **Milestone 8: Observability**: Prometheus scraping routes and Grafana dashboards.

---

## Getting Started

### Prerequisites
Before running the platform, ensure you have the following installed on your machine:
*   [Docker Desktop](https://www.docker.com/products/docker-desktop/) (v20.10 or higher)
*   [Python 3.13](https://www.python.org/downloads/)

### Installation
1.  Clone the repository to your local directory.
2.  Initialize the Python virtual environment:
    ```bash
    python -m venv .venv
    ```
3.  Activate the environment:
    *   **Windows**:
        ```powershell
        .venv\Scripts\activate
        ```
    *   **Linux/macOS**:
        ```bash
        source .venv/bin/activate
        ```
4.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

### Environment Variables
Configure your database and client settings by creating a `.env` file in the root workspace directory. You can reference the structure outlined in the `.env.example` file:
```env
# Application Settings
PROJECT_NAME="LinkForge"
ENVIRONMENT="development"
LOG_LEVEL="DEBUG"

# Database Settings
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=linkforge
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/linkforge

# Redis Settings
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379/0
```

### Running Databases
Start the Docker database and caching containers in the background:
```bash
docker compose up -d
```

### Running Alembic Migrations
Generate database tables by running Alembic migrations:
```bash
alembic upgrade head
```

### Starting FastAPI Development Server
Start the local FastAPI instance with auto-reload:
```bash
uvicorn app.main:app --reload
```

### Running Tests
Execute the Pytest automation test suite:
```bash
python -m pytest
```

---

## API Documentation

Once the FastAPI server is running, the interactive API documentation will be available at:
*   Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
*   ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## Engineering Principles

LinkForge is built with high standards of software engineering, following these patterns:
*   **Vertical Slice Architecture**: Organizing features into self-contained domain directories.
*   **SOLID Principles**: Designing decoupled modules with single responsibilities.
*   **Asynchronous Execution**: Leveraging non-blocking runtime engines for network I/O calls.
*   **Modular Monolith**: Enforcing boundaries within a single deployment unit to facilitate scaling.
*   **Production-Oriented Design**: Hardening database connection pools, logs, and trace parameters.

---

## Future Improvements

*   **Custom Branded Domains**: Support for tenant-specific apex and subdomains.
*   **Distributed Cache Invalidation**: Pub/Sub mechanism to invalidate cached redirections across active web nodes.
*   **Click Fraud Detection**: Identifying and filtering out automated scraper bot clicks.
*   **Webhook Integrations**: Notifying user servers in real time when specific events are fired in the pipeline.
*   **Horizontal Scaling of Redirect Workers**: Decoupling the ingestion workers from administrative endpoints to scale database writes dynamically.
*   **Advanced Analytics Aggregation**: Generating daily/weekly cached aggregates for reporting paths to prevent heavy ad-hoc queries.

---

## License

Distributed under the MIT License. See `LICENSE` for more information.
