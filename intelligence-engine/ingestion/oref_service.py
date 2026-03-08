"""
OREF (Israel Home Front Command) Rocket Alert Service
Real-time missile/rocket alert monitoring with threat zone mapping.
Uses the public OREF API for active alerts and historical patterns.
"""

import asyncio
import hashlib
import json
import logging
import time
from datetime import datetime, timezone

import httpx
import redis.asyncio as aioredis

from config import settings

logger = logging.getLogger(__name__)

# OREF public API endpoints
OREF_ALERTS_URL = "https://www.oref.org.il/WarningMessages/alert/alerts.json"
OREF_HISTORY_URL = "https://www.oref.org.il/WarningMessages/alert/History/AlertsHistory.json"

# Known threat regions with approximate centroids
OREF_REGIONS = {
    # Southern Israel
    "עוטף עזה": {"lat": 31.35, "lon": 34.35, "name_en": "Gaza Envelope", "zone": "south"},
    "שדרות, נתיבות": {"lat": 31.52, "lon": 34.60, "name_en": "Sderot-Netivot", "zone": "south"},
    "אשקלון": {"lat": 31.67, "lon": 34.57, "name_en": "Ashkelon", "zone": "south"},
    "אשדוד": {"lat": 31.80, "lon": 34.65, "name_en": "Ashdod", "zone": "south"},
    "באר שבע": {"lat": 31.25, "lon": 34.79, "name_en": "Beer Sheva", "zone": "south"},
    "דימונה": {"lat": 31.07, "lon": 35.03, "name_en": "Dimona", "zone": "south"},
    "אילת": {"lat": 29.56, "lon": 34.95, "name_en": "Eilat", "zone": "south"},
    # Central Israel
    "תל אביב": {"lat": 32.08, "lon": 34.78, "name_en": "Tel Aviv", "zone": "center"},
    "ירושלים": {"lat": 31.77, "lon": 35.22, "name_en": "Jerusalem", "zone": "center"},
    "חיפה": {"lat": 32.79, "lon": 35.00, "name_en": "Haifa", "zone": "north"},
    "רמת גן": {"lat": 32.08, "lon": 34.81, "name_en": "Ramat Gan", "zone": "center"},
    "פתח תקווה": {"lat": 32.09, "lon": 34.88, "name_en": "Petah Tikva", "zone": "center"},
    "ראשון לציון": {"lat": 31.97, "lon": 34.80, "name_en": "Rishon LeZion", "zone": "center"},
    # Northern Israel
    "קריית שמונה": {"lat": 33.21, "lon": 35.57, "name_en": "Kiryat Shmona", "zone": "north"},
    "צפת": {"lat": 32.97, "lon": 35.50, "name_en": "Safed", "zone": "north"},
    "טבריה": {"lat": 32.79, "lon": 35.53, "name_en": "Tiberias", "zone": "north"},
    "נהריה": {"lat": 33.01, "lon": 35.10, "name_en": "Nahariya", "zone": "north"},
    "עכו": {"lat": 32.93, "lon": 35.08, "name_en": "Akko", "zone": "north"},
    "כרמיאל": {"lat": 32.91, "lon": 35.30, "name_en": "Karmiel", "zone": "north"},
    # Golan Heights
    "רמת הגולן": {"lat": 33.00, "lon": 35.75, "name_en": "Golan Heights", "zone": "north"},
    # West Bank (Judea & Samaria)
    "יהודה ושומרון": {"lat": 32.00, "lon": 35.25, "name_en": "Judea & Samaria", "zone": "center"},
}

# Threat type classification
THREAT_TYPES = {
    "ירי רקטות וטילים": "rockets",
    "חדירת כלי טיס עוין": "hostile_aircraft",
    "רעידת אדמה": "earthquake",
    "חומרים מסוכנים": "hazmat",
    "צונאמי": "tsunami",
    "חדירת מחבלים": "infiltration",
    "ירי רקטות": "rockets",
    "טיל בליסטי": "ballistic_missile",
}

CACHE_TTL = 30  # 30 seconds - alerts are time-critical
HISTORY_CACHE_TTL = 300  # 5 minutes for historical data


