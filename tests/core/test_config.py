from app.core.config import settings

def test_settings_initialization():
    """
    Validates that the settings object loads defaults or environment overrides correctly.
    """
    assert settings.PROJECT_NAME == "LinkForge"
    assert settings.ENVIRONMENT in ["development", "production", "testing"]
    assert settings.DATABASE_URL.startswith("postgresql+asyncpg://")
    assert settings.REDIS_URL.startswith("redis://")
