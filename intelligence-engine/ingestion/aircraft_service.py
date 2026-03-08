import logging
from datetime import datetime, timezone

import httpx

from config import settings
from event_bus.EventStreamOrchestrator import EventStreamOrchestrator
from models.schemas import GeoEvent
from storage.db import store_event
from utils.rate_limiter import AsyncRateLimiter
from utils.retry import async_retry

logger = logging.getLogger(__name__)

rate_limiter = AsyncRateLimiter(rate=1, burst=2)


class AircraftIngestionService:
    def __init__(self, event_bus: EventStreamOrchestrator) -> None:
        self.event_bus = event_bus
        self.client = httpx.AsyncClient(timeout=30.0)
        self.source = "opensky"

    @async_retry(max_retries=3, base_delay=2.0, exceptions=(httpx.HTTPError,))
    async def _fetch_states(self) -> dict | None:
        await rate_limiter.acquire()
        params = {
            "lamin": settings.OPENSKY_BBOX_LAMIN,
            "lamax": settings.OPENSKY_BBOX_LAMAX,
            "lomin": settings.OPENSKY_BBOX_LOMIN,
            "lomax": settings.OPENSKY_BBOX_LOMAX,
        }
        resp = await self.client.get(settings.OPENSKY_API_URL, params=params)
        resp.raise_for_status()
        return resp.json()

    def _parse_state_vector(self, sv: list) -> GeoEvent | None:
        try:
            lon = sv[5]
            lat = sv[6]
            if lon is None or lat is None:
                return None

            callsign = (sv[1] or "").strip()
            return GeoEvent(
                type="aircraft",
                lat=float(lat),
                lon=float(lon),
                altitude=float(sv[7]) if sv[7] is not None else None,
                severity=1,
                metadata={
                    "callsign": callsign,
                    "icao24": sv[0],
                    "origin_country": sv[2] or "Unknown",
                    "velocity": sv[9],
                    "heading": sv[10],
                    "vertical_rate": sv[11],
                    "on_ground": sv[8],
                    "squawk": sv[14],
                },
                timestamp=datetime.now(timezone.utc).isoformat(),
                source=self.source,
            )
        except (IndexError, TypeError, ValueError) as e:
            logger.warning("Failed to parse state vector: %s", e)
            return None

    async def ingest(self) -> int:
        logger.info("Aircraft ingestion cycle starting")
        try:
            data = await self._fetch_states()
        except Exception as e:
            logger.error("Failed to fetch aircraft data: %s", e)
            return 0

        if not data or not data.get("states"):
            logger.warning("No aircraft states returned")
            return 0

        states = data["states"]
        # Limit to first 200 to avoid overwhelming the system
        states = states[:200]

        # Parse all events, then batch-publish
        events = []
        for sv in states:
            event = self._parse_state_vector(sv)
            if event:
                events.append(event)

        if events:
            try:
                await self.event_bus.publish_events_batch(events)
            except Exception as e:
                logger.error("Failed to batch-publish aircraft events: %s", e)

            for event in events:
                try:
                    await store_event(event)
                except Exception as e:
                    logger.error("Failed to store aircraft event %s: %s", event.id, e)

        logger.info("Aircraft ingestion complete: %d events", len(events))
        return len(events)

    async def close(self) -> None:
        await self.client.aclose()
