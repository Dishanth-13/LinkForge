import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import BigInteger, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class ClickEvent(Base):
    __tablename__ = "click_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    link_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("links.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    ip_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    user_agent: Mapped[str] = mapped_column(String(1000), nullable=False)
    referer: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    device_type: Mapped[str] = mapped_column(String(50), nullable=False)
    browser: Mapped[str] = mapped_column(String(100), nullable=False)
    os: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )

    def __repr__(self) -> str:
        return f"<ClickEvent id={self.id} link_id={self.link_id}>"
