import jwt
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.features.auth.schemas import RegisterRequest, LoginRequest, TokenResponse
from app.features.organizations.services import create_organization
from app.features.users.services import create_user, get_user_by_email
from app.features.users.models import User, UserRole
from app.features.auth.models import RefreshToken
from app.features.auth.services import (
    verify_password,
    create_access_token,
    issue_refresh_token_session,
    rotate_refresh_token_session,
    hash_token_secret,
    set_refresh_cookie,
    delete_refresh_cookie
)
from app.features.audit.services import log_audit_event

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    request: Request,
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    SaaS Tenant Self-Registration Endpoint.
    Registers a new Organization and its primary Owner user inside a single atomic transaction.
    """
    # Check if email is already taken
    existing_user = await get_user_by_email(db, payload.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists"
        )
        
    try:
        # Create organization and user atomically
        org = await create_organization(db, payload.org_name)
        user = await create_user(
            db,
            organization_id=org.id,
            email=payload.email,
            password_clear=payload.password,
            role=UserRole.OWNER
        )
        
        request_id = getattr(request.state, "request_id", "unknown")
        
        # Log audit events
        await log_audit_event(
            db,
            request_id=request_id,
            event_type="organization.created",
            organization_id=org.id,
            actor_user_id=user.id,
            resource_type="organization",
            resource_id=str(org.id),
            metadata={"org_name": org.name}
        )
        
        await log_audit_event(
            db,
            request_id=request_id,
            event_type="user.registered",
            organization_id=org.id,
            actor_user_id=user.id,
            resource_type="user",
            resource_id=str(user.id),
            metadata={"user_email": user.email}
        )
        
        await db.commit()
        return {"status": "success", "message": "Tenant registered successfully"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Tenant registration failed: {str(e)}"
        )

@router.post(
    "/login", 
    response_model=TokenResponse,
    responses={
        200: {
            "description": "Successful Login. Returns access token in body and sets refresh token in HttpOnly cookie.",
            "headers": {
                "Set-Cookie": {
                    "schema": {"type": "string"},
                    "description": "Sets the refresh_token HttpOnly secure cookie for session rotation."
                }
            }
        }
    }
)
async def login(
    response: Response,
    request: Request,
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    User Login Endpoint.
    Verifies credentials using Argon2id, generates tokens, sets refresh token in an HttpOnly cookie,
    and records the user login audit event.
    """
    user = await get_user_by_email(db, payload.email)
    if not user or not verify_password(payload.password, user.hashed_password) or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
        
    # Generate access token
    access_token = create_access_token(user.id, user.organization_id, user.role.value)
    
    # Issue stateful refresh token session
    raw_refresh_token, _ = await issue_refresh_token_session(db, user.id)
    
    # Store refresh token in secure HttpOnly cookie
    set_refresh_cookie(response, raw_refresh_token)
    
    request_id = getattr(request.state, "request_id", "unknown")
    await log_audit_event(
        db,
        request_id=request_id,
        event_type="user.login",
        organization_id=user.organization_id,
        actor_user_id=user.id,
        resource_type="user",
        resource_id=str(user.id),
        metadata={"user_email": user.email}
    )
    
    await db.commit()
    return {"access_token": access_token, "token_type": "bearer"}

@router.post(
    "/refresh", 
    response_model=TokenResponse,
    responses={
        200: {
            "description": "Token rotated successfully. Returns new access token in body and sets new refresh token in HttpOnly cookie.",
            "headers": {
                "Set-Cookie": {
                    "schema": {"type": "string"},
                    "description": "Sets the new rotated refresh_token HttpOnly secure cookie."
                }
            }
        }
    }
)
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Token Refresh / Rotation (RTR) Endpoint.
    Reads refresh token from HttpOnly cookie, executes RTR rotation, writes new refresh token,
    and returns a new access token. Revokes session families upon reuse detection.
    """
    raw_token = request.cookies.get("refresh_token")
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is missing"
        )
        
    try:
        new_access_token, new_refresh_token = await rotate_refresh_token_session(db, raw_token)
        
        # Store the rotated refresh token in secure HttpOnly cookie
        set_refresh_cookie(response, new_refresh_token)
        
        await db.commit()
        return {"access_token": new_access_token, "token_type": "bearer"}
    except jwt.InvalidTokenError as e:
        # Commit in case of breach revocation logs
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Token rotation failed: {str(e)}"
        )

@router.post(
    "/logout",
    responses={
        200: {
            "description": "Logged out successfully. Clears the refresh token cookie.",
            "headers": {
                "Set-Cookie": {
                    "schema": {"type": "string"},
                    "description": "Clears the refresh_token HttpOnly cookie by setting an expired expiration."
                }
            }
        }
    }
)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    User Logout Endpoint.
    Revokes the current refresh token session in the database and clears the client-side cookie.
    """
    raw_token = request.cookies.get("refresh_token")
    if raw_token:
        hashed = hash_token_secret(raw_token)
        query = select(RefreshToken).where(RefreshToken.token_hash == hashed)
        result = await db.execute(query)
        token_record = result.scalar_one_or_none()
        
        if token_record and not token_record.revoked_at:
            now = datetime.now(timezone.utc)
            token_record.revoked_at = now
            
            # Fetch user to log organization mapping
            user_query = select(User).where(User.id == token_record.user_id)
            user_result = await db.execute(user_query)
            user = user_result.scalar_one_or_none()
            org_id = user.organization_id if user else None
            
            request_id = getattr(request.state, "request_id", "unknown")
            await log_audit_event(
                db,
                request_id=request_id,
                event_type="user.logout",
                organization_id=org_id,
                actor_user_id=token_record.user_id,
                resource_type="user",
                resource_id=str(token_record.user_id),
                metadata={
                    "jti": token_record.jti,
                    "user_email": user.email if user else None
                }
            )
            
            await db.commit()
            
    delete_refresh_cookie(response)
    return {"status": "success", "message": "Logged out successfully"}
