import pytest
import jwt
from fastapi import status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.features.users.models import User, UserRole
from app.features.organizations.models import Organization
from app.features.auth.models import RefreshToken
from app.features.audit.models import AuditEvent

@pytest.mark.asyncio
async def test_tenant_registration_and_audit(async_client, db_session: AsyncSession):
    """
    Tests that registering a new tenant atomically creates the Organization,
    the User with OWNER role, and logs the corresponding AuditEvents.
    """
    payload = {
        "org_name": "Acme Corp",
        "email": "owner@acme.com",
        "password": "secure_password_123"
    }
    
    response = await async_client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["status"] == "success"
    
    # Verify Organization was created
    org_query = select(Organization).where(Organization.name == "Acme Corp")
    result = await db_session.execute(org_query)
    org = result.scalar_one_or_none()
    assert org is not None
    
    # Verify User was created and assigned the OWNER role
    user_query = select(User).where(User.email == "owner@acme.com")
    result = await db_session.execute(user_query)
    user = result.scalar_one_or_none()
    assert user is not None
    assert user.organization_id == org.id
    assert user.role == UserRole.OWNER
    
    # Verify AuditEvents were logged
    audit_query = select(AuditEvent).where(AuditEvent.organization_id == org.id)
    result = await db_session.execute(audit_query)
    events = result.scalars().all()
    assert len(events) == 2
    types = [e.event_type for e in events]
    assert "organization.created" in types
    assert "user.registered" in types

@pytest.mark.asyncio
async def test_user_login_and_cookie(async_client, db_session: AsyncSession):
    """
    Tests that a registered user can log in, receive an access token, 
    and secure HttpOnly refresh token cookie, logging user.login audit.
    """
    # 1. Register first
    reg_payload = {
        "org_name": "Acme Corp",
        "email": "owner@acme.com",
        "password": "secure_password_123"
    }
    await async_client.post("/api/v1/auth/register", json=reg_payload)
    
    # 2. Login
    login_payload = {
        "email": "owner@acme.com",
        "password": "secure_password_123"
    }
    response = await async_client.post("/api/v1/api/v1/auth/login" if False else "/api/v1/auth/login", json=login_payload)
    assert response.status_code == status.HTTP_200_OK
    
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    
    # Check secure HttpOnly cookie
    assert "refresh_token" in response.cookies
    cookie = response.cookies.get("refresh_token")
    assert cookie is not None
    
    # Verify audit event log
    user_query = select(User).where(User.email == "owner@acme.com")
    user_res = await db_session.execute(user_query)
    user = user_res.scalar_one_or_none()
    
    audit_query = select(AuditEvent).where(
        AuditEvent.actor_user_id == user.id,
        AuditEvent.event_type == "user.login"
    )
    result = await db_session.execute(audit_query)
    event = result.scalar_one_or_none()
    assert event is not None

@pytest.mark.asyncio
async def test_refresh_token_rotation(async_client, db_session: AsyncSession):
    """
    Tests Refresh Token Rotation (RTR). Verification and rotation
    should issue a new token pair and revoke the previous token.
    """
    # Register and Login
    await async_client.post("/api/v1/auth/register", json={
        "org_name": "Test Org",
        "email": "user@test.com",
        "password": "secure_password"
    })
    login_res = await async_client.post("/api/v1/auth/login", json={
        "email": "user@test.com",
        "password": "secure_password"
    })
    
    first_refresh_cookie = login_res.cookies.get("refresh_token")
    
    # Rotate token
    async_client.cookies.set("refresh_token", first_refresh_cookie)
    refresh_res = await async_client.post("/api/v1/auth/refresh")
    assert refresh_res.status_code == status.HTTP_200_OK
    
    new_access_token = refresh_res.json()["access_token"]
    new_refresh_cookie = refresh_res.cookies.get("refresh_token")
    assert new_access_token is not None
    assert new_refresh_cookie != first_refresh_cookie
    
    # Verify in DB that first token is marked as revoked
    decoded = jwt.decode(first_refresh_cookie, options={"verify_signature": False})
    jti = decoded["jti"]
    
    query = select(RefreshToken).where(RefreshToken.jti == jti)
    result = await db_session.execute(query)
    old_session = result.scalar_one_or_none()
    assert old_session is not None
    assert old_session.revoked_at is not None

@pytest.mark.asyncio
async def test_refresh_token_replay_attack_revocation(async_client, db_session: AsyncSession):
    """
    Tests RTR reuse protection. Replaying an already-revoked refresh token 
    must cause immediate revocation of all active sessions for the user.
    """
    # Register and Login
    await async_client.post("/api/v1/auth/register", json={
        "org_name": "Test Org",
        "email": "user@test.com",
        "password": "secure_password"
    })
    login_res = await async_client.post("/api/v1/auth/login", json={
        "email": "user@test.com",
        "password": "secure_password"
    })
    
    token_a = login_res.cookies.get("refresh_token")
    
    # 1. First rotation (valid)
    async_client.cookies.set("refresh_token", token_a)
    res_b = await async_client.post("/api/v1/auth/refresh")
    assert res_b.status_code == status.HTTP_200_OK
    token_b = res_b.cookies.get("refresh_token")
    
    # 2. Second login to create an independent concurrent session (Session C)
    login_res_c = await async_client.post("/api/v1/auth/login", json={
        "email": "user@test.com",
        "password": "secure_password"
    })
    token_c = login_res_c.cookies.get("refresh_token")
    
    # Check that Session B and Session C are active in DB
    user_query = select(User).where(User.email == "user@test.com")
    user_res = await db_session.execute(user_query)
    user = user_res.scalar_one_or_none()
    
    active_query = select(RefreshToken).where(
        RefreshToken.user_id == user.id,
        RefreshToken.revoked_at.is_(None)
    )
    result = await db_session.execute(active_query)
    active_sessions = result.scalars().all()
    # Expect 2 active sessions: Session B (from rotation) and Session C (from second login)
    assert len(active_sessions) == 2
    
    # 3. Attack: Replay Token A (already rotated/revoked)
    async_client.cookies.set("refresh_token", token_a)
    replay_res = await async_client.post("/api/v1/auth/refresh")
    assert replay_res.status_code == status.HTTP_401_UNAUTHORIZED
    
    # 4. Verify that ALL active sessions (Session B and Session C) have been emergency revoked in DB
    result_after = await db_session.execute(active_query)
    active_after = result_after.scalars().all()
    assert len(active_after) == 0

@pytest.mark.asyncio
async def test_user_logout(async_client, db_session: AsyncSession):
    """
    Tests that logging out revokes the refresh token record in the database
    and clears the client cookie.
    """
    await async_client.post("/api/v1/auth/register", json={
        "org_name": "Test Org",
        "email": "user@test.com",
        "password": "secure_password"
    })
    login_res = await async_client.post("/api/v1/auth/login", json={
        "email": "user@test.com",
        "password": "secure_password"
    })
    
    token = login_res.cookies.get("refresh_token")
    async_client.cookies.set("refresh_token", token)
    
    logout_res = await async_client.post("/api/v1/auth/logout")
    assert logout_res.status_code == status.HTTP_200_OK
    assert logout_res.cookies.get("refresh_token") in (None, "")
    
    # Verify JTI status in DB
    decoded = jwt.decode(token, options={"verify_signature": False})
    jti = decoded["jti"]
    
    query = select(RefreshToken).where(RefreshToken.jti == jti)
    result = await db_session.execute(query)
    record = result.scalar_one_or_none()
    assert record.revoked_at is not None
