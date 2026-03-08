import React, { useState, useEffect } from "react";
import { Radio, AlertTriangle, Wifi, WifiOff } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const TYPE_COLORS = { known_persistent: "#ff6600", jamming: "#ff0044", spoofing: "#ff00ff" };
const SEV_LABELS = { 5: "CRITICAL", 4: "HIGH", 3: "MEDIUM", 2: "LOW" };
const SEV_COLORS = { 5: "#ff0044", 4: "#ff6600", 3: "#ffaa00", 2: "#888" };

export default function GNSSPanel() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = async () => {
      try { const r = await fetch(`${API}/gnss/jamming`); setData(await r.json()); } catch (e) {}
    };
    load(); const t = setInterval(load, 300000); return () => clearInterval(t);
  }, []);

  if (!data) return null;

  const sev = data.severity_breakdown || {};

  return (
    <div className="glass-panel w-full flex flex-col max-h-[400px]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-1.5">
          <WifiOff size={12} className="text-orange-400" />
          <span className="text-[10px] font-mono text-intel-cyan tracking-wider">GNSS INTERFERENCE</span>
        </div>
        <span className="text-[9px] text-intel-muted">{data.total_zones} ZONES</span>
      </div>

      {/* Summary bar */}
      <div className="flex gap-2 px-3 py-2 border-b border-white/5">
        {Object.entries(sev).map(([level, count]) => (
          <div key={level} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: SEV_COLORS[level === "critical" ? 5 : level === "high" ? 4 : level === "medium" ? 3 : 2] }} />
            <span className="text-[8px] text-intel-muted">{level}: {count}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {(data.zones || []).map((zone, i) => (
          <div key={zone.id || i} className="px-3 py-2 border-b border-white/[0.03] hover:bg-white/[0.02]">
            <div className="flex items-center gap-1.5 mb-1">
              {zone.severity >= 4 ? <AlertTriangle size={10} className="text-red-400" /> : <Radio size={10} className="text-orange-400" />}
              <span className="text-[10px] text-intel-text flex-1">{zone.source}</span>
              <span className="text-[7px] px-1 py-0.5 rounded font-mono"
                style={{ backgroundColor: `${SEV_COLORS[zone.severity] || "#888"}20`, color: SEV_COLORS[zone.severity] || "#888" }}
              >{SEV_LABELS[zone.severity] || "LOW"}</span>
            </div>
            <div className="flex items-center gap-2 text-[8px] text-intel-muted">
              <span>{zone.lat?.toFixed(2)}, {zone.lon?.toFixed(2)}</span>
              <span>{zone.radius_km}km radius</span>
              <span className="px-1 rounded" style={{ backgroundColor: `${TYPE_COLORS[zone.type] || "#666"}15`, color: TYPE_COLORS[zone.type] || "#666" }}>
                {zone.type?.replace("_", " ")}
              </span>
              <span className="ml-auto">{zone.region}</span>
            </div>
            {zone.confidence && <span className="text-[7px] text-intel-muted">Confidence: {(zone.confidence * 100).toFixed(0)}%</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
