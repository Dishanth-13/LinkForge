# LinkForge Database Specification

This document details the schema layout, indexing strategies, and multi-tenant isolation rules configured in the LinkForge PostgreSQL instance.

---

## 1. Multi-Tenant Partitioning (Soft Isolation)

LinkForge uses a **Shared Database, Shared Schema** multi-tenancy model. 
*   All user-facing tables (users, API keys, links, click analytics) are linked to an `Organization` record via an `organization_id` foreign key.
*   Application queries must explicitly filter by `organization_id` to prevent data leakage. This is enforced via FastAPI authentication dependencies.

---

## 2. Table Schemas

### `audit_events`
Stores audit logs for all security-sensitive actions performed within the application.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY | Unique identifier for the audit event record. |
| `organization_id` | `UUID` | FOREIGN KEY (Nullable) | Associated organization. Nullable for unauthenticated login failures. |
| `actor_user_id` | `UUID` | FOREIGN KEY (Nullable) | User ID of the actor performing the operation. |
| `request_id` | `VARCHAR(36)` | INDEX, NOT NULL | Trace request token linked to the HTTP request. |
| `event_type` | `VARCHAR(100)` | INDEX, NOT NULL | Namespace action (e.g. `auth.login`, `link.created`). |
| `timestamp` | `TIMESTAMPTZ` | INDEX, NOT NULL | When the audit event took place. |
| `metadata` | `JSONB` | Nullable | Dynamic context payload containing request IP, OS, or changes. |

### Indexes
*   Index on `organization_id` for tenant log querying.
*   Index on `request_id` for tracking logs from specific requests.
*   Composite index on `(event_type, timestamp DESC)` for dashboard metric filters.
