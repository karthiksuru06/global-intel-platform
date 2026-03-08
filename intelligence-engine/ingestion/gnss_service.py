"""
GPS/GNSS Jamming & Spoofing Detection Service
Monitors GPS interference zones using GPSJam data, ADS-B anomalies,
and known military jamming regions. Generates GeoEvents for detected zones.
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

# Known persistent GNSS interference zones (lat, lon, radius_km, source, severity)
KNOWN_JAMMING_ZONES = [
    # Eastern Mediterranean - heavy Russian/Syrian jamming
    {"lat": 34.80, "lon": 33.00, "radius_km": 300, "source": "Russian EW (Syria/Cyprus)", "severity": 4, "region": "mena"},
    {"lat": 35.40, "lon": 35.95, "source": "Khmeimim AB Syria", "radius_km": 200, "severity": 5, "region": "mena"},
    # Baltic / Kaliningrad
    {"lat": 54.70, "lon": 20.50, "radius_km": 250, "source": "Kaliningrad EW", "severity": 4, "region": "europe"},
    # Black Sea
    {"lat": 44.60, "lon": 33.50, "radius_km": 200, "source": "Crimea EW", "severity": 5, "region": "europe"},
    # Ukraine conflict zone
    {"lat": 48.50, "lon": 37.80, "radius_km": 400, "source": "Ukraine Conflict EW", "severity": 5, "region": "europe"},
    # Northern Norway / Finland border
    {"lat": 69.50, "lon": 30.00, "radius_km": 150, "source": "Kola Peninsula EW", "severity": 3, "region": "europe"},
    # Iran
    {"lat": 32.65, "lon": 51.68, "radius_km": 200, "source": "Iran GNSS Denial", "severity": 4, "region": "mena"},
    # Persian Gulf
    {"lat": 26.00, "lon": 53.00, "radius_km": 300, "source": "Strait of Hormuz Spoofing", "severity": 4, "region": "mena"},
    # North Korea
    {"lat": 38.00, "lon": 126.50, "radius_km": 200, "source": "DPRK GPS Jamming", "severity": 5, "region": "asia"},
    # South China Sea
    {"lat": 16.00, "lon": 112.00, "radius_km": 400, "source": "SCS Militarized Zones", "severity": 3, "region": "asia"},
    # India-Pakistan border
    {"lat": 33.00, "lon": 74.00, "radius_km": 150, "source": "LOC Electronic Warfare", "severity": 3, "region": "asia"},
    # Libya
    {"lat": 32.90, "lon": 13.18, "radius_km": 200, "source": "Libya Conflict EW", "severity": 3, "region": "africa"},
    # Red Sea / Yemen
    {"lat": 13.50, "lon": 43.50, "radius_km": 250, "source": "Houthi/Yemen EW", "severity": 4, "region": "mena"},
    # Taiwan Strait
    {"lat": 24.50, "lon": 118.50, "radius_km": 200, "source": "Taiwan Strait EW", "severity": 3, "region": "asia"},
]

# GPSJam API endpoint
GPSJAM_URL = "https://gpsjam.org/api/v1/jamming"
GPSJAM_TILES_URL = "https://gpsjam.org/data"

CACHE_TTL = 300  # 5 minutes


class GNSSJammingService:
    def __init__(self):
        self._redis = None

    async def _get_redis(self):
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    async def _fetch_gpsjam_data(self) -> list:
        """Fetch current GNSS interference data from GPSJam.org."""
        detections = []
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # Try GPSJam API
                resp = await client.get(
                    GPSJAM_URL,
                    headers={"User-Agent": "GIP-GNSS-Monitor/3.0"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, list):
                        for item in data:
                            detections.append({
                                "lat": item.get("lat", 0),
                                "lon": item.get("lon", 0),
                                "intensity": item.get("intensity", 0),
                                "source": "gpsjam_live",
                                "type": item.get("type", "jamming"),
                                "confidence": item.get("confidence", 0.7),
                            })
        except Exception as e:
            logger.debug("GPSJam API not available: %s", e)

        return detections

    async def _detect_adsb_anomalies(self) -> list:
        """Detect GNSS anomalies from ADS-B position inconsistencies.
        Cross-references aircraft positions for sudden jumps indicating spoofing."""
        anomalies = []
        try:
            r = await self._get_redis()
            # Check if we have recent aircraft position data
            aircraft_data = await r.get("recent_aircraft_positions")
            if aircraft_data:
                positions = json.loads(aircraft_data)
                # Look for position jumps > 50km in < 30 seconds (physically impossible)
                for callsign, history in positions.items():
                    if len(history) < 2:
                        continue
                    prev = history[-2]
                    curr = history[-1]
                    # Simple distance check
                    dlat = abs(curr["lat"] - prev["lat"])
                    dlon = abs(curr["lon"] - prev["lon"])
                    dist_approx = ((dlat ** 2 + dlon ** 2) ** 0.5) * 111  # rough km
                    dt = curr.get("ts", 0) - prev.get("ts", 0)
                    if dt > 0 and dt < 30 and dist_approx > 50:
                        anomalies.append({
                            "lat": curr["lat"],
                            "lon": curr["lon"],
                            "callsign": callsign,
                            "jump_km": round(dist_approx, 1),
                            "type": "spoofing_suspected",
                            "confidence": min(0.95, dist_approx / 100),
                            "source": "adsb_anomaly",
                        })
        except Exception as e:
            logger.debug("ADS-B anomaly detection skipped: %s", e)
        return anomalies

    async def get_jamming_map(self) -> dict:
        """Get comprehensive GNSS jamming/spoofing map data."""
        try:
            r = await self._get_redis()
            cached = await r.get("gnss_jamming_map")
            if cached:
                return json.loads(cached)
        except Exception:
            pass

        # Combine known zones with live detections
        live_detections = await self._fetch_gpsjam_data()
        adsb_anomalies = await self._detect_adsb_anomalies()

        # Build zone list
        zones = []

        # Add known persistent zones
        for zone in KNOWN_JAMMING_ZONES:
            zone_id = hashlib.md5(
                f"{zone['lat']}:{zone['lon']}:{zone['source']}".encode()
            ).hexdigest()[:12]
            zones.append({
                "id": zone_id,
                "lat": zone["lat"],
                "lon": zone["lon"],
                "radius_km": zone["radius_km"],
                "source": zone["source"],
                "severity": zone["severity"],
                "region": zone["region"],
                "type": "known_persistent",
                "confidence": 0.9,
                "active": True,
            })

        # Add live GPSJam detections
        for det in live_detections:
            det_id = hashlib.md5(
                f"live:{det['lat']}:{det['lon']}".encode()
            ).hexdigest()[:12]
            zones.append({
                "id": det_id,
                "lat": det["lat"],
                "lon": det["lon"],
                "radius_km": 50,
                "source": "GPSJam Live Detection",
                "severity": max(2, min(5, int(det.get("intensity", 3)))),
                "region": self._get_region(det["lat"], det["lon"]),
                "type": det.get("type", "jamming"),
                "confidence": det.get("confidence", 0.7),
                "active": True,
            })

        # Add ADS-B spoofing anomalies
        for anom in adsb_anomalies:
            anom_id = hashlib.md5(
                f"adsb:{anom['callsign']}:{anom['lat']}".encode()
            ).hexdigest()[:12]
            zones.append({
                "id": anom_id,
                "lat": anom["lat"],
                "lon": anom["lon"],
                "radius_km": 30,
                "source": f"ADS-B Anomaly ({anom['callsign']})",
                "severity": 4,
                "region": self._get_region(anom["lat"], anom["lon"]),
                "type": "spoofing",
                "confidence": anom.get("confidence", 0.6),
                "active": True,
                "jump_km": anom.get("jump_km", 0),
            })

        # Statistics
        result = {
            "total_zones": len(zones),
            "zones": zones,
            "known_persistent": len(KNOWN_JAMMING_ZONES),
            "live_detections": len(live_detections),
            "adsb_anomalies": len(adsb_anomalies),
            "regions_affected": list(set(z["region"] for z in zones)),
            "severity_breakdown": {
                "critical": len([z for z in zones if z["severity"] == 5]),
                "high": len([z for z in zones if z["severity"] == 4]),
                "medium": len([z for z in zones if z["severity"] == 3]),
                "low": len([z for z in zones if z["severity"] <= 2]),
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        try:
            r = await self._get_redis()
            await r.setex("gnss_jamming_map", CACHE_TTL, json.dumps(result))
        except Exception:
            pass

        return result

    async def get_zone_by_region(self, region: str) -> list:
        """Get jamming zones filtered by region."""
        data = await self.get_jamming_map()
        return [z for z in data.get("zones", []) if z.get("region") == region]

    def _get_region(self, lat: float, lon: float) -> str:
        """Rough region classification from coordinates."""
        if lat > 60:
            return "europe"
        if 35 < lat < 60 and -10 < lon < 40:
            return "europe"
        if 10 < lat < 45 and 25 < lon < 65:
            return "mena"
        if -35 < lat < 10 and -20 < lon < 55:
            return "africa"
        if 0 < lat < 55 and 65 < lon < 150:
            return "asia"
        if -60 < lat < 15 and -120 < lon < -30:
            return "americas"
        if 15 < lat < 75 and -170 < lon < -50:
            return "americas"
        return "global"
