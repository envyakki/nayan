import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    SUPABASE_URL: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    SUPABASE_ANON_KEY: Optional[str] = None
    FASTAPI_BASE_URL: str = "http://localhost:8000"
    ANPR_OCR_ENGINE: str = "demo"
    DEMO_MODE: bool = True
    MAX_REASONABLE_SPEED_KMH: float = 120.0
    CONFIDENCE_THRESHOLD: float = 0.60
    AUTO_SCAN_INTERVAL_SEC: int = 3
    PORT: int = 8000
    TINYFISH_API_KEY: Optional[str] = None
    TINYFISH_AGENT_URL: str = "https://agent.tinyfish.ai/v1/automation/run"
    TINYFISH_TIMEOUT_SECONDS: int = 45

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
