import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Newspaper, AlertTriangle, Globe, Shield, Cpu, DollarSign,
  Zap, Search, ChevronDown, ChevronUp, ExternalLink, Clock,
  RefreshCw, Filter
} from "lucide-react";

const API_URL = "http://localhost:3001/api";

const CATEGORY_CONFIG = {
  geopolitics: { label: "Geopolitics", icon: Globe, color: "text-blue-400" },
  defense: { label: "Defense", icon: Shield, color: "text-red-400" },
  cyber: { label: "Cyber", icon: Cpu, color: "text-purple-400" },
  tech: { label: "Technology", icon: Cpu, color: "text-cyan-400" },
  finance: { label: "Finance", icon: DollarSign, color: "text-green-400" },
  energy: { label: "Energy", icon: Zap, color: "text-yellow-400" },
  mideast: { label: "Middle East", icon: Globe, color: "text-orange-400" },
  asiapac: { label: "Asia-Pacific", icon: Globe, color: "text-teal-400" },
  europe: { label: "Europe", icon: Globe, color: "text-indigo-400" },
  africa: { label: "Africa", icon: Globe, color: "text-amber-400" },
  latam: { label: "Latin America", icon: Globe, color: "text-lime-400" },
  science: { label: "Science", icon: Cpu, color: "text-violet-400" },
  osint: { label: "OSINT", icon: Shield, color: "text-rose-400" },
  humanitarian: { label: "Humanitarian", icon: AlertTriangle, color: "text-pink-400" },
};

const SEVERITY_COLORS = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  info: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

function timeAgo(dateStr) {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = (now - date) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return "";
  }
}

