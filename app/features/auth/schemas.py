from pydantic import BaseModel, EmailStr, Field

class RegisterRequest(BaseModel):
    org_name: str = Field(..., min_length=2, max_length=100, description="Name of the organization to create")
    email: EmailStr = Field(..., description="Email address of the organization owner")
    password: str = Field(..., min_length=8, max_length=128, description="Password of the organization owner")

class LoginRequest(BaseModel):
    email: EmailStr = Field(..., description="Login email address")
    password: str = Field(..., description="Login password")

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
