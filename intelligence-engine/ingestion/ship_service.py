import logging
import math
import random
from datetime import datetime, timezone

from event_bus.EventStreamOrchestrator import EventStreamOrchestrator
from models.schemas import GeoEvent
from storage.db import store_event

logger = logging.getLogger(__name__)

# Major shipping lanes as waypoint sequences
SHIPPING_LANES = [
    # Strait of Malacca
    {"name": "Malacca Strait", "points": [(1.2, 103.8), (2.5, 101.5), (4.0, 99.0), (5.5, 97.0)]},
    # Suez Canal approach
    {"name": "Suez Approach", "points": [(30.0, 32.5), (31.5, 32.3), (33.0, 33.0)]},
    # English Channel
    {"name": "English Channel", "points": [(50.0, -2.0), (50.5, 0.0), (51.0, 1.5)]},
    # South China Sea
    {"name": "South China Sea", "points": [(10.0, 110.0), (14.0, 114.0), (18.0, 117.0), (22.0, 118.0)]},
    # Panama Canal approach
    {"name": "Panama Approach", "points": [(8.5, -79.5), (9.0, -79.5), (9.3, -80.0)]},
    # Cape of Good Hope
    {"name": "Cape of Good Hope", "points": [(-34.5, 18.5), (-34.0, 20.0), (-33.0, 22.0)]},
    # US East Coast
    {"name": "US East Coast", "points": [(25.0, -80.0), (30.0, -78.0), (36.0, -75.0), (40.5, -73.5)]},
    # Mediterranean
    {"name": "Mediterranean", "points": [(36.0, -5.5), (37.0, 0.0), (38.0, 5.0), (39.0, 10.0), (37.5, 15.0)]},
]

VESSEL_TYPES = [
    "Cargo", "Tanker", "Container Ship", "Bulk Carrier", "Passenger",
    "Fishing", "Tug", "Military", "Sailing", "Pleasure Craft",
]


class ShipIngestionService:
    def __init__(self, event_bus: EventStreamOrchestrator) -> None:
        self.event_bus = event_bus
        self.source = "ais_sim"
        self._ship_registry: dict[str, dict] = {}
        self._initialized = False

    def _initialize_ships(self) -> None:
        """Generate persistent ship identities along shipping lanes."""
        for lane in SHIPPING_LANES:
            num_ships = random.randint(3, 8)
            for _ in range(num_ships):
                mmsi = str(random.randint(200000000, 799999999))
                t = random.random()
                points = lane["points"]
                seg_idx = int(t * (len(points) - 1))
                seg_idx = min(seg_idx, len(points) - 2)
                seg_t = (t * (len(points) - 1)) - seg_idx

                lat = points[seg_idx][0] + seg_t * (points[seg_idx + 1][0] - points[seg_idx][0])
                lon = points[seg_idx][1] + seg_t * (points[seg_idx + 1][1] - points[seg_idx][1])

                self._ship_registry[mmsi] = {
                    "mmsi": mmsi,
                    "vessel_name": f"MV {lane['name'][:3].upper()}-{random.randint(100, 999)}",
                    "vessel_type": random.choice(VESSEL_TYPES),
                    "lane": lane["name"],
                    "lat": lat,
                    "lon": lon,
                    "speed": random.uniform(5.0, 22.0),
                    "heading": random.uniform(0, 360),
                    "destination": random.choice(["Singapore", "Rotterdam", "Shanghai", "Houston", "Dubai", "Busan"]),
                }
        self._initialized = True

    def _update_positions(self) -> None:
        """Drift each ship slightly along its heading."""
        for ship in self._ship_registry.values():
            drift_nm = (ship["speed"] / 3600) * 30  # distance in 30 seconds
            drift_deg = drift_nm / 60  # rough conversion
            heading_rad = math.radians(ship["heading"])
            ship["lat"] += drift_deg * math.cos(heading_rad) + random.gauss(0, 0.001)
            ship["lon"] += drift_deg * math.sin(heading_rad) + random.gauss(0, 0.001)
            ship["lat"] = max(-90, min(90, ship["lat"]))
            ship["lon"] = max(-180, min(180, ship["lon"]))
            ship["speed"] += random.gauss(0, 0.3)
            ship["speed"] = max(0.5, min(30.0, ship["speed"]))
            ship["heading"] += random.gauss(0, 2.0)
            ship["heading"] %= 360

    async def ingest(self) -> int:
        logger.info("Ship ingestion cycle starting")
        if not self._initialized:
            self._initialize_ships()

        self._update_positions()

        # Collect all events, then batch-publish
        events = []
        for ship in self._ship_registry.values():
            events.append(GeoEvent(
                type="ship",
                lat=round(ship["lat"], 6),
                lon=round(ship["lon"], 6),
                severity=1,
                metadata={
                    "mmsi": ship["mmsi"],
                    "vessel_name": ship["vessel_name"],
                    "vessel_type": ship["vessel_type"],
                    "speed": round(ship["speed"], 1),
                    "heading": round(ship["heading"], 1),
                    "destination": ship["destination"],
                    "lane": ship["lane"],
                },
                timestamp=datetime.now(timezone.utc).isoformat(),
                source=self.source,
            ))

        if events:
            try:
                await self.event_bus.publish_events_batch(events)
            except Exception as e:
                logger.error("Failed to batch-publish ship events: %s", e)

            for event in events:
                try:
                    await store_event(event)
                except Exception as e:
                    logger.error("Failed to store ship event %s: %s", event.id, e)

        logger.info("Ship ingestion complete: %d events", len(events))
        return len(events)
