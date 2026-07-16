import pytest
import uuid
from fastapi import status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.features.users.models import User, UserRole
from app.features.organizations.models import Organization
from app.features.api_keys.models import APIKey, APIKeyPermission
from app.features.api_keys.services import (
    generate_key_material,
    authenticate_api_key,
    ph
)
from app.api.dependencies import get_auth_context, AuthContext

@pytest.mark.asyncio
async def test_key_generation_and_hashing():
    """
    Verifies that generated API keys conform to secure rules and verify with Argon2id.
    """
    plain, prefix, hashed = generate_key_material("production")
    
    assert plain.startswith("lf_live_")
    assert prefix.startswith("lf_live_")
    assert len(prefix) == 16  # lf_live_ (8) + 8 chars token (8) = 16
    assert plain.startswith(prefix)
    
    # Hash must verify against the plain text key
    assert ph.verify(hashed, plain)
    
    # Testing env prefix
    plain_t, prefix_t, _ = generate_key_material("testing")
    assert plain_t.startswith("lf_test_")
    assert prefix_t.startswith("lf_test_")
    assert len(prefix_t) == 16

@pytest.mark.asyncio
async def test_api_key_lifecycle_endpoints(async_client, db_session: AsyncSession):
    """
    Verifies creation (one-time reveal), listing, revoking, and regenerating API keys.
    """
    # 1. Register first to get an auth context
    reg_payload = {
        "org_name": "API Key Org",
        "email": "key_owner@acme.com",
        "password": "secure_password_123"
    }
    reg_res = await async_client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == status.HTTP_201_CREATED
    
    # 2. Login to get JWT
    login_res = await async_client.post("/api/v1/auth/login", json={
        "email": "key_owner@acme.com",
        "password": "secure_password_123"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 3. Create API Key
    create_payload = {
        "name": "My Prod Key",
        "environment": "production",
        "permissions": [APIKeyPermission.READ_LINKS, APIKeyPermission.CREATE_LINKS]
    }
    create_res = await async_client.post("/api/v1/api-keys", json=create_payload, headers=headers)
    assert create_res.status_code == status.HTTP_201_CREATED
    data = create_res.json()
    
    assert "plain_text_key" in data
    assert data["plain_text_key"].startswith("lf_live_")
    assert data["name"] == "My Prod Key"
    assert data["environment"] == "production"
    assert set(data["permissions"]) == {"READ_LINKS", "CREATE_LINKS"}
    assert data["revoked_at"] is None
    
    key_id = data["id"]
    plain_key = data["plain_text_key"]
    
    # 4. List API Keys (assert plaintext key is NOT returned here)
    list_res = await async_client.get("/api/v1/api-keys", headers=headers)
    assert list_res.status_code == status.HTTP_200_OK
    keys = list_res.json()
    assert len(keys) == 1
    assert "plain_text_key" not in keys[0]
    assert keys[0]["id"] == key_id
    assert keys[0]["key_prefix"] == data["key_prefix"]
    
    # 5. Authenticate using API Key (using get_auth_context logic indirectly via route if any, or test dependency directly)
    auth_ctx = await get_auth_context(db=db_session, token_creds=None, x_api_key=plain_key)
    assert auth_ctx.auth_method == "api_key"
    assert auth_ctx.organization_id == uuid.UUID(data["organization_id"])
    assert set(auth_ctx.permissions) == {"READ_LINKS", "CREATE_LINKS"}
    
    # Check last_used_at is updated in the DB
    db_res = await db_session.execute(select(APIKey).where(APIKey.id == uuid.UUID(key_id)))
    key_db = db_res.scalar_one()
    assert key_db.last_used_at is not None
    
    # 6. Regenerate API Key
    regen_res = await async_client.post(f"/api/v1/api-keys/{key_id}/regenerate", headers=headers)
    assert regen_res.status_code == status.HTTP_200_OK
    regen_data = regen_res.json()
    
    assert "plain_text_key" in regen_data
    new_plain_key = regen_data["plain_text_key"]
    assert new_plain_key != plain_key
    assert regen_data["id"] != key_id
    assert regen_data["name"] == "My Prod Key"
    assert set(regen_data["permissions"]) == {"READ_LINKS", "CREATE_LINKS"}
    
    # Assert old key is now revoked in database
    db_res_old = await db_session.execute(select(APIKey).where(APIKey.id == uuid.UUID(key_id)))
    old_key_db = db_res_old.scalar_one()
    assert old_key_db.revoked_at is not None
    
    # 7. Revoke new key
    new_key_id = regen_data["id"]
    revoke_res = await async_client.delete(f"/api/v1/api-keys/{new_key_id}", headers=headers)
    assert revoke_res.status_code == status.HTTP_200_OK
    assert revoke_res.json()["revoked_at"] is not None
    
    # 8. Try authenticating with revoked key - must fail
    with pytest.raises(Exception):
        await get_auth_context(db=db_session, token_creds=None, x_api_key=new_plain_key)

@pytest.mark.asyncio
async def test_api_key_tenant_isolation(async_client, db_session: AsyncSession):
    """
    Verifies that organization A cannot access, revoke, or regenerate organization B's API keys.
    """
    # Org A register + login
    await async_client.post("/api/v1/auth/register", json={
        "org_name": "Org A", "email": "a@acme.com", "password": "password123"
    })
    token_a = (await async_client.post("/api/v1/auth/login", json={"email": "a@acme.com", "password": "password123"})).json()["access_token"]
    
    # Org B register + login
    await async_client.post("/api/v1/auth/register", json={
        "org_name": "Org B", "email": "b@acme.com", "password": "password123"
    })
    token_b = (await async_client.post("/api/v1/auth/login", json={"email": "b@acme.com", "password": "password123"})).json()["access_token"]
    
    # Org A creates a key
    headers_a = {"Authorization": f"Bearer {token_a}"}
    create_payload = {"name": "Key A", "environment": "production", "permissions": [APIKeyPermission.READ_LINKS]}
    key_a = (await async_client.post("/api/v1/api-keys", json=create_payload, headers=headers_a)).json()
    key_a_id = key_a["id"]
    
    # Org B attempts to delete Org A's key - must return 404/403
    headers_b = {"Authorization": f"Bearer {token_b}"}
    revoke_res = await async_client.delete(f"/api/v1/api-keys/{key_a_id}", headers=headers_b)
    assert revoke_res.status_code == status.HTTP_404_NOT_FOUND
    
    # Org B attempts to regenerate Org A's key - must return 404/403
    regen_res = await async_client.post(f"/api/v1/api-keys/{key_a_id}/regenerate", headers=headers_b)
    assert regen_res.status_code == status.HTTP_404_NOT_FOUND
