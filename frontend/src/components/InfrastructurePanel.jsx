import React, { useState, useEffect } from "react";
import { Cable, Wifi, WifiOff, AlertTriangle, Activity } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const STATUS_COLORS = { operational: "#22cc88", under_construction: "#ffaa00", decommissioned: "#666" };

export default function InfrastructurePanel() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    const load = async () => {
      try { const r = await fetch(`${API}/infrastructure/overview`); setData(await r.json()); } catch (e) {}
    };
    load(); const t = setInterval(load, 600000); return () => clearInterval(t);
  }, []);

  if (!data) return null;

  const cables = data.submarine_cables || {};
  const outages = data.internet_outages || {};
  const healthColor = data.overall_health > 70 ? "#22cc88" : data.overall_health > 40 ? "#ffaa00" : "#ff0044";

  return (
    <div className="glass-panel w-full flex flex-col max-h-[420px]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-1.5">
          <Cable size={12} className="text-blue-400" />
          <span className="text-[10px] font-mono text-intel-cyan tracking-wider">INFRASTRUCTURE</span>
        </div>
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
          style={{ backgroundColor: `${healthColor}20`, color: healthColor }}
        >{data.health_status?.toUpperCase()} {Math.round(data.overall_health)}%</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 px-2 py-1 border-b border-white/5">
        {["overview", "cables", "outages", "risks"].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-2 py-0.5 text-[8px] font-mono rounded ${tab === t ? "bg-intel-cyan/15 text-intel-cyan" : "text-intel-muted"}`}
          >{t.toUpperCase()}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === "overview" && (
          <div className="px-3 py-2 space-y-3">
            {/* Health gauge */}
            <div className="flex items-center gap-3">
              <svg width="60" height="60" viewBox="0 0 60 60">
                <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                <circle cx="30" cy="30" r="26" fill="none" stroke={healthColor} strokeWidth="4"
                  strokeDasharray={`${(data.overall_health / 100) * 163.4} 163.4`}
                  strokeLinecap="round" transform="rotate(-90 30 30)" />
                <text x="30" y="33" textAnchor="middle" fill={healthColor} fontSize="14" fontFamily="monospace">{Math.round(data.overall_health)}</text>
              </svg>
              <div>
                <div className="text-[10px] text-intel-text">Global Infrastructure Health</div>
                <div className="text-[8px] text-intel-muted mt-1">
                  {cables.operational || 0} cables operational
                </div>
                <div className="text-[8px] text-intel-muted">
                  {cables.total_capacity_tbps || 0} Tbps total capacity
                </div>
                <div className="text-[8px] text-intel-muted">
                  {outages.total_outages || 0} active outages
                </div>
              </div>
            </div>

            {/* Risk zones */}
            <div>
              <span className="text-[9px] text-intel-muted">CHOKEPOINTS</span>
              <div className="space-y-1 mt-1">
                {(data.risk_zones || []).slice(0, 5).map((z, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[9px]">
                    <div className={`w-2 h-2 rounded-full ${z.risk === "high" ? "bg-red-500" : z.risk === "medium" ? "bg-yellow-500" : "bg-green-500"}`} />
                    <span className="text-intel-text">{z.name}</span>
                    <span className="text-intel-muted text-[7px] ml-auto">{z.risk}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "cables" && (cables.cables || []).map((c, i) => (
          <div key={c.id || i} className="px-3 py-2 border-b border-white/[0.03] hover:bg-white/[0.02]">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[c.status] }} />
              <span className="text-[10px] text-intel-text flex-1">{c.name}</span>
              <span className="text-[7px] text-intel-muted">{c.health_score}%</span>
            </div>
            <div className="flex items-center gap-2 text-[8px] text-intel-muted">
              <span>{c.length_km?.toLocaleString()}km</span>
              <span>{c.capacity_tbps} Tbps</span>
              <span>{c.owner}</span>
              <span>{c.year}</span>
            </div>
            {c.disruption_risk > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <AlertTriangle size={8} className="text-orange-400" />
                <span className="text-[7px] text-orange-400">Risk: {c.disruption_risk}%</span>
              </div>
            )}
          </div>
        ))}

        {tab === "outages" && (
          (outages.outages || []).length === 0 ? (
            <div className="flex flex-col items-center py-8">
              <Wifi size={20} className="text-green-400 mb-2" />
              <span className="text-[10px] text-green-400">No Active Outages</span>
            </div>
          ) : (outages.outages || []).map((o, i) => (
            <div key={o.id || i} className="px-3 py-2 border-b border-white/[0.03]">
              <div className="flex items-center gap-1.5">
                <WifiOff size={10} className="text-red-400" />
                <span className="text-[10px] text-intel-text">{o.country || o.entity}</span>
                <span className="text-[7px] text-intel-muted ml-auto">{o.source}</span>
              </div>
              {o.description && <p className="text-[8px] text-intel-muted mt-1">{o.description}</p>}
            </div>
          ))
        )}

        {tab === "risks" && (data.risk_zones || []).map((z, i) => (
          <div key={i} className="px-3 py-2 border-b border-white/[0.03]">
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={10} className={z.risk === "high" ? "text-red-400" : z.risk === "medium" ? "text-yellow-400" : "text-green-400"} />
              <span className="text-[10px] text-intel-text">{z.name}</span>
              <span className={`text-[7px] px-1 py-0.5 rounded font-mono ml-auto ${
                z.risk === "high" ? "bg-red-500/15 text-red-400" : z.risk === "medium" ? "bg-yellow-500/15 text-yellow-400" : "bg-green-500/15 text-green-400"
              }`}>{z.risk?.toUpperCase()}</span>
            </div>
            <p className="text-[8px] text-intel-muted mt-1">{z.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
