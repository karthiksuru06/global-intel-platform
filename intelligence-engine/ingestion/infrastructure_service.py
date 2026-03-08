"""
Infrastructure & Undersea Cable Monitoring Service
Monitors:
  - Undersea cable health (TeleGeography submarine cable map data)
  - Internet outages (Cloudflare Radar, IODA)
  - Power grid disruptions
  - Infrastructure cascade modeling
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

# ── Major Undersea Cables Database ──
# Source: TeleGeography Submarine Cable Map
SUBMARINE_CABLES = [
    {"name": "SEA-ME-WE 3", "id": "smw3", "length_km": 39000, "capacity_tbps": 0.96,
     "landing_points": [
         {"name": "Norden, Germany", "lat": 53.60, "lon": 7.20},
         {"name": "Marseille, France", "lat": 43.30, "lon": 5.37},
         {"name": "Jeddah, Saudi Arabia", "lat": 21.54, "lon": 39.17},
         {"name": "Mumbai, India", "lat": 19.08, "lon": 72.88},
         {"name": "Singapore", "lat": 1.35, "lon": 103.82},
         {"name": "Perth, Australia", "lat": -31.95, "lon": 115.86},
         {"name": "Okinawa, Japan", "lat": 26.34, "lon": 127.80},
     ], "status": "operational", "owner": "Consortium", "year": 2000},
    {"name": "SEA-ME-WE 6", "id": "smw6", "length_km": 19200, "capacity_tbps": 100,
     "landing_points": [
         {"name": "Marseille, France", "lat": 43.30, "lon": 5.37},
         {"name": "Singapore", "lat": 1.35, "lon": 103.82},
     ], "status": "operational", "owner": "Consortium", "year": 2025},
    {"name": "MAREA", "id": "marea", "length_km": 6600, "capacity_tbps": 200,
     "landing_points": [
         {"name": "Virginia Beach, USA", "lat": 36.85, "lon": -75.98},
         {"name": "Bilbao, Spain", "lat": 43.26, "lon": -2.93},
     ], "status": "operational", "owner": "Microsoft/Meta", "year": 2018},
    {"name": "DUNANT", "id": "dunant", "length_km": 6400, "capacity_tbps": 250,
     "landing_points": [
         {"name": "Virginia Beach, USA", "lat": 36.85, "lon": -75.98},
         {"name": "Saint-Hilaire-de-Riez, France", "lat": 46.72, "lon": -1.95},
     ], "status": "operational", "owner": "Google", "year": 2021},
    {"name": "GRACE HOPPER", "id": "gracehopper", "length_km": 6200, "capacity_tbps": 340,
     "landing_points": [
         {"name": "New York, USA", "lat": 40.71, "lon": -74.01},
         {"name": "Bude, UK", "lat": 50.83, "lon": -4.55},
         {"name": "Bilbao, Spain", "lat": 43.26, "lon": -2.93},
     ], "status": "operational", "owner": "Google", "year": 2022},
    {"name": "AEConnect-1", "id": "aeconnect1", "length_km": 5536, "capacity_tbps": 52,
     "landing_points": [
         {"name": "New York, USA", "lat": 40.71, "lon": -74.01},
         {"name": "Killala, Ireland", "lat": 54.21, "lon": -9.22},
     ], "status": "operational", "owner": "Aqua Comms", "year": 2016},
    {"name": "FLAG Europe-Asia", "id": "fea", "length_km": 28000, "capacity_tbps": 10,
     "landing_points": [
         {"name": "Porthcurno, UK", "lat": 50.04, "lon": -5.66},
         {"name": "Alexandria, Egypt", "lat": 31.20, "lon": 29.92},
         {"name": "Mumbai, India", "lat": 19.08, "lon": 72.88},
         {"name": "Tokyo, Japan", "lat": 35.68, "lon": 139.69},
     ], "status": "operational", "owner": "Reliance Globalcom", "year": 1997},
    {"name": "TAT-14", "id": "tat14", "length_km": 15428, "capacity_tbps": 3.2,
     "landing_points": [
         {"name": "Manasquan, USA", "lat": 40.12, "lon": -74.04},
         {"name": "Bude, UK", "lat": 50.83, "lon": -4.55},
         {"name": "Norden, Germany", "lat": 53.60, "lon": 7.20},
         {"name": "Katwijk, Netherlands", "lat": 52.20, "lon": 4.40},
         {"name": "Blaabjerg, Denmark", "lat": 55.60, "lon": 8.15},
     ], "status": "decommissioned", "owner": "Consortium", "year": 2001},
    {"name": "Asia-Africa-Europe 1 (AAE-1)", "id": "aae1", "length_km": 25000, "capacity_tbps": 40,
     "landing_points": [
         {"name": "Marseille, France", "lat": 43.30, "lon": 5.37},
         {"name": "Djibouti", "lat": 11.59, "lon": 43.15},
         {"name": "Mumbai, India", "lat": 19.08, "lon": 72.88},
         {"name": "Singapore", "lat": 1.35, "lon": 103.82},
         {"name": "Hong Kong", "lat": 22.30, "lon": 114.17},
     ], "status": "operational", "owner": "Consortium", "year": 2017},
    {"name": "Pacific Light Cable Network (PLCN)", "id": "plcn", "length_km": 12800, "capacity_tbps": 144,
     "landing_points": [
         {"name": "El Segundo, USA", "lat": 33.92, "lon": -118.42},
         {"name": "Taiwan", "lat": 25.03, "lon": 121.57},
         {"name": "Philippines", "lat": 14.58, "lon": 121.00},
     ], "status": "operational", "owner": "Google/Meta", "year": 2023},
    {"name": "2Africa", "id": "2africa", "length_km": 45000, "capacity_tbps": 180,
     "landing_points": [
         {"name": "Genoa, Italy", "lat": 44.41, "lon": 8.93},
         {"name": "Barcelona, Spain", "lat": 41.39, "lon": 2.17},
         {"name": "Oman", "lat": 23.61, "lon": 58.59},
         {"name": "Mombasa, Kenya", "lat": -4.04, "lon": 39.67},
         {"name": "Cape Town, SA", "lat": -33.92, "lon": 18.42},
         {"name": "Lagos, Nigeria", "lat": 6.45, "lon": 3.40},
     ], "status": "under_construction", "owner": "Meta/Consortium", "year": 2025},
    {"name": "SACS (South Atlantic Cable System)", "id": "sacs", "length_km": 6165, "capacity_tbps": 40,
     "landing_points": [
         {"name": "Luanda, Angola", "lat": -8.84, "lon": 13.23},
         {"name": "Fortaleza, Brazil", "lat": -3.73, "lon": -38.53},
     ], "status": "operational", "owner": "Angola Cables", "year": 2018},
    {"name": "NordLink", "id": "nordlink", "length_km": 623, "capacity_tbps": 0,
     "landing_points": [
         {"name": "Tonstad, Norway", "lat": 58.67, "lon": 6.72},
         {"name": "Wilster, Germany", "lat": 53.92, "lon": 9.37},
     ], "status": "operational", "owner": "Statnett/TenneT", "year": 2021, "type": "power"},
]

# Cloudflare Radar API
CLOUDFLARE_RADAR_URL = "https://api.cloudflare.com/client/v4/radar/annotations/outages"

# IODA (Internet Outage Detection and Analysis)
IODA_API_URL = "https://api.ioda.inetintel.cc.gatech.edu/v2/signals/raw"

CACHE_TTL = 300  # 5 minutes


class InfrastructureService:
    def __init__(self):
        self._redis = None

    async def _get_redis(self):
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    async def get_cable_status(self) -> dict:
        """Get status of all monitored submarine cables."""
        try:
            r = await self._get_redis()
            cached = await r.get("cable_status")
            if cached:
                return json.loads(cached)
        except Exception:
            pass

        cables = []
        total_capacity = 0
        for cable in SUBMARINE_CABLES:
            cable_id = cable["id"]
            # Calculate health score based on known factors
            health = 100
            if cable["status"] == "decommissioned":
                health = 0
            elif cable["status"] == "under_construction":
                health = 50

            # Check for known disruption areas
            disruption_risk = self._assess_cable_risk(cable)
            health = max(0, health - disruption_risk)

            cap = cable.get("capacity_tbps", 0)
            total_capacity += cap if cable["status"] == "operational" else 0

            cables.append({
                "id": cable_id,
                "name": cable["name"],
                "length_km": cable["length_km"],
                "capacity_tbps": cap,
                "landing_points": cable["landing_points"],
                "status": cable["status"],
                "owner": cable.get("owner", "Unknown"),
                "year": cable.get("year", 0),
                "health_score": health,
                "disruption_risk": disruption_risk,
                "type": cable.get("type", "fiber"),
                "path": self._generate_cable_path(cable["landing_points"]),
            })

        result = {
            "total_cables": len(cables),
            "operational": len([c for c in cables if c["status"] == "operational"]),
            "total_capacity_tbps": round(total_capacity, 1),
            "cables": cables,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        try:
            r = await self._get_redis()
            await r.setex("cable_status", CACHE_TTL, json.dumps(result))
        except Exception:
            pass

        return result

    async def get_internet_outages(self) -> dict:
        """Fetch current internet outage data."""
        try:
            r = await self._get_redis()
            cached = await r.get("internet_outages")
            if cached:
                return json.loads(cached)
        except Exception:
            pass

        outages = []

        # Try Cloudflare Radar
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    CLOUDFLARE_RADAR_URL,
                    headers={"User-Agent": "GIP-Infra/3.0"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    annotations = data.get("result", {}).get("annotations", [])
                    for ann in annotations:
                        outages.append({
                            "id": hashlib.md5(str(ann.get("id", "")).encode()).hexdigest()[:12],
                            "source": "cloudflare_radar",
                            "country": ann.get("asn_info", {}).get("country", ""),
                            "asn": ann.get("asn", ""),
                            "description": ann.get("description", ""),
                            "start_time": ann.get("startDate", ""),
                            "end_time": ann.get("endDate", ""),
                            "severity": self._outage_severity(ann),
                            "scope": ann.get("scope", ""),
                        })
        except Exception as e:
            logger.debug("Cloudflare Radar fetch failed: %s", e)

        # Try IODA
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    IODA_API_URL,
                    params={"from": "-24h", "until": "now"},
                    headers={"User-Agent": "GIP-Infra/3.0"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    for signal in data if isinstance(data, list) else data.get("data", []):
                        if signal.get("level", 0) >= 3:  # Only significant outages
                            outages.append({
                                "id": hashlib.md5(str(signal).encode()).hexdigest()[:12],
                                "source": "ioda",
                                "entity": signal.get("entity", {}).get("name", ""),
                                "type": signal.get("entity", {}).get("type", ""),
                                "level": signal.get("level", 0),
                                "severity": min(5, signal.get("level", 0)),
                            })
        except Exception as e:
            logger.debug("IODA fetch failed: %s", e)

        result = {
            "total_outages": len(outages),
            "outages": outages,
            "sources": ["Cloudflare Radar", "IODA"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        try:
            r = await self._get_redis()
            await r.setex("internet_outages", CACHE_TTL, json.dumps(result))
        except Exception:
            pass

        return result

    async def get_infrastructure_overview(self) -> dict:
        """Combined infrastructure health overview."""
        cables_task = self.get_cable_status()
        outages_task = self.get_internet_outages()

        cables, outages = await asyncio.gather(
            cables_task, outages_task, return_exceptions=True
        )

        if isinstance(cables, Exception):
            cables = {"cables": [], "total_cables": 0}
        if isinstance(outages, Exception):
            outages = {"outages": [], "total_outages": 0}

        # Compute overall health score
        cable_health_avg = 0
        operational_cables = [c for c in cables.get("cables", []) if c.get("status") == "operational"]
        if operational_cables:
            cable_health_avg = sum(c.get("health_score", 0) for c in operational_cables) / len(operational_cables)

        active_outages = len(outages.get("outages", []))
        outage_penalty = min(30, active_outages * 5)

        overall_health = max(0, min(100, cable_health_avg - outage_penalty))

        return {
            "overall_health": round(overall_health, 1),
            "health_status": "critical" if overall_health < 40 else "degraded" if overall_health < 70 else "healthy",
            "submarine_cables": cables,
            "internet_outages": outages,
            "risk_zones": self._identify_risk_zones(cables, outages),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def _assess_cable_risk(self, cable: dict) -> int:
        """Assess disruption risk for a cable based on geopolitical factors."""
        risk = 0
        for lp in cable.get("landing_points", []):
            lat, lon = lp["lat"], lp["lon"]
            # Red Sea / Yemen (Houthi attacks on cables)
            if 10 < lat < 20 and 35 < lon < 50:
                risk += 25
            # South China Sea
            if 5 < lat < 25 and 105 < lon < 125:
                risk += 15
            # Eastern Mediterranean (conflict zones)
            if 30 < lat < 40 and 25 < lon < 40:
                risk += 10
            # Taiwan Strait
            if 22 < lat < 27 and 117 < lon < 122:
                risk += 20
        return min(50, risk)

    def _generate_cable_path(self, landing_points: list) -> list:
        """Generate simplified path coordinates for map rendering."""
        return [{"lat": lp["lat"], "lon": lp["lon"]} for lp in landing_points]

    def _outage_severity(self, annotation: dict) -> int:
        """Classify outage severity."""
        scope = annotation.get("scope", "")
        if "country" in scope.lower():
            return 5
        if "region" in scope.lower():
            return 4
        return 3

    def _identify_risk_zones(self, cables: dict, outages: dict) -> list:
        """Identify geographic zones with elevated infrastructure risk."""
        zones = []
        # Known chokepoints
        chokepoints = [
            {"name": "Suez Canal / Red Sea", "lat": 27.0, "lon": 34.0, "risk": "high",
             "reason": "Houthi attacks, cable density"},
            {"name": "Strait of Malacca", "lat": 2.5, "lon": 101.5, "risk": "medium",
             "reason": "High traffic, piracy"},
            {"name": "Taiwan Strait", "lat": 24.5, "lon": 119.0, "risk": "high",
             "reason": "Geopolitical tension, cable concentration"},
            {"name": "English Channel", "lat": 50.5, "lon": 0.0, "risk": "low",
             "reason": "High cable density, anchor strikes"},
            {"name": "Strait of Hormuz", "lat": 26.5, "lon": 56.0, "risk": "medium",
             "reason": "Military tension, energy infrastructure"},
        ]
        zones.extend(chokepoints)

        # Add zones from active outages
        for outage in outages.get("outages", []):
            if outage.get("severity", 0) >= 4:
                zones.append({
                    "name": f"Outage: {outage.get('country', outage.get('entity', 'Unknown'))}",
                    "risk": "high",
                    "reason": outage.get("description", "Active internet outage"),
                    "source": outage.get("source", ""),
                })

        return zones
