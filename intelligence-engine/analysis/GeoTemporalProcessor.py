import logging
import math
from collections import defaultdict
from datetime import datetime

from models.schemas import CorrelationResult, GeoEvent

logger = logging.getLogger(__name__)


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


class GeoTemporalProcessor:
    def __init__(self) -> None:
        self._recent_correlations: list[CorrelationResult] = []

    @property
    def correlations(self) -> list[CorrelationResult]:
        return list(self._recent_correlations)

    async def spatial_cluster(
        self, events: list[GeoEvent], radius_km: float = 50.0
    ) -> list[CorrelationResult]:
        """Group nearby events using simple distance-based clustering."""
        if not events:
            return []

        visited = set()
        clusters: list[list[GeoEvent]] = []

        for i, ev in enumerate(events):
            if i in visited:
                continue
            cluster = [ev]
            visited.add(i)
            for j, other in enumerate(events):
                if j in visited:
                    continue
                if _haversine_km(ev.lat, ev.lon, other.lat, other.lon) <= radius_km:
                    cluster.append(other)
                    visited.add(j)
            if len(cluster) >= 3:
                clusters.append(cluster)

        results = []
        for cluster in clusters:
            center_lat = sum(e.lat for e in cluster) / len(cluster)
            center_lon = sum(e.lon for e in cluster) / len(cluster)
            types = set(e.type for e in cluster)
            max_sev = max((e.severity or 1) for e in cluster)

            results.append(
                CorrelationResult(
                    correlation_type="spatial_cluster",
                    event_ids=[e.id for e in cluster],
                    center_lat=center_lat,
                    center_lon=center_lon,
                    description=f"Spatial cluster of {len(cluster)} events ({', '.join(types)}) within {radius_km}km",
                    severity=min(max_sev + 1, 5) if len(cluster) > 10 else max_sev,
                )
            )

        return results

    async def temporal_correlation(
        self, events: list[GeoEvent], window_seconds: float = 60.0
    ) -> list[CorrelationResult]:
        """Group events occurring within time windows."""
        if not events:
            return []

        sorted_events = sorted(events, key=lambda e: e.timestamp)
        clusters: list[list[GeoEvent]] = []
        current_cluster: list[GeoEvent] = [sorted_events[0]]

        for ev in sorted_events[1:]:
            try:
                prev_ts = datetime.fromisoformat(current_cluster[-1].timestamp.replace("Z", "+00:00"))
                curr_ts = datetime.fromisoformat(ev.timestamp.replace("Z", "+00:00"))
                delta = abs((curr_ts - prev_ts).total_seconds())
            except (ValueError, TypeError):
                delta = float("inf")

            if delta <= window_seconds:
                current_cluster.append(ev)
            else:
                if len(current_cluster) >= 5:
                    clusters.append(current_cluster)
                current_cluster = [ev]

        if len(current_cluster) >= 5:
            clusters.append(current_cluster)

        results = []
        for cluster in clusters:
            types_count = defaultdict(int)
            for e in cluster:
                types_count[e.type] += 1

            results.append(
                CorrelationResult(
                    correlation_type="temporal_cluster",
                    event_ids=[e.id for e in cluster],
                    center_lat=sum(e.lat for e in cluster) / len(cluster),
                    center_lon=sum(e.lon for e in cluster) / len(cluster),
                    description=(
                        f"Temporal burst of {len(cluster)} events within {window_seconds}s: "
                        + ", ".join(f"{t}({c})" for t, c in types_count.items())
                    ),
                    severity=min(3, max((e.severity or 1) for e in cluster)),
                )
            )

        return results

    async def detect_anomalies(self, events: list[GeoEvent]) -> list[CorrelationResult]:
        """Simple rule-based anomaly detection."""
        anomalies = []

        for ev in events:
            reasons = []

            if ev.type == "aircraft":
                alt = ev.altitude
                if alt is not None:
                    if alt > 15000:
                        reasons.append(f"extremely high altitude ({alt:.0f}m)")
                    elif alt < 100 and not ev.metadata.get("on_ground", False):
                        reasons.append(f"very low altitude ({alt:.0f}m) while airborne")

                velocity = ev.metadata.get("velocity")
                if velocity is not None and velocity > 340:
                    reasons.append(f"supersonic speed ({velocity:.0f} m/s)")

            elif ev.type == "ship":
                speed = ev.metadata.get("speed", 0)
                if speed > 25:
                    reasons.append(f"unusually fast vessel ({speed:.1f} knots)")

                if abs(ev.lat) > 70:
                    reasons.append("vessel in polar waters")

            if (ev.severity or 0) >= 4:
                reasons.append(f"high severity ({ev.severity})")

            if reasons:
                anomalies.append(
                    CorrelationResult(
                        correlation_type="anomaly",
                        event_ids=[ev.id],
                        center_lat=ev.lat,
                        center_lon=ev.lon,
                        description=f"Anomaly detected in {ev.type} event: " + "; ".join(reasons),
                        severity=min((ev.severity or 1) + 1, 5),
                    )
                )

        return anomalies

    def _to_geo_event(self, corr: CorrelationResult) -> GeoEvent | None:
        """Convert a correlation result with location into a first-class GeoEvent."""
        if corr.center_lat is None or corr.center_lon is None:
            return None
        return GeoEvent(
            type="hotspots",
            lat=corr.center_lat,
            lon=corr.center_lon,
            severity=corr.severity,
            metadata={
                "correlation_id": corr.id,
                "correlation_type": corr.correlation_type,
                "name": corr.description[:80],
                "event_count": len(corr.event_ids),
                "event_ids": corr.event_ids[:20],
            },
            source="geo_temporal_processor",
        )

    async def correlate(self, events: list[GeoEvent]) -> tuple[list[CorrelationResult], list[GeoEvent]]:
        """Run all correlation analyses. Returns (correlations, derived_geo_events)."""
        if not events:
            return [], []

        spatial = await self.spatial_cluster(events)
        temporal = await self.temporal_correlation(events)
        anomalies = await self.detect_anomalies(events)

        all_results = spatial + temporal + anomalies
        self._recent_correlations = all_results[-100:]

        # Emit derived GeoEvents for clusters with centroids
        derived_events = []
        for corr in all_results:
            geo_ev = self._to_geo_event(corr)
            if geo_ev:
                derived_events.append(geo_ev)

        logger.info(
            "Geo-Temporal processing complete: %d spatial, %d temporal, %d anomalies, %d derived events",
            len(spatial), len(temporal), len(anomalies), len(derived_events),
        )
        return all_results, derived_events
