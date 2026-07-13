# LinkForge Database Specification

This document details the schema layout, indexing strategies, and multi-tenant isolation rules configured in the LinkForge PostgreSQL instance.

---

## 1. Multi-Tenant Partitioning (Soft Isolation)

LinkForge uses a **Shared Database, Shared Schema** multi-tenancy model. 
*   All user-facing tables (users, API keys, links, click analytics) are linked to an `Organization` record via an `organization_id` foreign key.
*   Application queries must explicitly filter by `organization_id` to prevent data leakage. This is enforced via FastAPI authentication dependencies.
*   Soft deletes are supported on primary entities (`User`, `Link`) by filtering records where `deleted_at IS NULL`.

---

## 2. Table Schemas

### `organizations`
Defines logical SaaS tenant boundaries.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY | Unique identifier for the organization tenant. |
| `name` | `VARCHAR(100)` | NOT NULL | Human-readable name of the organization. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | Registration date. |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | Last modification date. |

### `users`
Defines member profiles and access credentials associated with organizations.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY | Unique identifier for the user. |
| `organization_id` | `UUID` | FOREIGN KEY, INDEX, NOT NULL | Tenant scoping reference (Cascade delete). |
| `email` | `VARCHAR(255)` | UNIQUE, INDEX, NOT NULL | Unique credential login email. |
| `hashed_password` | `VARCHAR(255)` | NOT NULL | Argon2id password hash. |
| `role` | `VARCHAR(20)` | NOT NULL | RBAC tier: `owner`, `admin`, `member`, `viewer`. |
| `is_active` | `BOOLEAN` | NOT NULL, DEFAULT: TRUE | Status flag allowing or denying user logins. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | Account creation date. |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | Account profile edit date. |
| `deleted_at` | `TIMESTAMPTZ` | Nullable | Scoping timestamp for soft deletions. |

### `refresh_tokens`
Stores rotated token session tracking data for user logins.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY | Unique session identifier. |
| `user_id` | `UUID` | FOREIGN KEY, INDEX, NOT NULL | Reference to associated user. |
| `jti` | `VARCHAR(36)` | UNIQUE, INDEX, NOT NULL | JWT token identifier. |
| `token_hash` | `VARCHAR(64)` | NOT NULL | SHA-256 hash of the JWT token string. |
| `parent_jti` | `VARCHAR(36)` | Nullable | Trace mapping for RTR breach detection. |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | Lifespan expiration limit. |
| `revoked_at` | `TIMESTAMPTZ` | Nullable | Timestamp of rotation or explicit logout. |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | Session initialization timestamp. |

### `audit_events`
Stores security-sensitive operation trails.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | PRIMARY KEY | Unique identifier for the audit event record. |
| `organization_id` | `UUID` | FOREIGN KEY (Nullable) | Associated organization. Nullable for unauthenticated login failures. |
| `actor_user_id` | `UUID` | FOREIGN KEY (Nullable) | User ID of the actor performing the operation. |
| `request_id` | `VARCHAR(36)` | INDEX, NOT NULL | Trace request token linked to the HTTP request. |
| `event_type` | `VARCHAR(100)` | INDEX, NOT NULL | Namespace action (e.g. `auth.login`, `link.created`). |
| `timestamp` | `TIMESTAMPTZ` | INDEX, NOT NULL | When the audit event took place. |
| `metadata` | `JSONB` | Nullable | Dynamic context payload containing request IP, OS, or changes. |

---

## 3. Database Indexes

*   `ix_users_email`: Index on `User.email` for credential lookup queries.
*   `ix_users_organization_id`: Index on `User.organization_id` for tenant user list lookups.
*   `ix_refresh_tokens_jti`: Unique index on `RefreshToken.jti` to enable fast rotation queries.
*   `ix_refresh_tokens_user_id`: Index on `RefreshToken.user_id` for revoking all sessions for a user during breach alarms.
*   `ix_audit_events_organization_id`: Index on `AuditEvent.organization_id` for scoped event log queries.
*   `ix_audit_events_request_id`: Index on `AuditEvent.request_id` for tracing logs by HTTP requests.
*   `ix_audit_events_event_type`: Index on `AuditEvent.event_type` for filtering logs by action types.
