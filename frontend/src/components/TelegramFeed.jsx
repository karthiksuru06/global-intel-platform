import React, { useState, useEffect, useCallback } from "react";
import { MessageSquare, AlertTriangle, Search, Radio, Shield, Globe, Crosshair } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const CATEGORIES = ["all", "conflict", "military", "nuclear", "cyber", "maritime", "osint", "breaking"];
const CAT_COLORS = {
  conflict: "#ff4444", military: "#ff8800", nuclear: "#ff00ff",
  cyber: "#00ffcc", maritime: "#4488ff", osint: "#88ff44",
  breaking: "#ff0044", aviation: "#44aaff", geopolitics: "#ffaa00",
};
const PRIORITY_COLORS = { critical: "#ff0044", high: "#ff6600", medium: "#ffaa00", low: "#888888" };

export default function TelegramFeed() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({});
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      const url = search.trim()
        ? `${API}/telegram/search?q=${encodeURIComponent(search)}`
        : `${API}/telegram${params.toString() ? "?" + params : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      setItems(search.trim() ? data.items || [] : data.items || []);
      setMeta(data.meta || {});
    } catch (e) {
      console.error("Telegram fetch failed:", e);
    }
    setLoading(false);
  }, [category, search]);

  useEffect(() => { fetchData(); const t = setInterval(fetchData, 60000); return () => clearInterval(t); }, [fetchData]);

  const catIcon = (cat) => {
    switch (cat) {
      case "conflict": return <Crosshair size={10} />;
      case "military": return <Shield size={10} />;
      case "nuclear": return <AlertTriangle size={10} />;
      case "cyber": return <Globe size={10} />;
      default: return <Radio size={10} />;
    }
  };

  return (
    <div className="glass-panel w-[340px] max-h-[500px] flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-1.5">
          <MessageSquare size={12} className="text-blue-400" />
          <span className="text-[10px] font-mono text-intel-cyan tracking-wider">TELEGRAM OSINT</span>
        </div>
        <span className="text-[9px] text-intel-muted">{meta.channels_fetched || 0}/{meta.channels_monitored || 0} CH</span>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b border-white/5">
        <div className="relative">
          <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-intel-muted" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search OSINT..."
            className="w-full bg-white/[0.03] border border-white/5 rounded text-[10px] pl-6 pr-2 py-1 text-intel-text placeholder:text-intel-muted/50 focus:outline-none focus:border-intel-cyan/30"
          />
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-0.5 px-2 py-1 overflow-x-auto border-b border-white/5">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)}
            className={`px-1.5 py-0.5 text-[8px] font-mono rounded whitespace-nowrap ${
              category === c ? "bg-intel-cyan/15 text-intel-cyan" : "text-intel-muted hover:text-intel-text"
            }`}
          >{c.toUpperCase()}</button>
        ))}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && items.length === 0 ? (
          <div className="text-center text-[10px] text-intel-muted py-8">Loading channels...</div>
        ) : items.length === 0 ? (
          <div className="text-center text-[10px] text-intel-muted py-8">No items found</div>
        ) : (
          items.slice(0, 50).map((item, i) => (
            <div key={item.id || i} className="px-3 py-2 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[7px] font-mono"
                  style={{ backgroundColor: `${CAT_COLORS[item.category] || "#666"}15`, color: CAT_COLORS[item.category] || "#666" }}
                >{catIcon(item.category)} {item.category}</span>
                <span className="px-1 py-0.5 rounded text-[7px] font-mono"
                  style={{ backgroundColor: `${PRIORITY_COLORS[item.priority] || "#888"}15`, color: PRIORITY_COLORS[item.priority] || "#888" }}
                >{item.priority}</span>
                <span className="text-[8px] text-intel-muted ml-auto">@{item.channel}</span>
              </div>
              <p className="text-[10px] text-intel-text leading-snug line-clamp-3">{item.title}</p>
              {item.published && (
                <span className="text-[8px] text-intel-muted mt-1 block">{item.published}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
