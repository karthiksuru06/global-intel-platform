import { useMemo } from "react";
import { ShieldAlert } from "lucide-react";
import useEventStore from "../hooks/useEventStore";

export default function ThreatIndicator() {
  const eventList = useEventStore((s) => s.eventList);

  const threatLevel = useMemo(() => {
    if (eventList.length === 0) return 0;
    const sum = eventList.reduce((acc, e) => acc + (e.severity || 1), 0);
    return Math.min(1, sum / (eventList.length * 5));
  }, [eventList]);

  // Calculate historical baseline (10 mins ago) to determine trend trajectory
  const threatTrend = useMemo(() => {
    if (eventList.length < 5) return "stable"; // Need minimum data points
    const tenMinsAgo = new Date(Date.now() - 10 * 60000).toISOString();
    const olderEvents = eventList.filter(e => e.timestamp < tenMinsAgo);

    if (olderEvents.length === 0) return "up";

    const oldSum = olderEvents.reduce((acc, e) => acc + (e.severity || 1), 0);
    const oldThreat = Math.min(1, oldSum / (olderEvents.length * 5));

    if (threatLevel > oldThreat + 0.02) return "up";
    if (threatLevel < oldThreat - 0.02) return "down";
    return "stable";
  }, [eventList, threatLevel]);

  const percentage = Math.round(threatLevel * 100);
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - threatLevel * circumference;

  const color =
    threatLevel > 0.7 ? "#ff3355" : threatLevel > 0.4 ? "#ffaa00" : "#00ff88";

  const label =
    threatLevel > 0.7 ? "HIGH" : threatLevel > 0.4 ? "ELEVATED" : "LOW";

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative w-10 h-10 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 40 40">
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="transparent"
            stroke="rgba(30,30,53,0.5)"
            strokeWidth="3"
          />
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <ShieldAlert className="w-3.5 h-3.5" style={{ color }} />
        </div>
      </div>
      <div>
        <div className="text-[11px] font-mono font-bold leading-none flex items-center gap-1.5" style={{ color }}>
          {label}
        </div>
        <div className="text-[9px] font-mono text-intel-muted mt-0.5 flex items-center gap-1">
          {percentage}% threat
          {threatTrend === "up" && <span className="text-red-400">↑</span>}
          {threatTrend === "down" && <span className="text-green-400">↓</span>}
          {threatTrend === "stable" && <span className="text-intel-muted">→</span>}
        </div>
      </div>
    </div>
  );
}
