"""
Telegram OSINT Feed Service
Monitors public Telegram channels for OSINT intelligence via RSS bridge proxies.
Channels cover conflict zones, military movements, breaking alerts, cyber threats.
"""

import asyncio
import hashlib
import logging
import time
from datetime import datetime, timezone
from xml.etree import ElementTree

import httpx
import redis.asyncio as aioredis

from config import settings

logger = logging.getLogger(__name__)

# ── Public Telegram OSINT Channels (via RSS bridge) ──
# Format: (channel_username, category, priority, region)
TELEGRAM_CHANNELS = [
    # Conflict & Military
    ("intelooperofficial", "conflict", "critical", "global"),
    ("militaborz", "military", "high", "europe"),
    ("ryaborofficial", "conflict", "critical", "europe"),
    ("mod_russia_en", "military", "high", "europe"),
    ("ukaborz", "conflict", "critical", "europe"),
    ("militarysummary", "conflict", "high", "global"),
    ("intelinua", "conflict", "critical", "europe"),
    ("oaborz", "conflict", "high", "mena"),
    # Nuclear & WMD
    ("nuclearalert", "nuclear", "critical", "global"),
    ("naborz", "nuclear", "high", "global"),
    # Cyber & InfoSec
    ("cyberundergroundfeed", "cyber", "high", "global"),
    ("daborz", "cyber", "high", "global"),
    ("ransomwareintel", "cyber", "high", "global"),
    ("hackerspace", "cyber", "medium", "global"),
    # Maritime & Aviation
    ("marinetrafficfeed", "maritime", "medium", "global"),
    ("aviationgeek", "aviation", "medium", "global"),
    # Middle East
    ("gazanow", "conflict", "critical", "mena"),
    ("israelradar", "conflict", "critical", "mena"),
    ("iaborz", "conflict", "high", "mena"),
    ("yeaborz", "conflict", "high", "mena"),
    # Asia-Pacific
    ("southchinaseawatch", "military", "high", "asia"),
    ("taiwannews", "geopolitics", "high", "asia"),
    ("nkaborz", "nuclear", "critical", "asia"),
    # Africa
    ("sahelnow", "conflict", "high", "africa"),
    ("africaintel", "conflict", "medium", "africa"),
    # OSINT Aggregators
    ("osaborz", "osint", "high", "global"),
    ("bellingcatauto", "osint", "high", "global"),
    ("gaborz", "osint", "medium", "global"),
    ("intelslava", "conflict", "high", "global"),
    ("breakingaborz", "breaking", "critical", "global"),
]

# RSS bridge endpoints (multiple for redundancy)
RSS_BRIDGES = [
    "https://rsshub.app/telegram/channel",
    "https://rss.app/feeds/telegram",
]

CACHE_TTL = 600  # 10 minutes
FETCH_TIMEOUT = 15.0
MAX_CONCURRENT = 10


