"""
Polymarket Prediction Markets Service
Tracks geopolitical prediction markets for conflict, elections, policy outcomes.
Real-time probability signals from crowd-sourced forecasting.
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

# Polymarket API
POLYMARKET_API = "https://clob.polymarket.com"
POLYMARKET_GAMMA_API = "https://gamma-api.polymarket.com"

# Categories we care about
GEOPOLITICAL_TAGS = [
    "politics", "geopolitics", "war", "conflict", "military",
    "elections", "nuclear", "china", "russia", "ukraine",
    "iran", "israel", "nato", "trade", "sanctions",
    "climate", "terrorism", "cyber", "ai-policy",
]

CACHE_TTL = 300  # 5 minutes


class PolymarketService:
    def __init__(self):
        self._redis = None

    async def _get_redis(self):
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    async def _fetch_markets(self, limit: int = 100) -> list:
        """Fetch active geopolitical prediction markets."""
        markets = []
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # Use Gamma API for market discovery
                resp = await client.get(
                    f"{POLYMARKET_GAMMA_API}/markets",
                    params={
                        "limit": limit,
                        "active": True,
                        "closed": False,
                        "order": "volume24hr",
                        "ascending": False,
                    },
                    headers={"User-Agent": "GIP-Predictions/3.0"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    items = data if isinstance(data, list) else data.get("data", data.get("markets", []))
                    for item in items:
                        # Filter for geopolitical relevance
                        title = (item.get("question", "") or item.get("title", "")).lower()
                        tags = [t.lower() for t in (item.get("tags", []) or [])]
                        description = (item.get("description", "") or "").lower()

                        is_geopolitical = any(
                            tag in " ".join(tags) + " " + title + " " + description
                            for tag in GEOPOLITICAL_TAGS
                        )

                        if not is_geopolitical:
                            continue

                        market_id = item.get("id", item.get("condition_id", ""))
                        prob = item.get("outcomePrices", item.get("outcomes_prices", []))
                        yes_price = 0
                        if isinstance(prob, list) and len(prob) > 0:
                            yes_price = float(prob[0]) if prob[0] else 0
                        elif isinstance(prob, str):
                            try:
                                prices = json.loads(prob)
                                yes_price = float(prices[0]) if prices else 0
                            except (json.JSONDecodeError, IndexError):
                                pass

                        volume = float(item.get("volume", item.get("volume24hr", 0)) or 0)
                        liquidity = float(item.get("liquidity", 0) or 0)

                        markets.append({
                            "id": hashlib.md5(str(market_id).encode()).hexdigest()[:12],
                            "market_id": str(market_id),
                            "question": item.get("question", item.get("title", "")),
                            "description": (item.get("description", "") or "")[:300],
                            "probability": round(yes_price * 100, 1),
                            "volume_usd": round(volume, 2),
                            "liquidity_usd": round(liquidity, 2),
                            "category": self._categorize_market(title, tags),
                            "tags": tags[:5],
                            "end_date": item.get("endDate", item.get("end_date_iso", "")),
                            "image": item.get("image", ""),
                            "url": f"https://polymarket.com/event/{item.get('slug', market_id)}",
                            "outcomes": item.get("outcomes", ["Yes", "No"]),
                        })

        except Exception as e:
            logger.error("Polymarket fetch failed: %s", e)

        return markets

    async def get_geopolitical_markets(self) -> dict:
        """Get all active geopolitical prediction markets."""
        try:
            r = await self._get_redis()
            cached = await r.get("polymarket_geo")
            if cached:
                return json.loads(cached)
        except Exception:
            pass

        markets = await self._fetch_markets(limit=200)

        # Sort by volume
        markets.sort(key=lambda x: -x.get("volume_usd", 0))

        # Group by category
        by_category = {}
        for m in markets:
            cat = m.get("category", "other")
            by_category.setdefault(cat, []).append(m)

        # High-probability alerts (>80% or <20% = strong consensus)
        strong_signals = [
            m for m in markets
            if m["probability"] > 80 or m["probability"] < 20
        ]

        result = {
            "total_markets": len(markets),
            "markets": markets[:100],
            "by_category": {k: len(v) for k, v in by_category.items()},
            "strong_signals": strong_signals[:20],
            "total_volume_usd": sum(m.get("volume_usd", 0) for m in markets),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        try:
            r = await self._get_redis()
            await r.setex("polymarket_geo", CACHE_TTL, json.dumps(result))
        except Exception:
            pass

        return result

    async def get_conflict_predictions(self) -> list:
        """Get only conflict/war-related prediction markets."""
        data = await self.get_geopolitical_markets()
        conflict_keywords = ["war", "conflict", "invade", "attack", "military", "nuclear", "strike"]
        return [
            m for m in data.get("markets", [])
            if any(kw in m.get("question", "").lower() for kw in conflict_keywords)
        ]

    async def get_election_predictions(self) -> list:
        """Get election-related prediction markets."""
        data = await self.get_geopolitical_markets()
        election_keywords = ["election", "president", "prime minister", "vote", "win", "nominee"]
        return [
            m for m in data.get("markets", [])
            if any(kw in m.get("question", "").lower() for kw in election_keywords)
        ]

    def _categorize_market(self, title: str, tags: list) -> str:
        """Categorize a market into geopolitical subcategories."""
        text = title + " " + " ".join(tags)
        if any(w in text for w in ["war", "conflict", "invade", "attack", "military"]):
            return "conflict"
        if any(w in text for w in ["election", "president", "vote", "nominee", "party"]):
            return "elections"
        if any(w in text for w in ["nuclear", "weapon", "wmd", "missile"]):
            return "nuclear"
        if any(w in text for w in ["sanction", "trade", "tariff", "embargo"]):
            return "trade_sanctions"
        if any(w in text for w in ["nato", "alliance", "treaty", "diplomacy"]):
            return "diplomacy"
        if any(w in text for w in ["cyber", "hack", "ransomware"]):
            return "cyber"
        if any(w in text for w in ["climate", "environment", "carbon"]):
            return "climate"
        return "geopolitics"
