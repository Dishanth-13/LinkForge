from celery import Celery
from app.core.config import settings

# Initialize Celery Application
celery_app = Celery(
    "linkforge",
    broker=settings.REDIS_URL,
    include=["app.features.analytics.tasks"]  # Explicitly load tasks vertical slice
)

# Apply production task configurations
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,                 # Late acknowledgment ensures At-Least-Once delivery guarantees
    task_reject_on_worker_lost=True,     # Re-queue the task if the worker process is killed/lost
)

# Load the centralized model registry to fully populate Base.metadata for the worker process
import app.core.models