class TelegramOSINTService:
    def __init__(self):
        self._redis = None
        self._cache_key = "telegram_osint_digest"
        self._items_key = "telegram_osint_items"

    async def _get_redis(self):
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    async def _fetch_channel(self, channel: str, category: str, priority: str, region: str) -> list:
        """Fetch messages from a single Telegram channel via RSS bridge."""
        items = []
        async with httpx.AsyncClient(timeout=FETCH_TIMEOUT, follow_redirects=True) as client:
            for bridge_base in RSS_BRIDGES:
                try:
                    url = f"{bridge_base}/{channel}"
                    resp = await client.get(url, headers={"User-Agent": "GIP-OSINT/3.0"})
                    if resp.status_code != 200:
                        continue

                    root = ElementTree.fromstring(resp.text)
                    # Parse RSS items
                    for item in root.iter("item"):
                        title_el = item.find("title")
                        desc_el = item.find("description")
                        link_el = item.find("link")
                        pub_el = item.find("pubDate")

                        title = title_el.text if title_el is not None and title_el.text else ""
                        description = desc_el.text if desc_el is not None and desc_el.text else ""
                        link = link_el.text if link_el is not None and link_el.text else ""
                        pub_date = pub_el.text if pub_el is not None and pub_el.text else ""

                        content = title or description[:200]
                        if not content.strip():
                            continue

                        msg_id = hashlib.md5(f"{channel}:{link}:{content[:50]}".encode()).hexdigest()[:12]

                        items.append({
                            "id": msg_id,
                            "channel": channel,
                            "category": category,
                            "priority": priority,
                            "region": region,
                            "title": content[:300],
                            "description": description[:500] if description != content else "",
                            "link": link,
                            "published": pub_date,
                            "source": f"telegram/@{channel}",
                        })

                    if items:
                        break  # Success with this bridge
                except Exception as e:
                    logger.debug("RSS bridge failed for @%s via %s: %s", channel, bridge_base, e)
                    continue

        return items[:20]  # Max 20 per channel

    async def aggregate_channels(self, region_filter: str = None, category_filter: str = None) -> dict:
        """Aggregate messages from all monitored Telegram OSINT channels."""
        # Check cache first
        try:
            r = await self._get_redis()
            cached = await r.get(self._cache_key)
            if cached:
                import json
                digest = json.loads(cached)
                # Apply filters on cached data
                if region_filter or category_filter:
                    digest["items"] = [
                        i for i in digest.get("items", [])
                        if (not region_filter or i.get("region") == region_filter)
                        and (not category_filter or i.get("category") == category_filter)
                    ]
                return digest
        except Exception:
            pass

        # Fetch all channels concurrently
        sem = asyncio.Semaphore(MAX_CONCURRENT)
        all_items = []

        async def fetch_with_sem(ch, cat, pri, reg):
            async with sem:
                try:
                    return await asyncio.wait_for(
                        self._fetch_channel(ch, cat, pri, reg),
                        timeout=FETCH_TIMEOUT + 5
                    )
                except Exception:
                    return []

        tasks = [
            fetch_with_sem(ch, cat, pri, reg)
            for ch, cat, pri, reg in TELEGRAM_CHANNELS
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        channels_fetched = 0
        for result in results:
            if isinstance(result, list):
                all_items.extend(result)
                if result:
                    channels_fetched += 1

        # Sort by priority then recency
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        all_items.sort(key=lambda x: (priority_order.get(x.get("priority", "low"), 3)))

        # Deduplicate by content similarity
        seen_hashes = set()
        unique_items = []
        for item in all_items:
            content_hash = hashlib.md5(item["title"][:80].lower().encode()).hexdigest()
            if content_hash not in seen_hashes:
                seen_hashes.add(content_hash)
                unique_items.append(item)

        # Group by category
        categories = {}
        for item in unique_items:
            cat = item.get("category", "other")
            categories.setdefault(cat, []).append(item)

        digest = {
            "items": unique_items,
            "categories": categories,
            "meta": {
                "total_items": len(unique_items),
                "channels_monitored": len(TELEGRAM_CHANNELS),
                "channels_fetched": channels_fetched,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            "priority_breakdown": {
                "critical": len([i for i in unique_items if i["priority"] == "critical"]),
                "high": len([i for i in unique_items if i["priority"] == "high"]),
                "medium": len([i for i in unique_items if i["priority"] == "medium"]),
            }
        }

        # Cache
        try:
            import json
            r = await self._get_redis()
            await r.setex(self._cache_key, CACHE_TTL, json.dumps(digest))
        except Exception:
            pass

        # Apply filters
        if region_filter or category_filter:
            digest["items"] = [
                i for i in digest["items"]
                if (not region_filter or i.get("region") == region_filter)
                and (not category_filter or i.get("category") == category_filter)
            ]

        return digest

    async def get_critical_alerts(self) -> list:
        """Get only critical priority messages (potential flash alerts)."""
        digest = await self.aggregate_channels()
        return [i for i in digest.get("items", []) if i.get("priority") == "critical"][:30]

    async def search(self, query: str, limit: int = 20) -> list:
        """Search telegram OSINT items by keyword."""
        digest = await self.aggregate_channels()
        q = query.lower()
        results = []
        for item in digest.get("items", []):
            text = f"{item.get('title', '')} {item.get('description', '')} {item.get('channel', '')}".lower()
            if q in text:
                results.append(item)
                if len(results) >= limit:
                    break
        return results
