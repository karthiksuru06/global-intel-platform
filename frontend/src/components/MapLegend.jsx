import { useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";

const MARKER_LEGEND = [
  {
    label: "Aircraft / Flights",
    color: "#00d4ff",
    shape: "circle",
    desc: "Live ADS-B transponder data",
  },
  {
    label: "Maritime Vessels",
    color: "#3b82f6",
    shape: "circle",
    desc: "AIS vessel tracking",
  },
  {
    label: "Conflict Zones",
    color: "#ef4444",
    shape: "pulse",
    desc: "Active conflict & UCDP events",
  },
  {
    label: "Military Bases",
    color: "#f97316",
    shape: "diamond",
    desc: "Known military installations",
  },
  {
    label: "Nuclear Sites",
    color: "#facc15",
    shape: "radiation",
    desc: "Reactors, weapons, test zones",
  },
  {
    label: "Cyber Threats",
    color: "#f43f5e",
    shape: "hex",
    desc: "Active cyber attack origins",
  },
  {
    label: "Data Centers",
    color: "#8b5cf6",
    shape: "circle",
    desc: "Cloud & colocation facilities",
  },
  {
    label: "Webcams",
    color: "#00ff88",
    shape: "circle",
    desc: "Public camera feeds",
  },
  {
    label: "Seismic / Weather",
    color: "#ff5533",
    shape: "circle",
    desc: "Earthquakes & severe weather",
  },
  {
    label: "Fires",
    color: "#f97316",
    shape: "circle",
    desc: "Active wildfires & hotspots",
  },
];

const LINE_LEGEND = [
  { label: "Submarine Cable", color: "#22d3ee", style: "solid" },
  { label: "Pipeline", color: "#f59e0b", style: "dashed" },
  { label: "Trade Route", color: "#14b8a6", style: "dotted" },
];

function MarkerIcon({ shape, color, size = 12 }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 1;

  switch (shape) {
    case "pulse":
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={1} />
          <circle cx={cx} cy={cy} r={r * 0.4} fill={color} />
        </svg>
      );
    case "diamond":
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <rect
            x={cx - r * 0.6}
            y={cy - r * 0.6}
            width={r * 1.2}
            height={r * 1.2}
            fill={color}
            fillOpacity={0.3}
            stroke={color}
            strokeWidth={1}
            transform={`rotate(45 ${cx} ${cy})`}
          />
          <circle cx={cx} cy={cy} r={r * 0.25} fill={color} />
        </svg>
      );
    case "radiation":
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.2} stroke={color} strokeWidth={1} />
          <circle cx={cx} cy={cy} r={r * 0.35} fill={color} />
          <circle cx={cx} cy={cy} r={r * 0.7} fill="none" stroke={color} strokeWidth={0.5} strokeDasharray="2,1.5" />
        </svg>
      );
    case "hex":
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={0.8} strokeDasharray="1.5,1.5" />
          <circle cx={cx} cy={cy} r={r * 0.4} fill={color} fillOpacity={0.9} />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.6} stroke={color} strokeWidth={1} />
          <circle cx={cx} cy={cy} r={r * 0.35} fill="white" fillOpacity={0.9} />
        </svg>
      );
  }
}

export default function MapLegend() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="glass-panel w-[180px] overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-1.5 flex items-center justify-between text-[10px] font-mono text-intel-muted hover:text-intel-cyan transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Info className="w-3 h-3" />
          <span className="uppercase tracking-wider">Legend</span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>

      {isOpen && (
        <div className="px-3 pb-2 space-y-1.5 animate-fade-in">
          {/* Marker symbols */}
          <div className="text-[8px] font-mono text-intel-cyan/60 uppercase tracking-wider">
            Markers
          </div>
          <div className="space-y-[3px]">
            {MARKER_LEGEND.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-1.5 group"
                title={item.desc}
              >
                <MarkerIcon shape={item.shape} color={item.color} size={10} />
                <span className="text-[8px] font-mono text-intel-muted group-hover:text-intel-text transition-colors">
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          {/* Line divider */}
          <div className="h-px bg-intel-border/30" />

          {/* Line symbols */}
          <div className="text-[8px] font-mono text-intel-cyan/60 uppercase tracking-wider">
            Lines
          </div>
          <div className="space-y-[3px]">
            {LINE_LEGEND.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <svg width={16} height={4} viewBox="0 0 16 4">
                  <line
                    x1={0}
                    y1={2}
                    x2={16}
                    y2={2}
                    stroke={item.color}
                    strokeWidth={item.style === "solid" ? 2 : 1.5}
                    strokeDasharray={
                      item.style === "dashed"
                        ? "3,2"
                        : item.style === "dotted"
                        ? "1.5,1.5"
                        : "none"
                    }
                    strokeLinecap="round"
                  />
                </svg>
                <span className="text-[8px] font-mono text-intel-muted">
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          {/* Severity scale */}
          <div className="h-px bg-intel-border/30" />
          <div className="text-[8px] font-mono text-intel-cyan/60 uppercase tracking-wider">
            Severity
          </div>
          <div className="flex items-center gap-[2px]">
            {[
              { level: "Low", color: "#00ff88" },
              { level: "Med", color: "#ffdd00" },
              { level: "High", color: "#ffaa00" },
              { level: "Crit", color: "#ff5533" },
              { level: "Sev", color: "#b44dff" },
            ].map((s) => (
              <div key={s.level} className="flex-1 text-center">
                <div
                  className="h-1 rounded-full mb-0.5"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-[6px] font-mono text-intel-muted">
                  {s.level}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
