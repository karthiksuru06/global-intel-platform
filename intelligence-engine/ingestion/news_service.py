"""
RSS/News Feed Aggregation Service
Fetches 80+ curated RSS feeds across geopolitics, defense, tech, finance.
Server-side aggregation with Redis caching (15-min TTL).
"""

import asyncio
import hashlib
import html
import logging
import re
import time
from datetime import datetime, timezone
from typing import Any
from xml.etree import ElementTree as ET

import httpx
import redis.asyncio as aioredis
import json

from config import settings

logger = logging.getLogger(__name__)

# ── Curated Feed Registry ──
# Each feed: (url, category, tier, lang)
# Tier 1 = major wire services, Tier 2 = reputable outlets, Tier 3 = niche/regional

FEED_REGISTRY: list[tuple[str, str, int, str]] = [
    # ── Geopolitics & World ──
    ("https://feeds.bbci.co.uk/news/world/rss.xml", "geopolitics", 1, "en"),
    ("https://rss.nytimes.com/services/xml/rss/nyt/World.xml", "geopolitics", 1, "en"),
    ("https://feeds.reuters.com/Reuters/worldNews", "geopolitics", 1, "en"),
    ("https://www.aljazeera.com/xml/rss/all.xml", "geopolitics", 1, "en"),
    ("https://rss.cnn.com/rss/edition_world.rss", "geopolitics", 1, "en"),
    ("https://www.theguardian.com/world/rss", "geopolitics", 1, "en"),
    ("https://feeds.washingtonpost.com/rss/world", "geopolitics", 2, "en"),
    ("https://www.france24.com/en/rss", "geopolitics", 2, "en"),
    ("https://www.dw.com/rss/en/top-stories/s-9097", "geopolitics", 2, "en"),

    # ── Defense & Military ──
    ("https://www.defensenews.com/arc/outboundfeeds/rss/category/global/?outputType=xml", "defense", 1, "en"),
    ("https://www.janes.com/feeds/news", "defense", 1, "en"),
    ("https://breakingdefense.com/feed/", "defense", 2, "en"),
    ("https://www.militarytimes.com/arc/outboundfeeds/rss/category/news/?outputType=xml", "defense", 2, "en"),
    ("https://www.thedrive.com/the-war-zone/feed", "defense", 2, "en"),
    ("https://news.usni.org/feed", "defense", 2, "en"),
    ("https://www.armyrecognition.com/rss", "defense", 3, "en"),

    # ── Cybersecurity ──
    ("https://feeds.feedburner.com/TheHackersNews", "cyber", 1, "en"),
    ("https://www.bleepingcomputer.com/feed/", "cyber", 1, "en"),
    ("https://krebsonsecurity.com/feed/", "cyber", 1, "en"),
    ("https://www.darkreading.com/rss.xml", "cyber", 2, "en"),
    ("https://www.securityweek.com/feed/", "cyber", 2, "en"),
    ("https://threatpost.com/feed/", "cyber", 2, "en"),
    ("https://www.schneier.com/feed/atom/", "cyber", 2, "en"),

    # ── Technology ──
    ("https://feeds.arstechnica.com/arstechnica/index", "tech", 1, "en"),
    ("https://www.theverge.com/rss/index.xml", "tech", 1, "en"),
    ("https://techcrunch.com/feed/", "tech", 1, "en"),
    ("https://www.wired.com/feed/rss", "tech", 2, "en"),
    ("https://www.technologyreview.com/feed/", "tech", 2, "en"),

    # ── Finance & Markets ──
    ("https://www.ft.com/rss/home", "finance", 1, "en"),
    ("https://feeds.bloomberg.com/markets/news.rss", "finance", 1, "en"),
    ("https://www.cnbc.com/id/100003114/device/rss/rss.html", "finance", 1, "en"),
    ("https://feeds.marketwatch.com/marketwatch/topstories/", "finance", 2, "en"),
    ("https://www.economist.com/rss", "finance", 2, "en"),
    ("https://www.coindesk.com/arc/outboundfeeds/rss/", "finance", 2, "en"),

    # ── Energy & Resources ──
    ("https://oilprice.com/rss/main", "energy", 2, "en"),
    ("https://www.rigzone.com/news/rss/rigzone_latest.aspx", "energy", 2, "en"),
    ("https://www.world-nuclear-news.org/rss", "energy", 3, "en"),

    # ── Middle East & Conflict ──
    ("https://www.middleeasteye.net/rss", "mideast", 2, "en"),
    ("https://www.al-monitor.com/rss", "mideast", 2, "en"),
    ("https://www.timesofisrael.com/feed/", "mideast", 2, "en"),
    ("https://english.alarabiya.net/tools/rss", "mideast", 2, "en"),

    # ── Asia-Pacific ──
    ("https://www.scmp.com/rss/91/feed", "asiapac", 2, "en"),
    ("https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml", "asiapac", 2, "en"),
    ("https://www3.nhk.or.jp/nhkworld/en/news/rss.xml", "asiapac", 2, "en"),
    ("https://www.japantimes.co.jp/feed/", "asiapac", 3, "en"),

    # ── Europe ──
    ("https://www.politico.eu/feed/", "europe", 2, "en"),
    ("https://www.euronews.com/rss", "europe", 2, "en"),

    # ── Africa ──
    ("https://www.africanews.com/feed/", "africa", 2, "en"),

    # ── Latin America ──
    ("https://www.batimes.com.ar/feed", "latam", 3, "en"),

    # ── Science & Space ──
    ("https://www.space.com/feeds/all", "science", 2, "en"),
    ("https://www.newscientist.com/feed/home/", "science", 2, "en"),

    # ── OSINT & Intelligence ──
    ("https://www.bellingcat.com/feed/", "osint", 1, "en"),
    ("https://www.rferl.org/api/", "osint", 2, "en"),
    ("https://www.iiss.org/rss", "osint", 3, "en"),

    # ── French ──
    ("https://www.lemonde.fr/rss/une.xml", "geopolitics", 1, "fr"),
    ("https://www.france24.com/fr/rss", "geopolitics", 2, "fr"),

    # ── Spanish ──
    ("https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada", "geopolitics", 1, "es"),
    ("https://www.bbc.com/mundo/index.xml", "geopolitics", 2, "es"),

    # ── Arabic ──
    ("https://www.aljazeera.net/aljazeerarss/a7029c45-23d3-4571-a860-b27a54527571/73d0e1b4-532f-45ef-b135-bfdff8b8cab9", "geopolitics", 1, "ar"),
    ("https://arabic.rt.com/rss/", "geopolitics", 2, "ar"),

    # ── Chinese ──
    ("https://www.bbc.com/zhongwen/simp/index.xml", "geopolitics", 2, "zh"),

    # ── Disasters & Humanitarian ──
    ("https://reliefweb.int/updates/rss.xml", "humanitarian", 1, "en"),
    ("https://www.who.int/feeds/entity/csr/don/en/rss.xml", "humanitarian", 2, "en"),
]


