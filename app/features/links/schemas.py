import re
import uuid
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse
from pydantic import BaseModel, Field, field_validator, ConfigDict

RESERVED_PATHS = {
    "api", "docs", "redoc", "health", "live", "ready", 
    "static", "links", "auth", "users", "organizations", 
    "admin", "metrics", "login", "logout", "register"
}

class LinkCreate(BaseModel):
    original_url: str = Field(..., max_length=2048, description="The destination URL starting with http:// or https://")
    custom_alias: Optional[str] = Field(None, max_length=50, description="Optional tenant-scoped alias (alphanumeric, hyphens, underscores)")
    title: Optional[str] = Field(None, max_length=255, description="Optional title description")
    description: Optional[str] = Field(None, description="Optional longer description")
    expires_at: Optional[datetime] = Field(None, description="Optional expiration timestamp")

    @field_validator("original_url")
    @classmethod
    def validate_original_url(cls, v: str) -> str:
        url = v.strip()
        try:
            parsed = urlparse(url)
        except Exception:
            raise ValueError("Malformed URL")
            
        if not parsed.scheme or not parsed.netloc:
            raise ValueError("URL must have a valid scheme and hostname")
            
        if parsed.scheme.lower() not in ("http", "https"):
            raise ValueError("Only http and https protocols are supported")
            
        # Reject protocols embedded inside the URL string
        if any(bad in url.lower() for bad in ("javascript:", "ftp:", "file:", "data:")):
            raise ValueError("URL contains an unsupported protocol")
            
        host = parsed.hostname
        if not host:
            raise ValueError("URL must have a valid host")
            
        host = host.lower().strip()
        
        # Block SSRF / Local interface redirection attempts
        is_loopback = host in ("localhost", "127.0.0.1", "0.0.0.0", "[::1]") or host.startswith("127.")
        is_link_local = host.startswith("169.254.")
        is_lan = (
            host.startswith("10.") or 
            host.startswith("192.168.") or 
            re.match(r"^172\.(1[6-9]|2[0-9]|3[0-1])\.", host)
        )
        if is_loopback or is_link_local or is_lan:
            raise ValueError("Redirection to local or private networks is forbidden")
            
        return url

    @field_validator("custom_alias")
    @classmethod
    def validate_custom_alias(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        v = v.strip()
        if len(v) > 50:
            raise ValueError("Custom alias cannot exceed 50 characters")
        if not re.match(r"^[a-zA-Z0-9_-]+$", v):
            raise ValueError("Custom alias can only contain alphanumeric characters, hyphens, and underscores")
        if v.lower() in RESERVED_PATHS:
            raise ValueError("Custom alias matches a reserved system path")
        return v

    @field_validator("expires_at")
    @classmethod
    def validate_expires_at(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is not None:
            if v.tzinfo is None:
                v = v.replace(tzinfo=timezone.utc)
            if v < datetime.now(timezone.utc):
                raise ValueError("Expiration date must be in the future")
        return v

class LinkUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None)
    expires_at: Optional[datetime] = Field(None)
    is_active: Optional[bool] = Field(None)

    @field_validator("expires_at")
    @classmethod
    def validate_expires_at(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is not None:
            if v.tzinfo is None:
                v = v.replace(tzinfo=timezone.utc)
            if v < datetime.now(timezone.utc):
                raise ValueError("Expiration date must be in the future")
        return v

class LinkResponse(BaseModel):
    id: str  # Serialized as string to prevent 64-bit integer truncation in JavaScript engines
    organization_id: uuid.UUID
    created_by: uuid.UUID
    original_url: str
    short_code: str
    custom_alias: Optional[str]
    title: Optional[str]
    description: Optional[str]
    is_active: bool
    expires_at: Optional[datetime]
    click_count: int
    created_at: datetime
    updated_at: datetime

    @field_validator("id", mode="before")
    @classmethod
    def serialize_bigint(cls, v: any) -> str:
        return str(v)

    model_config = ConfigDict(from_attributes=True)
