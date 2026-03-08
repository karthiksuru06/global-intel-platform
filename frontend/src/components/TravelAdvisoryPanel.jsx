import React, { useState, useEffect } from "react";
import { Globe, AlertTriangle, Shield, Search } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const LEVEL_COLORS = { 4: "#ff0044", 3: "#ff6600", 2: "#ffaa00", 1: "#22cc88" };
const LEVEL_LABELS = { 4: "DO NOT TRAVEL", 3: "RECONSIDER", 2: "INCREASED CAUTION", 1: "NORMAL" };
const LEVEL_BG = { 4: "bg-red-500/10", 3: "bg-orange-500/10", 2: "bg-yellow-500/10", 1: "bg-green-500/10" };

export default function TravelAdvisoryPanel() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      try { const r = await fetch(`${API}/travel-advisories`); setData(await r.json()); } catch (e) {}
    };
    load(); const t = setInterval(load, 3600000); return () => clearInterval(t);
  }, []);

  if (!data) return null;

  let advisories = data.advisories || [];
  if (filter !== "all") advisories = advisories.filter((a) => a.level === parseInt(filter));
  if (search.trim()) {
    const q = search.toLowerCase();
    advisories = advisories.filter((a) =>
      a.country?.toLowerCase().includes(q) || a.country_code?.toLowerCase().includes(q)
    );
  }

  const breakdown = data.level_breakdown || {};

  return (
    <div className="glass-panel w-full flex flex-col max-h-[400px]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-1.5">
          <Globe size={12} className="text-blue-400" />
          <span className="text-[10px] font-mono text-intel-cyan tracking-wider">TRAVEL ADVISORIES</span>
        </div>
        <span className="text-[9px] text-intel-muted">{data.total_countries} COUNTRIES</span>
      </div>

      {/* Summary */}
      <div className="flex gap-2 px-3 py-1.5 border-b border-white/5">
        <div className="flex items-center gap-1 cursor-pointer" onClick={() => setFilter("4")}>
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-[8px] text-red-400">{breakdown.do_not_travel}</span>
        </div>
        <div className="flex items-center gap-1 cursor-pointer" onClick={() => setFilter("3")}>
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <span className="text-[8px] text-orange-400">{breakdown.reconsider_travel}</span>
        </div>
        <div className="flex items-center gap-1 cursor-pointer" onClick={() => setFilter("2")}>
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span className="text-[8px] text-yellow-400">{breakdown.increased_caution}</span>
        </div>
        <div className="flex items-center gap-1 cursor-pointer" onClick={() => setFilter("all")}>
          <span className="text-[8px] text-intel-muted">ALL</span>
        </div>
      </div>

      {/* Search */}
      <div className="px-2 py-1 border-b border-white/5">
        <div className="relative">
          <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-intel-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search country..."
            className="w-full bg-white/[0.03] border border-white/5 rounded text-[10px] pl-6 pr-2 py-1 text-intel-text placeholder:text-intel-muted/50 focus:outline-none focus:border-intel-cyan/30"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {advisories.slice(0, 80).map((a, i) => (
          <div key={a.country_code || i} className={`px-3 py-1.5 border-b border-white/[0.03] hover:bg-white/[0.02] flex items-center gap-2`}>
            <div className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-mono font-bold"
              style={{ backgroundColor: `${LEVEL_COLORS[a.level] || "#888"}20`, color: LEVEL_COLORS[a.level] || "#888" }}
            >{a.level}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-intel-text truncate">{a.country}</span>
                <span className="text-[7px] text-intel-muted">{a.country_code}</span>
              </div>
              <span className="text-[8px]" style={{ color: LEVEL_COLORS[a.level] || "#888" }}>
                {LEVEL_LABELS[a.level]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
