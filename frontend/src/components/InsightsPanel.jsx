import { Brain, AlertTriangle, TrendingUp, Info, Search, Activity } from "lucide-react";
import useEventStore from "../hooks/useEventStore";
import { formatTimestamp, formatSeverity } from "../utils/formatters";

const CATEGORY_ICONS = {
  threat: AlertTriangle,
  pattern: Search,
  anomaly: AlertTriangle,
  trend: TrendingUp,
  info: Info,
};

export default function InsightsPanel() {
  const insights = useEventStore((s) => s.insights);

  // ALWAYS Unlocked for Phase 4 Completion
  return (
    <div className="glass-panel-glow p-4 w-full">
      <div className="flex items-center gap-2 mb-3 text-xs font-mono text-intel-cyan uppercase tracking-wider">
        <Brain className="w-3.5 h-3.5" />
        <span>AI Insights</span>
        {insights.length > 0 && (
          <span className="ml-auto bg-intel-cyan/20 text-intel-cyan px-1.5 py-0.5 rounded text-[10px]">
            {insights.length}
          </span>
        )}
      </div>

      <TheaterStatureCard />

      {insights.length === 0 ? (
        <div className="text-center py-8">
          <Brain className="w-8 h-8 text-intel-border mx-auto mb-2 opacity-30" />
          <p className="text-xs text-intel-muted">No insights yet</p>
          <p className="text-[10px] text-intel-muted mt-1">
            Waiting for analysis engine...
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {insights
            .slice()
            .reverse()
            .map((insight) => {
              const sev = formatSeverity(insight.severity || 1);
              const Icon = CATEGORY_ICONS[insight.category] || Info;

              return (
                <div
                  key={insight.id}
                  className="p-2.5 rounded-md bg-white/[0.03] border border-intel-border/50 hover:border-intel-border transition animate-fade-in"
                >
                  <div className="flex items-start gap-2">
                    <Icon
                      className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                      style={{ color: sev.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono font-medium text-intel-text leading-tight">
                        {insight.title}
                      </div>
                      <div className="text-[10px] text-intel-muted mt-1 leading-relaxed">
                        {insight.description}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded font-mono uppercase"
                          style={{
                            color: sev.color,
                            backgroundColor: sev.color + "15",
                          }}
                        >
                          {insight.category}
                        </span>
                        {insight.metadata?.escalation_prob !== undefined && (
                          <span className="text-[9px] text-intel-cyan bg-intel-cyan/10 px-1 rounded">
                            {Math.round(insight.metadata.escalation_prob * 100)}% PROB
                          </span>
                        )}
                        <span className="text-[9px] text-intel-muted ml-auto">
                          {formatTimestamp(insight.timestamp)}
                        </span>
                      </div>

                      {insight.metadata?.recommendations?.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-intel-border/30">
                          <div className="text-[9px] font-mono text-intel-cyan mb-1 flex items-center gap-1">
                            <TrendingUp className="w-2.5 h-2.5" />
                            RECOMMENDED ACTIONS
                          </div>
                          <div className="space-y-1">
                            {insight.metadata.recommendations.map((rec, i) => (
                              <div key={i} className="text-[9px] text-intel-text pl-2 border-l border-intel-cyan/30">
                                {rec}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

function TheaterStatureCard() {
  const events = useEventStore((s) => s.eventList);

  const theaterCount = { air: 0, sea: 0, threat: 0 };
  events.forEach(e => {
    if (e.type === "aircraft" || e.type === "flights") theaterCount.air++;
    if (e.type === "ship" || e.type === "military") theaterCount.sea++;
    if (e.severity >= 0.7) theaterCount.threat++;
  });

  const statureLevel = theaterCount.threat > 10 ? "ELEVATED" : theaterCount.threat > 5 ? "GUARDED" : "NOMINAL";
  const statureColor = statureLevel === "ELEVATED" ? "text-intel-amber" : "text-intel-green";

  return (
    <div className="mb-4 p-3 rounded-lg bg-black/40 border border-intel-border/30">
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-intel-border/20">
        <span className="text-[10px] font-mono font-bold text-intel-text uppercase tracking-widest">
          Theater Stature
        </span>
        <span className={`text-[10px] font-mono font-bold ${statureColor}`}>
          {statureLevel}
        </span>
      </div>
      <div className="flex justify-between text-[10px] pb-1">
        <div className="flex flex-col items-center">
          <span className="text-intel-muted mb-1 uppercase text-[8px]">Air Assets</span>
          <span className="font-mono text-intel-cyan">{theaterCount.air}</span>
        </div>
        <div className="w-px bg-intel-border/20" />
        <div className="flex flex-col items-center">
          <span className="text-intel-muted mb-1 uppercase text-[8px]">Sea Assets</span>
          <span className="font-mono text-intel-cyan">{theaterCount.sea}</span>
        </div>
        <div className="w-px bg-intel-border/20" />
        <div className="flex flex-col items-center">
          <span className="text-intel-red mb-1 uppercase text-[8px]">Hostile Activity</span>
          <span className="font-mono text-intel-red">{theaterCount.threat}</span>
        </div>
      </div>
    </div>
  );
}
