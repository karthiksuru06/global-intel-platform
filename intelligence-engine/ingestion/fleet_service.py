"""
USNI Fleet Intelligence Service
Tracks major naval fleet deployments worldwide using USNI News Fleet Tracker data
and open-source naval intelligence. Covers US Navy carrier strike groups,
amphibious ready groups, and major allied/adversary fleet movements.
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

# ── Known Fleet Deployments (baseline from USNI Fleet Tracker) ──
# Updated with approximate positions based on public OSINT
FLEET_DEPLOYMENTS = {
    # US Navy Carrier Strike Groups
    "CSG-1": {
        "name": "USS Carl Vinson (CVN-70) CSG",
        "type": "carrier_strike_group",
        "fleet": "US Navy",
        "flagship": "CVN-70 Carl Vinson",
        "composition": ["CVN-70", "CG-57", "DDG-105", "DDG-113"],
        "home_port": "San Diego, CA",
        "lat": 21.30, "lon": -157.80,
        "region": "indo_pacific",
        "status": "deployed",
        "mission": "Indo-Pacific Patrol",
    },
    "CSG-3": {
        "name": "USS Abraham Lincoln (CVN-72) CSG",
        "type": "carrier_strike_group",
        "fleet": "US Navy",
        "flagship": "CVN-72 Abraham Lincoln",
        "composition": ["CVN-72", "CG-54", "DDG-61", "DDG-100"],
        "home_port": "San Diego, CA",
        "lat": 32.70, "lon": -117.20,
        "region": "pacific",
        "status": "in_port",
        "mission": "Maintenance/Training",
    },
    "CSG-2": {
        "name": "USS Dwight D. Eisenhower (CVN-69) CSG",
        "type": "carrier_strike_group",
        "fleet": "US Navy",
        "flagship": "CVN-69 Eisenhower",
        "composition": ["CVN-69", "CG-70", "DDG-99", "DDG-63"],
        "home_port": "Norfolk, VA",
        "lat": 25.50, "lon": 60.00,
        "region": "mena",
        "status": "deployed",
        "mission": "Central Command Operations",
    },
    "CSG-12": {
        "name": "USS Gerald R. Ford (CVN-78) CSG",
        "type": "carrier_strike_group",
        "fleet": "US Navy",
        "flagship": "CVN-78 Ford",
        "composition": ["CVN-78", "CG-65", "DDG-102", "DDG-110"],
        "home_port": "Norfolk, VA",
        "lat": 36.85, "lon": -76.30,
        "region": "atlantic",
        "status": "in_port",
        "mission": "Training/Maintenance",
    },
    "CSG-5": {
        "name": "USS Ronald Reagan (CVN-76) CSG",
        "type": "carrier_strike_group",
        "fleet": "US Navy",
        "flagship": "CVN-76 Reagan",
        "composition": ["CVN-76", "CG-62", "DDG-85", "DDG-89"],
        "home_port": "Yokosuka, Japan",
        "lat": 35.28, "lon": 139.67,
        "region": "indo_pacific",
        "status": "forward_deployed",
        "mission": "7th Fleet Forward Presence",
    },
    # US Navy Amphibious Ready Groups
    "ARG-WASP": {
        "name": "USS Wasp (LHD-1) ARG",
        "type": "amphibious_ready_group",
        "fleet": "US Navy",
        "flagship": "LHD-1 Wasp",
        "composition": ["LHD-1", "LPD-27", "LSD-52", "26th MEU"],
        "home_port": "Norfolk, VA",
        "lat": 33.50, "lon": 35.50,
        "region": "mediterranean",
        "status": "deployed",
        "mission": "Mediterranean Forward Presence",
    },
    "ARG-AMERICA": {
        "name": "USS America (LHA-6) ARG",
        "type": "amphibious_ready_group",
        "fleet": "US Navy",
        "flagship": "LHA-6 America",
        "composition": ["LHA-6", "LPD-22", "LSD-48", "13th MEU"],
        "home_port": "Sasebo, Japan",
        "lat": 33.16, "lon": 129.72,
        "region": "indo_pacific",
        "status": "forward_deployed",
        "mission": "7th Fleet Amphibious Operations",
    },
    # Allied Navies
    "QUEEN_ELIZABETH": {
        "name": "HMS Queen Elizabeth (R08) CSG",
        "type": "carrier_strike_group",
        "fleet": "Royal Navy",
        "flagship": "R08 Queen Elizabeth",
        "composition": ["R08", "T45 Destroyer", "T23 Frigate", "Astute SSN"],
        "home_port": "Portsmouth, UK",
        "lat": 50.80, "lon": -1.10,
        "region": "atlantic",
        "status": "in_port",
        "mission": "Workup",
    },
    "CHARLES_DE_GAULLE": {
        "name": "FS Charles de Gaulle (R91) CSG",
        "type": "carrier_strike_group",
        "fleet": "Marine Nationale",
        "flagship": "R91 Charles de Gaulle",
        "composition": ["R91", "Horizon AAW", "FREMM Frigate", "Rubis SSN"],
        "home_port": "Toulon, France",
        "lat": 35.00, "lon": 18.00,
        "region": "mediterranean",
        "status": "deployed",
        "mission": "Operation Clemenceau",
    },
    "LIAONING": {
        "name": "Liaoning (CV-16) CSG",
        "type": "carrier_strike_group",
        "fleet": "PLAN (China)",
        "flagship": "CV-16 Liaoning",
        "composition": ["CV-16", "Type 055", "Type 052D x2", "Type 054A x2"],
        "home_port": "Qingdao, China",
        "lat": 20.00, "lon": 115.00,
        "region": "south_china_sea",
        "status": "deployed",
        "mission": "South China Sea Patrol",
    },
    "SHANDONG": {
        "name": "Shandong (CV-17) CSG",
        "type": "carrier_strike_group",
        "fleet": "PLAN (China)",
        "flagship": "CV-17 Shandong",
        "composition": ["CV-17", "Type 055", "Type 052D x2"],
        "home_port": "Sanya, China",
        "lat": 18.20, "lon": 109.50,
        "region": "south_china_sea",
        "status": "in_port",
        "mission": "Training",
    },
    "KUZNETSOV": {
        "name": "Admiral Kuznetsov CSG",
        "type": "carrier_strike_group",
        "fleet": "Russian Navy",
        "flagship": "Admiral Kuznetsov",
        "composition": ["Kuznetsov", "Kirov-class", "Udaloy-class"],
        "home_port": "Severomorsk, Russia",
        "lat": 69.07, "lon": 33.42,
        "region": "arctic",
        "status": "in_port",
        "mission": "Extended Refit",
    },
    # Submarine Activity (known patrol areas)
    "SSBN_PATROL_ATLANTIC": {
        "name": "Ohio-class SSBN Patrol (Atlantic)",
        "type": "submarine_patrol",
        "fleet": "US Navy",
        "flagship": "Ohio-class SSBN",
        "composition": ["SSBN x1-2"],
        "home_port": "Kings Bay, GA",
        "lat": 35.00, "lon": -45.00,
        "region": "atlantic",
        "status": "on_patrol",
        "mission": "Strategic Deterrent Patrol",
    },
    "SSBN_PATROL_PACIFIC": {
        "name": "Ohio-class SSBN Patrol (Pacific)",
        "type": "submarine_patrol",
        "fleet": "US Navy",
        "flagship": "Ohio-class SSBN",
        "composition": ["SSBN x1-2"],
        "home_port": "Bangor, WA",
        "lat": 38.00, "lon": -170.00,
        "region": "pacific",
        "status": "on_patrol",
        "mission": "Strategic Deterrent Patrol",
    },
}

CACHE_TTL = 600  # 10 minutes
USNI_FLEET_URL = "https://news.usni.org/category/fleet-tracker"


class FleetIntelligenceService:
    def __init__(self):
        self._redis = None

    async def _get_redis(self):
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    async def get_fleet_positions(self, region: str = None) -> dict:
        """Get all known fleet positions and deployments."""
        try:
            r = await self._get_redis()
            cached = await r.get(f"fleet_positions:{region or 'all'}")
            if cached:
                return json.loads(cached)
        except Exception:
            pass

        fleets = []
        for fleet_id, data in FLEET_DEPLOYMENTS.items():
            if region and data.get("region") != region:
                continue
            fleets.append({
                "id": fleet_id,
                **data,
            })

        # Sort: deployed first, then by fleet name
        status_order = {"deployed": 0, "on_patrol": 0, "forward_deployed": 1, "in_port": 2}
        fleets.sort(key=lambda x: (status_order.get(x.get("status", ""), 3), x.get("name", "")))

        # Regional breakdown
        regions = {}
        for f in fleets:
            reg = f.get("region", "unknown")
            regions.setdefault(reg, []).append(f["id"])

        result = {
            "total_groups": len(fleets),
            "deployed": len([f for f in fleets if f["status"] in ("deployed", "on_patrol", "forward_deployed")]),
            "in_port": len([f for f in fleets if f["status"] == "in_port"]),
            "fleets": fleets,
            "by_region": {k: len(v) for k, v in regions.items()},
            "by_navy": self._count_by_navy(fleets),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        try:
            r = await self._get_redis()
            await r.setex(f"fleet_positions:{region or 'all'}", CACHE_TTL, json.dumps(result))
        except Exception:
            pass

        return result

    async def get_carrier_positions(self) -> list:
        """Get only aircraft carrier positions."""
        data = await self.get_fleet_positions()
        return [f for f in data.get("fleets", []) if f.get("type") == "carrier_strike_group"]

    async def get_deployed_forces(self) -> list:
        """Get only actively deployed naval forces."""
        data = await self.get_fleet_positions()
        return [
            f for f in data.get("fleets", [])
            if f.get("status") in ("deployed", "on_patrol", "forward_deployed")
        ]

    def _count_by_navy(self, fleets: list) -> dict:
        """Count fleet groups by navy."""
        counts = {}
        for f in fleets:
            navy = f.get("fleet", "Unknown")
            counts[navy] = counts.get(navy, 0) + 1
        return counts
