import React, { useState } from "react";
import { Brain, Loader, Zap, Tag, BarChart3 } from "lucide-react";
import useMLStore from "../hooks/useMLPipeline";

const SENTIMENT_COLORS = { POSITIVE: "#22cc88", NEGATIVE: "#ff4444", NEUTRAL: "#888" };
const ENTITY_COLORS = { PER: "#4488ff", ORG: "#ff8800", LOC: "#22cc88", MISC: "#aa44ff" };

export default function MLAnalysisPanel() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const { ready, loading, status, warmup, fullAnalysis } = useMLStore();

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    if (!ready) await warmup();
    try {
      const analysis = await fullAnalysis(input.trim());
      setResult(analysis);
    } catch (e) {
      console.error("ML analysis failed:", e);
    }
  };

  return (
    <div className="glass-panel w-full flex flex-col max-h-[450px]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-1.5">
          <Brain size={12} className="text-purple-400" />
          <span className="text-[10px] font-mono text-intel-cyan tracking-wider">ML ANALYSIS</span>
        </div>
        <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${ready ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400"}`}>
          {status}
        </span>
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-b border-white/5">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a headline or intelligence text for analysis..."
          rows={3}
          className="w-full bg-white/[0.03] border border-white/5 rounded text-[10px] p-2 text-intel-text placeholder:text-intel-muted/50 focus:outline-none focus:border-purple-500/30 resize-none"
        />
        <button
          onClick={handleAnalyze}
          disabled={loading || !input.trim()}
          className="mt-1 w-full py-1.5 text-[10px] font-mono rounded bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 disabled:opacity-30 flex items-center justify-center gap-1.5"
        >
          {loading ? <Loader size={10} className="animate-spin" /> : <Zap size={10} />}
          {loading ? "ANALYZING..." : ready ? "ANALYZE" : "LOAD MODELS & ANALYZE"}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="flex-1 overflow-y-auto min-h-0 px-3 py-2 space-y-3">
          {/* Sentiment */}
          <div>
            <span className="text-[8px] text-intel-muted font-mono">SENTIMENT</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[12px] font-mono font-bold"
                style={{ color: SENTIMENT_COLORS[result.sentiment?.label] || "#888" }}
              >{result.sentiment?.label}</span>
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full"
                  style={{
                    width: `${(result.sentiment?.score || 0) * 100}%`,
                    backgroundColor: SENTIMENT_COLORS[result.sentiment?.label] || "#888",
                  }}
                />
              </div>
              <span className="text-[9px] font-mono text-intel-muted">
                {((result.sentiment?.score || 0) * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Threat Classification */}
          <div>
            <span className="text-[8px] text-intel-muted font-mono">THREAT CLASSIFICATION</span>
            <div className="space-y-1 mt-1">
              {(result.threat_classification?.labels || []).map((label, i) => {
                const score = result.threat_classification?.scores?.[i] || 0;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-[9px] text-intel-text w-32 truncate">{label}</span>
                    <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-purple-500/60" style={{ width: `${score * 100}%` }} />
                    </div>
                    <span className="text-[8px] font-mono text-intel-muted w-10 text-right">
                      {(score * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Named Entities */}
          {(result.entities || []).length > 0 && (
            <div>
              <span className="text-[8px] text-intel-muted font-mono">NAMED ENTITIES</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {(result.entities || []).map((ent, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-mono flex items-center gap-0.5"
                    style={{ backgroundColor: `${ENTITY_COLORS[ent.type] || "#888"}15`, color: ENTITY_COLORS[ent.type] || "#888" }}
                  >
                    <Tag size={7} />
                    {ent.word}
                    <span className="text-[6px] opacity-60">{ent.type}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!result && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center py-6 text-center">
          <Brain size={24} className="text-purple-400/30 mb-2" />
          <span className="text-[10px] text-intel-muted">Enter text above to analyze</span>
          <span className="text-[8px] text-intel-muted mt-1">
            Sentiment, threat classification, entity extraction
          </span>
          <span className="text-[8px] text-intel-muted">Runs entirely in your browser</span>
        </div>
      )}
    </div>
  );
}
