"""
Finance & Crypto Market Data Service
Fetches crypto prices, Fear & Greed Index, and basic market data.
"""

import json
import logging
from datetime import datetime, timezone

import httpx
import redis.asyncio as aioredis

from config import settings

logger = logging.getLogger(__name__)

# Top cryptocurrencies to track
CRYPTO_IDS = "bitcoin,ethereum,solana,ripple,cardano,dogecoin,avalanche-2,chainlink,polkadot,litecoin"
CRYPTO_VS = "usd"

# Major stock indices (Yahoo Finance symbols)
STOCK_INDICES = [
    {"symbol": "^GSPC", "name": "S&P 500", "country": "US"},
    {"symbol": "^DJI", "name": "Dow Jones", "country": "US"},
    {"symbol": "^IXIC", "name": "NASDAQ", "country": "US"},
    {"symbol": "^FTSE", "name": "FTSE 100", "country": "GB"},
    {"symbol": "^GDAXI", "name": "DAX", "country": "DE"},
    {"symbol": "^N225", "name": "Nikkei 225", "country": "JP"},
    {"symbol": "000001.SS", "name": "Shanghai Composite", "country": "CN"},
    {"symbol": "^HSI", "name": "Hang Seng", "country": "HK"},
    {"symbol": "^BSESN", "name": "BSE Sensex", "country": "IN"},
    {"symbol": "^TASI", "name": "Tadawul", "country": "SA"},
]


class FinanceService:
    """Market data aggregator with Redis caching."""

    def __init__(self):
        self.redis: aioredis.Redis | None = None
        self._client: httpx.AsyncClient | None = None

    async def _ensure_redis(self):
        if self.redis is None:
            self.redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

    async def _ensure_client(self):
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(15.0, connect=5.0),
                follow_redirects=True,
                headers={"User-Agent": "GlobalIntelPlatform/3.0"},
            )

    async def get_crypto_prices(self) -> dict:
        """Fetch crypto prices from CoinGecko (free, no API key)."""
        await self._ensure_redis()
        await self._ensure_client()

        cache_key = "finance:crypto:prices"
        cached = await self.redis.get(cache_key)
        if cached:
            try:
                return json.loads(cached)
            except json.JSONDecodeError:
                pass

        try:
            resp = await self._client.get(
                "https://api.coingecko.com/api/v3/coins/markets",
                params={
                    "vs_currency": CRYPTO_VS,
                    "ids": CRYPTO_IDS,
                    "order": "market_cap_desc",
                    "sparkline": "false",
                    "price_change_percentage": "1h,24h,7d",
                }
            )
            if resp.status_code == 200:
                data = resp.json()
                result = {
                    "coins": [
                        {
                            "id": c["id"],
                            "symbol": c["symbol"].upper(),
                            "name": c["name"],
                            "price": c["current_price"],
                            "market_cap": c["market_cap"],
                            "volume_24h": c["total_volume"],
                            "change_24h": c.get("price_change_percentage_24h", 0),
                            "change_7d": c.get("price_change_percentage_7d_in_currency", 0),
                            "rank": c["market_cap_rank"],
                            "image": c.get("image", ""),
                        }
                        for c in data
                    ],
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                }
                await self.redis.setex(cache_key, 120, json.dumps(result))  # 2-min cache
                return result
            else:
                logger.warning("CoinGecko returned %d", resp.status_code)
        except Exception as e:
            logger.warning("Crypto fetch error: %s", str(e)[:100])

        return {"coins": [], "fetched_at": datetime.now(timezone.utc).isoformat(), "error": "fetch_failed"}

    async def get_fear_greed(self) -> dict:
        """Fetch Crypto Fear & Greed Index."""
        await self._ensure_redis()
        await self._ensure_client()

        cache_key = "finance:fear_greed"
        cached = await self.redis.get(cache_key)
        if cached:
            try:
                return json.loads(cached)
            except json.JSONDecodeError:
                pass

        try:
            resp = await self._client.get("https://api.alternative.me/fng/?limit=30&format=json")
            if resp.status_code == 200:
                data = resp.json()
                entries = data.get("data", [])
                result = {
                    "current": {
                        "value": int(entries[0]["value"]) if entries else 50,
                        "classification": entries[0].get("value_classification", "Neutral") if entries else "Neutral",
                        "timestamp": entries[0].get("timestamp", "") if entries else "",
                    },
                    "history": [
                        {"value": int(e["value"]), "classification": e.get("value_classification", ""),
                         "date": datetime.fromtimestamp(int(e["timestamp"]), tz=timezone.utc).strftime("%Y-%m-%d")}
                        for e in entries[:30]
                    ],
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                }
                await self.redis.setex(cache_key, 600, json.dumps(result))  # 10-min cache
                return result
        except Exception as e:
            logger.warning("Fear & Greed fetch error: %s", str(e)[:100])

        return {"current": {"value": 50, "classification": "Neutral"}, "history": []}

    async def get_market_overview(self) -> dict:
        """Get a combined market overview."""
        await self._ensure_redis()

        cache_key = "finance:overview"
        cached = await self.redis.get(cache_key)
        if cached:
            try:
                return json.loads(cached)
            except json.JSONDecodeError:
                pass

        crypto = await self.get_crypto_prices()
        fear_greed = await self.get_fear_greed()

        btc = next((c for c in crypto.get("coins", []) if c["symbol"] == "BTC"), None)

        # Compute market sentiment
        fg_value = fear_greed.get("current", {}).get("value", 50)
        if fg_value >= 75:
            verdict = "EXTREME_GREED"
        elif fg_value >= 55:
            verdict = "GREED"
        elif fg_value >= 45:
            verdict = "NEUTRAL"
        elif fg_value >= 25:
            verdict = "FEAR"
        else:
            verdict = "EXTREME_FEAR"

        overview = {
            "crypto": crypto,
            "fear_greed": fear_greed,
            "indices": STOCK_INDICES,
            "sentiment": {
                "verdict": verdict,
                "fear_greed_value": fg_value,
                "btc_24h_change": btc["change_24h"] if btc else 0,
                "btc_price": btc["price"] if btc else 0,
            },
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }

        await self.redis.setex(cache_key, 180, json.dumps(overview))  # 3-min cache
        return overview

    async def close(self):
        if self._client:
            await self._client.aclose()
        if self.redis:
            await self.redis.close()
