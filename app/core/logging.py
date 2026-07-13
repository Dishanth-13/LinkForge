import logging
import sys
import structlog
from app.core.config import settings

def setup_logging():
    """
    Configures structlog to output structured JSON in production environments
    and clean, colorized terminal logs in local development environments.
    """
    # Shared processors that format context, timestamp, and logging levels
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.format_exc_info,
        structlog.processors.TimeStamper(fmt="iso"),
    ]

    if settings.ENVIRONMENT == "production":
        # Production configuration optimized for JSON processing engines (like Vector, ELK, Datadog)
        processors = shared_processors + [
            structlog.processors.dict_tracebacks,
            structlog.processors.JSONRenderer(),
        ]
    else:
        # Development configuration optimized for developer readability in terminal
        processors = shared_processors + [
            structlog.dev.ConsoleRenderer(),
        ]

    # Map log level string from settings (e.g. DEBUG, INFO) to logging integers
    log_level = logging.getLevelName(settings.LOG_LEVEL.upper())
    if not isinstance(log_level, int):
        log_level = logging.INFO

    structlog.configure(
        processors=processors,
        logger_factory=structlog.PrintLoggerFactory(),
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        cache_logger_on_first_use=True,
    )

# Run initialization upon module import
setup_logging()
logger = structlog.get_logger()
