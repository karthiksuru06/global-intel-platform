import asyncio
import hashlib
import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

import redis.asyncio as aioredis
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from analysis.PatternCorrelationEngine import PatternCorrelationEngine
from analysis.GeoTemporalProcessor import GeoTemporalProcessor
from config import settings
from event_bus.EventStreamOrchestrator import EventStreamOrchestrator
from ingestion.scheduler import IngestionScheduler
from ingestion.news_service import NewsAggregationService
from ingestion.cii_service import CountryInstabilityService
from ingestion.finance_service import FinanceService
from ingestion.telegram_service import TelegramOSINTService
from ingestion.oref_service import OREFAlertService
from ingestion.gnss_service import GNSSJammingService
from ingestion.travel_advisory_service import TravelAdvisoryService
from ingestion.acled_gdelt_service import ACLEDGDELTService
from ingestion.infrastructure_service import InfrastructureService
from ingestion.polymarket_service import PolymarketService
from ingestion.fleet_service import FleetIntelligenceService
from ingestion.airport_service import AirportService
from models.schemas import AIInsight, CorrelationResult, GeoEvent, GeoEventCreate
from storage.anchor_replicator import AnchorReplicator
from storage.db import init_db, query_events, query_events_in_bbox, query_events_in_radius, store_event
from utils.structured_logging import setup_structured_logging

setup_structured_logging(level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)

# Shared service instances
event_bus = EventStreamOrchestrator()
geo_processor = GeoTemporalProcessor()
pattern_engine = PatternCorrelationEngine()
anchor_replicator = AnchorReplicator()
pattern_engine._anchor_replicator = anchor_replicator
ingestion_scheduler = IngestionScheduler(event_bus)
news_service = NewsAggregationService()
cii_service = CountryInstabilityService()
finance_service = FinanceService()
telegram_service = TelegramOSINTService()
oref_service = OREFAlertService()
gnss_service = GNSSJammingService()
travel_advisory_service = TravelAdvisoryService()
acled_gdelt_service = ACLEDGDELTService()
infrastructure_service = InfrastructureService()
polymarket_service = PolymarketService()
fleet_service = FleetIntelligenceService()
airport_service = AirportService()

_correlation_task: Optional[asyncio.Task] = None
_break_glass_expiry_task: Optional[asyncio.Task] = None

# Feature 1: Shared Redis client for token revocation checks
_revocation_redis: Optional[aioredis.Redis] = None


async def _get_revocation_redis() -> aioredis.Redis:
    global _revocation_redis
    if _revocation_redis is None:
        _revocation_redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _revocation_redis


async def _check_token_revocation(api_key: str) -> bool:
    """Returns True if the token is revoked."""
    if not api_key:
        return False
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    try:
        r = await _get_revocation_redis()
        score = await r.zscore("revoked_tokens", key_hash)
        if score is not None:
            if score == 0 or score > time.time():
                return True
            await r.zrem("revoked_tokens", key_hash)
    except Exception as e:
        logger.error("Revocation check failed (FAIL-OPEN): %s", e)
    return False


async def _run_break_glass_expiry_loop() -> None:
    """Background loop that checks and expires timed-out break-glass sessions."""
    while True:
        try:
            await asyncio.sleep(60)
            expired = pattern_engine.check_break_glass_expiry()
            if expired:
                logger.info("Break-glass expiry check: expired %d sessions", len(expired))
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Break-glass expiry loop error: %s", e)


