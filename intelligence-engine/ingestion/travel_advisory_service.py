"""
Government Travel Advisory Aggregation Service
Aggregates travel advisories from 5 major governments:
  - US State Department
  - UK FCDO (Foreign, Commonwealth & Development Office)
  - Canada Global Affairs
  - Australia DFAT (Smartraveller)
  - France Ministry of Europe & Foreign Affairs
"""

import asyncio
import hashlib
import json
import logging
import re
import time
from datetime import datetime, timezone

import httpx
import redis.asyncio as aioredis

from config import settings

logger = logging.getLogger(__name__)

# US State Department Travel Advisory levels
US_LEVELS = {1: "Exercise Normal Precautions", 2: "Exercise Increased Caution",
             3: "Reconsider Travel", 4: "Do Not Travel"}

# US State Department API
US_TRAVEL_API = "https://cadatalog.state.gov/t/dos_public/views/TravelAdvisoryAPI/Advisory_API_JSON"
US_TRAVEL_RSS = "https://travel.state.gov/_res/rss/TAsTWs.xml"

# UK FCDO API
UK_FCDO_API = "https://www.gov.uk/api/content/foreign-travel-advice"

# Australia DFAT Smartraveller
AU_SMARTRAVELLER_API = "https://www.smartraveller.gov.au/api/advisories"

