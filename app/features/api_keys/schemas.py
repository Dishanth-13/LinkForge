import uuid
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, field_validator, ConfigDict
from app.features.api_keys.models import APIKeyPermission

class APIKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Friendly identifier for the API key")
    environment: Literal["production", "testing"] = Field("production", description="Environment for the API key")
    permissions: list[APIKeyPermission] = Field(
        default_factory=list,
        description="Explicit permissions granted to the API key"
    )

    @field_validator("permissions")
    @classmethod
    def validate_permissions_not_empty(cls, v: list[APIKeyPermission]) -> list[APIKeyPermission]:
        if not v:
            raise ValueError("An API key must be granted at least one permission")
        return v

class APIKeyResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    environment: Literal["production", "testing"]
    key_prefix: str
    permissions: list[APIKeyPermission]
    created_by: uuid.UUID
    created_at: datetime
    last_used_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class APIKeyCreatedResponse(APIKeyResponse):
    plain_text_key: str

    model_config = ConfigDict(from_attributes=True)
