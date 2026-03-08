import React, { useState, useEffect, useCallback } from "react";
import {
  DollarSign, TrendingUp, TrendingDown, Bitcoin, RefreshCw,
  BarChart3, Activity
} from "lucide-react";

const API_URL = "http://localhost:3001/api";

const FEAR_GREED_COLORS = {
  "Extreme Fear": { color: "text-red-400", bg: "bg-red-500/20" },
  "Fear": { color: "text-orange-400", bg: "bg-orange-500/20" },
  "Neutral": { color: "text-yellow-400", bg: "bg-yellow-500/20" },
  "Greed": { color: "text-green-400", bg: "bg-green-500/20" },
  "Extreme Greed": { color: "text-emerald-400", bg: "bg-emerald-500/20" },
};

function formatPrice(price) {
  if (!price) return "$0";
  if (price >= 1000) return `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

function formatMarketCap(cap) {
  if (!cap) return "";
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}M`;
  return `$${cap.toLocaleString()}`;
}

function MiniSparkline({ data, width = 50, height = 16, color = "#22d3ee" }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className="opacity-60">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function FinancePanel() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("crypto"); // crypto | sentiment

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const headers = { "x-api-key": "7f9e1d3c5b7a9f2e4d6c8b0a2f4e6d7f9e1d" };
      const res = await fetch(`${API_URL}/finance/overview`, { headers });
      if (res.ok) {
        const data = await res.json();
        setOverview(data);
      }
    } catch (err) {
      console.error("Finance fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const coins = overview?.crypto?.coins || [];
  const fearGreed = overview?.fear_greed || {};
  const sentiment = overview?.sentiment || {};
  const fgHistory = fearGreed?.history || [];

  const fgConfig = FEAR_GREED_COLORS[fearGreed?.current?.classification] || FEAR_GREED_COLORS.Neutral;

  return (
    <div className="glass-panel p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-400" />
          <span className="text-xs font-mono font-bold text-green-400 tracking-wider">
            MARKET INTEL
          </span>
        </div>
        <div className="flex items-center gap-2">
          {sentiment.verdict && (
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${fgConfig.bg} ${fgConfig.color}`}>
              {sentiment.verdict.replace("_", " ")}
            </span>
          )}
          <button onClick={fetchData} disabled={loading} className="p-1 rounded hover:bg-white/5">
            <RefreshCw className={`w-3 h-3 text-intel-muted ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-2">
        <button
          onClick={() => setTab("crypto")}
          className={`px-2 py-0.5 rounded text-[9px] font-mono transition ${
            tab === "crypto" ? "bg-green-500/15 text-green-400" : "text-intel-muted hover:text-intel-text"
          }`}
        >
          Crypto
        </button>
        <button
          onClick={() => setTab("sentiment")}
          className={`px-2 py-0.5 rounded text-[9px] font-mono transition ${
            tab === "sentiment" ? "bg-green-500/15 text-green-400" : "text-intel-muted hover:text-intel-text"
          }`}
        >
          Sentiment
        </button>
      </div>

      {loading && !overview ? (
        <div className="text-[10px] text-intel-muted text-center py-4">Loading market data...</div>
      ) : (
        <>
          {/* Crypto Tab */}
          {tab === "crypto" && (
            <div className="space-y-1 max-h-[250px] overflow-y-auto">
              {coins.map((coin) => {
                const isUp = (coin.change_24h || 0) >= 0;
                return (
                  <div
                    key={coin.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded bg-black/10 hover:bg-black/20 border border-white/[0.03] transition"
                  >
                    {coin.image && (
                      <img src={coin.image} alt="" className="w-4 h-4 rounded-full" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono text-intel-text font-medium">
                          {coin.symbol}
                        </span>
                        <span className="text-[8px] text-intel-muted">{coin.name}</span>
                      </div>
                      <span className="text-[8px] text-intel-muted">
                        MCap: {formatMarketCap(coin.market_cap)}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-mono text-intel-text">
                        {formatPrice(coin.price)}
                      </div>
                      <div className={`flex items-center gap-0.5 justify-end text-[9px] font-mono ${
                        isUp ? "text-green-400" : "text-red-400"
                      }`}>
                        {isUp ? (
                          <TrendingUp className="w-2.5 h-2.5" />
                        ) : (
                          <TrendingDown className="w-2.5 h-2.5" />
                        )}
                        {(coin.change_24h || 0).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sentiment Tab */}
          {tab === "sentiment" && (
            <div className="space-y-3">
              {/* Fear & Greed Gauge */}
              <div className="flex items-center gap-4 p-3 rounded bg-black/20 border border-white/5">
                <div className="relative w-16 h-16">
                  <svg width="64" height="64" className="-rotate-90">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                    <circle
                      cx="32" cy="32" r="28" fill="none"
                      stroke="currentColor" strokeWidth="4"
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${2 * Math.PI * 28 * (1 - (fearGreed?.current?.value || 50) / 100)}`}
                      strokeLinecap="round"
                      className={fgConfig.color}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-lg font-mono font-bold ${fgConfig.color}`}>
                      {fearGreed?.current?.value || 50}
                    </span>
                  </div>
                </div>
                <div>
                  <div className={`text-sm font-mono font-bold ${fgConfig.color}`}>
                    {fearGreed?.current?.classification || "Neutral"}
                  </div>
                  <div className="text-[9px] text-intel-muted mt-1">Fear & Greed Index</div>
                  <MiniSparkline
                    data={fgHistory.map((h) => h.value).reverse()}
                    width={60}
                    height={14}
                    color={fgConfig.color === "text-red-400" ? "#f87171" : "#34d399"}
                  />
                </div>
              </div>

              {/* BTC Summary */}
              {sentiment.btc_price > 0 && (
                <div className="p-2 rounded bg-black/10 border border-white/5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Bitcoin className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-[10px] font-mono text-intel-text">Bitcoin</span>
                  </div>
                  <div className="text-lg font-mono text-intel-text">
                    {formatPrice(sentiment.btc_price)}
                  </div>
                  <div className={`text-[10px] font-mono ${
                    sentiment.btc_24h_change >= 0 ? "text-green-400" : "text-red-400"
                  }`}>
                    {sentiment.btc_24h_change >= 0 ? "+" : ""}
                    {(sentiment.btc_24h_change || 0).toFixed(2)}% (24h)
                  </div>
                </div>
              )}

              {/* 30-day History */}
              {fgHistory.length > 0 && (
                <div>
                  <div className="text-[9px] text-intel-muted font-mono mb-1">30-Day History</div>
                  <div className="grid grid-cols-6 gap-0.5">
                    {fgHistory.slice(0, 30).map((h, i) => {
                      const cfg = FEAR_GREED_COLORS[h.classification] || FEAR_GREED_COLORS.Neutral;
                      return (
                        <div
                          key={i}
                          className={`h-4 rounded-sm ${cfg.bg} flex items-center justify-center`}
                          title={`${h.date}: ${h.value} (${h.classification})`}
                        >
                          <span className="text-[6px] font-mono text-white/60">{h.value}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
