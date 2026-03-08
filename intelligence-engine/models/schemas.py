from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


class GeoEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str = Field(..., description="Event type: aircraft, ship, webcam, seismic, weather")
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    altitude: Optional[float] = None
    severity: Optional[int] = Field(None, ge=1, le=5)
    risk_score: float = Field(default=0.0, ge=0.0, le=100.0, description="Predictive risk score 0-100")
    trace_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    source: str = Field(..., description="Data source identifier")

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        allowed = {
            "aircraft", "ship", "webcam", "seismic", "weather", "custom",
            "hotspots", "insight", "correlation", "canary",
        }
        if v not in allowed:
            raise ValueError(f"type must be one of {allowed}")
        return v

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp(cls, v: str) -> str:
        try:
            datetime.fromisoformat(v.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            raise ValueError("timestamp must be a valid ISO 8601 string")
        return v


class GeoEventCreate(BaseModel):
    type: str
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)
    altitude: Optional[float] = None
    severity: Optional[int] = Field(None, ge=1, le=5)
    metadata: dict[str, Any] = Field(default_factory=dict)
    source: str = "manual"

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        allowed = {
            "aircraft", "ship", "webcam", "seismic", "weather", "custom",
            "hotspots", "insight", "correlation", "canary",
        }
        if v not in allowed:
            raise ValueError(f"type must be one of {allowed}")
        return v


class CorrelationResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    correlation_type: str = Field(
        ..., description="spatial_cluster, temporal_cluster, anomaly"
    )
    event_ids: list[str] = Field(default_factory=list)
    center_lat: Optional[float] = None
    center_lon: Optional[float] = None
    description: str = ""
    severity: int = Field(1, ge=1, le=5)
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    metadata: dict[str, Any] = Field(default_factory=dict)


class AIInsight(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    severity: int = Field(1, ge=1, le=5)
    category: str = Field(
        ..., description="threat, pattern, anomaly, trend, info"
    )
    related_event_ids: list[str] = Field(default_factory=list)
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    metadata: dict[str, Any] = Field(default_factory=dict)
