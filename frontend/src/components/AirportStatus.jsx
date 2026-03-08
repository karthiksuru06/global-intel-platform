import React, { useState, useEffect } from "react";
import { Plane, AlertTriangle, Clock, Ban } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const STATUS_COLORS = { normal: "#22cc88", delayed: "#ffaa00", ground_stop: "#ff0044" };

export default function AirportStatus() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("all");
  const [region, setRegion] = useState("all");

  useEffect(() => {
    const load = async () => {
      try {
        const params = region !== "all" ? `?region=${region}` : "";
        const r = await fetch(`${API}/airports${params}`);
        setData(await r.json());
      } catch (e) {}
    };
    load(); const t = setInterval(load, 300000); return () => clearInterval(t);
  }, [region]);

  if (!data) return null;

  let airports = data.airports || [];
  if (filter === "delayed") airports = airports.filter((a) => a.status !== "normal");

  return (
    <div className="glass-panel w-full flex flex-col max-h-[420px]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-1.5">
          <Plane size={12} className="text-cyan-400" />
          <span className="text-[10px] font-mono text-intel-cyan tracking-wider">AIRPORT STATUS</span>
        </div>
        <div className="flex items-center gap-1">
          {data.ground_stops > 0 && (
            <span className="text-[8px] px-1 py-0.5 rounded font-mono bg-red-500/15 text-red-400 flex items-center gap-0.5">
              <Ban size={7} />{data.ground_stops} STOPS
            </span>
          )}
          {data.delayed > 0 && (
            <span className="text-[8px] px-1 py-0.5 rounded font-mono bg-yellow-500/15 text-yellow-400">
              {data.delayed} DELAYED
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-0.5 px-2 py-1 border-b border-white/5">
        <button onClick={() => setFilter("all")}
          className={`px-1.5 py-0.5 text-[8px] font-mono rounded ${filter === "all" ? "bg-intel-cyan/15 text-intel-cyan" : "text-intel-muted"}`}
        >ALL ({data.total_airports})</button>
        <button onClick={() => setFilter("delayed")}
          className={`px-1.5 py-0.5 text-[8px] font-mono rounded ${filter === "delayed" ? "bg-yellow-500/15 text-yellow-400" : "text-intel-muted"}`}
        >DELAYED ({data.delayed})</button>
        <div className="ml-auto flex gap-0.5">
          {["all", "americas", "europe", "mena", "asia", "africa"].map((r) => (
            <button key={r} onClick={() => setRegion(r)}
              className={`px-1 py-0.5 text-[7px] font-mono rounded ${region === r ? "bg-intel-cyan/15 text-intel-cyan" : "text-intel-muted"}`}
            >{r === "all" ? "ALL" : r.toUpperCase()}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {airports.map((a, i) => {
          const color = STATUS_COLORS[a.status] || "#888";
          return (
            <div key={a.code || i} className="px-3 py-1.5 border-b border-white/[0.03] hover:bg-white/[0.02] flex items-center gap-2">
              <div className="w-8 text-center">
                <span className="text-[11px] font-mono font-bold" style={{ color }}>{a.code}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] text-intel-text truncate">{a.name}</div>
                <div className="text-[7px] text-intel-muted">{a.city}</div>
              </div>
              {a.status === "normal" ? (
                <span className="text-[8px] text-green-400 font-mono">OK</span>
              ) : (
                <div className="text-right">
                  <div className="flex items-center gap-0.5">
                    {a.ground_stop ? <Ban size={8} className="text-red-400" /> : <Clock size={8} className="text-yellow-400" />}
                    <span className="text-[8px] font-mono" style={{ color }}>
                      {a.ground_stop ? "STOP" : `${a.delay_minutes}m`}
                    </span>
                  </div>
                  {a.reason && <span className="text-[6px] text-intel-muted">{a.reason}</span>}
                </div>
              )}
            </div>
          );
        })}

        {/* Airspace restrictions */}
        {(data.airspace_restrictions || []).length > 0 && (
          <>
            <div className="px-3 py-1.5 bg-red-500/[0.03] border-b border-red-500/10">
              <span className="text-[9px] font-mono text-red-400">AIRSPACE RESTRICTIONS</span>
            </div>
            {(data.airspace_restrictions || []).map((r, i) => (
              <div key={i} className="px-3 py-1.5 border-b border-white/[0.03]">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={9} className="text-red-400" />
                  <span className="text-[9px] text-intel-text">{r.area}</span>
                  <span className="text-[7px] text-red-400 ml-auto">{r.type?.replace("_", " ")}</span>
                </div>
                <span className="text-[7px] text-intel-muted">Since {r.since} | {r.radius_nm}nm</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