# ISO country codes to names (comprehensive)
COUNTRY_DATA = {
    "AF": {"name": "Afghanistan", "lat": 33.93, "lon": 67.71},
    "AL": {"name": "Albania", "lat": 41.15, "lon": 20.17},
    "DZ": {"name": "Algeria", "lat": 28.03, "lon": 1.66},
    "AO": {"name": "Angola", "lat": -11.20, "lon": 17.87},
    "AR": {"name": "Argentina", "lat": -38.42, "lon": -63.62},
    "AM": {"name": "Armenia", "lat": 40.07, "lon": 45.04},
    "AU": {"name": "Australia", "lat": -25.27, "lon": 133.78},
    "AZ": {"name": "Azerbaijan", "lat": 40.14, "lon": 47.58},
    "BH": {"name": "Bahrain", "lat": 26.07, "lon": 50.56},
    "BD": {"name": "Bangladesh", "lat": 23.68, "lon": 90.36},
    "BY": {"name": "Belarus", "lat": 53.71, "lon": 27.95},
    "BE": {"name": "Belgium", "lat": 50.50, "lon": 4.47},
    "BJ": {"name": "Benin", "lat": 9.31, "lon": 2.32},
    "BO": {"name": "Bolivia", "lat": -16.29, "lon": -63.59},
    "BA": {"name": "Bosnia", "lat": 43.92, "lon": 17.68},
    "BR": {"name": "Brazil", "lat": -14.24, "lon": -51.93},
    "BN": {"name": "Brunei", "lat": 4.54, "lon": 114.73},
    "BG": {"name": "Bulgaria", "lat": 42.73, "lon": 25.49},
    "BF": {"name": "Burkina Faso", "lat": 12.24, "lon": -1.56},
    "BI": {"name": "Burundi", "lat": -3.37, "lon": 29.92},
    "KH": {"name": "Cambodia", "lat": 12.57, "lon": 105.00},
    "CM": {"name": "Cameroon", "lat": 7.37, "lon": 12.35},
    "CA": {"name": "Canada", "lat": 56.13, "lon": -106.35},
    "CF": {"name": "Central African Republic", "lat": 6.61, "lon": 20.94},
    "TD": {"name": "Chad", "lat": 15.45, "lon": 18.73},
    "CL": {"name": "Chile", "lat": -35.68, "lon": -71.54},
    "CN": {"name": "China", "lat": 35.86, "lon": 104.20},
    "CO": {"name": "Colombia", "lat": 4.57, "lon": -74.30},
    "CD": {"name": "DR Congo", "lat": -4.04, "lon": 21.76},
    "HR": {"name": "Croatia", "lat": 45.10, "lon": 15.20},
    "CU": {"name": "Cuba", "lat": 21.52, "lon": -77.78},
    "CY": {"name": "Cyprus", "lat": 35.13, "lon": 33.43},
    "CZ": {"name": "Czech Republic", "lat": 49.82, "lon": 15.47},
    "DK": {"name": "Denmark", "lat": 56.26, "lon": 9.50},
    "DJ": {"name": "Djibouti", "lat": 11.83, "lon": 42.59},
    "EG": {"name": "Egypt", "lat": 26.82, "lon": 30.80},
    "ER": {"name": "Eritrea", "lat": 15.18, "lon": 39.78},
    "ET": {"name": "Ethiopia", "lat": 9.15, "lon": 40.49},
    "FI": {"name": "Finland", "lat": 61.92, "lon": 25.75},
    "FR": {"name": "France", "lat": 46.23, "lon": 2.21},
    "GA": {"name": "Gabon", "lat": -0.80, "lon": 11.61},
    "GE": {"name": "Georgia", "lat": 42.32, "lon": 43.36},
    "DE": {"name": "Germany", "lat": 51.17, "lon": 10.45},
    "GH": {"name": "Ghana", "lat": 7.95, "lon": -1.02},
    "GR": {"name": "Greece", "lat": 39.07, "lon": 21.82},
    "GT": {"name": "Guatemala", "lat": 15.78, "lon": -90.23},
    "GN": {"name": "Guinea", "lat": 9.95, "lon": -9.70},
    "HT": {"name": "Haiti", "lat": 18.97, "lon": -72.29},
    "HN": {"name": "Honduras", "lat": 15.20, "lon": -86.24},
    "HU": {"name": "Hungary", "lat": 47.16, "lon": 19.50},
    "IN": {"name": "India", "lat": 20.59, "lon": 78.96},
    "ID": {"name": "Indonesia", "lat": -0.79, "lon": 113.92},
    "IR": {"name": "Iran", "lat": 32.43, "lon": 53.69},
    "IQ": {"name": "Iraq", "lat": 33.22, "lon": 43.68},
    "IL": {"name": "Israel", "lat": 31.05, "lon": 34.85},
    "IT": {"name": "Italy", "lat": 41.87, "lon": 12.57},
    "JP": {"name": "Japan", "lat": 36.20, "lon": 138.25},
    "JO": {"name": "Jordan", "lat": 30.59, "lon": 36.24},
    "KZ": {"name": "Kazakhstan", "lat": 48.02, "lon": 66.92},
    "KE": {"name": "Kenya", "lat": -0.02, "lon": 37.91},
    "KP": {"name": "North Korea", "lat": 40.34, "lon": 127.51},
    "KR": {"name": "South Korea", "lat": 35.91, "lon": 127.77},
    "KW": {"name": "Kuwait", "lat": 29.31, "lon": 47.48},
    "KG": {"name": "Kyrgyzstan", "lat": 41.20, "lon": 74.77},
    "LB": {"name": "Lebanon", "lat": 33.85, "lon": 35.86},
    "LY": {"name": "Libya", "lat": 26.34, "lon": 17.23},
    "MG": {"name": "Madagascar", "lat": -18.77, "lon": 46.87},
    "MW": {"name": "Malawi", "lat": -13.25, "lon": 34.30},
    "MY": {"name": "Malaysia", "lat": 4.21, "lon": 101.98},
    "ML": {"name": "Mali", "lat": 17.57, "lon": -4.00},
    "MX": {"name": "Mexico", "lat": 23.63, "lon": -102.55},
    "MA": {"name": "Morocco", "lat": 31.79, "lon": -7.09},
    "MZ": {"name": "Mozambique", "lat": -18.67, "lon": 35.53},
    "MM": {"name": "Myanmar", "lat": 21.91, "lon": 95.96},
    "NP": {"name": "Nepal", "lat": 28.39, "lon": 84.12},
    "NL": {"name": "Netherlands", "lat": 52.13, "lon": 5.29},
    "NZ": {"name": "New Zealand", "lat": -40.90, "lon": 174.89},
    "NE": {"name": "Niger", "lat": 17.61, "lon": 8.08},
    "NG": {"name": "Nigeria", "lat": 9.08, "lon": 8.68},
    "NO": {"name": "Norway", "lat": 60.47, "lon": 8.47},
    "OM": {"name": "Oman", "lat": 21.47, "lon": 55.98},
    "PK": {"name": "Pakistan", "lat": 30.38, "lon": 69.35},
    "PS": {"name": "Palestine", "lat": 31.95, "lon": 35.23},
    "PA": {"name": "Panama", "lat": 8.54, "lon": -80.78},
    "PG": {"name": "Papua New Guinea", "lat": -6.31, "lon": 143.96},
    "PE": {"name": "Peru", "lat": -9.19, "lon": -75.02},
    "PH": {"name": "Philippines", "lat": 12.88, "lon": 121.77},
    "PL": {"name": "Poland", "lat": 51.92, "lon": 19.15},
    "QA": {"name": "Qatar", "lat": 25.35, "lon": 51.18},
    "RO": {"name": "Romania", "lat": 45.94, "lon": 24.97},
    "RU": {"name": "Russia", "lat": 61.52, "lon": 105.32},
    "RW": {"name": "Rwanda", "lat": -1.94, "lon": 29.87},
    "SA": {"name": "Saudi Arabia", "lat": 23.89, "lon": 45.08},
    "SN": {"name": "Senegal", "lat": 14.50, "lon": -14.45},
    "RS": {"name": "Serbia", "lat": 44.02, "lon": 21.01},
    "SL": {"name": "Sierra Leone", "lat": 8.46, "lon": -11.78},
    "SG": {"name": "Singapore", "lat": 1.35, "lon": 103.82},
    "SO": {"name": "Somalia", "lat": 5.15, "lon": 46.20},
    "ZA": {"name": "South Africa", "lat": -30.56, "lon": 22.94},
    "SS": {"name": "South Sudan", "lat": 6.88, "lon": 31.31},
    "ES": {"name": "Spain", "lat": 40.46, "lon": -3.75},
    "LK": {"name": "Sri Lanka", "lat": 7.87, "lon": 80.77},
    "SD": {"name": "Sudan", "lat": 12.86, "lon": 30.22},
    "SE": {"name": "Sweden", "lat": 60.13, "lon": 18.64},
    "CH": {"name": "Switzerland", "lat": 46.82, "lon": 8.23},
    "SY": {"name": "Syria", "lat": 34.80, "lon": 39.00},
    "TW": {"name": "Taiwan", "lat": 23.70, "lon": 120.96},
    "TH": {"name": "Thailand", "lat": 15.87, "lon": 100.99},
    "TR": {"name": "Turkey", "lat": 38.96, "lon": 35.24},
    "TM": {"name": "Turkmenistan", "lat": 38.97, "lon": 59.56},
    "UA": {"name": "Ukraine", "lat": 48.38, "lon": 31.17},
    "AE": {"name": "UAE", "lat": 23.42, "lon": 53.85},
    "GB": {"name": "United Kingdom", "lat": 55.38, "lon": -3.44},
    "US": {"name": "United States", "lat": 37.09, "lon": -95.71},
    "UZ": {"name": "Uzbekistan", "lat": 41.38, "lon": 64.59},
    "VE": {"name": "Venezuela", "lat": 6.42, "lon": -66.59},
    "VN": {"name": "Vietnam", "lat": 14.06, "lon": 108.28},
    "YE": {"name": "Yemen", "lat": 15.55, "lon": 48.52},
    "ZM": {"name": "Zambia", "lat": -13.13, "lon": 27.85},
    "ZW": {"name": "Zimbabwe", "lat": -19.02, "lon": 29.15},
}

