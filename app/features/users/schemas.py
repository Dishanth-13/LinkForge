import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from app.features.users.models import UserRole

class UserBase(BaseModel):
    email: EmailStr = Field(..., description="User primary email address")

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=128, description="User password")
    role: UserRole = Field(default=UserRole.MEMBER, description="User role in the organization")

class UserRead(UserBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
