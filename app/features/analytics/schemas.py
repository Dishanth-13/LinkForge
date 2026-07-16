from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

class TimeSeriesPoint(BaseModel):
    timestamp: datetime
    clicks: int

    model_config = ConfigDict(from_attributes=True)

class DistributionItem(BaseModel):
    name: str
    count: int

    model_config = ConfigDict(from_attributes=True)

class RecentClickItem(BaseModel):
    timestamp: datetime
    short_code: str
    browser: str
    os: str
    device_type: str
    referer: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class AnalyticsOverviewResponse(BaseModel):
    total_clicks: int
    unique_visitors: int
    top_browser: Optional[str] = None
    top_referrer: Optional[str] = None
    time_series: List[TimeSeriesPoint]
    browser_distribution: List[DistributionItem]
    os_distribution: List[DistributionItem]
    device_distribution: List[DistributionItem]
    referrer_distribution: List[DistributionItem]
    recent_clicks: List[RecentClickItem]

    model_config = ConfigDict(from_attributes=True)
