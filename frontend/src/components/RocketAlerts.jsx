import React, { useState, useEffect, useCallback } from "react";
import { Siren, MapPin, Clock, AlertTriangle } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const ZONE_COLORS = { south: "#ff0044", center: "#ff6600", north: "#ffaa00", unknown: "#888" };

export default function RocketAlerts() {
  const [alerts, setAlerts] = useState(null);
  const [history, setHistory] = useState(null);
  const [tab, setTab] = useState("live");

  const fetchAlerts = useCallback(async () => {
    try {
      const [liveRes, histRes] = await Promise.all([
        fetch(`${API}/oref/alerts`), fetch(`${API}/oref/history?hours=24`),
      ]);
      setAlerts(await liveRes.json());
      setHistory(await histRes.json());
    } catch (e) { console.error("OREF fetch:", e); }
  }, []);

  useEffect(() => { fetchAlerts(); const t = setInterval(fetchAlerts, 15000); return () => clearInterval(t); }, [fetchAlerts]);

  const isActive = alerts?.active;

  return (
    <div className="glass-panel w-full flex flex-col max-h-[400px]">
      <div className={`flex items-center justify-between px-3 py-2 border-b ${isActive ? "border-red-500/30 bg-red-500/5" : "border-white/5"}`}>
        <div className="flex items-center gap-1.5">
          <Siren size={12} className={isActive ? "text-red-500 animate-pulse" : "text-orange-400"} />
          <span className="text-[10px] font-mono tracking-wider" style={{ color: isActive ? "#ff0044" : "var(--intel-cyan)" }}>
            {isActive ? "RED ALERT" : "OREF MONITOR"}
          </span>
        </div>
        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${isActive ? "bg-red-500/20 text-red-400" : "bg-green-500/15 text-green-400"}`}>
          {isActive ? `${alerts.alert_count} ACTIVE` : "CLEAR"}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 px-2 py-1 border-b border-white/5">
        <button onClick={() => setTab("live")}
          className={`px-2 py-0.5 text-[9px] font-mono rounded ${tab === "live" ? "bg-red-500/15 text-red-400" : "text-intel-muted"}`}
        >LIVE</button>
        <button onClick={() => setTab("history")}
          className={`px-2 py-0.5 text-[9px] font-mono rounded ${tab === "history" ? "bg-intel-cyan/15 text-intel-cyan" : "text-intel-muted"}`}
        >24H HISTORY</button>
        <button onClick={() => setTab("zones")}
          className={`px-2 py-0.5 text-[9px] font-mono rounded ${tab === "zones" ? "bg-intel-cyan/15 text-intel-cyan" : "text-intel-muted"}`}
        >ZONES</button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === "live" && (
          isActive ? alerts.alerts.map((a, i) => (
            <div key={a.id || i} className="px-3 py-2 border-b border-red-500/10 bg-red-500/[0.03]">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle size={10} className="text-red-500" />
                <span className="text-[10px] font-mono text-red-400">{a.threat_type?.toUpperCase()}</span>
                <span className="text-[8px] px-1 py-0.5 rounded font-mono ml-auto"
                  style={{ backgroundColor: `${ZONE_COLORS[a.zone] || "#888"}20`, color: ZONE_COLORS[a.zone] || "#888" }}
                >{a.zone?.toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-intel-text">
                <MapPin size={9} className="text-intel-muted" />
                <span>{a.area_english}</span>
                <span className="text-intel-muted text-[8px] ml-1">({a.area_hebrew})</span>
              </div>
              <div className="text-[8px] text-intel-muted mt-1 flex items-center gap-1">
                <Clock size={8} /> {a.timestamp}
              </div>
            </div>
          )) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center mb-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-[11px] text-green-400 font-mono">ALL CLEAR</span>
              <span className="text-[9px] text-intel-muted mt-1">No active alerts</span>
            </div>
          )
        )}

        {tab === "history" && history && (
          <>
            <div className="px-3 py-2 border-b border-white/5">
              <span className="text-[9px] text-intel-muted">{history.total_alerts} alerts in last 24h</span>
            </div>
            {(history.history || []).slice(0, 50).map((h, i) => (
              <div key={i} className="px-3 py-1.5 border-b border-white/[0.03] text-[9px]">
                <div className="flex items-center justify-between">
                  <span className="text-intel-text">{h.area_english}</span>
                  <span className="text-intel-muted">{h.threat_type}</span>
                </div>
                <span className="text-[8px] text-intel-muted">{h.date}</span>
              </div>
            ))}
          </>
        )}

        {tab === "zones" && (
          <div className="px-3 py-2 space-y-2">
            {["south", "center", "north"].map((zone) => {
              const zoneAlerts = (alerts?.alerts || []).filter((a) => a.zone === zone);
              const histCount = (history?.zone_stats || {})[zone] || 0;
              return (
                <div key={zone} className="p-2 rounded bg-white/[0.02] border border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono" style={{ color: ZONE_COLORS[zone] }}>
                      {zone.toUpperCase()} ZONE
                    </span>
                    <span className={`text-[8px] px-1 py-0.5 rounded font-mono ${
                      zoneAlerts.length > 0 ? "bg-red-500/20 text-red-400" : "bg-green-500/15 text-green-400"
                    }`}>
                      {zoneAlerts.length > 0 ? `${zoneAlerts.length} ACTIVE` : "CLEAR"}
                    </span>
                  </div>
                  <span className="text-[8px] text-intel-muted">{histCount} alerts in 24h</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
