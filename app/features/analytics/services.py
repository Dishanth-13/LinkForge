import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.features.analytics.models import ClickEvent
from app.features.links.models import Link
from app.features.analytics.schemas import (
    AnalyticsOverviewResponse,
    TimeSeriesPoint,
    DistributionItem,
    RecentClickItem,
)

async def get_analytics_overview(
    db: AsyncSession,
    organization_id: uuid.UUID,
    link_id: Optional[int] = None,
    range_str: str = "7d",
) -> AnalyticsOverviewResponse:
    # 1. Determine timestamp filter cutoff
    now = datetime.now(timezone.utc)
    cutoff: Optional[datetime] = None
    interval = "day"

    if range_str == "24h":
        cutoff = now - timedelta(hours=24)
        interval = "hour"
    elif range_str == "7d":
        cutoff = now - timedelta(days=7)
    elif range_str == "30d":
        cutoff = now - timedelta(days=30)
    elif range_str == "90d":
        cutoff = now - timedelta(days=90)
    # "all" or anything else does not apply a cutoff filter

    # Base filters
    filters = [ClickEvent.organization_id == organization_id]
    if link_id is not None:
        filters.append(ClickEvent.link_id == link_id)
    if cutoff is not None:
        filters.append(ClickEvent.timestamp >= cutoff)

    # 2. Query total clicks
    total_clicks_stmt = select(func.count(ClickEvent.id)).where(*filters)
    total_clicks_res = await db.execute(total_clicks_stmt)
    total_clicks = total_clicks_res.scalar() or 0

    # 3. Query unique visitors
    unique_visitors_stmt = select(func.count(func.distinct(ClickEvent.ip_hash))).where(*filters)
    unique_visitors_res = await db.execute(unique_visitors_stmt)
    unique_visitors = unique_visitors_res.scalar() or 0

    # 4. Query time series clicks
    time_series_stmt = (
        select(
            func.date_trunc(interval, ClickEvent.timestamp).label("period"),
            func.count(ClickEvent.id).label("clicks")
        )
        .where(*filters)
        .group_by("period")
        .order_by("period")
    )
    time_series_res = await db.execute(time_series_stmt)
    time_series = [
        TimeSeriesPoint(timestamp=row.period, clicks=row.clicks)
        for row in time_series_res.all()
    ]

    # Helper function to query distribution limit 10
    async def get_distribution(column, limit: int = 10):
        stmt = (
            select(column.label("name"), func.count(ClickEvent.id).label("count"))
            .where(*filters)
            .group_by(column)
            .order_by(desc("count"))
            .limit(limit)
        )
        res = await db.execute(stmt)
        return [
            DistributionItem(name=row.name, count=row.count)
            for row in res.all()
        ]

    # Query distributions
    browser_dist = await get_distribution(ClickEvent.browser)
    os_dist = await get_distribution(ClickEvent.os)
    device_dist = await get_distribution(ClickEvent.device_type)

    # Referrer distribution with COALESCE for direct traffic
    referrer_col = func.coalesce(ClickEvent.referer, "Direct / Email")
    referrer_stmt = (
        select(referrer_col.label("name"), func.count(ClickEvent.id).label("count"))
        .where(*filters)
        .group_by(referrer_col)
        .order_by(desc("count"))
        .limit(10)
    )
    referrer_res = await db.execute(referrer_stmt)
    referrer_dist = [
        DistributionItem(name=row.name, count=row.count)
        for row in referrer_res.all()
    ]

    # Determine top browser and top referrer
    top_browser = browser_dist[0].name if browser_dist else None
    top_referrer = referrer_dist[0].name if referrer_dist else None

    # 5. Query recent 10 clicks
    recent_stmt = (
        select(
            ClickEvent.timestamp,
            func.coalesce(Link.custom_alias, Link.short_code).label("short_code"),
            ClickEvent.browser,
            ClickEvent.os,
            ClickEvent.device_type,
            ClickEvent.referer
        )
        .join(Link, ClickEvent.link_id == Link.id)
        .where(*filters)
        .order_by(ClickEvent.timestamp.desc())
        .limit(10)
    )
    recent_res = await db.execute(recent_stmt)
    recent_clicks = [
        RecentClickItem(
            timestamp=row.timestamp,
            short_code=row.short_code,
            browser=row.browser,
            os=row.os,
            device_type=row.device_type,
            referer=row.referer
        )
        for row in recent_res.all()
    ]

    return AnalyticsOverviewResponse(
        total_clicks=total_clicks,
        unique_visitors=unique_visitors,
        top_browser=top_browser,
        top_referrer=top_referrer,
        time_series=time_series,
        browser_distribution=browser_dist,
        os_distribution=os_dist,
        device_distribution=device_dist,
        referrer_distribution=referrer_dist,
        recent_clicks=recent_clicks,
    )