class OREFAlertService:
    def __init__(self):
        self._redis = None

    async def _get_redis(self):
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    def _geocode_alert(self, area_name: str) -> dict:
        """Map Hebrew area name to lat/lon coordinates."""
        # Direct match
        if area_name in OREF_REGIONS:
            return OREF_REGIONS[area_name]
        # Partial match
        for key, val in OREF_REGIONS.items():
            if key in area_name or area_name in key:
                return val
        # Default to central Israel if unknown
        return {"lat": 31.5, "lon": 34.75, "name_en": area_name, "zone": "unknown"}

    def _classify_threat(self, threat_desc: str) -> str:
        """Classify Hebrew threat description into English category."""
        for hebrew, english in THREAT_TYPES.items():
            if hebrew in threat_desc:
                return english
        return "unknown"

    async def get_active_alerts(self) -> dict:
        """Fetch current active alerts from OREF."""
        try:
            r = await self._get_redis()
            cached = await r.get("oref_active_alerts")
            if cached:
                return json.loads(cached)
        except Exception:
            pass

        alerts = []
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    OREF_ALERTS_URL,
                    headers={
                        "Referer": "https://www.oref.org.il/",
                        "X-Requested-With": "XMLHttpRequest",
                        "User-Agent": "Mozilla/5.0",
                    },
                )
                if resp.status_code == 200 and resp.text.strip():
                    data = resp.json()
                    if isinstance(data, list):
                        for alert in data:
                            area = alert.get("data", alert.get("title", "Unknown"))
                            threat = alert.get("title", alert.get("desc", ""))
                            geo = self._geocode_alert(area)
                            alert_id = hashlib.md5(
                                f"{area}:{threat}:{alert.get('id', '')}".encode()
                            ).hexdigest()[:12]

                            alerts.append({
                                "id": alert_id,
                                "area_hebrew": area,
                                "area_english": geo.get("name_en", area),
                                "threat_type": self._classify_threat(threat),
                                "threat_desc": threat,
                                "lat": geo["lat"],
                                "lon": geo["lon"],
                                "zone": geo.get("zone", "unknown"),
                                "severity": 5,  # All rocket alerts are max severity
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                "source": "oref",
                                "active": True,
                            })
        except Exception as e:
            logger.error("OREF alert fetch failed: %s", e)

        result = {
            "active": len(alerts) > 0,
            "alert_count": len(alerts),
            "alerts": alerts,
            "status": "RED_ALERT" if alerts else "CLEAR",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "zones_affected": list(set(a["zone"] for a in alerts)),
        }

        try:
            r = await self._get_redis()
            await r.setex("oref_active_alerts", CACHE_TTL, json.dumps(result))
        except Exception:
            pass

        return result

    async def get_alert_history(self, hours: int = 24) -> dict:
        """Fetch recent alert history."""
        try:
            r = await self._get_redis()
            cached = await r.get("oref_alert_history")
            if cached:
                return json.loads(cached)
        except Exception:
            pass

        history = []
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    OREF_HISTORY_URL,
                    headers={
                        "Referer": "https://www.oref.org.il/",
                        "User-Agent": "Mozilla/5.0",
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, list):
                        for alert in data[:200]:  # Last 200 alerts
                            area = alert.get("data", "Unknown")
                            geo = self._geocode_alert(area)
                            history.append({
                                "area_english": geo.get("name_en", area),
                                "area_hebrew": area,
                                "threat_type": self._classify_threat(alert.get("title", "")),
                                "lat": geo["lat"],
                                "lon": geo["lon"],
                                "zone": geo.get("zone", "unknown"),
                                "date": alert.get("alertDate", ""),
                                "category": alert.get("category", 0),
                            })
        except Exception as e:
            logger.error("OREF history fetch failed: %s", e)

        # Compute zone statistics
        zone_stats = {}
        for h in history:
            z = h["zone"]
            zone_stats[z] = zone_stats.get(z, 0) + 1

        result = {
            "total_alerts": len(history),
            "history": history,
            "zone_stats": zone_stats,
            "period_hours": hours,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        try:
            r = await self._get_redis()
            await r.setex("oref_alert_history", HISTORY_CACHE_TTL, json.dumps(result))
        except Exception:
            pass

        return result

    async def get_threat_zones(self) -> list:
        """Return all known threat zones with current status for map overlay."""
        alerts = await self.get_active_alerts()
        active_zones = set(a["zone"] for a in alerts.get("alerts", []))

        zones = []
        seen = set()
        for area_name, geo in OREF_REGIONS.items():
            zone_name = geo.get("zone", "unknown")
            if zone_name not in seen:
                seen.add(zone_name)
                zones.append({
                    "zone": zone_name,
                    "active": zone_name in active_zones,
                    "alert_count": sum(1 for a in alerts.get("alerts", []) if a["zone"] == zone_name),
                    "representative_lat": geo["lat"],
                    "representative_lon": geo["lon"],
                })

        return zones
