import pytest
from fastapi import status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.features.users.models import User, UserRole

async def setup_rbac_users(async_client, org_suffix: str):
    """
    Helper to register an organization and create users with Owner, Admin, Member, and Viewer roles.
    """
    # 1. Register Org & Owner
    owner_email = f"owner@{org_suffix}.com"
    await async_client.post("/api/v1/auth/register", json={
        "org_name": f"Org {org_suffix}",
        "email": owner_email,
        "password": "secure_password"
    })
    
    # Login Owner
    login_res = await async_client.post("/api/v1/auth/login", json={
        "email": owner_email,
        "password": "secure_password"
    })
    owner_token = login_res.json()["access_token"]
    
    # 2. Owner adds Admin, Member, and Viewer
    auth_headers = {"Authorization": f"Bearer {owner_token}"}
    
    admin_email = f"admin@{org_suffix}.com"
    res = await async_client.post("/api/v1/users/", headers=auth_headers, json={
        "email": admin_email,
        "password": "password123",
        "role": UserRole.ADMIN.value
    })
    admin_id = res.json()["id"]
    
    member_email = f"member@{org_suffix}.com"
    res = await async_client.post("/api/v1/users/", headers=auth_headers, json={
        "email": member_email,
        "password": "password123",
        "role": UserRole.MEMBER.value
    })
    member_id = res.json()["id"]
    
    viewer_email = f"viewer@{org_suffix}.com"
    res = await async_client.post("/api/v1/users/", headers=auth_headers, json={
        "email": viewer_email,
        "password": "password123",
        "role": UserRole.VIEWER.value
    })
    viewer_id = res.json()["id"]
    
    # Logins and tokens
    admin_login = await async_client.post("/api/v1/auth/login", json={"email": admin_email, "password": "password123"})
    member_login = await async_client.post("/api/v1/auth/login", json={"email": member_email, "password": "password123"})
    viewer_login = await async_client.post("/api/v1/auth/login", json={"email": viewer_email, "password": "password123"})
    
    return {
        "owner": {"token": owner_token, "email": owner_email},
        "admin": {"token": admin_login.json()["access_token"], "id": admin_id, "email": admin_email},
        "member": {"token": member_login.json()["access_token"], "id": member_id, "email": member_email},
        "viewer": {"token": viewer_login.json()["access_token"], "id": viewer_id, "email": viewer_email}
    }

@pytest.mark.asyncio
async def test_viewer_and_member_role_restrictions(async_client):
    """
    Tests that Viewers and Members cannot add new users (expect HTTP 403).
    """
    users = await setup_rbac_users(async_client, "restrictions")
    
    new_user_payload = {
        "email": "another@restrictions.com",
        "password": "password123",
        "role": "member"
    }
    
    # 1. Viewer tries to add user
    viewer_headers = {"Authorization": f"Bearer {users['viewer']['token']}"}
    res = await async_client.post("/api/v1/users/", headers=viewer_headers, json=new_user_payload)
    assert res.status_code == status.HTTP_403_FORBIDDEN
    
    # 2. Member tries to add user
    member_headers = {"Authorization": f"Bearer {users['member']['token']}"}
    res = await async_client.post("/api/v1/users/", headers=member_headers, json=new_user_payload)
    assert res.status_code == status.HTTP_403_FORBIDDEN

@pytest.mark.asyncio
async def test_admin_cannot_create_owners(async_client):
    """
    Tests that Admins are prohibited from creating Owner user accounts.
    """
    users = await setup_rbac_users(async_client, "admincreate")
    admin_headers = {"Authorization": f"Bearer {users['admin']['token']}"}
    
    res = await async_client.post("/api/v1/users/", headers=admin_headers, json={
        "email": "extraowner@admincreate.com",
        "password": "password123",
        "role": UserRole.OWNER.value
    })
    assert res.status_code == status.HTTP_403_FORBIDDEN

@pytest.mark.asyncio
async def test_hierarchical_deletion_rules(async_client):
    """
    Tests deletion authorization paths:
      - Admin cannot delete Owner or another Admin.
      - Owner can delete Admins/Members/Viewers.
      - User cannot delete self.
    """
    users = await setup_rbac_users(async_client, "deletion")
    
    admin_headers = {"Authorization": f"Bearer {users['admin']['token']}"}
    owner_headers = {"Authorization": f"Bearer {users['owner']['token']}"}
    
    # 1. Admin tries to delete Admin (not allowed)
    # Register another admin first
    res = await async_client.post("/api/v1/users/", headers=owner_headers, json={
        "email": "admin2@deletion.com",
        "password": "password123",
        "role": UserRole.ADMIN.value
    })
    admin2_id = res.json()["id"]
    
    res = await async_client.delete(f"/api/v1/users/{admin2_id}", headers=admin_headers)
    assert res.status_code == status.HTTP_403_FORBIDDEN
    
    # 2. Admin tries to delete Member (allowed)
    res = await async_client.delete(f"/api/v1/users/{users['member']['id']}", headers=admin_headers)
    assert res.status_code == status.HTTP_200_OK
    
    # 3. Owner deletes Admin (allowed)
    res = await async_client.delete(f"/api/v1/users/{users['admin']['id']}", headers=owner_headers)
    assert res.status_code == status.HTTP_200_OK