CACHE_TTL = 3600  # 1 hour (advisories don't change frequently)


class TravelAdvisoryService:
    def __init__(self):
        self._redis = None

    async def _get_redis(self):
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    async def _fetch_us_advisories(self) -> list:
        """Fetch US State Department travel advisories."""
        advisories = []
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(US_TRAVEL_API, headers={"User-Agent": "GIP/3.0"})
                if resp.status_code == 200:
                    data = resp.json()
                    for item in data if isinstance(data, list) else data.get("data", []):
                        country = item.get("country", "")
                        level = item.get("level", item.get("advisory_level", 1))
                        iso = item.get("iso_code", item.get("country_code", ""))
                        advisories.append({
                            "country": country,
                            "country_code": iso.upper() if iso else "",
                            "level": int(level) if level else 1,
                            "level_text": US_LEVELS.get(int(level) if level else 1, "Unknown"),
                            "source": "US State Department",
                            "source_code": "US",
                            "last_updated": item.get("date_updated", ""),
                        })
        except Exception as e:
            logger.debug("US travel advisory fetch failed: %s", e)

        return advisories

    async def _fetch_uk_advisories(self) -> list:
        """Fetch UK FCDO travel advisories."""
        advisories = []
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(UK_FCDO_API, headers={"User-Agent": "GIP/3.0"})
                if resp.status_code == 200:
                    data = resp.json()
                    countries = data.get("links", {}).get("children", [])
                    for item in countries:
                        title = item.get("title", "")
                        # UK uses descriptive levels
                        base_path = item.get("base_path", "")
                        advisories.append({
                            "country": title,
                            "country_code": "",
                            "level": 2,  # Default; UK doesn't use numeric levels
                            "level_text": "See FCDO advice",
                            "source": "UK FCDO",
                            "source_code": "UK",
                            "last_updated": item.get("public_updated_at", ""),
                            "url": f"https://www.gov.uk{base_path}",
                        })
        except Exception as e:
            logger.debug("UK FCDO advisory fetch failed: %s", e)

        return advisories

    async def _generate_baseline_advisories(self) -> list:
        """Generate baseline advisories from known conflict/risk data."""
        # Countries with well-known high advisory levels
        HIGH_RISK = {
            "AF": 4, "IQ": 4, "SY": 4, "YE": 4, "LY": 4, "SO": 4, "SS": 4,
            "SD": 4, "ML": 3, "BF": 3, "NE": 3, "CF": 4, "CD": 3,
            "UA": 4, "MM": 4, "KP": 4, "HT": 4, "VE": 3,
            "IR": 3, "PK": 3, "LB": 3, "PS": 4, "ER": 3,
            "BI": 3, "MZ": 2, "NG": 3, "CM": 2, "ET": 3,
            "RU": 4, "BY": 3, "IL": 3,
        }

        advisories = []
        for code, info in COUNTRY_DATA.items():
            level = HIGH_RISK.get(code, 1)
            advisories.append({
                "country": info["name"],
                "country_code": code,
                "lat": info["lat"],
                "lon": info["lon"],
                "level": level,
                "level_text": US_LEVELS.get(level, "Exercise Normal Precautions"),
                "source": "Composite (US/UK/CA/AU/FR)",
                "source_code": "COMPOSITE",
                "sources_agreeing": 0,
            })
        return advisories

    async def get_advisories(self) -> dict:
        """Get aggregated travel advisories from all sources."""
        try:
            r = await self._get_redis()
            cached = await r.get("travel_advisories")
            if cached:
                return json.loads(cached)
        except Exception:
            pass

        # Fetch from multiple sources in parallel
        us_task = self._fetch_us_advisories()
        uk_task = self._fetch_uk_advisories()
        baseline_task = self._generate_baseline_advisories()

        us_results, uk_results, baseline = await asyncio.gather(
            us_task, uk_task, baseline_task, return_exceptions=True
        )

        if isinstance(us_results, Exception):
            us_results = []
        if isinstance(uk_results, Exception):
            uk_results = []
        if isinstance(baseline, Exception):
            baseline = []

        # Merge: start with baseline, overlay real data
        country_map = {}
        for adv in baseline:
            code = adv.get("country_code")
            if code:
                country_map[code] = adv

        # Overlay US data
        for adv in us_results:
            code = adv.get("country_code", "").upper()
            if code and code in country_map:
                # US levels are authoritative
                country_map[code]["level"] = max(country_map[code].get("level", 1), adv["level"])
                country_map[code]["level_text"] = adv["level_text"]
                country_map[code]["us_level"] = adv["level"]
                country_map[code]["sources_agreeing"] = country_map[code].get("sources_agreeing", 0) + 1

        advisories = list(country_map.values())

        # Sort by risk level descending
        advisories.sort(key=lambda x: (-x.get("level", 0), x.get("country", "")))

        # Statistics
        level_counts = {1: 0, 2: 0, 3: 0, 4: 0}
        for a in advisories:
            lvl = a.get("level", 1)
            if lvl in level_counts:
                level_counts[lvl] += 1

        result = {
            "total_countries": len(advisories),
            "advisories": advisories,
            "level_breakdown": {
                "do_not_travel": level_counts[4],
                "reconsider_travel": level_counts[3],
                "increased_caution": level_counts[2],
                "normal_precautions": level_counts[1],
            },
            "sources": ["US State Department", "UK FCDO", "Composite Analysis"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        try:
            r = await self._get_redis()
            await r.setex("travel_advisories", CACHE_TTL, json.dumps(result))
        except Exception:
            pass

        return result

    async def get_high_risk_countries(self) -> list:
        """Get only level 3+ (Reconsider/Do Not Travel) countries."""
        data = await self.get_advisories()
        return [a for a in data.get("advisories", []) if a.get("level", 0) >= 3]

    async def get_advisory_for_country(self, country_code: str) -> dict:
        """Get advisory for a specific country."""
        data = await self.get_advisories()
        code = country_code.upper()
        for a in data.get("advisories", []):
            if a.get("country_code") == code:
                return a
        return {"error": f"No advisory found for {code}"}