export default function NewsFeed() {
  const [digest, setDigest] = useState(null);
  const [breaking, setBreaking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [lastFetched, setLastFetched] = useState(null);
  const searchTimeout = useRef(null);

  const fetchNews = useCallback(async () => {
    try {
      setLoading(true);
      const headers = { "x-api-key": "7f9e1d3c5b7a9f2e4d6c8b0a2f4e6d7f9e1d" };
      const [digestRes, breakingRes] = await Promise.all([
        fetch(`${API_URL}/news`, { headers }),
        fetch(`${API_URL}/news/breaking`, { headers }),
      ]);
      if (digestRes.ok) {
        const data = await digestRes.json();
        setDigest(data);
      }
      if (breakingRes.ok) {
        const data = await breakingRes.json();
        setBreaking(data.items || []);
      }
      setLastFetched(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 15 * 60 * 1000); // Refresh every 15 min
    return () => clearInterval(interval);
  }, [fetchNews]);

  const handleSearch = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSearchResults(null);
      return;
    }
    try {
      const res = await fetch(
        `${API_URL}/news/search?q=${encodeURIComponent(query)}&limit=20`,
        { headers: { "x-api-key": "7f9e1d3c5b7a9f2e4d6c8b0a2f4e6d7f9e1d" } }
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.items || []);
      }
    } catch {
      // Ignore search errors
    }
  }, []);

  const onSearchInput = useCallback((e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => handleSearch(q), 300);
  }, [handleSearch]);

  const toggleCategory = (cat) => {
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const categories = digest?.categories || {};
  const meta = digest?.meta || {};
  const displayItems = searchResults || [];

  const filteredCategories = activeCategory === "all"
    ? Object.entries(categories)
    : Object.entries(categories).filter(([k]) => k === activeCategory);

  return (
    <div className="glass-panel w-[380px] max-h-[calc(100vh-200px)] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-white/5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-intel-cyan" />
            <span className="text-xs font-mono font-bold text-intel-cyan tracking-wider">
              LIVE NEWS FEED
            </span>
          </div>
          <div className="flex items-center gap-2">
            {meta.total_items && (
              <span className="text-[9px] text-intel-muted font-mono">
                {meta.total_items} items / {meta.sources_fetched || 0} sources
              </span>
            )}
            <button
              onClick={fetchNews}
              disabled={loading}
              className="p-1 rounded hover:bg-white/5 transition"
            >
              <RefreshCw className={`w-3 h-3 text-intel-muted ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-intel-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={onSearchInput}
            placeholder="Search news..."
            className="w-full pl-7 pr-3 py-1.5 bg-black/20 border border-white/5 rounded text-[10px] font-mono text-intel-text placeholder:text-intel-muted/50 focus:outline-none focus:border-intel-cyan/30"
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-1 mt-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-2 py-0.5 rounded text-[9px] font-mono whitespace-nowrap transition ${activeCategory === "all"
              ? "bg-intel-cyan/15 text-intel-cyan"
              : "text-intel-muted hover:text-intel-text hover:bg-white/5"
              }`}
          >
            All
          </button>
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
            if (!categories[key]) return null;
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`px-2 py-0.5 rounded text-[9px] font-mono whitespace-nowrap transition ${activeCategory === key
                  ? "bg-intel-cyan/15 text-intel-cyan"
                  : "text-intel-muted hover:text-intel-text hover:bg-white/5"
                  }`}
              >
                {config.label} ({categories[key]?.length || 0})
              </button>
            );
          })}
        </div>
      </div>

      {/* Breaking News Banner */}
      {breaking.length > 0 && (
        <div className="mx-2 my-2 border-l-[3px] border-red-500 bg-red-500/[0.07] rounded-r-md pl-3 pr-2 py-2">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle className="w-3 h-3 text-red-500 animate-pulse" />
            <span className="text-[9px] font-mono font-bold text-red-500 tracking-widest uppercase">
              Breaking ({breaking.length})
            </span>
          </div>
          {breaking.slice(0, 3).map((item, i) => (
            <a
              key={i}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-[10px] font-medium text-intel-text hover:text-red-400 leading-snug mb-1 transition-colors"
            >
              {item.title}
            </a>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {error && (
          <div className="text-[10px] text-red-400 text-center py-4">
            Feed error: {error}
          </div>
        )}

        {loading && !digest && (
          <div className="space-y-2 animate-pulse py-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="px-2 py-1.5 rounded bg-white/5 border border-white/5">
                <div className="h-3 bg-white/10 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-white/10 rounded w-1/2 mb-2"></div>
                <div className="flex gap-2">
                  <div className="h-2 bg-white/10 rounded w-8"></div>
                  <div className="h-2 bg-white/10 rounded w-12"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search Results */}
        {searchResults && (
          <div className="space-y-1">
            <div className="text-[9px] text-intel-muted font-mono mb-1">
              {searchResults.length} results for "{searchQuery}"
            </div>
            {searchResults.map((item, i) => (
              <NewsItem key={`search-${i}`} item={item} />
            ))}
          </div>
        )}

        {/* Category Groups */}
        {!searchResults && filteredCategories.map(([cat, items]) => {
          const config = CATEGORY_CONFIG[cat] || { label: cat, icon: Globe, color: "text-gray-400" };
          const Icon = config.icon;
          const isExpanded = expandedCategories[cat] !== false; // Default expanded

          return (
            <div key={cat} className="border border-white/5 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 bg-black/20 hover:bg-black/30 transition"
              >
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-3 h-3 ${config.color}`} />
                  <span className={`text-[10px] font-mono font-bold ${config.color}`}>
                    {config.label.toUpperCase()}
                  </span>
                  <span className="text-[9px] text-intel-muted">({items.length})</span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-3 h-3 text-intel-muted" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-intel-muted" />
                )}
              </button>

              {isExpanded && (
                <div className="p-1.5 space-y-1">
                  {items.slice(0, 10).map((item, i) => (
                    <NewsItem key={`${cat}-${i}`} item={item} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {lastFetched && (
        <div className="px-3 py-1.5 border-t border-white/5 text-[8px] text-intel-muted font-mono text-center">
          Updated {timeAgo(lastFetched.toISOString())} | Next refresh in 15m
        </div>
      )}
    </div>
  );
}

function NewsItem({ item }) {
  const severityClass = SEVERITY_COLORS[item.threat_level] || SEVERITY_COLORS.info;

  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block px-2 py-1.5 rounded bg-black/10 hover:bg-black/20 border border-white/[0.03] hover:border-white/10 transition group"
    >
      <div className="flex items-start gap-1.5">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-intel-text group-hover:text-intel-cyan leading-tight font-medium line-clamp-4">
            {item.title}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`px-1 py-0 rounded text-[7px] font-mono border ${severityClass}`}>
              {item.threat_level?.toUpperCase()}
            </span>
            <span className="text-[8px] text-intel-muted">{item.source}</span>
            {item.pub_date && (
              <>
                <Clock className="w-2 h-2 text-intel-muted" />
                <span className="text-[8px] text-intel-muted">{timeAgo(item.pub_date)}</span>
              </>
            )}
            {item.tier <= 2 && (
              <span className="text-[7px] text-intel-cyan/60 font-mono">T{item.tier}</span>
            )}
          </div>
        </div>
        <ExternalLink className="w-2.5 h-2.5 text-intel-muted opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5" />
      </div>
    </a>
  );
}
