import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    jti: Mapped[str] = mapped_column(String(36), unique=True, index=True, nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)  # SHA-256 hash of the refresh token secret
    parent_jti: Mapped[Optional[str]] = mapped_column(String(36), nullable=True) # Used for RTR replay detection
    
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )

    def __repr__(self) -> str:
        return f"<RefreshToken user={self.user_id} jti={self.jti} revoked={self.revoked_at is not None}>"
