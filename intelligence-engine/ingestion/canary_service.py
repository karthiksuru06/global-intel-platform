"""
Canary Event Injection Service (Feature 2).
Generates synthetic honeypot events with HMAC-signed fingerprints
for data exfiltration detection.
"""
import hashlib
import hmac as hmac_mod
import json
import logging
import random
import uuid
from datetime import datetime, timezone
from typing import Optional

import redis.asyncio as aioredis

from config import settings
from event_bus.EventStreamOrchestrator import EventStreamOrchestrator
from models.schemas import GeoEvent

logger = logging.getLogger(__name__)


class CanaryService:
    def __init__(self, event_bus: EventStreamOrchestrator) -> None:
        self.event_bus = event_bus
        self._secret = settings.CANARY_SECRET.encode()
        self._redis: Optional[aioredis.Redis] = None

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    def _generate_canary_id(self, event_uuid: str, timestamp: str) -> str:
        """Generate HMAC-signed canary fingerprint."""
        nonce = uuid.uuid4().hex[:16]
        payload = f"{event_uuid}:{timestamp}:{nonce}"
        return hmac_mod.new(self._secret, payload.encode(), hashlib.sha256).hexdigest()

    def _generate_canary_signature(self, canary_id: str, event_data: str) -> str:
        """Sign the canary_id + event data to prove authenticity."""
        return hmac_mod.new(
            self._secret, f"{canary_id}:{event_data}".encode(), hashlib.sha256
        ).hexdigest()[:32]

    async def inject_canary(self) -> GeoEvent:
        """Create and inject a single canary event into the full pipeline."""
        event_uuid = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()
        canary_id = self._generate_canary_id(event_uuid, timestamp)

        lat = round(random.uniform(-60.0, 60.0), 4)
        lon = round(random.uniform(-180.0, 180.0), 4)

        event = GeoEvent(
            id=event_uuid,
            type="canary",
            lat=lat,
            lon=lon,
            altitude=round(random.uniform(0, 12000), 1),
            severity=random.randint(1, 3),
            metadata={
                "_canary_id": canary_id,
                "_canary_sig": self._generate_canary_signature(canary_id, event_uuid),
                "description": "Synthetic monitoring event",
            },
            timestamp=timestamp,
            source="canary_service",
        )

        # Publish through the full pipeline (Redis stream -> API Gateway -> WebSocket)
        await self.event_bus.publish_event(event)

        # Register in canary registry
        r = await self._get_redis()
        registry_entry = {
            "injection_timestamp": timestamp,
            "expected_ttl_minutes": settings.CANARY_INTERVAL_MINUTES * 4,
            "lat": event.lat,
            "lon": event.lon,
            "event_id": event_uuid,
            "tripped": False,
            "tripped_at": None,
            "tripped_source": None,
        }
        await r.hset("canary_registry", canary_id, json.dumps(registry_entry))

        logger.info("CANARY INJECTED: id=%s, canary_id=%s", event_uuid, canary_id[:12])
        return event

    async def check_canary_status(self) -> list[dict]:
        """Return all active canaries and their status."""
        r = await self._get_redis()
        all_canaries = await r.hgetall("canary_registry")
        results = []
        for canary_id, entry_json in all_canaries.items():
            entry = json.loads(entry_json)
            entry["canary_id"] = canary_id
            results.append(entry)
        return results

    async def trip_canary(self, canary_id: str, detection_source: str) -> bool:
        """Mark a canary as tripped (exfiltration detected)."""
        r = await self._get_redis()
        entry_json = await r.hget("canary_registry", canary_id)
        if not entry_json:
            return False
        entry = json.loads(entry_json)
        entry["tripped"] = True
        entry["tripped_at"] = datetime.now(timezone.utc).isoformat()
        entry["tripped_source"] = detection_source
        await r.hset("canary_registry", canary_id, json.dumps(entry))
        logger.critical(
            "CANARY TRIPPED: %s detected in %s", canary_id[:12], detection_source
        )
        return True
