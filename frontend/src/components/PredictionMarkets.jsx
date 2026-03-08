import React, { useState, useEffect } from "react";
import { TrendingUp, BarChart3, AlertTriangle } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const CAT_COLORS = {
  conflict: "#ff0044", elections: "#4488ff", nuclear: "#ff00ff",
  trade_sanctions: "#ffaa00", diplomacy: "#22cc88", cyber: "#00ffcc",
  climate: "#44ff88", geopolitics: "#8844ff",
};

function ProbBar({ probability }) {
  const color = probability > 80 ? "#ff0044" : probability > 60 ? "#ff6600" : probability > 40 ? "#ffaa00" : probability > 20 ? "#22cc88" : "#4488ff";
  return (
    <div className="flex items-center gap-1.5 w-full">
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${probability}%`, backgroundColor: color }} />
      </div>
      <span className="text-[9px] font-mono w-10 text-right" style={{ color }}>{probability}%</span>
    </div>
  );
}

export default function PredictionMarkets() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    const load = async () => {
      try { const r = await fetch(`${API}/predictions`); setData(await r.json()); } catch (e) {}
    };
    load(); const t = setInterval(load, 300000); return () => clearInterval(t);
  }, []);

  if (!data) return null;

  let markets = data.markets || [];
  if (tab !== "all") markets = markets.filter((m) => m.category === tab);

  return (
    <div className="glass-panel w-full flex flex-col max-h-[420px]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-1.5">
          <TrendingUp size={12} className="text-purple-400" />
          <span className="text-[10px] font-mono text-intel-cyan tracking-wider">PREDICTION MARKETS</span>
        </div>
        <span className="text-[9px] text-intel-muted">{data.total_markets} MARKETS</span>
      </div>

      {/* Category tabs */}
      <div className="flex gap-0.5 px-2 py-1 overflow-x-auto border-b border-white/5">
        {["all", "conflict", "elections", "nuclear", "trade_sanctions", "diplomacy", "geopolitics"].map((c) => (
          <button key={c} onClick={() => setTab(c)}
            className={`px-1.5 py-0.5 text-[8px] font-mono rounded whitespace-nowrap ${
              tab === c ? "bg-purple-500/15 text-purple-400" : "text-intel-muted"
            }`}
          >{c.replace("_", " ").toUpperCase()}</button>
        ))}
      </div>

      {/* Strong signals */}
      {tab === "all" && (data.strong_signals || []).length > 0 && (
        <div className="px-3 py-1.5 border-b border-white/5 bg-purple-500/[0.03]">
          <span className="text-[8px] text-purple-400 font-mono">STRONG SIGNALS ({data.strong_signals.length})</span>
          {(data.strong_signals || []).slice(0, 3).map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 mt-1">
              <AlertTriangle size={8} className={s.probability > 80 ? "text-red-400" : "text-blue-400"} />
              <span className="text-[8px] text-intel-text truncate flex-1">{s.question}</span>
              <span className="text-[9px] font-mono" style={{ color: s.probability > 80 ? "#ff0044" : "#4488ff" }}>
                {s.probability}%
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0">
        {markets.slice(0, 50).map((m, i) => (
          <div key={m.id || i} className="px-3 py-2 border-b border-white/[0.03] hover:bg-white/[0.02]">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="px-1 py-0.5 rounded text-[7px] font-mono"
                style={{ backgroundColor: `${CAT_COLORS[m.category] || "#888"}15`, color: CAT_COLORS[m.category] || "#888" }}
              >{m.category}</span>
              {m.volume_usd > 100000 && (
                <span className="text-[7px] text-intel-muted flex items-center gap-0.5">
                  <BarChart3 size={7} />${(m.volume_usd / 1000).toFixed(0)}k vol
                </span>
              )}
            </div>
            <p className="text-[10px] text-intel-text leading-snug mb-1.5">{m.question}</p>
            <ProbBar probability={m.probability} />
          </div>
        ))}
      </div>
    </div>
  );
}
