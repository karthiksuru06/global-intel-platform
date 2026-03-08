from datetime import datetime, timezone

from geoalchemy2 import Geometry
from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class GeoEventRecord(Base):
    __tablename__ = "geo_events"

    id = Column(String(36), primary_key=True)
    type = Column(String(50), nullable=False, index=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    altitude = Column(Float, nullable=True)
    severity = Column(Integer, nullable=True)
    metadata_ = Column("metadata", JSON, default=dict)
    timestamp = Column(String(50), nullable=False, index=True)
    source = Column(String(100), nullable=False, index=True)
    geom = Column(
        Geometry(geometry_type="POINT", srid=4326),
        nullable=False,
    )
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        Index("idx_geo_events_type_timestamp", "type", "timestamp"),
        Index("idx_geo_events_severity", "severity"),
        # GeoAlchemy2 auto-creates the spatial index on geom column
    )

    def __repr__(self) -> str:
        return f"<GeoEventRecord id={self.id} type={self.type}>"