async def _run_correlation_loop() -> None:
    """Background loop that runs correlation and AI analysis periodically."""
    while True:
        try:
            await asyncio.sleep(settings.CORRELATION_INTERVAL_SECONDS)
            events_data = await query_events(limit=500)
            events = [
                GeoEvent(
                    id=e["id"],
                    type=e["type"],
                    lat=e["lat"],
                    lon=e["lon"],
                    altitude=e.get("altitude"),
                    severity=e.get("severity"),
                    metadata=e.get("metadata", {}),
                    timestamp=e["timestamp"],
                    source=e["source"],
                )
                for e in events_data
            ]

            if events:
                correlations, derived_events = await geo_processor.correlate(events)
                insights, insight_events = await pattern_engine.analyze_events(events)

                # Publish derived GeoEvents from correlations
                if derived_events:
                    try:
                        await event_bus.publish_events_batch(derived_events)
                        for dev in derived_events:
                            await store_event(dev)
                    except Exception as pub_err:
                        logger.error("Failed to publish derived events: %s", pub_err)

                # Publish derived GeoEvents from AI insights
                if insight_events:
                    try:
                        await event_bus.publish_events_batch(insight_events)
                        for iev in insight_events:
                            await store_event(iev)
                    except Exception as pub_err:
                        logger.error("Failed to publish insight events: %s", pub_err)

                # Publish insights to Redis so Node gateway can forward to frontend
                for insight in insights:
                    try:
                        await event_bus.publish_insight(insight.model_dump())
                    except Exception as pub_err:
                        logger.error("Failed to publish insight: %s", pub_err)

                for corr in correlations[:10]:  # Top 10 correlations
                    try:
                        await event_bus.publish_insight({
                            **corr.model_dump(),
                            "category": corr.correlation_type,
                            "title": corr.description[:80],
                        })
                    except Exception as pub_err:
                        logger.error("Failed to publish correlation: %s", pub_err)

                logger.info(
                    "Correlation cycle: %d correlations, %d insights, %d derived events published",
                    len(correlations), len(insights),
                    len(derived_events) + len(insight_events),
                )

            # Periodic stream trimming
            await event_bus.trim_streams()

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Correlation loop error: %s", e, exc_info=True)
            await asyncio.sleep(10)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _correlation_task, _break_glass_expiry_task

    logger.info("Starting Intelligence Engine...")

    # Initialize database
    try:
        await init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.error("Database init failed: %s", e)

    # Connect Redis event bus
    try:
        await event_bus.connect()
        await event_bus.create_consumer_group()
        logger.info("Redis event bus connected")
    except Exception as e:
        logger.error("Redis connection failed: %s", e)

    # Start ingestion scheduler
    ingestion_scheduler.start()

    # Start correlation background task
    _correlation_task = asyncio.create_task(_run_correlation_loop())

    # Start break-glass expiry background task (Feature 4)
    _break_glass_expiry_task = asyncio.create_task(_run_break_glass_expiry_loop())

    logger.info("Intelligence Engine fully started")
    yield

    # Shutdown
    logger.info("Shutting down Intelligence Engine...")
    if _correlation_task:
        _correlation_task.cancel()
        try:
            await _correlation_task
        except asyncio.CancelledError:
            pass
    if _break_glass_expiry_task:
        _break_glass_expiry_task.cancel()
        try:
            await _break_glass_expiry_task
        except asyncio.CancelledError:
            pass
    ingestion_scheduler.stop()
    await event_bus.disconnect()
    logger.info("Intelligence Engine stopped")


app = FastAPI(
    title="Global Intelligence Engine",
    version="1.0.0",
    lifespan=lifespan,
)

