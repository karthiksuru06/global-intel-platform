import React, { useState, useEffect } from "react";
import { Crosshair, Flame, Megaphone, Skull, Target } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const TYPE_ICONS = {
  Battles: Crosshair, "Violence against civilians": Skull,
  "Explosions/Remote violence": Target, Riots: Flame, Protests: Megaphone,
};
const TYPE_COLORS = {
  Battles: "#ff0000", "Violence against civilians": "#dc143c",
  "Explosions/Remote violence": "#ff4500", Riots: "#ff8c00", Protests: "#ffd700",
  protest: "#ffd700", battle: "#ff0000", fight: "#ff0000", bombing: "#ff4500",
  assault: "#dc143c", conflict: "#ff6600", military_force: "#ff0044",
};

export default function ConflictTracker() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    const load = async () => {
      try { const r = await fetch(`${API}/conflicts?days=${days}`); setData(await r.json()); } catch (e) {}
    };
    load(); const t = setInterval(load, 600000); return () => clearInterval(t);
  }, [days]);

  if (!data) return null;

  return (
    <div className="glass-panel w-full flex flex-col max-h-[420px]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-1.5">
          <Crosshair size={12} className="text-red-400" />
          <span className="text-[10px] font-mono text-intel-cyan tracking-wider">CONFLICT TRACKER</span>
        </div>
        <div className="flex gap-1">
          {[3, 7, 14, 30].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-1.5 py-0.5 text-[8px] font-mono rounded ${days === d ? "bg-red-500/15 text-red-400" : "text-intel-muted"}`}
            >{d}D</button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 px-3 py-2 border-b border-white/5">
        <div className="text-center">
          <div className="text-[14px] font-mono text-red-400">{data.total_events}</div>
          <div className="text-[7px] text-intel-muted">EVENTS</div>
        </div>
        <div className="text-center">
          <div className="text-[14px] font-mono text-orange-400">{data.fatalities_total}</div>
          <div className="text-[7px] text-intel-muted">FATALITIES</div>
        </div>
        <div className="text-center">
          <div className="text-[14px] font-mono text-intel-cyan">{(data.hotspots || []).length}</div>
          <div className="text-[7px] text-intel-muted">HOTSPOTS</div>
        </div>
      </div>

      {/* Hotspots */}
      <div className="px-3 py-1.5 border-b border-white/5">
        <span className="text-[8px] text-intel-muted">TOP HOTSPOTS</span>
        <div className="flex flex-wrap gap-1 mt-1">
          {(data.hotspots || []).slice(0, 10).map((h, i) => (
            <span key={i} className="px-1.5 py-0.5 text-[8px] font-mono bg-red-500/10 text-red-400 rounded">
              {h.country} ({h.event_count})
            </span>
          ))}
        </div>
      </div>

      {/* Source breakdown */}
      <div className="flex gap-3 px-3 py-1 border-b border-white/5 text-[8px] text-intel-muted">
        <span>ACLED: {data.sources?.acled || 0}</span>
        <span>GDELT: {data.sources?.gdelt || 0}</span>
      </div>

      {/* Events */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {(data.events || []).slice(0, 60).map((e, i) => {
          const color = TYPE_COLORS[e.event_type] || "#ff6600";
          return (
            <div key={e.id || i} className="px-3 py-1.5 border-b border-white/[0.03] hover:bg-white/[0.02]">
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[9px] font-mono" style={{ color }}>{e.event_type}</span>
                {e.sub_type && <span className="text-[7px] text-intel-muted">/ {e.sub_type}</span>}
                <span className="ml-auto text-[7px] text-intel-muted">{e.source}</span>
              </div>
              <div className="text-[9px] text-intel-text truncate">
                {e.location || e.country} {e.actor1 && `- ${e.actor1}`} {e.actor2 && `vs ${e.actor2}`}
              </div>
              <div className="flex items-center gap-2 text-[7px] text-intel-muted mt-0.5">
                <span>{e.date}</span>
                {e.fatalities > 0 && <span className="text-red-400">{e.fatalities} killed</span>}
                <span>{e.lat?.toFixed(2)}, {e.lon?.toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
