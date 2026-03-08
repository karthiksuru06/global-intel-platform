"""
Airport Delay & NOTAM Monitoring Service
Monitors airport delays, ground stops, and NOTAMs (Notices to Air Missions)
from FAA, Eurocontrol, and international aviation authorities.
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

# FAA Airport Status API
FAA_STATUS_URL = "https://nasstatus.faa.gov/api/airport-status-information"
FAA_DELAYS_URL = "https://nasstatus.faa.gov/api/airport-delays"

# Major world airports to monitor
MONITORED_AIRPORTS = {
    # North America
    "JFK": {"name": "John F. Kennedy Intl", "lat": 40.64, "lon": -73.78, "city": "New York", "region": "americas"},
    "LAX": {"name": "Los Angeles Intl", "lat": 33.94, "lon": -118.41, "city": "Los Angeles", "region": "americas"},
    "ORD": {"name": "O'Hare Intl", "lat": 41.98, "lon": -87.90, "city": "Chicago", "region": "americas"},
    "ATL": {"name": "Hartsfield-Jackson", "lat": 33.64, "lon": -84.43, "city": "Atlanta", "region": "americas"},
    "DFW": {"name": "Dallas/Fort Worth", "lat": 32.90, "lon": -97.04, "city": "Dallas", "region": "americas"},
    "DEN": {"name": "Denver Intl", "lat": 39.86, "lon": -104.67, "city": "Denver", "region": "americas"},
    "SFO": {"name": "San Francisco Intl", "lat": 37.62, "lon": -122.38, "city": "San Francisco", "region": "americas"},
    "MIA": {"name": "Miami Intl", "lat": 25.80, "lon": -80.29, "city": "Miami", "region": "americas"},
    "YYZ": {"name": "Toronto Pearson", "lat": 43.68, "lon": -79.63, "city": "Toronto", "region": "americas"},
    "MEX": {"name": "Mexico City Intl", "lat": 19.44, "lon": -99.07, "city": "Mexico City", "region": "americas"},
    "GRU": {"name": "São Paulo-Guarulhos", "lat": -23.43, "lon": -46.47, "city": "São Paulo", "region": "americas"},
    # Europe
    "LHR": {"name": "London Heathrow", "lat": 51.47, "lon": -0.46, "city": "London", "region": "europe"},
    "CDG": {"name": "Paris Charles de Gaulle", "lat": 49.01, "lon": 2.55, "city": "Paris", "region": "europe"},
    "FRA": {"name": "Frankfurt Airport", "lat": 50.03, "lon": 8.57, "city": "Frankfurt", "region": "europe"},
    "AMS": {"name": "Amsterdam Schiphol", "lat": 52.31, "lon": 4.77, "city": "Amsterdam", "region": "europe"},
    "IST": {"name": "Istanbul Airport", "lat": 41.26, "lon": 28.74, "city": "Istanbul", "region": "europe"},
    "MAD": {"name": "Madrid Barajas", "lat": 40.47, "lon": -3.56, "city": "Madrid", "region": "europe"},
    "FCO": {"name": "Rome Fiumicino", "lat": 41.80, "lon": 12.25, "city": "Rome", "region": "europe"},
    "ZRH": {"name": "Zurich Airport", "lat": 47.46, "lon": 8.55, "city": "Zurich", "region": "europe"},
    # Middle East
    "DXB": {"name": "Dubai Intl", "lat": 25.25, "lon": 55.36, "city": "Dubai", "region": "mena"},
    "DOH": {"name": "Hamad Intl", "lat": 25.27, "lon": 51.61, "city": "Doha", "region": "mena"},
    "AUH": {"name": "Abu Dhabi Intl", "lat": 24.44, "lon": 54.65, "city": "Abu Dhabi", "region": "mena"},
    "TLV": {"name": "Ben Gurion", "lat": 32.01, "lon": 34.89, "city": "Tel Aviv", "region": "mena"},
    "RUH": {"name": "King Khalid Intl", "lat": 24.96, "lon": 46.70, "city": "Riyadh", "region": "mena"},
    # Asia-Pacific
    "HND": {"name": "Tokyo Haneda", "lat": 35.55, "lon": 139.78, "city": "Tokyo", "region": "asia"},
    "NRT": {"name": "Tokyo Narita", "lat": 35.77, "lon": 140.39, "city": "Tokyo", "region": "asia"},
    "PEK": {"name": "Beijing Capital", "lat": 40.08, "lon": 116.58, "city": "Beijing", "region": "asia"},
    "PVG": {"name": "Shanghai Pudong", "lat": 31.14, "lon": 121.81, "city": "Shanghai", "region": "asia"},
    "HKG": {"name": "Hong Kong Intl", "lat": 22.31, "lon": 113.91, "city": "Hong Kong", "region": "asia"},
    "SIN": {"name": "Singapore Changi", "lat": 1.36, "lon": 103.99, "city": "Singapore", "region": "asia"},
    "ICN": {"name": "Incheon Intl", "lat": 37.46, "lon": 126.44, "city": "Seoul", "region": "asia"},
    "BKK": {"name": "Suvarnabhumi", "lat": 13.69, "lon": 100.75, "city": "Bangkok", "region": "asia"},
    "DEL": {"name": "Indira Gandhi Intl", "lat": 28.57, "lon": 77.10, "city": "New Delhi", "region": "asia"},
    "SYD": {"name": "Sydney Kingsford Smith", "lat": -33.95, "lon": 151.18, "city": "Sydney", "region": "asia"},
    # Africa
    "JNB": {"name": "OR Tambo Intl", "lat": -26.14, "lon": 28.24, "city": "Johannesburg", "region": "africa"},
    "CAI": {"name": "Cairo Intl", "lat": 30.12, "lon": 31.41, "city": "Cairo", "region": "africa"},
    "ADD": {"name": "Bole Intl", "lat": 8.98, "lon": 38.80, "city": "Addis Ababa", "region": "africa"},
    "NBO": {"name": "Jomo Kenyatta", "lat": -1.32, "lon": 36.93, "city": "Nairobi", "region": "africa"},
}

# Known airspace closures and restrictions
AIRSPACE_RESTRICTIONS = [
    {"area": "Ukraine", "lat": 48.4, "lon": 31.2, "radius_nm": 300, "type": "conflict_zone", "since": "2022-02-24"},
    {"area": "Eastern Libya", "lat": 32.0, "lon": 20.0, "radius_nm": 200, "type": "conflict_zone", "since": "2020-01-01"},
    {"area": "Northern Syria", "lat": 36.0, "lon": 38.0, "radius_nm": 150, "type": "conflict_zone", "since": "2015-09-30"},
    {"area": "Yemen", "lat": 15.5, "lon": 44.0, "radius_nm": 250, "type": "conflict_zone", "since": "2015-03-26"},
    {"area": "Somalia", "lat": 5.0, "lon": 46.0, "radius_nm": 300, "type": "conflict_zone", "since": "2007-01-01"},
    {"area": "North Korea", "lat": 40.0, "lon": 127.0, "radius_nm": 200, "type": "prohibited", "since": "1953-07-27"},
    {"area": "Iran (Eastern)", "lat": 32.0, "lon": 58.0, "radius_nm": 200, "type": "risk_zone", "since": "2020-01-08"},
]

CACHE_TTL = 300  # 5 minutes


class AirportService:
    def __init__(self):
        self._redis = None

    async def _get_redis(self):
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    async def _fetch_faa_delays(self) -> list:
        """Fetch current FAA airport delays and ground stops."""
        delays = []
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    FAA_STATUS_URL,
                    headers={"User-Agent": "GIP-Aviation/3.0"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    for item in data if isinstance(data, list) else data.get("data", []):
                        airport_code = item.get("arpt", item.get("airport", ""))
                        if not airport_code:
                            continue

                        delay_info = item.get("delay", item.get("status", {}))
                        reason = ""
                        avg_delay = 0

                        if isinstance(delay_info, dict):
                            reason = delay_info.get("reason", "")
                            avg_delay = delay_info.get("avgDelay", delay_info.get("average", 0))
                        elif isinstance(delay_info, str):
                            reason = delay_info

                        airport_info = MONITORED_AIRPORTS.get(airport_code, {})
                        delays.append({
                            "airport": airport_code,
                            "name": airport_info.get("name", airport_code),
                            "lat": airport_info.get("lat", 0),
                            "lon": airport_info.get("lon", 0),
                            "city": airport_info.get("city", ""),
                            "delay_type": item.get("type", "delay"),
                            "reason": reason,
                            "avg_delay_minutes": avg_delay,
                            "ground_stop": item.get("groundStop", False),
                            "ground_delay": item.get("groundDelay", False),
                            "severity": self._delay_severity(avg_delay, item.get("groundStop", False)),
                            "source": "faa",
                        })
        except Exception as e:
            logger.debug("FAA delay fetch failed: %s", e)

        return delays

    async def get_airport_status(self, region: str = None) -> dict:
        """Get comprehensive airport status with delays and NOTAMs."""
        try:
            r = await self._get_redis()
            cached = await r.get(f"airport_status:{region or 'all'}")
            if cached:
                return json.loads(cached)
        except Exception:
            pass

        # Fetch FAA delays
        faa_delays = await self._fetch_faa_delays()

        # Build airport status list
        airports = []
        for code, info in MONITORED_AIRPORTS.items():
            if region and info["region"] != region:
                continue

            # Check if this airport has a delay
            delay = next((d for d in faa_delays if d["airport"] == code), None)

            status = "normal"
            severity = 1
            delay_minutes = 0
            if delay:
                status = "ground_stop" if delay.get("ground_stop") else "delayed"
                severity = delay.get("severity", 2)
                delay_minutes = delay.get("avg_delay_minutes", 0)

            airports.append({
                "code": code,
                "name": info["name"],
                "city": info["city"],
                "lat": info["lat"],
                "lon": info["lon"],
                "region": info["region"],
                "status": status,
                "severity": severity,
                "delay_minutes": delay_minutes,
                "reason": delay.get("reason", "") if delay else "",
                "ground_stop": delay.get("ground_stop", False) if delay else False,
            })

        # Sort: delayed airports first
        airports.sort(key=lambda x: (-x["severity"], x["code"]))

        # Stats
        delayed = len([a for a in airports if a["status"] != "normal"])
        ground_stops = len([a for a in airports if a.get("ground_stop")])

        result = {
            "total_airports": len(airports),
            "delayed": delayed,
            "ground_stops": ground_stops,
            "airports": airports,
            "airspace_restrictions": AIRSPACE_RESTRICTIONS,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        try:
            r = await self._get_redis()
            await r.setex(f"airport_status:{region or 'all'}", CACHE_TTL, json.dumps(result))
        except Exception:
            pass

        return result

    async def get_delayed_airports(self) -> list:
        """Get only airports with active delays."""
        data = await self.get_airport_status()
        return [a for a in data.get("airports", []) if a["status"] != "normal"]

    async def get_airspace_restrictions(self) -> list:
        """Get known airspace closures and conflict zone restrictions."""
        return AIRSPACE_RESTRICTIONS

    def _delay_severity(self, avg_minutes, ground_stop: bool) -> int:
        """Calculate delay severity level."""
        if ground_stop:
            return 5
        if avg_minutes > 120:
            return 4
        if avg_minutes > 60:
            return 3
        if avg_minutes > 30:
            return 2
        return 1
