import uuid
import hashlib
from datetime import datetime, timezone
from sqlalchemy.exc import IntegrityError, OperationalError
from user_agents import parse
from app.core.celery import celery_app
from app.core.database import SessionLocal
from app.core.logging import logger
from app.features.analytics.models import ClickEvent

@celery_app.task(bind=True, max_retries=5, default_retry_delay=5)
def process_click_telemetry(self, event_data: dict) -> None:
    """
    Celery task wrapper running the asynchronous database operations.
    Runs inside a thread-safe asyncio loop to support our asyncpg connection engine.
    """
    import asyncio
    try:
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
        loop.run_until_complete(async_process_click_telemetry(self, event_data))
    except Exception as e:
        logger.error("Failed to run click telemetry task", error=str(e), event_id=event_data.get("event_id"))
        raise e

async def async_process_click_telemetry(self, event_data: dict) -> None:
    """
    Asynchronously parses client headers, hashes IP, and stores click analytics.
    Enforces idempotent inserts to preserve unique delivery.
    """
    event_id_str = event_data["event_id"]
    link_id = event_data["link_id"]
    org_id_str = event_data["organization_id"]
    timestamp_str = event_data["timestamp"]
    ip_address = event_data.get("ip_address", "")
    user_agent = event_data.get("user_agent", "")
    referer = event_data.get("referer")

    event_id = uuid.UUID(event_id_str)
    org_id = uuid.UUID(org_id_str)
    
    timestamp = datetime.fromisoformat(timestamp_str)
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)

    # 1. Parse client user-agent for analytics metrics
    ua = parse(user_agent)
    if ua.is_mobile:
        device_type = "mobile"
    elif ua.is_tablet:
        device_type = "tablet"
    elif ua.is_pc:
        device_type = "desktop"
    elif ua.is_bot:
        device_type = "bot"
    else:
        device_type = "unknown"

    browser = f"{ua.browser.family} {ua.browser.version_string}".strip()
    os = f"{ua.os.family} {ua.os.version_string}".strip()

    # 2. Securely hash client IP address using SHA-256
    ip_hash = hashlib.sha256(ip_address.encode("utf-8")).hexdigest()

    # 3. Assemble ClickEvent record
    click_event = ClickEvent(
        id=event_id,
        link_id=link_id,
        organization_id=org_id,
        timestamp=timestamp,
        ip_hash=ip_hash,
        user_agent=user_agent[:1000],
        referer=referer[:2048] if referer else None,
        country=None,  # Non-GeoIP in this milestone
        device_type=device_type,
        browser=browser,
        os=os
    )

    # Database execution with transactional rollback safety
    try:
        async with SessionLocal() as db:
            try:
                # Use a savepoint/nested transaction to isolate integrity conflicts
                async with db.begin_nested():
                    db.add(click_event)
                await db.commit()
                logger.info("Telemetry event persisted successfully", event_id=event_id_str)
            except IntegrityError:
                # Savepoint has automatically rolled back, no-op the duplicate event
                logger.info("Duplicate telemetry event ignored (idempotent no-op)", event_id=event_id_str)
    except OperationalError as exc:
        # Retry transient database connection failures with exponential backoff
        logger.warning("Transient database error during telemetry execution, retrying", error=str(exc))
        countdown = 2 ** self.request.retries * 5
        raise self.retry(exc=exc, countdown=countdown)
    except Exception as exc:
        logger.error("Unhandled error during telemetry execution", error=str(exc))
        raise exc
