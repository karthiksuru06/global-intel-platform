import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

from geoalchemy2.functions import ST_DWithin, ST_Intersects, ST_MakeEnvelope, ST_MakePoint, ST_SetSRID
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from config import settings
from models.schemas import GeoEvent
from storage.models import Base, GeoEventRecord

logger = logging.getLogger(__name__)

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

async_session_factory = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def init_db() -> None:
    """Create all tables and enable PostGIS extension. Safe to call repeatedly."""
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        # Clean slate on startup for development
        await conn.execute(text("DROP TABLE IF EXISTS geo_events CASCADE"))
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database initialized with PostGIS extension")


@asynccontextmanager
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def store_event(event: GeoEvent) -> None:
    """Store a GeoEvent in PostGIS."""
    async with get_session() as session:
        record = GeoEventRecord(
            id=event.id,
            type=event.type,
            lat=event.lat,
            lon=event.lon,
            altitude=event.altitude,
            severity=event.severity,
            metadata_=event.metadata,
            timestamp=event.timestamp,
            source=event.source,
            geom=f"SRID=4326;POINT({event.lon} {event.lat})",
        )
        session.add(record)
    logger.debug("Stored event %s (type=%s)", event.id, event.type)


async def query_events(
    event_type: Optional[str] = None,
    severity_min: Optional[int] = None,
    since: Optional[str] = None,
    bbox: Optional[tuple[float, float, float, float]] = None,
    limit: int = 500,
) -> list[dict]:
    """Query events with optional filters."""
    async with get_session() as session:
        stmt = select(GeoEventRecord)

        if event_type:
            stmt = stmt.where(GeoEventRecord.type == event_type)
        if severity_min is not None:
            stmt = stmt.where(GeoEventRecord.severity >= severity_min)
        if since:
            stmt = stmt.where(GeoEventRecord.timestamp >= since)
        if bbox:
            lamin, lomin, lamax, lomax = bbox
            stmt = stmt.where(
                GeoEventRecord.lat.between(lamin, lamax),
                GeoEventRecord.lon.between(lomin, lomax),
            )

        stmt = stmt.order_by(GeoEventRecord.timestamp.desc()).limit(limit)
        result = await session.execute(stmt)
        records = result.scalars().all()

        return [_record_to_dict(r) for r in records]


async def query_events_in_radius(
    lat: float, lon: float, radius_km: float, limit: int = 200
) -> list[dict]:
    """Query events within a radius using PostGIS ST_DWithin."""
    radius_meters = radius_km * 1000
    async with get_session() as session:
        point = ST_SetSRID(ST_MakePoint(lon, lat), 4326)
        stmt = (
            select(GeoEventRecord)
            .where(
                ST_DWithin(
                    GeoEventRecord.geom,
                    point,
                    radius_meters,
                    use_spheroid=True,
                )
            )
            .order_by(GeoEventRecord.timestamp.desc())
            .limit(limit)
        )
        result = await session.execute(stmt)
        records = result.scalars().all()
        return [_record_to_dict(r) for r in records]


async def query_events_in_bbox(
    lamin: float, lomin: float, lamax: float, lomax: float,
    event_type: str | None = None,
    limit: int = 500,
) -> list[dict]:
    """Query events within a bounding box using PostGIS ST_MakeEnvelope (GIST index)."""
    async with get_session() as session:
        envelope = ST_MakeEnvelope(lomin, lamin, lomax, lamax, 4326)
        stmt = (
            select(GeoEventRecord)
            .where(ST_Intersects(GeoEventRecord.geom, envelope))
        )
        if event_type:
            stmt = stmt.where(GeoEventRecord.type == event_type)
        stmt = stmt.order_by(GeoEventRecord.timestamp.desc()).limit(limit)
        result = await session.execute(stmt)
        records = result.scalars().all()
        return [_record_to_dict(r) for r in records]


def _record_to_dict(record: GeoEventRecord) -> dict:
    return {
        "id": record.id,
        "type": record.type,
        "lat": record.lat,
        "lon": record.lon,
        "altitude": record.altitude,
        "severity": record.severity,
        "metadata": record.metadata_,
        "timestamp": record.timestamp,
        "source": record.source,
        "created_at": record.created_at.isoformat() if record.created_at else None,
    }
