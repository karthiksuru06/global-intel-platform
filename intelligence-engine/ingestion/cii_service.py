"""
Country Instability Index (CII) Service
Computes per-country instability scores (0-100) with weighted multi-signal blend.
23 tier-1 nations have tuned baseline risk profiles.
"""

import json
import logging
import math
from datetime import datetime, timezone, timedelta
from typing import Any

import redis.asyncio as aioredis

from config import settings

logger = logging.getLogger(__name__)

# ── Tier-1 Nation Baselines ──
# {country_code: {name, baseline_risk, event_multiplier, keywords}}
TIER1_NATIONS: dict[str, dict[str, Any]] = {
    "US": {"name": "United States", "baseline_risk": 20, "event_multiplier": 0.6,
           "keywords": ["united states", "american", "washington", "pentagon", "biden", "trump", "white house"]},
    "RU": {"name": "Russia", "baseline_risk": 55, "event_multiplier": 1.4,
           "keywords": ["russia", "russian", "moscow", "kremlin", "putin"]},
    "CN": {"name": "China", "baseline_risk": 35, "event_multiplier": 1.0,
           "keywords": ["china", "chinese", "beijing", "xi jinping", "pla"]},
    "UA": {"name": "Ukraine", "baseline_risk": 65, "event_multiplier": 1.8,
           "keywords": ["ukraine", "ukrainian", "kyiv", "zelensky"]},
    "IR": {"name": "Iran", "baseline_risk": 55, "event_multiplier": 1.5,
           "keywords": ["iran", "iranian", "tehran", "khamenei", "irgc"]},
    "IL": {"name": "Israel", "baseline_risk": 50, "event_multiplier": 1.5,
           "keywords": ["israel", "israeli", "tel aviv", "jerusalem", "idf", "netanyahu"]},
    "TW": {"name": "Taiwan", "baseline_risk": 40, "event_multiplier": 1.3,
           "keywords": ["taiwan", "taiwanese", "taipei"]},
    "KP": {"name": "North Korea", "baseline_risk": 60, "event_multiplier": 1.6,
           "keywords": ["north korea", "dprk", "pyongyang", "kim jong"]},
    "SA": {"name": "Saudi Arabia", "baseline_risk": 30, "event_multiplier": 0.9,
           "keywords": ["saudi", "riyadh", "mbs"]},
    "TR": {"name": "Turkey", "baseline_risk": 35, "event_multiplier": 1.0,
           "keywords": ["turkey", "turkish", "ankara", "erdogan"]},
    "PL": {"name": "Poland", "baseline_risk": 20, "event_multiplier": 0.7,
           "keywords": ["poland", "polish", "warsaw"]},
    "DE": {"name": "Germany", "baseline_risk": 15, "event_multiplier": 0.5,
           "keywords": ["germany", "german", "berlin"]},
    "FR": {"name": "France", "baseline_risk": 18, "event_multiplier": 0.6,
           "keywords": ["france", "french", "paris", "macron"]},
    "GB": {"name": "United Kingdom", "baseline_risk": 15, "event_multiplier": 0.5,
           "keywords": ["united kingdom", "british", "london", "uk"]},
    "IN": {"name": "India", "baseline_risk": 30, "event_multiplier": 0.9,
           "keywords": ["india", "indian", "delhi", "modi"]},
    "PK": {"name": "Pakistan", "baseline_risk": 45, "event_multiplier": 1.3,
           "keywords": ["pakistan", "pakistani", "islamabad"]},
    "SY": {"name": "Syria", "baseline_risk": 70, "event_multiplier": 1.8,
           "keywords": ["syria", "syrian", "damascus"]},
    "YE": {"name": "Yemen", "baseline_risk": 70, "event_multiplier": 1.8,
           "keywords": ["yemen", "yemeni", "houthi", "sanaa"]},
    "MM": {"name": "Myanmar", "baseline_risk": 60, "event_multiplier": 1.5,
           "keywords": ["myanmar", "burma", "naypyidaw"]},
    "VE": {"name": "Venezuela", "baseline_risk": 50, "event_multiplier": 1.3,
           "keywords": ["venezuela", "venezuelan", "caracas", "maduro"]},
    "BR": {"name": "Brazil", "baseline_risk": 25, "event_multiplier": 0.7,
           "keywords": ["brazil", "brazilian", "brasilia"]},
    "AE": {"name": "UAE", "baseline_risk": 15, "event_multiplier": 0.5,
           "keywords": ["uae", "emirates", "abu dhabi", "dubai"]},
    "JP": {"name": "Japan", "baseline_risk": 10, "event_multiplier": 0.4,
           "keywords": ["japan", "japanese", "tokyo"]},
}

DEFAULT_BASELINE_RISK = 15
DEFAULT_EVENT_MULTIPLIER = 1.0


