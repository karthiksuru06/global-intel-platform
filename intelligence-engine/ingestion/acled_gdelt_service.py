"""
ACLED + GDELT Protest & Conflict Tracking Service
Tracks protests, riots, battles, explosions, and violence against civilians
from ACLED (Armed Conflict Location & Event Data) and GDELT Event Database.
"""

import asyncio
import hashlib
import json
import logging
import os
import time
from datetime import datetime, timedelta, timezone

import httpx
import redis.asyncio as aioredis

from config import settings

logger = logging.getLogger(__name__)

# ACLED API
ACLED_API_URL = "https://api.acleddata.com/acled/read"

# GDELT API v2
GDELT_EVENTS_URL = "https://api.gdeltproject.org/api/v2/doc/doc"
GDELT_GEO_URL = "https://api.gdeltproject.org/api/v2/geo/geo"

# ACLED event types
ACLED_EVENT_TYPES = {
    "Battles": {"severity": 5, "icon": "crosshairs", "color": "#ff0000"},
    "Violence against civilians": {"severity": 5, "icon": "skull", "color": "#dc143c"},
    "Explosions/Remote violence": {"severity": 5, "icon": "explosion", "color": "#ff4500"},
    "Riots": {"severity": 4, "icon": "flame", "color": "#ff8c00"},
    "Protests": {"severity": 3, "icon": "megaphone", "color": "#ffd700"},
    "Strategic developments": {"severity": 2, "icon": "info", "color": "#4169e1"},
}

# GDELT CAMEO event codes for conflict
GDELT_CONFLICT_CODES = {
    "14": {"type": "protest", "severity": 3, "desc": "Protest"},
    "145": {"type": "protest_violent", "severity": 4, "desc": "Protest with violence"},
    "17": {"type": "coerce", "severity": 3, "desc": "Coercion"},
    "18": {"type": "assault", "severity": 5, "desc": "Assault"},
    "19": {"type": "fight", "severity": 5, "desc": "Armed conflict"},
    "190": {"type": "military_force", "severity": 5, "desc": "Use of military force"},
    "193": {"type": "battle", "severity": 5, "desc": "Fight with weapons"},
    "194": {"type": "mass_violence", "severity": 5, "desc": "Mass violence"},
    "195": {"type": "bombing", "severity": 5, "desc": "Bombing/IED"},
    "20": {"type": "mass_violence", "severity": 5, "desc": "Mass killing"},
}

CACHE_TTL = 600  # 10 minutes