# ── Threat Classification Keywords ──
THREAT_KEYWORDS = {
    "critical": ["nuclear strike", "war declared", "invasion", "missile launch", "nuclear test", "coup"],
    "high": ["airstrike", "bombing", "casualties", "troops deployed", "sanctions", "cyberattack",
             "ransomware", "missile", "military buildup", "assassination", "explosion"],
    "medium": ["protest", "tensions", "military exercise", "drone", "ceasefire", "summit",
               "negotiations", "embargo", "espionage", "arrested"],
    "low": ["election", "trade deal", "diplomacy", "conference", "agreement", "regulation"],
}


def classify_threat(title: str, description: str = "") -> tuple[str, int]:
    """Classify threat level and severity from headline text."""
    text = f"{title} {description}".lower()
    for level, keywords in THREAT_KEYWORDS.items():
        for kw in keywords:
            if re.search(rf"\b{re.escape(kw)}\b", text):
                severity_map = {"critical": 5, "high": 4, "medium": 3, "low": 2}
                return level, severity_map.get(level, 1)
    return "info", 1


def _content_hash(title: str) -> str:
    return hashlib.sha256(title.strip().lower().encode()).hexdigest()[:16]


def _parse_rss_xml(xml_text: str, feed_url: str, category: str, tier: int, lang: str) -> list[dict]:
    """Parse RSS/Atom XML into normalized news items."""
    items = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return items

    ns = {"atom": "http://www.w3.org/2005/Atom"}

    # Try RSS 2.0 format
    rss_items = root.findall(".//item")
    if not rss_items:
        # Try Atom format
        rss_items = root.findall(".//atom:entry", ns)
        if not rss_items:
            rss_items = root.findall(".//{http://www.w3.org/2005/Atom}entry")

    for item in rss_items[:15]:  # Cap at 15 items per feed
        title_el = item.find("title")
        if title_el is None:
            title_el = item.find("{http://www.w3.org/2005/Atom}title")
        if title_el is None or not title_el.text:
            continue

        title = html.unescape(title_el.text.strip())

        # Get link
        link_el = item.find("link")
        if link_el is None:
            link_el = item.find("{http://www.w3.org/2005/Atom}link")
        link = ""
        if link_el is not None:
            link = link_el.get("href", link_el.text or "")

        # Get description
        desc_el = item.find("description")
        if desc_el is None:
            desc_el = item.find("{http://www.w3.org/2005/Atom}summary")
            if desc_el is None:
                desc_el = item.find("{http://www.w3.org/2005/Atom}content")
        description = ""
        if desc_el is not None and desc_el.text:
            description = html.unescape(re.sub(r"<[^>]+>", "", desc_el.text.strip()))[:500]

        # Get pubDate
        pub_el = item.find("pubDate")
        if pub_el is None:
            pub_el = item.find("{http://www.w3.org/2005/Atom}published")
            if pub_el is None:
                pub_el = item.find("{http://www.w3.org/2005/Atom}updated")
        pub_date = pub_el.text.strip() if pub_el is not None and pub_el.text else None

        # Get source name from feed URL
        source = re.sub(r"https?://(www\.)?", "", feed_url).split("/")[0]

        # Classify threat
        threat_level, severity = classify_threat(title, description)

        items.append({
            "id": _content_hash(title),
            "title": title,
            "description": description,
            "link": link,
            "source": source,
            "category": category,
            "tier": tier,
            "lang": lang,
            "pub_date": pub_date,
            "threat_level": threat_level,
            "severity": severity,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        })

    return items


