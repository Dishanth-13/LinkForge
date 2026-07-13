import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

class OrganizationBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Organization name")

class OrganizationCreate(OrganizationBase):
    pass

class OrganizationRead(OrganizationBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