# Sovereign Grade Governance (v2.9.4): Strict CORS Restrictions
ALLOWED_ORIGINS = [
    "http://localhost:5173", 
    "http://localhost:3001" # API Gateway
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Feature 1: Token Revocation Middleware
class TokenRevocationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        api_key = request.headers.get("x-api-key")
        if api_key and await _check_token_revocation(api_key):
            return JSONResponse(
                status_code=401,
                content={"success": False, "error": "TOKEN_REVOKED: Credential revoked by governance action."},
            )
        return await call_next(request)


app.add_middleware(TokenRevocationMiddleware)


@app.get("/health")
async def health():
    try:
        stream_info = await event_bus.get_stream_info()
        redis_ok = True
    except Exception:
        stream_info = {}
        redis_ok = False

    return {
        "status": "healthy" if redis_ok else "degraded",
        "service": "intelligence-engine",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "redis_connected": redis_ok,
        "stream_info": stream_info,
    }


@app.get("/events")
async def get_events(
    type: Optional[str] = Query(None, description="Filter by event type"),
    severity: Optional[int] = Query(None, ge=1, le=5, description="Minimum severity"),
    since: Optional[str] = Query(None, description="ISO timestamp to filter from"),
    bbox: Optional[str] = Query(None, description="Bounding box: lamin,lomin,lamax,lomax"),
    limit: int = Query(200, ge=1, le=1000),
):
    bbox_tuple = None
    if bbox:
        try:
            parts = [float(x.strip()) for x in bbox.split(",")]
            if len(parts) != 4:
                raise ValueError
            bbox_tuple = tuple(parts)
        except (ValueError, TypeError):
            raise HTTPException(400, "bbox must be 4 comma-separated floats: lamin,lomin,lamax,lomax")

    events = await query_events(
        event_type=type,
        severity_min=severity,
        since=since,
        bbox=bbox_tuple,
        limit=limit,
    )
    return {"success": True, "count": len(events), "events": events}


@app.get("/events/bbox")
async def get_events_bbox(
    lamin: float = Query(..., ge=-90, le=90, description="South latitude"),
    lomin: float = Query(..., ge=-180, le=180, description="West longitude"),
    lamax: float = Query(..., ge=-90, le=90, description="North latitude"),
    lomax: float = Query(..., ge=-180, le=180, description="East longitude"),
    type: Optional[str] = Query(None),
    limit: int = Query(500, ge=1, le=2000),
):
    """Spatial bounding box query using PostGIS GIST index."""
    events = await query_events_in_bbox(lamin, lomin, lamax, lomax, event_type=type, limit=limit)
    return {"success": True, "count": len(events), "events": events}


@app.get("/events/nearby")
async def get_events_nearby(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(50, ge=0.1, le=20000),
    limit: int = Query(100, ge=1, le=500),
):
    events = await query_events_in_radius(lat, lon, radius_km, limit)
    return {"success": True, "count": len(events), "events": events}


@app.get("/events/{event_id}")
async def get_event_by_id(event_id: str):
    events = await query_events(limit=1)
    for ev in events:
        if ev["id"] == event_id:
            return {"success": True, "event": ev}
    raise HTTPException(404, f"Event {event_id} not found")


@app.post("/events")
async def create_event(body: GeoEventCreate):
    event = GeoEvent(
        type=body.type,
        lat=body.lat,
        lon=body.lon,
        altitude=body.altitude,
        severity=body.severity,
        metadata=body.metadata,
        source=body.source,
    )
    await event_bus.publish_event(event)
    await store_event(event)
    return {"success": True, "event_id": event.id}


@app.get("/correlations")
async def get_correlations():
    results = geo_processor.correlations
    return {
        "success": True,
        "count": len(results),
        "correlations": [r.model_dump() for r in results],
    }


@app.get("/insights")
async def get_insights():
    results = pattern_engine.insights
    return {
        "success": True,
        "count": len(results),
        "insights": [r.model_dump() for r in results],
    }


# ── Sovereign Governance API (v2.9.4) ──

@app.post("/governance/quarantine")
async def governance_quarantine(
    source: str, 
    auditor_key: str, 
    reason: str, 
    evidence: str
):
    """Secure Governance Lever: Instantly neutralize a compromised data source."""
    try:
        pattern_engine.emergency_quarantine_source(source, auditor_key, reason, evidence)
        return {"success": True, "action": "QUARANTINE_ENGAGED", "source": source}
    except Exception as e:
        logger.error("Governance operation failed: %s", e)
        raise HTTPException(500, str(e))


@app.post("/governance/restore")
async def governance_restore(
    source: str, 
    auditor_key: str, 
    reason: str, 
    evidence: str
):
    """Symmetric Governance: Restore source reputation based on verified audit clearing."""
    try:
        pattern_engine.restore_source_reputation(source, auditor_key, reason, evidence)
        return {"success": True, "action": "QUARANTINE_RESTORATION", "source": source}
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except Exception as e:
        logger.error("Governance operation failed: %s", e)
        raise HTTPException(500, str(e))


@app.post("/governance/break-glass")
async def governance_break_glass(request: Request):
    """Graduated Break-Glass Override (v3.0): 3-tier emergency access system."""
    try:
        body = await request.json()
        tier = int(body.get("tier", 3))
        breaker_key = body.get("breaker_key", "")
        sources = body.get("sources", "")
        source = body.get("source", "")
        reason = body.get("reason", "")
        bypass_token = body.get("bypass_token")
        secondary_auth = body.get("secondary_auth")

        # Legacy compatibility: if 'source' is passed instead of 'sources'
        if isinstance(sources, list):
            source_list = [s.strip() for s in sources if s.strip()]
        else:
            source_list = [s.strip() for s in (sources or source or "").split(",") if s.strip()]
        if not source_list:
            raise HTTPException(400, "At least one source must be specified.")
        session = pattern_engine.break_glass_activate(
            tier=tier, breaker_key=breaker_key, sources=source_list,
            reason=reason, bypass_token=bypass_token, secondary_auth=secondary_auth,
        )
        return {"success": True, "action": f"BREAK_GLASS_T{tier}_ACTIVATED", "session": session}
    except HTTPException:
        raise
    except PermissionError as e:
        raise HTTPException(403, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/governance/freeze")
async def governance_freeze(auditor_key: str):
    """Institutional Sovereign Constraint: Freeze all model parameters against drift."""
    try:
        pattern_engine.freeze_model(auditor_key)
        return {"success": True, "action": "MODEL_FROZEN"}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/governance/audit")
async def get_governance_audit():
    """Forensic Log Retrieval for 6-month trial performance analysis."""
    return {
        "success": True,
        "fingerprint": pattern_engine._model_fingerprint,
        "log_entries": len(pattern_engine._governance_log),
        "audit_trail": pattern_engine._governance_log
    }


# ── Feature 1: Token Revocation Endpoints ──

@app.post("/governance/revoke-token")
async def governance_revoke_token(
    target_key_hash: str,
    reason: str,
    ttl_hours: int = 0,
):
    """Revoke an API token by its SHA-256 hash."""
    if len(target_key_hash) != 64:
        raise HTTPException(400, "target_key_hash must be a 64-char SHA-256 hex string.")
    try:
        r = await _get_revocation_redis()
        expiry_score = time.time() + (ttl_hours * 3600) if ttl_hours else 0
        await r.zadd("revoked_tokens", {target_key_hash: expiry_score})
        await r.hset(f"revoked_tokens_meta:{target_key_hash}", mapping={
            "revoked_at": datetime.now(timezone.utc).isoformat(),
            "reason": reason,
        })
        pattern_engine._log_governance_action(
            "TOKEN_REVOKED", target_key_hash[:8], "API", reason, "DIRECT",
        )
        return {"success": True, "action": "TOKEN_REVOKED"}
    except Exception as e:
        raise HTTPException(503, f"Revocation write failed: {e}")


@app.post("/governance/unrevoke-token")
async def governance_unrevoke_token(target_key_hash: str, reason: str):
    """Remove a token from the revocation blacklist."""
    if len(target_key_hash) != 64:
        raise HTTPException(400, "target_key_hash must be a 64-char SHA-256 hex string.")
    try:
        r = await _get_revocation_redis()
        removed = await r.zrem("revoked_tokens", target_key_hash)
        await r.delete(f"revoked_tokens_meta:{target_key_hash}")
        pattern_engine._log_governance_action(
            "TOKEN_UNREVOKED", target_key_hash[:8], "API", reason, "DIRECT",
        )
        return {"success": True, "action": "TOKEN_UNREVOKED" if removed else "TOKEN_NOT_FOUND"}
    except Exception as e:
        raise HTTPException(503, f"Unrevocation failed: {e}")


# ── Feature 2: Canary Status Endpoints ──

@app.get("/governance/canary-status")
async def governance_canary_status():
    """Return all active canaries and their trip status."""
    if not ingestion_scheduler.canary_service:
        return {"success": True, "canaries": [], "message": "Canary system disabled"}
    canaries = await ingestion_scheduler.canary_service.check_canary_status()
    tripped = [c for c in canaries if c.get("tripped")]
    return {
        "success": True,
        "total_active": len(canaries),
        "total_tripped": len(tripped),
        "canaries": canaries,
        "alert": len(tripped) > 0,
    }


@app.post("/governance/canary-trip")
async def governance_canary_trip(request: Request):
    """Manually trip a canary (e.g., external detection system reports exfiltration)."""
    body = await request.json()
    canary_id = body.get("canary_id", "")
    detection_source = body.get("detection_source", "unknown")
    if not canary_id:
        raise HTTPException(400, "canary_id is required.")
    if not ingestion_scheduler.canary_service:
        raise HTTPException(503, "Canary system disabled")
    success = await ingestion_scheduler.canary_service.trip_canary(canary_id, detection_source)
    if not success:
        raise HTTPException(404, f"Canary {canary_id[:12]} not found in registry")
    return {"success": True, "action": "CANARY_TRIPPED", "canary_id": canary_id[:12]}


# ── Feature 3: Anchor Integrity Endpoint ──

@app.get("/governance/anchor-integrity")
async def governance_anchor_integrity():
    """Cross-check anchor consistency across all replicas (local, Redis, S3)."""
    try:
        result = await anchor_replicator.verify_integrity()
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(500, f"Anchor integrity check failed: {e}")


# ── Feature 4: Break-Glass Status Endpoints ──

@app.get("/governance/break-glass-status")
async def governance_break_glass_status():
    """Return all break-glass sessions (active and expired)."""
    sessions = pattern_engine.get_active_break_glass_sessions()
    active = [s for s in sessions if s.get("active")]
    return {
        "success": True,
        "total_sessions": len(sessions),
        "active_sessions": len(active),
        "sessions": sessions,
    }


@app.post("/governance/break-glass-deactivate")
async def governance_break_glass_deactivate(request: Request):
    """Manually deactivate a break-glass session."""
    body = await request.json()
    session_id = body.get("session_id", "")
    if not session_id:
        raise HTTPException(400, "session_id is required.")
    success = pattern_engine.break_glass_deactivate(session_id)
    if not success:
        raise HTTPException(404, f"Session {session_id} not found or already inactive.")
    return {"success": True, "action": "BREAK_GLASS_DEACTIVATED", "session_id": session_id}


# ── News Feed Aggregation Endpoints ──

@app.get("/news")
async def get_news(
    lang: Optional[str] = Query(None, description="Language filter (en, fr, es, ar, zh)"),
    category: Optional[str] = Query(None, description="Category filter"),
):
    """Aggregated news digest from 80+ RSS feeds with threat classification."""
    digest = await news_service.aggregate_all(lang_filter=lang)
    if category and category in digest.get("categories", {}):
        return {
            "success": True,
            "category": category,
            "items": digest["categories"][category],
            "meta": digest.get("meta", {}),
        }
    return {"success": True, **digest}


@app.get("/news/breaking")
async def get_breaking_news():
    """Top critical/high severity news items."""
    items = await news_service.get_breaking()
    return {"success": True, "count": len(items), "items": items}


@app.get("/news/search")
async def search_news(q: str = Query(..., min_length=2), limit: int = Query(20, ge=1, le=100)):
    """Search news items by keyword."""
    results = await news_service.search(q, limit=limit)
    return {"success": True, "count": len(results), "query": q, "items": results}


# ── Country Instability Index (CII) Endpoints ──

@app.get("/cii")
async def get_cii_scores():
    """Get latest Country Instability Index scores for all tracked countries."""
    scores = await cii_service.get_cached_scores()
    if not scores:
        # Compute fresh scores
        events_data = await query_events(limit=1000)
        digest = await news_service.aggregate_all()
        all_news = []
        for cat_items in digest.get("categories", {}).values():
            all_news.extend(cat_items)
        scores = await cii_service.compute_scores(events=events_data, news_items=all_news)
    return {
        "success": True,
        "count": len(scores),
        "scores": scores,
    }


@app.get("/cii/top")
async def get_cii_top(n: int = Query(10, ge=1, le=50)):
    """Get top N highest-risk countries by CII score."""
    top = await cii_service.get_top_risk(n)
    if not top:
        # Trigger computation
        events_data = await query_events(limit=1000)
        digest = await news_service.aggregate_all()
        all_news = []
        for cat_items in digest.get("categories", {}).values():
            all_news.extend(cat_items)
        await cii_service.compute_scores(events=events_data, news_items=all_news)
        top = await cii_service.get_top_risk(n)
    return {"success": True, "count": len(top), "countries": top}


# ── Finance & Market Data Endpoints ──

@app.get("/finance/crypto")
async def get_crypto():
    """Real-time cryptocurrency prices from CoinGecko."""
    return await finance_service.get_crypto_prices()


@app.get("/finance/fear-greed")
async def get_fear_greed():
    """Crypto Fear & Greed Index with 30-day history."""
    return await finance_service.get_fear_greed()


@app.get("/finance/overview")
async def get_finance_overview():
    """Combined market overview: crypto, indices, sentiment."""
    return await finance_service.get_market_overview()


# ── Telegram OSINT Endpoints ──

@app.get("/telegram")
async def get_telegram_feed(
    region: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
):
    """Aggregated Telegram OSINT feed from monitored channels."""
    return await telegram_service.aggregate_channels(region_filter=region, category_filter=category)


@app.get("/telegram/critical")
async def get_telegram_critical():
    """Critical priority Telegram alerts only."""
    items = await telegram_service.get_critical_alerts()
    return {"success": True, "count": len(items), "items": items}


@app.get("/telegram/search")
async def search_telegram(q: str = Query(..., min_length=2), limit: int = Query(20, ge=1, le=100)):
    """Search Telegram OSINT items."""
    results = await telegram_service.search(q, limit=limit)
    return {"success": True, "count": len(results), "query": q, "items": results}


# ── OREF Rocket Alert Endpoints ──

@app.get("/oref/alerts")
async def get_oref_alerts():
    """Get current active OREF (Israel Home Front Command) rocket alerts."""
    return await oref_service.get_active_alerts()


@app.get("/oref/history")
async def get_oref_history(hours: int = Query(24, ge=1, le=168)):
    """Get OREF alert history."""
    return await oref_service.get_alert_history(hours=hours)


@app.get("/oref/zones")
async def get_oref_zones():
    """Get OREF threat zones with current status for map overlay."""
    zones = await oref_service.get_threat_zones()
    return {"success": True, "zones": zones}


# ── GNSS Jamming Detection Endpoints ──

@app.get("/gnss/jamming")
async def get_gnss_jamming():
    """Get comprehensive GNSS jamming/spoofing detection map."""
    return await gnss_service.get_jamming_map()


@app.get("/gnss/jamming/region/{region}")
async def get_gnss_by_region(region: str):
    """Get GNSS jamming zones for a specific region."""
    zones = await gnss_service.get_zone_by_region(region)
    return {"success": True, "region": region, "count": len(zones), "zones": zones}


# ── Travel Advisory Endpoints ──

@app.get("/travel-advisories")
async def get_travel_advisories():
    """Aggregated government travel advisories from 5 nations."""
    return await travel_advisory_service.get_advisories()


@app.get("/travel-advisories/high-risk")
async def get_high_risk_countries():
    """Countries with Level 3+ travel advisories."""
    countries = await travel_advisory_service.get_high_risk_countries()
    return {"success": True, "count": len(countries), "countries": countries}


@app.get("/travel-advisories/{country_code}")
async def get_country_advisory(country_code: str):
    """Get travel advisory for a specific country."""
    return await travel_advisory_service.get_advisory_for_country(country_code)


# ── ACLED/GDELT Conflict Tracking Endpoints ──

@app.get("/conflicts")
async def get_conflict_events(
    days: int = Query(7, ge=1, le=30),
    region: Optional[str] = Query(None),
):
    """Merged conflict events from ACLED + GDELT."""
    return await acled_gdelt_service.get_conflict_events(days=days, region=region)


@app.get("/conflicts/protests")
async def get_protests():
    """Protest events for map overlay."""
    events = await acled_gdelt_service.get_protest_map()
    return {"success": True, "count": len(events), "events": events}


@app.get("/conflicts/hotspots")
async def get_conflict_hotspots(limit: int = Query(20, ge=1, le=50)):
    """Top conflict hotspot countries."""
    hotspots = await acled_gdelt_service.get_hotspots(limit=limit)
    return {"success": True, "count": len(hotspots), "hotspots": hotspots}


# ── Infrastructure & Undersea Cable Endpoints ──

@app.get("/infrastructure/cables")
async def get_cable_status():
    """Submarine cable health and positions."""
    return await infrastructure_service.get_cable_status()


@app.get("/infrastructure/outages")
async def get_internet_outages():
    """Current internet outages worldwide."""
    return await infrastructure_service.get_internet_outages()


@app.get("/infrastructure/overview")
async def get_infrastructure_overview():
    """Combined infrastructure health: cables + outages + risk zones."""
    return await infrastructure_service.get_infrastructure_overview()


# ── Polymarket Prediction Markets Endpoints ──

@app.get("/predictions")
async def get_prediction_markets():
    """Active geopolitical prediction markets from Polymarket."""
    return await polymarket_service.get_geopolitical_markets()


@app.get("/predictions/conflicts")
async def get_conflict_predictions():
    """Conflict/war prediction markets."""
    markets = await polymarket_service.get_conflict_predictions()
    return {"success": True, "count": len(markets), "markets": markets}


@app.get("/predictions/elections")
async def get_election_predictions():
    """Election prediction markets."""
    markets = await polymarket_service.get_election_predictions()
    return {"success": True, "count": len(markets), "markets": markets}


# ── Fleet Intelligence Endpoints ──

@app.get("/fleet")
async def get_fleet_positions(region: Optional[str] = Query(None)):
    """Global naval fleet positions and deployments."""
    return await fleet_service.get_fleet_positions(region=region)


@app.get("/fleet/carriers")
async def get_carrier_positions():
    """Aircraft carrier positions worldwide."""
    carriers = await fleet_service.get_carrier_positions()
    return {"success": True, "count": len(carriers), "carriers": carriers}


@app.get("/fleet/deployed")
async def get_deployed_forces():
    """Currently deployed naval forces."""
    forces = await fleet_service.get_deployed_forces()
    return {"success": True, "count": len(forces), "forces": forces}


# ── Airport & Aviation Endpoints ──

@app.get("/airports")
async def get_airport_status(region: Optional[str] = Query(None)):
    """Global airport delay status and NOTAMs."""
    return await airport_service.get_airport_status(region=region)


@app.get("/airports/delays")
async def get_delayed_airports():
    """Airports with active delays only."""
    airports = await airport_service.get_delayed_airports()
    return {"success": True, "count": len(airports), "airports": airports}


@app.get("/airports/airspace")
async def get_airspace_restrictions():
    """Known airspace closures and conflict zone restrictions."""
    restrictions = await airport_service.get_airspace_restrictions()
    return {"success": True, "count": len(restrictions), "restrictions": restrictions}
