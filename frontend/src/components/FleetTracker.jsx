import React, { useState, useEffect } from "react";
import { Anchor, Ship, Navigation, Radar } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const STATUS_COLORS = { deployed: "#ff4444", on_patrol: "#ff6600", forward_deployed: "#ffaa00", in_port: "#22cc88" };
const TYPE_ICONS = { carrier_strike_group: Ship, amphibious_ready_group: Anchor, submarine_patrol: Radar };
const NAVY_COLORS = {
  "US Navy": "#4488ff", "Royal Navy": "#ff4444", "Marine Nationale": "#4444ff",
  "PLAN (China)": "#ff8800", "Russian Navy": "#ff0044",
};

export default function FleetTracker() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const load = async () => {
      try { const r = await fetch(`${API}/fleet`); setData(await r.json()); } catch (e) {}
    };
    load(); const t = setInterval(load, 600000); return () => clearInterval(t);
  }, []);

  if (!data) return null;

  let fleets = data.fleets || [];
  if (filter === "deployed") fleets = fleets.filter((f) => ["deployed", "on_patrol", "forward_deployed"].includes(f.status));
  if (filter === "carriers") fleets = fleets.filter((f) => f.type === "carrier_strike_group");

  return (
    <div className="glass-panel w-full flex flex-col max-h-[420px]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-1.5">
          <Ship size={12} className="text-blue-400" />
          <span className="text-[10px] font-mono text-intel-cyan tracking-wider">FLEET TRACKER</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-orange-400">{data.deployed} DEPLOYED</span>
          <span className="text-[9px] text-intel-muted">/ {data.total_groups}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-0.5 px-2 py-1 border-b border-white/5">
        {["all", "deployed", "carriers"].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-2 py-0.5 text-[8px] font-mono rounded ${filter === f ? "bg-blue-500/15 text-blue-400" : "text-intel-muted"}`}
          >{f.toUpperCase()}</button>
        ))}
      </div>

      {/* Navy breakdown */}
      <div className="flex flex-wrap gap-1.5 px-3 py-1.5 border-b border-white/5">
        {Object.entries(data.by_navy || {}).map(([navy, count]) => (
          <span key={navy} className="px-1.5 py-0.5 text-[7px] font-mono rounded"
            style={{ backgroundColor: `${NAVY_COLORS[navy] || "#888"}15`, color: NAVY_COLORS[navy] || "#888" }}
          >{navy}: {count}</span>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {fleets.map((f, i) => {
          const Icon = TYPE_ICONS[f.type] || Ship;
          const statusColor = STATUS_COLORS[f.status] || "#888";
          const navyColor = NAVY_COLORS[f.fleet] || "#888";
          return (
            <div key={f.id || i} className="px-3 py-2 border-b border-white/[0.03] hover:bg-white/[0.02]">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={11} style={{ color: navyColor }} />
                <span className="text-[10px] text-intel-text flex-1">{f.name}</span>
                <span className="text-[7px] px-1 py-0.5 rounded font-mono"
                  style={{ backgroundColor: `${statusColor}20`, color: statusColor }}
                >{f.status?.replace("_", " ").toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-2 text-[8px] text-intel-muted">
                <span style={{ color: navyColor }}>{f.fleet}</span>
                <span>{f.flagship}</span>
              </div>
              <div className="flex items-center gap-2 text-[7px] text-intel-muted mt-0.5">
                <span>Region: {f.region?.replace("_", " ")}</span>
                <span>{f.lat?.toFixed(1)}, {f.lon?.toFixed(1)}</span>
                <span className="ml-auto">{f.mission}</span>
              </div>
              {f.composition && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {f.composition.map((ship, j) => (
                    <span key={j} className="px-1 py-0.5 text-[6px] font-mono bg-white/[0.03] rounded text-intel-muted">{ship}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