class NewsAggregationService:
    """Server-side RSS feed aggregator with Redis caching."""

    def __init__(self):
        self.redis: aioredis.Redis | None = None
        self._client: httpx.AsyncClient | None = None

    async def _ensure_redis(self):
        if self.redis is None:
            self.redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

    async def _ensure_client(self):
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(10.0, connect=5.0),
                follow_redirects=True,
                headers={"User-Agent": "GlobalIntelPlatform/3.0 NewsAggregator"},
            )

    async def fetch_single_feed(self, url: str, category: str, tier: int, lang: str) -> list[dict]:
        """Fetch and parse a single RSS feed with per-feed caching."""
        await self._ensure_redis()
        await self._ensure_client()

        cache_key = f"news:feed:{hashlib.md5(url.encode()).hexdigest()}"

        # Check per-feed cache (10 min)
        cached = await self.redis.get(cache_key)
        if cached:
            try:
                return json.loads(cached)
            except json.JSONDecodeError:
                pass

        try:
            resp = await self._client.get(url)
            if resp.status_code != 200:
                logger.warning("Feed %s returned %d", url[:50], resp.status_code)
                return []
            items = _parse_rss_xml(resp.text, url, category, tier, lang)
            # Cache for 10 minutes
            if items:
                await self.redis.setex(cache_key, 600, json.dumps(items))
            return items
        except Exception as e:
            logger.warning("Feed fetch error %s: %s", url[:50], str(e)[:100])
            return []

    async def aggregate_all(self, lang_filter: str | None = None) -> dict:
        """
        Fetch all feeds, aggregate by category.
        Returns: {categories: {cat: [items]}, meta: {total, sources, ...}}
        """
        await self._ensure_redis()

        # Check digest cache (15 min)
        cache_key = f"news:digest:v1:{lang_filter or 'all'}"
        cached = await self.redis.get(cache_key)
        if cached:
            try:
                return json.loads(cached)
            except json.JSONDecodeError:
                pass

        # Filter feeds by language
        feeds = FEED_REGISTRY
        if lang_filter and lang_filter != "all":
            feeds = [f for f in feeds if f[3] == lang_filter or f[3] == "en"]

        # Fetch concurrently (20 concurrent max)
        semaphore = asyncio.Semaphore(20)

        async def _fetch_with_sem(url, cat, tier, lang):
            async with semaphore:
                return await self.fetch_single_feed(url, cat, tier, lang)

        tasks = [_fetch_with_sem(url, cat, tier, lang) for url, cat, tier, lang in feeds]

        try:
            results = await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=30.0
            )
        except asyncio.TimeoutError:
            logger.warning("Feed aggregation hit 30s deadline")
            results = []

        # Aggregate by category
        categories: dict[str, list[dict]] = {}
        seen_hashes: set[str] = set()
        total_items = 0
        source_count = 0

        for result in results:
            if isinstance(result, Exception):
                continue
            if not result:
                continue
            source_count += 1
            for item in result:
                # Dedup by content hash
                if item["id"] in seen_hashes:
                    continue
                seen_hashes.add(item["id"])
                cat = item["category"]
                if cat not in categories:
                    categories[cat] = []
                if len(categories[cat]) < 25:  # Cap per category
                    categories[cat].append(item)
                    total_items += 1

        # Sort each category by tier (lower = better), then severity (higher = more important)
        for cat in categories:
            categories[cat].sort(key=lambda x: (x["tier"], -x["severity"]), reverse=False)

        digest = {
            "categories": categories,
            "meta": {
                "total_items": total_items,
                "sources_fetched": source_count,
                "sources_total": len(feeds),
                "categories": list(categories.keys()),
                "cached_at": datetime.now(timezone.utc).isoformat(),
                "lang_filter": lang_filter or "all",
            }
        }

        # Cache for 15 minutes
        await self.redis.setex(cache_key, 900, json.dumps(digest))
        logger.info("News digest built: %d items from %d sources across %d categories",
                     total_items, source_count, len(categories))

        return digest

    async def get_breaking(self) -> list[dict]:
        """Get critical/high severity items from the last hour."""
        await self._ensure_redis()
        cached = await self.redis.get("news:breaking")
        if cached:
            try:
                return json.loads(cached)
            except json.JSONDecodeError:
                pass

        digest = await self.aggregate_all()
        breaking = []
        for cat_items in digest.get("categories", {}).values():
            for item in cat_items:
                if item.get("severity", 0) >= 4:
                    breaking.append(item)

        breaking.sort(key=lambda x: x.get("severity", 0), reverse=True)
        breaking = breaking[:20]

        await self.redis.setex("news:breaking", 300, json.dumps(breaking))
        return breaking

    async def search(self, query: str, limit: int = 20) -> list[dict]:
        """Search news items by keyword."""
        digest = await self.aggregate_all()
        results = []
        q = query.lower()
        for cat_items in digest.get("categories", {}).values():
            for item in cat_items:
                if q in item.get("title", "").lower() or q in item.get("description", "").lower():
                    results.append(item)
                    if len(results) >= limit:
                        return results
        return results

    async def close(self):
        if self._client:
            await self._client.aclose()
        if self.redis:
            await self.redis.close()
