# Centralized SQLAlchemy Model Registry
# This file imports all declarative models exactly once to populate Base.metadata
# for database engine processes (FastAPI, Celery workers, and Alembic migrations).

from app.core.database import Base
from app.features.organizations.models import Organization
from app.features.users.models import User
from app.features.auth.models import RefreshToken
from app.features.links.models import Link
from app.features.analytics.models import ClickEvent
from app.features.audit.models import AuditEvent
from app.features.api_keys.models import APIKey

# Explicit list of all registered tables for tracking
__all__ = [
    "Base",
    "Organization",
    "User",
    "RefreshToken",
    "Link",
    "ClickEvent",
    "AuditEvent",
    "APIKey"
]
