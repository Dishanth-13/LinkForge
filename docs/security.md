# LinkForge Security Specification

This document details the security architecture, cryptographic parameters, authorization models, and threat mitigations implemented in LinkForge.

---

## 1. Authentication

LinkForge uses **JSON Web Tokens (JWT)** for stateless session management:
*   **Signature Scheme**: Symmetric HS256 (HMAC-SHA256) signature.
*   **Access Token Lifetime**: 15 minutes.
*   **Refresh Token Lifetime**: 7 days.
*   **Header Transmission**: Access tokens are transmitted via the `Authorization: Bearer <token>` header. Refresh tokens are read/written exclusively using a secure, HttpOnly cookie:
    ```http
    Set-Cookie: refresh_token=<token>; Max-Age=604800; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Lax
    ```

---

## 2. Password Hashing (Argon2id)

Passwords are never stored in plaintext. They are hashed using **Argon2id** (the PHC-winning algorithm), configured to prevent hardware-accelerated dictionary attacks (GPUs/ASICs) and side-channel timing attacks.

### Configuration Parameters
*   **Time Cost (Iterations)**: 3
*   **Memory Cost**: 65536 KiB (64 MiB)
*   **Parallelism**: 4 threads
*   **Salt Length**: 16 bytes (randomly generated per hash)
*   **Key Length**: 32 bytes

---

## 3. Refresh Token Rotation (RTR)

Refresh Token Rotation ensures that long-lived session tokens cannot be replayed by attackers if intercepted.

```
Client                             Server
  |                                  |
  |--- POST /auth/refresh ----------->|  [Validates RefreshToken A]
  |    (with RefreshToken A)         |  [Generates RefreshToken B & AccessToken]
  |                                  |  [Marks RefreshToken A as Revoked]
  |<-- New Tokens Issued -------------|
  |                                  |
  |                                  |
  |--- Replayed POST /auth/refresh --->|  [Detects RefreshToken A is ALREADY Revoked]
  |    (with Replayed Token A)       |  [Session Breach Alarm Triggered]
  |                                  |  [Revokes entire RefreshToken family]
  |<-- HTTP 401 Unauthorized --------|
```

### Protocol Details
1.  **Strict Lifecycle**: Every call to `/auth/refresh` invalidates the active refresh token (`revoked_at` timestamp is set in PostgreSQL) and issues a new refresh token.
2.  **Breach Replay Detection**: The database keeps track of the parent token relationship (`parent_jti`). If an already-revoked token is submitted:
    *   The request is immediate rejected with HTTP 401 Unauthorized.
    *   The token family (all refresh tokens issued within the same user session) is flagged as revoked.
    *   An `AuditEvent` is generated warning of a token reuse attempt.

---

## 4. Authorization (RBAC)

Authorization is managed via Role-Based Access Control (RBAC). The roles are strongly typed using a Python enum (`UserRole`):

*   **`owner`**: Complete tenant ownership. Can view, update, delete the organization, and manage administrative members.
*   **`admin`**: Full organization scope management. Can manage API keys, users, and all links.
*   **`member`**: Collaborative write scope. Can read/write links and view dashboard analytics.
*   **`viewer`**: Read-only access. Can list links and retrieve logs/reports.

---

## 5. Tenant Isolation

To enforce multi-tenant isolation and prevent cross-tenant data access:
1.  **Identifier Validation**: All API paths are scoped under dependencies that read token parameters or API keys.
2.  **Scoped Queries**: The repository/service layer enforces filtering on all SQLAlchemy queries:
    ```python
    # Example Database Selection
    query = select(Link).where(
        Link.organization_id == active_org_id,
        Link.deleted_at.is_(None)
    )
    ```
3.  **No Fallback**: If an `organization_id` context is missing or invalid on a protected endpoint, the request fails with HTTP 401/403.

---

## 6. Threat Mitigations

| Threat | Mitigation Strategy |
| :--- | :--- |
| **Brute-Force Login** | Rate limits login endpoints per IP and Email (Milestone 5). Argon2id delay acts as a natural rate limiter. |
| **Token Theft (Man-in-the-Middle)** | Force HTTPS (TLS 1.3). Access tokens expire quickly. Refresh tokens are isolated in HttpOnly, secure cookies, preventing access by client-side Javascript scripts (XSS). |
| **CSRF Attacks** | Refresh tokens require `SameSite=Lax` or `SameSite=Strict`. Since access tokens are stored in memory and sent via headers, they are naturally immune to classic CSRF. |
| **Session Fixation** | Issuing a new session token identifier (`jti`) upon every successful authentication. |
| **Timing Attacks** | Using `secrets.compare_digest` (constant-time check) when evaluating hashed API keys or signatures. |
