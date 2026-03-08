import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from config import settings
from event_bus.EventStreamOrchestrator import EventStreamOrchestrator
from ingestion.aircraft_service import AircraftIngestionService
from ingestion.ship_service import ShipIngestionService
from ingestion.webcam_service import WebcamIngestionService
from ingestion.canary_service import CanaryService
from ingestion.news_service import NewsAggregationService
from ingestion.cii_service import CountryInstabilityService
from ingestion.telegram_service import TelegramOSINTService
from ingestion.oref_service import OREFAlertService
from ingestion.acled_gdelt_service import ACLEDGDELTService
from ingestion.infrastructure_service import InfrastructureService
from ingestion.fleet_service import FleetIntelligenceService
from ingestion.airport_service import AirportService

logger = logging.getLogger(__name__)


class IngestionScheduler:
    def __init__(self, event_bus: EventStreamOrchestrator) -> None:
        self.event_bus = event_bus
        self.scheduler = AsyncIOScheduler()
        self.aircraft_service = AircraftIngestionService(event_bus)
        self.ship_service = ShipIngestionService(event_bus)
        self.webcam_service = WebcamIngestionService(event_bus)
        self.canary_service = CanaryService(event_bus) if settings.CANARY_ENABLED else None
        self.news_service = NewsAggregationService()
        self.cii_service = CountryInstabilityService()
        self.telegram_service = TelegramOSINTService()
        self.oref_service = OREFAlertService()
        self.acled_gdelt_service = ACLEDGDELTService()
        self.infrastructure_service = InfrastructureService()
        self.fleet_service = FleetIntelligenceService()
        self.airport_service = AirportService()

    def start(self) -> None:
        interval = settings.INGESTION_INTERVAL_SECONDS

        self.scheduler.add_job(
            self._run_aircraft,
            trigger=IntervalTrigger(seconds=interval),
            id="aircraft_ingestion",
            name="Aircraft Ingestion",
            max_instances=1,
        )
        self.scheduler.add_job(
            self._run_ships,
            trigger=IntervalTrigger(seconds=interval),
            id="ship_ingestion",
            name="Ship Ingestion",
            max_instances=1,
        )
        self.scheduler.add_job(
            self._run_webcams,
            trigger=IntervalTrigger(seconds=interval * 2),
            id="webcam_ingestion",
            name="Webcam Ingestion",
            max_instances=1,
        )

        # Canary injection (Feature 2)
        if self.canary_service:
            self.scheduler.add_job(
                self._run_canary,
                trigger=IntervalTrigger(minutes=settings.CANARY_INTERVAL_MINUTES),
                id="canary_injection",
                name="Canary Injection",
                max_instances=1,
            )

        # News feed aggregation (every 15 minutes)
        self.scheduler.add_job(
            self._run_news,
            trigger=IntervalTrigger(minutes=15),
            id="news_aggregation",
            name="News Feed Aggregation",
            max_instances=1,
        )

        # CII computation (every 5 minutes)
        self.scheduler.add_job(
            self._run_cii,
            trigger=IntervalTrigger(minutes=5),
            id="cii_computation",
            name="Country Instability Index",
            max_instances=1,
        )

        # Telegram OSINT (every 10 minutes)
        self.scheduler.add_job(
            self._run_telegram,
            trigger=IntervalTrigger(minutes=10),
            id="telegram_osint",
            name="Telegram OSINT Feed",
            max_instances=1,
        )

        # OREF Rocket Alerts (every 30 seconds - time-critical)
        self.scheduler.add_job(
            self._run_oref,
            trigger=IntervalTrigger(seconds=30),
            id="oref_alerts",
            name="OREF Rocket Alerts",
            max_instances=1,
        )

        # ACLED/GDELT Conflict data (every 30 minutes)
        self.scheduler.add_job(
            self._run_conflicts,
            trigger=IntervalTrigger(minutes=30),
            id="conflict_tracking",
            name="ACLED/GDELT Conflict Tracking",
            max_instances=1,
        )

        # Infrastructure monitoring (every 10 minutes)
        self.scheduler.add_job(
            self._run_infrastructure,
            trigger=IntervalTrigger(minutes=10),
            id="infrastructure_monitor",
            name="Infrastructure & Cable Monitor",
            max_instances=1,
        )

        # Fleet intelligence (every 15 minutes)
        self.scheduler.add_job(
            self._run_fleet,
            trigger=IntervalTrigger(minutes=15),
            id="fleet_intel",
            name="Fleet Intelligence",
            max_instances=1,
        )

        # Airport status (every 5 minutes)
        self.scheduler.add_job(
            self._run_airports,
            trigger=IntervalTrigger(minutes=5),
            id="airport_status",
            name="Airport Status Monitor",
            max_instances=1,
        )

        self.scheduler.start()
        logger.info(
            "Ingestion scheduler started (interval=%ds)", interval
        )

    async def _run_aircraft(self) -> None:
        try:
            count = await self.aircraft_service.ingest()
            logger.info("Aircraft cycle: %d events ingested", count)
        except Exception as e:
            logger.error("Aircraft ingestion failed: %s", e, exc_info=True)

    async def _run_ships(self) -> None:
        try:
            count = await self.ship_service.ingest()
            logger.info("Ship cycle: %d events ingested", count)
        except Exception as e:
            logger.error("Ship ingestion failed: %s", e, exc_info=True)

    async def _run_webcams(self) -> None:
        try:
            count = await self.webcam_service.ingest()
            logger.info("Webcam cycle: %d events ingested", count)
        except Exception as e:
            logger.error("Webcam ingestion failed: %s", e, exc_info=True)

    async def _run_canary(self) -> None:
        try:
            event = await self.canary_service.inject_canary()
            logger.info("Canary injection cycle complete: event %s", event.id[:8])
        except Exception as e:
            logger.error("Canary injection failed: %s", e, exc_info=True)

    async def _run_news(self) -> None:
        try:
            digest = await self.news_service.aggregate_all()
            total = digest.get("meta", {}).get("total_items", 0)
            logger.info("News aggregation cycle: %d items from %d sources",
                        total, digest.get("meta", {}).get("sources_fetched", 0))
        except Exception as e:
            logger.error("News aggregation failed: %s", e, exc_info=True)

    async def _run_cii(self) -> None:
        try:
            # Get fresh news for CII computation
            from storage.db import query_events as db_query_events
            events_data = await db_query_events(limit=1000)
            digest = await self.news_service.aggregate_all()
            all_news = []
            for cat_items in digest.get("categories", {}).values():
                all_news.extend(cat_items)
            scores = await self.cii_service.compute_scores(events=events_data, news_items=all_news)
            logger.info("CII computation cycle: %d countries scored", len(scores))
        except Exception as e:
            logger.error("CII computation failed: %s", e, exc_info=True)

    async def _run_telegram(self) -> None:
        try:
            digest = await self.telegram_service.aggregate_channels()
            total = digest.get("meta", {}).get("total_items", 0)
            logger.info("Telegram OSINT cycle: %d items from %d channels",
                        total, digest.get("meta", {}).get("channels_fetched", 0))
        except Exception as e:
            logger.error("Telegram OSINT failed: %s", e, exc_info=True)

    async def _run_oref(self) -> None:
        try:
            alerts = await self.oref_service.get_active_alerts()
            if alerts.get("active"):
                logger.warning("OREF ACTIVE ALERTS: %d alerts in zones %s",
                               alerts["alert_count"], alerts.get("zones_affected", []))
        except Exception as e:
            logger.error("OREF alerts failed: %s", e, exc_info=True)

    async def _run_conflicts(self) -> None:
        try:
            data = await self.acled_gdelt_service.get_conflict_events(days=7)
            logger.info("Conflict tracking cycle: %d events (ACLED=%d, GDELT=%d)",
                        data.get("total_events", 0),
                        data.get("sources", {}).get("acled", 0),
                        data.get("sources", {}).get("gdelt", 0))
        except Exception as e:
            logger.error("Conflict tracking failed: %s", e, exc_info=True)

    async def _run_infrastructure(self) -> None:
        try:
            data = await self.infrastructure_service.get_infrastructure_overview()
            logger.info("Infrastructure cycle: health=%s, cables=%d, outages=%d",
                        data.get("health_status", "unknown"),
                        data.get("submarine_cables", {}).get("total_cables", 0),
                        data.get("internet_outages", {}).get("total_outages", 0))
        except Exception as e:
            logger.error("Infrastructure monitoring failed: %s", e, exc_info=True)

    async def _run_fleet(self) -> None:
        try:
            data = await self.fleet_service.get_fleet_positions()
            logger.info("Fleet intel cycle: %d groups, %d deployed",
                        data.get("total_groups", 0), data.get("deployed", 0))
        except Exception as e:
            logger.error("Fleet intelligence failed: %s", e, exc_info=True)

    async def _run_airports(self) -> None:
        try:
            data = await self.airport_service.get_airport_status()
            delayed = data.get("delayed", 0)
            if delayed > 0:
                logger.info("Airport status cycle: %d/%d airports delayed, %d ground stops",
                            delayed, data.get("total_airports", 0), data.get("ground_stops", 0))
        except Exception as e:
            logger.error("Airport monitoring failed: %s", e, exc_info=True)

    def stop(self) -> None:
        self.scheduler.shutdown(wait=False)
        logger.info("Ingestion scheduler stopped")
