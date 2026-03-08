import json
import logging
from typing import Optional

import redis.asyncio as aioredis

from config import settings
from models.schemas import GeoEvent

logger = logging.getLogger(__name__)


class EventStreamOrchestrator:
    def __init__(self) -> None:
        self._client: Optional[aioredis.Redis] = None
        self.stream_name = settings.REDIS_STREAM_NAME
        self.consumer_group = settings.REDIS_CONSUMER_GROUP

    async def connect(self) -> None:
        self._client = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            max_connections=20,
        )
        await self._client.ping()
        logger.info("Connected to Redis at %s", settings.REDIS_URL)

    async def disconnect(self) -> None:
        if self._client:
            await self._client.aclose()
            logger.info("Disconnected from Redis")

    async def create_consumer_group(self) -> None:
        try:
            await self._client.xgroup_create(
                self.stream_name,
                self.consumer_group,
                id="0",
                mkstream=True,
            )
            logger.info(
                "Created consumer group '%s' on stream '%s'",
                self.consumer_group,
                self.stream_name,
            )
        except aioredis.ResponseError as e:
            if "BUSYGROUP" in str(e):
                logger.debug("Consumer group '%s' already exists", self.consumer_group)
            else:
                raise

    async def publish_event(self, event: GeoEvent) -> str:
        payload = {
            "data": event.model_dump_json(),
            "type": event.type,
            "severity": str(event.severity or 0),
        }
        message_id = await self._client.xadd(
            self.stream_name,
            payload,
            maxlen=10000,
            approximate=True,
        )
        logger.debug("Published event %s to stream (msg_id=%s)", event.id, message_id)
        return message_id

    async def publish_events_batch(self, events: list[GeoEvent]) -> int:
        """Publish multiple events in a single Redis pipeline for efficiency."""
        if not events:
            return 0
        pipe = self._client.pipeline(transaction=False)
        for event in events:
            payload = {
                "data": event.model_dump_json(),
                "type": event.type,
                "severity": str(event.severity or 0),
            }
            pipe.xadd(self.stream_name, payload, maxlen=10000, approximate=True)
        results = await pipe.execute()
        logger.info("Batch published %d events to stream", len(results))
        return len(results)

    async def read_events(
        self,
        consumer_name: str,
        count: int = 10,
        block_ms: int = 2000,
    ) -> list[GeoEvent]:
        results = await self._client.xreadgroup(
            groupname=self.consumer_group,
            consumername=consumer_name,
            streams={self.stream_name: ">"},
            count=count,
            block=block_ms,
        )

        events = []
        if results:
            for _stream, messages in results:
                for msg_id, fields in messages:
                    try:
                        event = GeoEvent.model_validate_json(fields["data"])
                        events.append(event)
                        await self._client.xack(
                            self.stream_name, self.consumer_group, msg_id
                        )
                    except Exception as e:
                        logger.error("Failed to parse event from stream: %s", e)

        return events

    async def get_stream_info(self) -> dict:
        try:
            info = await self._client.xinfo_stream(self.stream_name)
            return {
                "length": info.get("length", 0),
                "first_entry": info.get("first-entry"),
                "last_entry": info.get("last-entry"),
                "groups": info.get("groups", 0),
            }
        except aioredis.ResponseError:
            return {"length": 0, "first_entry": None, "last_entry": None, "groups": 0}

    async def publish_insight(self, insight_data: dict) -> str:
        """Publish an AI insight or correlation to the insights stream."""
        payload = {
            "data": json.dumps(insight_data),
            "type": "insight",
        }
        message_id = await self._client.xadd(
            "intel_insights",
            payload,
            maxlen=500,
            approximate=True,
        )
        logger.debug("Published insight to intel_insights stream (msg_id=%s)", message_id)
        return message_id

    async def trim_streams(self) -> None:
        """Periodic trim to enforce stream size limits."""
        try:
            trimmed_events = await self._client.xtrim(
                self.stream_name, maxlen=10000, approximate=True
            )
            trimmed_insights = await self._client.xtrim(
                "intel_insights", maxlen=500, approximate=True
            )
            if trimmed_events or trimmed_insights:
                logger.info(
                    "Stream trim: geo_events=%d, intel_insights=%d entries removed",
                    trimmed_events, trimmed_insights,
                )
        except Exception as e:
            logger.error("Stream trim failed: %s", e)

    async def publish_raw(self, channel: str, data: dict) -> None:
        await self._client.publish(channel, json.dumps(data))
