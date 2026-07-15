import uuid
from datetime import datetime, timezone
from typing import Optional
from app.core.logging import logger
from app.features.analytics.tasks import process_click_telemetry

from app.core.metrics import linkforge_click_events_published_total, safe_inc

class TelemetryPublisher:
    @staticmethod
    def publish_click_event(
        link_id: int,
        organization_id: uuid.UUID,
        ip_address: str,
        user_agent: str,
        referer: Optional[str] = None
    ) -> None:
        """
        Publishes a click redirection telemetry event to the background task queue.
        Fails open and logs warnings if queue/broker operations fail.
        """
        event_id = uuid.uuid4()
        timestamp = datetime.now(timezone.utc).isoformat()
        
        payload = {
            "event_id": str(event_id),
            "event_version": 1,  # Version tracking for forward compatibility
            "link_id": link_id,
            "organization_id": str(organization_id),
            "timestamp": timestamp,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "referer": referer
        }
        
        try:
            # Prefer apply_async over delay as requested
            process_click_telemetry.apply_async(args=[payload])
            safe_inc(linkforge_click_events_published_total)
            logger.info("Telemetry click event published to Celery queue", event_id=str(event_id), link_id=link_id)
        except Exception as e:
            # Graceful fail-open resilience: log warning and continue
            logger.warning("Failed to publish telemetry event, failing open", error=str(e), event_id=str(event_id))
