import pytest
from fastapi import status

@pytest.mark.asyncio
async def test_tenant_isolation_boundary(async_client):
    """
    Tests that a user authenticated under Tenant A:
      - Cannot list users from Tenant B.
      - Cannot query Tenant B's organization metadata.
      - Cannot delete a user belonging to Tenant B.
    """
    # 1. Register Tenant A
    await async_client.post("/api/v1/auth/register", json={
        "org_name": "Tenant A",
        "email": "owner@tenant-a.com",
        "password": "secure_password"
    })
    
    login_a = await async_client.post("/api/v1/auth/login", json={
        "email": "owner@tenant-a.com",
        "password": "secure_password"
    })
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    
    # 2. Register Tenant B
    await async_client.post("/api/v1/auth/register", json={
        "org_name": "Tenant B",
        "email": "owner@tenant-b.com",
        "password": "secure_password"
    })
    
    login_b = await async_client.post("/api/v1/auth/login", json={
        "email": "owner@tenant-b.com",
        "password": "secure_password"
    })
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}
    
    # Fetch Tenant B Owner's user profile ID
    me_b_res = await async_client.get("/api/v1/users/me", headers=headers_b)
    owner_b_id = me_b_res.json()["id"]
    
    # 3. Test: Tenant A listing users must NOT return Tenant B's owner
    list_res = await async_client.get("/api/v1/users/", headers=headers_a)
    assert list_res.status_code == status.HTTP_200_OK
    users_list = list_res.json()
    assert len(users_list) == 1
    assert users_list[0]["email"] == "owner@tenant-a.com"
    
    # 4. Test: Tenant A queries organization details
    org_res = await async_client.get("/api/v1/organizations/me", headers=headers_a)
    assert org_res.status_code == status.HTTP_200_OK
    assert org_res.json()["name"] == "Tenant A"
    
    # 5. Test: Tenant A attempts to delete Tenant B's Owner (must fail with 404)
    del_res = await async_client.delete(f"/api/v1/users/{owner_b_id}", headers=headers_a)
    assert del_res.status_code == status.HTTP_404_NOT_FOUND