class CountryInstabilityService:
    """Computes and caches per-country instability scores."""

    def __init__(self):
        self.redis: aioredis.Redis | None = None

    async def _ensure_redis(self):
        if self.redis is None:
            self.redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

    def _match_country(self, text: str) -> list[str]:
        """Extract country codes mentioned in text."""
        text_lower = text.lower()
        matches = []
        for code, profile in TIER1_NATIONS.items():
            for kw in profile["keywords"]:
                if kw in text_lower:
                    matches.append(code)
                    break
        return matches

    async def compute_scores(self, events: list[dict] = None, news_items: list[dict] = None) -> dict[str, dict]:
        """
        Compute CII scores for all countries with available data.
        Returns: {country_code: {name, score, components, trend, tier}}
        """
        await self._ensure_redis()

        scores: dict[str, dict] = {}

        # Initialize all tier-1 nations
        for code, profile in TIER1_NATIONS.items():
            scores[code] = {
                "name": profile["name"],
                "baseline_risk": profile["baseline_risk"],
                "unrest_score": 0,
                "security_score": 0,
                "info_velocity": 0,
                "event_count": 0,
                "news_count": 0,
                "multiplier": profile["event_multiplier"],
            }

        # Process geo-events
        if events:
            for ev in events:
                # Try to match country from metadata or source
                meta = ev.get("metadata", {}) or {}
                country_codes = []

                # Direct country code in metadata
                if meta.get("country_code"):
                    country_codes.append(meta["country_code"])

                # Match from event source/name
                name = meta.get("name", "") or meta.get("callsign", "") or ""
                source = ev.get("source", "")
                country_codes.extend(self._match_country(f"{name} {source}"))

                ev_type = ev.get("type", "")
                severity = ev.get("severity", 1) or 1

                for cc in set(country_codes):
                    if cc not in scores:
                        scores[cc] = {
                            "name": cc,
                            "baseline_risk": DEFAULT_BASELINE_RISK,
                            "unrest_score": 0,
                            "security_score": 0,
                            "info_velocity": 0,
                            "event_count": 0,
                            "news_count": 0,
                            "multiplier": DEFAULT_EVENT_MULTIPLIER,
                        }
                    scores[cc]["event_count"] += 1

                    if ev_type in ("conflicts", "protests"):
                        scores[cc]["unrest_score"] += severity * 3
                    elif ev_type in ("military", "bases", "aircraft", "ship"):
                        scores[cc]["security_score"] += severity * 2
                    else:
                        scores[cc]["info_velocity"] += severity

        # Process news items
        if news_items:
            for item in news_items:
                title = item.get("title", "")
                desc = item.get("description", "")
                severity = item.get("severity", 1) or 1
                country_codes = self._match_country(f"{title} {desc}")

                for cc in set(country_codes):
                    if cc not in scores:
                        scores[cc] = {
                            "name": cc,
                            "baseline_risk": DEFAULT_BASELINE_RISK,
                            "unrest_score": 0,
                            "security_score": 0,
                            "info_velocity": 0,
                            "event_count": 0,
                            "news_count": 0,
                            "multiplier": DEFAULT_EVENT_MULTIPLIER,
                        }
                    scores[cc]["news_count"] += 1
                    scores[cc]["info_velocity"] += severity * scores[cc]["multiplier"]

        # Compute final scores
        results: dict[str, dict] = {}
        for code, data in scores.items():
            baseline = data["baseline_risk"]
            multiplier = data["multiplier"]

            # Normalize component scores (0-100 each)
            unrest = min(100, data["unrest_score"] * multiplier)
            security = min(100, data["security_score"] * multiplier)
            info_vel = min(100, data["info_velocity"] * math.log1p(data["news_count"] + 1) * 2)

            # Weighted composite: baseline 40%, unrest 20%, security 20%, info 20%
            composite = (
                baseline * 0.40 +
                unrest * 0.20 +
                security * 0.20 +
                info_vel * 0.20
            )

            # Apply conflict zone floors
            floors = {"UA": 55, "SY": 50, "YE": 50, "MM": 45}
            if code in floors:
                composite = max(composite, floors[code])

            composite = min(100, max(0, round(composite, 1)))

            # Determine severity label
            if composite >= 75:
                severity_label = "critical"
            elif composite >= 50:
                severity_label = "high"
            elif composite >= 30:
                severity_label = "medium"
            else:
                severity_label = "low"

            results[code] = {
                "country_code": code,
                "name": data["name"],
                "score": composite,
                "severity": severity_label,
                "components": {
                    "baseline": round(baseline, 1),
                    "unrest": round(unrest, 1),
                    "security": round(security, 1),
                    "information": round(info_vel, 1),
                },
                "event_count": data["event_count"],
                "news_count": data["news_count"],
                "tier": 1 if code in TIER1_NATIONS else 2,
                "computed_at": datetime.now(timezone.utc).isoformat(),
            }

        # Cache results
        await self.redis.setex(
            "cii:scores:latest",
            300,  # 5-minute cache
            json.dumps(results)
        )

        # Store historical for trend detection
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M")
        await self.redis.setex(f"cii:history:{ts}", 86400, json.dumps(results))

        return results

    async def get_cached_scores(self) -> dict | None:
        """Get cached CII scores."""
        await self._ensure_redis()
        cached = await self.redis.get("cii:scores:latest")
        if cached:
            try:
                return json.loads(cached)
            except json.JSONDecodeError:
                pass
        return None

    async def get_top_risk(self, n: int = 10) -> list[dict]:
        """Get top N highest-risk countries."""
        scores = await self.get_cached_scores()
        if not scores:
            return []
        ranked = sorted(scores.values(), key=lambda x: x["score"], reverse=True)
        return ranked[:n]

    async def close(self):
        if self.redis:
            await self.redis.close()
