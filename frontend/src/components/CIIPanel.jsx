import React, { useState, useEffect, useCallback } from "react";
import { Shield, TrendingUp, TrendingDown, AlertTriangle, Globe, RefreshCw } from "lucide-react";

const API_URL = "http://localhost:3001/api";

const SEVERITY_CONFIG = {
  critical: { color: "text-red-400", bg: "bg-red-500/20", ring: "border-red-500" },
  high: { color: "text-orange-400", bg: "bg-orange-500/20", ring: "border-orange-500" },
  medium: { color: "text-yellow-400", bg: "bg-yellow-500/20", ring: "border-yellow-500" },
  low: { color: "text-green-400", bg: "bg-green-500/20", ring: "border-green-500" },
};

function ScoreRing({ score, severity, size = 48 }) {
  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.low;
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={3}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${config.color} transition-all duration-1000`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-[11px] font-mono font-bold ${config.color}`}>
          {Math.round(score)}
        </span>
      </div>
    </div>
  );
}

function ComponentBar({ label, value, color }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[8px] text-intel-muted font-mono w-12 text-right">{label}</span>
      <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
      <span className="text-[8px] text-intel-muted font-mono w-6">{Math.round(value)}</span>
    </div>
  );
}

export default function CIIPanel() {
  const [scores, setScores] = useState(null);
  const [topRisk, setTopRisk] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const fetchCII = useCallback(async () => {
    try {
      setLoading(true);
      const headers = { "x-api-key": "7f9e1d3c5b7a9f2e4d6c8b0a2f4e6d7f9e1d" };
      const [scoresRes, topRes] = await Promise.all([
        fetch(`${API_URL}/cii`, { headers }),
        fetch(`${API_URL}/cii/top?n=15`, { headers }),
      ]);
      if (scoresRes.ok) {
        const data = await scoresRes.json();
        setScores(data.scores || {});
      }
      if (topRes.ok) {
        const data = await topRes.json();
        setTopRisk(data.countries || []);
      }
    } catch (err) {
      console.error("CII fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCII();
    const interval = setInterval(fetchCII, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchCII]);

  const totalCountries = scores ? Object.keys(scores).length : 0;
  const criticalCount = topRisk.filter((c) => c.severity === "critical").length;
  const highCount = topRisk.filter((c) => c.severity === "high").length;

  return (
    <div className="glass-panel p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-intel-amber" />
          <span className="text-xs font-mono font-bold text-intel-amber tracking-wider">
            COUNTRY INSTABILITY INDEX
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-intel-muted font-mono">
            {totalCountries} nations
          </span>
          <button onClick={fetchCII} disabled={loading} className="p-1 rounded hover:bg-white/5">
            <RefreshCw className={`w-3 h-3 text-intel-muted ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex gap-2 mb-3">
        {criticalCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span className="text-[9px] font-mono text-red-400">{criticalCount} CRITICAL</span>
          </div>
        )}
        {highCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20">
            <span className="text-[9px] font-mono text-orange-400">{highCount} HIGH</span>
          </div>
        )}
      </div>

      {/* Country List */}
      {loading && !topRisk.length ? (
        <div className="text-[10px] text-intel-muted text-center py-4">Computing CII scores...</div>
      ) : (
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {topRisk.map((country) => {
            const config = SEVERITY_CONFIG[country.severity] || SEVERITY_CONFIG.low;
            const isExpanded = expanded === country.country_code;

            return (
              <div
                key={country.country_code}
                className={`rounded border border-white/5 transition cursor-pointer ${
                  isExpanded ? "bg-black/20" : "hover:bg-black/10"
                }`}
                onClick={() => setExpanded(isExpanded ? null : country.country_code)}
              >
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <ScoreRing score={country.score} severity={country.severity} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-intel-text font-medium">
                        {country.name}
                      </span>
                      <span className="text-[8px] text-intel-muted font-mono">
                        ({country.country_code})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[8px] font-mono font-bold ${config.color}`}>
                        {country.severity.toUpperCase()}
                      </span>
                      {country.event_count > 0 && (
                        <span className="text-[8px] text-intel-muted">
                          {country.event_count} events
                        </span>
                      )}
                      {country.news_count > 0 && (
                        <span className="text-[8px] text-intel-muted">
                          {country.news_count} mentions
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`text-sm font-mono font-bold ${config.color}`}>
                    {Math.round(country.score)}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && country.components && (
                  <div className="px-3 pb-2 space-y-1">
                    <ComponentBar label="Base" value={country.components.baseline} color="bg-blue-500" />
                    <ComponentBar label="Unrest" value={country.components.unrest} color="bg-red-500" />
                    <ComponentBar label="Security" value={country.components.security} color="bg-orange-500" />
                    <ComponentBar label="Info" value={country.components.information} color="bg-cyan-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
