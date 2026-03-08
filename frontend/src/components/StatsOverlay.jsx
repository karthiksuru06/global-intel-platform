import { useMemo } from "react";
import {
  Globe, Plane, Ship, Swords, Shield, Atom, Cable,
  Fuel, Server, Rocket, Flame, Bug, Users, Zap,
  Activity, Anchor, Mountain, Thermometer,
} from "lucide-react";
import useEventStore from "../hooks/useEventStore";
import { getEventConfig } from "../utils/eventIcons";

const STAT_ITEMS = [
  { key: "aircraft", icon: Plane, label: "Aircraft" },
  { key: "ship", icon: Ship, label: "Vessels" },
  { key: "conflicts", icon: Swords, label: "Conflicts" },
  { key: "bases", icon: Shield, label: "Mil. Bases" },
  { key: "nuclear", icon: Atom, label: "Nuclear" },
  { key: "cables", icon: Cable, label: "Cables" },
  { key: "pipelines", icon: Fuel, label: "Pipelines" },
  { key: "datacenters", icon: Server, label: "Data Ctr" },
  { key: "spaceports", icon: Rocket, label: "Spaceports" },
  { key: "fires", icon: Flame, label: "Fires" },
  { key: "cyberThreats", icon: Bug, label: "Cyber" },
  { key: "protests", icon: Users, label: "Protests" },
  { key: "outages", icon: Zap, label: "Outages" },
  { key: "seismic", icon: Activity, label: "Seismic" },
  { key: "minerals", icon: Mountain, label: "Minerals" },
  { key: "climate", icon: Thermometer, label: "Climate" },
];

export default function StatsOverlay() {
  const getEventCounts = useEventStore((s) => s.getEventCounts);
  const activeFlights = useEventStore((s) => s.activeFlights);
  const getStatsByCategory = useEventStore((s) => s.getStatsByCategory);
  const counts = getEventCounts();
  const catStats = getStatsByCategory();

  const categories = useMemo(
    () => [
      { name: "Tracking", count: catStats.tracking, color: "#00d4ff" },
      { name: "Security", count: catStats.security, color: "#ef4444" },
      { name: "Infra", count: catStats.infrastructure, color: "#8b5cf6" },
      { name: "Environment", count: catStats.environment, color: "#10b981" },
      { name: "Cyber/Social", count: catStats.cyber, color: "#f43f5e" },
      { name: "Surveillance", count: catStats.surveillance, color: "#00ff88" },
    ],
    [catStats]
  );

  const maxCat = Math.max(1, ...categories.map((c) => c.count));

  return (
    <div className="glass-panel w-72 p-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Globe className="w-3.5 h-3.5 text-intel-cyan" />
        <span className="text-[10px] font-mono text-intel-cyan uppercase tracking-widest">
          Global Statistics
        </span>
        <span className="ml-auto text-[9px] font-mono text-intel-muted bg-white/[0.04] px-1.5 py-0.5 rounded">
          {counts.total || 0} total
        </span>
      </div>

      {/* Category bars */}
      <div className="space-y-1.5 mb-3">
        {categories.map((cat) => (
          <div key={cat.name} className="flex items-center gap-2">
            <span className="text-[8px] font-mono text-intel-muted w-16 text-right truncate">
              {cat.name}
            </span>
            <div className="flex-1 h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(cat.count / maxCat) * 100}%`,
                  backgroundColor: cat.color,
                  minWidth: cat.count > 0 ? "4px" : "0",
                }}
              />
            </div>
            <span
              className="text-[8px] font-mono tabular-nums w-6 text-right"
              style={{ color: cat.color }}
            >
              {cat.count}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-intel-border/30 my-2" />

      {/* Individual layer counts grid */}
      <div className="grid grid-cols-2 gap-1">
        {STAT_ITEMS.map(({ key, icon: Icon, label }) => {
          const count = counts[key] || 0;
          if (count === 0) return null;
          const config = getEventConfig(key);

          return (
            <div
              key={key}
              className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-white/[0.02]"
            >
              <Icon className="w-2.5 h-2.5" style={{ color: config.color }} />
              <span className="text-[8px] font-mono text-intel-muted truncate flex-1">
                {label}
              </span>
              <span
                className="text-[9px] font-mono font-bold tabular-nums"
                style={{ color: config.color }}
              >
                {count}
              </span>
            </div>
          );
        })}

        {/* Active flights (from simulation) */}
        {activeFlights.length > 0 && (
          <div className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-white/[0.02]">
            <Plane className="w-2.5 h-2.5 text-[#06b6d4]" />
            <span className="text-[8px] font-mono text-intel-muted truncate flex-1">
              Flights
            </span>
            <span className="text-[9px] font-mono font-bold tabular-nums text-[#06b6d4]">
              {activeFlights.length}
            </span>
          </div>
        )}
      </div>

      {/* Intelligence Metrics */}
      <div className="mt-2 pt-2 border-t border-intel-border/30">
        <div className="grid grid-cols-4 gap-1 text-center">
          <div>
            <div className="text-[10px] font-mono font-bold text-intel-cyan tabular-nums">
              {counts.total || 0}
            </div>
            <div className="text-[6px] font-mono text-intel-muted uppercase">Nodes</div>
          </div>
          <div>
            <div className="text-[10px] font-mono font-bold text-intel-amber tabular-nums">
              {(counts.conflicts || 0) + (counts.threats || 0)}
            </div>
            <div className="text-[6px] font-mono text-intel-muted uppercase">Threats</div>
          </div>
          <div>
            <div className="text-[10px] font-mono font-bold text-intel-red tabular-nums">
              7.2
            </div>
            <div className="text-[6px] font-mono text-intel-muted uppercase">Entropy</div>
          </div>
          <div>
            <div className="text-[10px] font-mono font-bold text-intel-green tabular-nums">
              {Math.floor(Math.random() * 50) + 120}K
            </div>
            <div className="text-[6px] font-mono text-intel-muted uppercase">Signals</div>
          </div>
        </div>
      </div>
    </div>
  );
}
