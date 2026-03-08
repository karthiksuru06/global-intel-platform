import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379")
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:postgres@postgres:5432/intelligence",
    )
    SYNC_DATABASE_URL: str = os.getenv(
        "SYNC_DATABASE_URL",
        "postgresql://postgres:postgres@postgres:5432/intelligence",
    )

    OPENSKY_API_URL: str = os.getenv(
        "OPENSKY_API_URL", "https://opensky-network.org/api/states/all"
    )

    INGESTION_INTERVAL_SECONDS: int = int(
        os.getenv("INGESTION_INTERVAL_SECONDS", "30")
    )
    CORRELATION_INTERVAL_SECONDS: int = int(
        os.getenv("CORRELATION_INTERVAL_SECONDS", "60")
    )

    REDIS_STREAM_NAME: str = os.getenv("REDIS_STREAM_NAME", "geo_events")
    REDIS_CONSUMER_GROUP: str = os.getenv("REDIS_CONSUMER_GROUP", "intelligence_group")

    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # Bounding box for OpenSky (default: rough world view)
    OPENSKY_BBOX_LAMIN: float = float(os.getenv("OPENSKY_BBOX_LAMIN", "-60"))
    OPENSKY_BBOX_LAMAX: float = float(os.getenv("OPENSKY_BBOX_LAMAX", "60"))
    OPENSKY_BBOX_LOMIN: float = float(os.getenv("OPENSKY_BBOX_LOMIN", "-180"))
    OPENSKY_BBOX_LOMAX: float = float(os.getenv("OPENSKY_BBOX_LOMAX", "180"))

    # ── Canary Injection Configuration (Feature 2) ──
    CANARY_ENABLED: bool = os.getenv("CANARY_ENABLED", "true").lower() == "true"
    CANARY_INTERVAL_MINUTES: int = int(os.getenv("CANARY_INTERVAL_MINUTES", "15"))
    CANARY_SECRET: str = os.getenv("CANARY_SECRET", "fallback-canary-key-dev-only")

    # ── S3 Anchor Replication Configuration (Feature 3) ──
    S3_ANCHOR_BUCKET: str = os.getenv("S3_ANCHOR_BUCKET", "")
    S3_ANCHOR_REGION: str = os.getenv("S3_ANCHOR_REGION", "us-east-1")
    S3_ANCHOR_PREFIX: str = os.getenv("S3_ANCHOR_PREFIX", "sovereign-anchors/")
    S3_ANCHOR_ENABLED: bool = os.getenv("S3_ANCHOR_ENABLED", "false").lower() == "true"


settings = Settings()
