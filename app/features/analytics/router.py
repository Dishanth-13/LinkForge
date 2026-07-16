import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.features.users.models import User
from app.features.analytics.schemas import AnalyticsOverviewResponse
from app.features.analytics.services import get_analytics_overview

router = APIRouter(prefix="/analytics", tags=["Analytics"])

ALLOWED_RANGES = {"24h", "7d", "30d", "90d", "all"}

@router.get("/overview", response_model=AnalyticsOverviewResponse)
async def get_overview(
    link_id: Optional[int] = Query(None, description="Optional ID to filter metrics to a single link"),
    range: str = Query("7d", description="Time range for metrics: 24h, 7d, 30d, 90d, all"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns aggregated traffic overview metrics (clicks, unique visitors, time-series,
    and device/os/browser/referrer distributions) isolated to the current organization scope.
    """
    if range not in ALLOWED_RANGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid range parameter. Allowed values: {', '.join(ALLOWED_RANGES)}",
        )

    # Note: Enforce tenant isolation strictly by passing current_user.organization_id
    try:
        data = await get_analytics_overview(
            db=db,
            organization_id=current_user.organization_id,
            link_id=link_id,
            range_str=range,
        )
        return data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load analytics: {str(e)}"
        )