class ACLEDGDELTService:
    def __init__(self):
        self._redis = None
        self._acled_key = os.environ.get("ACLED_API_KEY", "")

    async def _get_redis(self):
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    async def _fetch_acled_events(self, days: int = 7, limit: int = 500) -> list:
        """Fetch recent conflict events from ACLED API."""
        events = []
        try:
            date_from = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
            params = {
                "event_date": date_from,
                "event_date_where": ">=",
                "limit": limit,
                "fields": "event_id_cnty|event_date|event_type|sub_event_type|actor1|actor2|"
                          "country|admin1|admin2|location|latitude|longitude|fatalities|notes|source",
            }
            acled_key = settings.__dict__.get("ACLED_API_KEY", "")
            if acled_key:
                params["key"] = acled_key

            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(ACLED_API_URL, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    records = data.get("data", [])
                    for rec in records:
                        event_type = rec.get("event_type", "")
                        type_info = ACLED_EVENT_TYPES.get(event_type, {"severity": 2})
                        lat = float(rec.get("latitude", 0))
                        lon = float(rec.get("longitude", 0))
                        if lat == 0 and lon == 0:
                            continue

                        events.append({
                            "id": hashlib.md5(str(rec.get("event_id_cnty", "")).encode()).hexdigest()[:12],
                            "source": "acled",
                            "event_type": event_type,
                            "sub_type": rec.get("sub_event_type", ""),
                            "lat": lat,
                            "lon": lon,
                            "country": rec.get("country", ""),
                            "location": rec.get("location", ""),
                            "admin1": rec.get("admin1", ""),
                            "date": rec.get("event_date", ""),
                            "actor1": rec.get("actor1", ""),
                            "actor2": rec.get("actor2", ""),
                            "fatalities": int(rec.get("fatalities", 0)),
                            "severity": type_info["severity"],
                            "notes": rec.get("notes", "")[:300],
                            "source_detail": rec.get("source", ""),
                        })
        except Exception as e:
            logger.error("ACLED fetch failed: %s", e)

        return events

    async def _fetch_gdelt_events(self, days: int = 3) -> list:
        """Fetch conflict/protest events from GDELT API v2."""
        events = []
        try:
            # Use GDELT GEO API for geocoded conflict events
            params = {
                "query": "conflict OR protest OR attack OR bombing OR military",
                "mode": "pointdata",
                "format": "json",
                "timespan": f"{days * 24 * 60}min",
                "maxrecords": 250,
            }

            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(GDELT_GEO_URL, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    features = data if isinstance(data, list) else data.get("features", [])
                    for feat in features:
                        props = feat.get("properties", feat) if isinstance(feat, dict) else {}
                        geo = feat.get("geometry", {})
                        coords = geo.get("coordinates", [0, 0])

                        lat = coords[1] if len(coords) > 1 else 0
                        lon = coords[0] if len(coords) > 0 else 0

                        if lat == 0 and lon == 0:
                            continue

                        # Determine event type from CAMEO code
                        cameo = str(props.get("EventCode", props.get("eventcode", "")))
                        cameo_info = GDELT_CONFLICT_CODES.get(cameo[:3], GDELT_CONFLICT_CODES.get(cameo[:2], None))

                        event_id = hashlib.md5(
                            f"gdelt:{lat}:{lon}:{props.get('GLOBALEVENTID', '')}".encode()
                        ).hexdigest()[:12]

                        severity = 3
                        event_type = "conflict"
                        if cameo_info:
                            severity = cameo_info["severity"]
                            event_type = cameo_info["type"]

                        events.append({
                            "id": event_id,
                            "source": "gdelt",
                            "event_type": event_type,
                            "lat": lat,
                            "lon": lon,
                            "country": props.get("ActionGeo_CountryCode", ""),
                            "location": props.get("ActionGeo_FullName", props.get("name", "")),
                            "date": props.get("DATEADDED", props.get("dateadded", "")),
                            "actor1": props.get("Actor1Name", ""),
                            "actor2": props.get("Actor2Name", ""),
                            "goldstein_scale": float(props.get("GoldsteinScale", 0)),
                            "avg_tone": float(props.get("AvgTone", 0)),
                            "severity": severity,
                            "url": props.get("SOURCEURL", props.get("url", "")),
                        })
        except Exception as e:
            logger.error("GDELT fetch failed: %s", e)

        return events

    async def get_conflict_events(self, days: int = 7, region: str = None) -> dict:
        """Get merged conflict events from ACLED + GDELT."""
        try:
            r = await self._get_redis()
            cache_key = f"conflict_events:{days}:{region or 'all'}"
            cached = await r.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

        # Fetch from both sources in parallel
        acled_task = self._fetch_acled_events(days=days)
        gdelt_task = self._fetch_gdelt_events(days=min(days, 3))

        acled_events, gdelt_events = await asyncio.gather(
            acled_task, gdelt_task, return_exceptions=True
        )

        if isinstance(acled_events, Exception):
            acled_events = []
        if isinstance(gdelt_events, Exception):
            gdelt_events = []

        all_events = acled_events + gdelt_events

        # Deduplicate by proximity (events within 50km and same day)
        unique_events = []
        seen_locations = set()
        for event in all_events:
            loc_key = f"{round(event['lat'], 1)}:{round(event['lon'], 1)}:{event.get('date', '')[:10]}"
            if loc_key not in seen_locations:
                seen_locations.add(loc_key)
                unique_events.append(event)

        # Sort by severity then date
        unique_events.sort(key=lambda x: (-x.get("severity", 0), x.get("date", "")), reverse=False)
        unique_events.sort(key=lambda x: -x.get("severity", 0))

        # Region filter
        if region:
            unique_events = [e for e in unique_events if self._in_region(e, region)]

        # Group by type
        by_type = {}
        for e in unique_events:
            t = e.get("event_type", "other")
            by_type.setdefault(t, []).append(e)

        # Country hotspots
        country_counts = {}
        for e in unique_events:
            c = e.get("country", "Unknown")
            country_counts[c] = country_counts.get(c, 0) + 1
        hotspots = sorted(country_counts.items(), key=lambda x: -x[1])[:20]

        result = {
            "total_events": len(unique_events),
            "events": unique_events[:500],
            "by_type": {k: len(v) for k, v in by_type.items()},
            "hotspots": [{"country": c, "event_count": n} for c, n in hotspots],
            "sources": {
                "acled": len(acled_events),
                "gdelt": len(gdelt_events),
            },
            "fatalities_total": sum(e.get("fatalities", 0) for e in unique_events),
            "period_days": days,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        try:
            r = await self._get_redis()
            await r.setex(f"conflict_events:{days}:{region or 'all'}", CACHE_TTL, json.dumps(result))
        except Exception:
            pass

        return result

    async def get_protest_map(self) -> list:
        """Get only protest events for map overlay."""
        data = await self.get_conflict_events(days=7)
        return [
            e for e in data.get("events", [])
            if "protest" in e.get("event_type", "").lower() or e.get("event_type") == "Protests"
        ]

    async def get_hotspots(self, limit: int = 20) -> list:
        """Get top conflict hotspot countries."""
        data = await self.get_conflict_events(days=7)
        return data.get("hotspots", [])[:limit]

    def _in_region(self, event: dict, region: str) -> bool:
        """Check if event is in a given region."""
        lat = event.get("lat", 0)
        lon = event.get("lon", 0)
        regions = {
            "europe": (35, 72, -10, 45),
            "mena": (10, 45, 25, 65),
            "africa": (-35, 15, -20, 55),
            "asia": (0, 55, 65, 150),
            "americas": (-60, 75, -170, -30),
        }
        if region not in regions:
            return True
        lat_min, lat_max, lon_min, lon_max = regions[region]
        return lat_min <= lat <= lat_max and lon_min <= lon <= lon_max
