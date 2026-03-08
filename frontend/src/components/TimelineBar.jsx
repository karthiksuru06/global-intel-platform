import { useMemo, useState, useEffect } from "react";
import { Clock, Zap, Globe, Shield, Plane, Swords, Server, Flame, Play, Pause, SkipBack } from "lucide-react";
import useEventStore from "../hooks/useEventStore";
import { getEventConfig } from "../utils/eventIcons";
import ThreatIndicator from "./ThreatIndicator";

const TIME_RANGES = [
  { label: "1H", value: "1h", ms: 3600000 },
  { label: "6H", value: "6h", ms: 21600000 },
  { label: "24H", value: "24h", ms: 86400000 },
  { label: "48H", value: "48h", ms: 172800000 },
  { label: "7D", value: "7d", ms: 604800000 },
];

export default function TimelineBar() {
  const eventList = useEventStore((s) => s.eventList);
  const getEventCounts = useEventStore((s) => s.getEventCounts);
  const timeRangeFilter = useEventStore((s) => s.timeRangeFilter);
  const setTimeRangeFilter = useEventStore((s) => s.setTimeRangeFilter);
  const activeFlights = useEventStore((s) => s.activeFlights);

  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(100); // 0 to 100%

  const counts = getEventCounts();
  const selectedRange = TIME_RANGES.find((r) => r.value === timeRangeFilter);

  // Playback Effect
  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setPlayProgress((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 100;
          }
          return prev + 0.5; // Custom playback speed increment
        });
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Events per minute
  const epm = useMemo(() => {
    const cutoff = new Date(Date.now() - 60000).toISOString();
    return eventList.filter((e) => e.timestamp >= cutoff).length;
  }, [eventList]);

  // Histogram: 40 buckets
  const histogram = useMemo(() => {
    const buckets = new Array(40).fill(0);
    if (eventList.length === 0) return buckets;

    const ms = selectedRange?.ms || 86400000;
    const now = Date.now();
    const cutoff = new Date(now - ms).toISOString();
    const filtered = eventList.filter((e) => e.timestamp >= cutoff);

    for (const ev of filtered) {
      try {
        const t = new Date(ev.timestamp).getTime();
        const bucket = Math.floor(((t - (now - ms)) / ms) * 39);
        if (bucket >= 0 && bucket < 40) buckets[bucket]++;
      } catch {
        /* skip */
      }
    }
    return buckets;
  }, [eventList, selectedRange]);

  const maxBucket = Math.max(1, ...histogram);

  // Color-coded histogram bars
  const getBarColor = (val) => {
    const ratio = val / maxBucket;
    if (ratio > 0.8) return "rgba(255, 51, 85, 0.6)";
    if (ratio > 0.5) return "rgba(255, 170, 0, 0.5)";
    if (ratio > 0.2) return "rgba(0, 212, 255, 0.45)";
    return val > 0 ? "rgba(0, 212, 255, 0.25)" : "rgba(30, 30, 53, 0.35)";
  };

  return (
    <div className="glass-panel px-4 py-2 flex items-center gap-3">
      {/* Threat gauge */}
      <ThreatIndicator />

      <div className="w-px h-8 bg-intel-border/30" />

      {/* Time range buttons */}
      <div className="flex items-center gap-0.5">
        <Clock className="w-3 h-3 text-intel-muted mr-1" />
        {TIME_RANGES.map((range) => (
          <button
            key={range.value}
            onClick={() => setTimeRangeFilter(range.value)}
            className={`px-2 py-0.5 text-[10px] font-mono rounded-md transition ${timeRangeFilter === range.value
                ? "bg-intel-cyan/15 text-intel-cyan border border-intel-cyan/20"
                : "text-intel-muted hover:text-intel-text border border-transparent"
              }`}
          >
            {range.label}
          </button>
        ))}
      </div>

      <div className="w-px h-8 bg-intel-border/30" />

      {/* Playback Controls (Feature 4) */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => {
            setIsPlaying(!isPlaying);
            if (playProgress >= 100) setPlayProgress(0);
          }}
          className={`p-1 rounded-md transition ${isPlaying ? "bg-intel-cyan/15 text-intel-cyan" : "text-intel-muted hover:bg-white/5 hover:text-intel-text"}`}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => {
            setIsPlaying(false);
            setPlayProgress(100); // Live mode
          }}
          className="p-1 rounded-md text-intel-muted hover:bg-white/5 hover:text-intel-text transition"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-px h-8 bg-intel-border/30" />

      {/* Histogram with color coding and playhead */}
      <div className="relative flex items-end gap-[1px] h-7 flex-1 max-w-md cursor-pointer" onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const curProgress = ((e.clientX - rect.left) / rect.width) * 100;
        setPlayProgress(curProgress);
        setIsPlaying(false);
      }}>
        {/* Playback Playhead */}
        <div
          className="absolute top-0 bottom-0 w-px bg-white/50 z-10 transition-all duration-75"
          style={{ left: `${playProgress}%` }}
        />
        <div
          className="absolute top-0 bottom-0 left-0 bg-white/[0.02] z-0 transition-all duration-75"
          style={{ right: `${100 - playProgress}%` }}
        />

        {histogram.map((val, i) => {
          // Fade out bars ahead of playhead if in playback mode
          const barProgress = (i / 40) * 100;
          const isActive = barProgress <= playProgress;

          return (
            <div
              key={i}
              className={`flex-1 rounded-t-sm transition-all duration-300 ${!isActive && playProgress < 100 ? "opacity-20 grayscale" : ""}`}
              style={{
                height: `${(val / maxBucket) * 100}%`,
                minHeight: val > 0 ? "2px" : "1px",
                backgroundColor: getBarColor(val),
              }}
            />
          );
        })}
      </div>

      <div className="w-px h-8 bg-intel-border/30" />

      {/* Quick stats strip */}
      <div className="flex items-center gap-3 text-[9px] font-mono text-intel-muted">
        <BottomStat icon={Zap} value={epm} label="evt/min" color="#ffaa00" />
        <BottomStat icon={Plane} value={activeFlights.length} label="flights" color="#06b6d4" />
        <BottomStat icon={Swords} value={counts.conflicts || 0} label="conflicts" color="#ef4444" />
        <BottomStat icon={Flame} value={counts.fires || 0} label="fires" color="#f97316" />
        <BottomStat icon={Server} value={counts.datacenters || 0} label="DCs" color="#8b5cf6" />
        <BottomStat icon={Globe} value={counts.total || 0} label="total" color="#00d4ff" />
      </div>
    </div>
  );
}

function BottomStat({ icon: Icon, value, label, color }) {
  return (
    <div className="flex items-center gap-1">
      <Icon className="w-2.5 h-2.5" style={{ color }} />
      <span className="text-intel-text tabular-nums">{value}</span>
      <span className="text-intel-muted/60">{label}</span>
    </div>
  );
}
