import logging
import random
from datetime import datetime, timezone

from event_bus.EventStreamOrchestrator import EventStreamOrchestrator
from models.schemas import GeoEvent
from storage.db import store_event

logger = logging.getLogger(__name__)

GLOBAL_WEBCAMS = [
    {"name": "Times Square NYC", "lat": 40.7580, "lon": -73.9855, "tags": ["landmark", "urban"]},
    {"name": "Shibuya Crossing Tokyo", "lat": 35.6595, "lon": 139.7004, "tags": ["landmark", "urban"]},
    {"name": "Eiffel Tower Paris", "lat": 48.8584, "lon": 2.2945, "tags": ["landmark", "monument"]},
    {"name": "Sydney Harbour", "lat": -33.8568, "lon": 151.2153, "tags": ["harbor", "landmark"]},
    {"name": "Port of Singapore", "lat": 1.2644, "lon": 103.8222, "tags": ["port", "maritime"]},
    {"name": "Port of Rotterdam", "lat": 51.9036, "lon": 4.4993, "tags": ["port", "maritime"]},
    {"name": "LAX Airport", "lat": 33.9425, "lon": -118.4081, "tags": ["airport", "aviation"]},
    {"name": "Heathrow Airport", "lat": 51.4700, "lon": -0.4543, "tags": ["airport", "aviation"]},
    {"name": "Dubai Marina", "lat": 25.0805, "lon": 55.1403, "tags": ["urban", "landmark"]},
    {"name": "Kremlin Moscow", "lat": 55.7520, "lon": 37.6175, "tags": ["landmark", "government"]},
    {"name": "Golden Gate Bridge", "lat": 37.8199, "lon": -122.4783, "tags": ["landmark", "bridge"]},
    {"name": "Panama Canal", "lat": 9.0800, "lon": -79.6800, "tags": ["infrastructure", "maritime"]},
    {"name": "Suez Canal", "lat": 30.4574, "lon": 32.3500, "tags": ["infrastructure", "maritime"]},
    {"name": "Strait of Hormuz", "lat": 26.5667, "lon": 56.2500, "tags": ["strait", "maritime"]},
    {"name": "Cape Town Harbor", "lat": -33.9062, "lon": 18.4216, "tags": ["port", "maritime"]},
    {"name": "Shanghai Port", "lat": 31.3600, "lon": 121.6200, "tags": ["port", "maritime"]},
    {"name": "Narita Airport Tokyo", "lat": 35.7647, "lon": 140.3864, "tags": ["airport", "aviation"]},
    {"name": "Brandenburg Gate Berlin", "lat": 52.5163, "lon": 13.3777, "tags": ["landmark", "monument"]},
    {"name": "Colosseum Rome", "lat": 41.8902, "lon": 12.4922, "tags": ["landmark", "monument"]},
    {"name": "Niagara Falls", "lat": 43.0962, "lon": -79.0377, "tags": ["landmark", "nature"]},
]


class WebcamIngestionService:
    def __init__(self, event_bus: EventStreamOrchestrator) -> None:
        self.event_bus = event_bus
        self.source = "webcam_sim"

    async def ingest(self) -> int:
        logger.info("Webcam ingestion cycle starting")

        events = []
        for cam in GLOBAL_WEBCAMS:
            status = random.choices(
                ["online", "online", "online", "degraded", "offline"],
                weights=[60, 20, 10, 7, 3],
            )[0]

            severity = 1
            if status == "degraded":
                severity = 2
            elif status == "offline":
                severity = 3

            events.append(GeoEvent(
                type="webcam",
                lat=cam["lat"] + random.gauss(0, 0.0001),
                lon=cam["lon"] + random.gauss(0, 0.0001),
                severity=severity,
                metadata={
                    "name": cam["name"],
                    "url": f"https://cams.example.com/{cam['name'].lower().replace(' ', '_')}",
                    "status": status,
                    "resolution": random.choice(["720p", "1080p", "4K"]),
                    "fps": random.choice([15, 24, 30]),
                    "tags": cam["tags"],
                },
                timestamp=datetime.now(timezone.utc).isoformat(),
                source=self.source,
            ))

        if events:
            try:
                await self.event_bus.publish_events_batch(events)
            except Exception as e:
                logger.error("Failed to batch-publish webcam events: %s", e)

            for event in events:
                try:
                    await store_event(event)
                except Exception as e:
                    logger.error("Failed to store webcam event %s: %s", event.id, e)

        logger.info("Webcam ingestion complete: %d events", len(events))
        return len(events)
