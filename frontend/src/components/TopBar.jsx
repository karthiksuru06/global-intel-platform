import { useEffect, useState, useMemo } from "react";
import {
  ShieldAlert,
  Search,
  Wifi,
  WifiOff,
  Activity,
  AlertTriangle,
  BrainCircuit,
  PieChart,
  Globe, Shield, Plane, Swords, Bug, Layers, Zap,
  Sun, Moon, Command,
} from "lucide-react";
import useEventStore from "../hooks/useEventStore";
import useTheme from "../hooks/useTheme";
import { formatNumber } from "../utils/formatters";

export default function TopBar() {
  const connectionStatus = useEventStore((s) => s.connectionStatus);
  const getEventCounts = useEventStore((s) => s.getEventCounts);
  const getThreatLevel = useEventStore((s) => s.getThreatLevel);
  const getActiveLayerCount = useEventStore((s) => s.getActiveLayerCount);
  const getStatsByCategory = useEventStore((s) => s.getStatsByCategory);
  const activeFlights = useEventStore((s) => s.activeFlights);
  const eventList = useEventStore((s) => s.eventList);
  const showSearch = useEventStore((s) => s.showSearch);
  const toggleSearch = useEventStore((s) => s.toggleSearch);
  const setFilter = useEventStore((s) => s.setFilter);
  const activeFilters = useEventStore((s) => s.activeFilters);
  const channel = useEventStore((s) => s.channel);
  const insights = useEventStore((s) => s.insights);

  const counts = getEventCounts();
  const threatLevel = getThreatLevel();
  const activeLayerCount = getActiveLayerCount();

  // Feature: Pentagon Pizza Index (Volatility Metric)
  const pizzaIndex = Math.min(100, Math.round(threatLevel * 100 * 1.5 + (activeFilters.minSeverity * 5) + (insights.length * 0.5)));
  const defconLevel = pizzaIndex > 80 ? 2 : pizzaIndex > 50 ? 3 : pizzaIndex > 25 ? 4 : 5;
  const catStats = getStatsByCategory();

  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () => {
      setClock(
        new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC"
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Events per minute
  const epm = useMemo(() => {
    const cutoff = new Date(Date.now() - 60000).toISOString();
    return eventList.filter((e) => e.timestamp >= cutoff).length;
  }, [eventList]);

  const statusColor =
    connectionStatus === "connected"
      ? "bg-intel-green"
      : connectionStatus === "reconnecting"
        ? "bg-intel-amber"
        : "bg-intel-red";

  const threatColor =
    threatLevel > 0.7
      ? "text-intel-red"
      : threatLevel > 0.4
        ? "text-intel-amber"
        : "text-intel-green";

  const threatLabel =
    threatLevel > 0.7 ? "HIGH" : threatLevel > 0.4 ? "ELEVATED" : "NOMINAL";

  return (
    <div className="glass-panel">
      {/* Main bar */}
      <div className="flex items-center justify-between px-4 py-2">
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-intel-cyan/10 border border-intel-cyan/20 flex items-center justify-center relative">
            <ShieldAlert className="w-4 h-4 text-intel-cyan" />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-intel-green animate-pulse-glow" />
          </div>
          <div>
            <h1 className="text-[11px] font-mono font-bold tracking-[0.2em] text-intel-text uppercase leading-none">
              GEOPOLITICAL INTELLIGENCE ENGINE
            </h1>
            <span className="text-[8px] font-mono text-intel-cyan tracking-wider flex items-center gap-1">
              <Activity className="w-2.5 h-2.5" />
              DISTRIBUTED PROBABILISTIC KNOWLEDGE GRAPH
            </span>
          </div>
        </div>

        {/* Center: Quick Stats */}
        <div className="flex items-center gap-1">
          <MiniStat
            icon={Globe}
            label="Events"
            value={formatNumber(counts.total)}
            color="#00d4ff"
            tooltip="Total monitored geopolitical events across all active layers"
          />
          <Divider />
          <MiniStat
            icon={Shield}
            label="Threat"
            value={threatLabel}
            color={threatLevel > 0.7 ? "#ff3355" : threatLevel > 0.4 ? "#ffaa00" : "#00ff88"}
            tooltip="Current aggregate threat level calculated from event severity and volume"
          />
          <Divider />
          <MiniStat
            icon={Plane}
            label="Flights"
            value={String(activeFlights.length)}
            color="#06b6d4"
            tooltip="Active live flights from ADS-B simulation"
          />
          <Divider />
          <MiniStat
            icon={Swords}
            label="Conflicts"
            value={String(counts.conflicts || 0)}
            color="#ef4444"
            tooltip="Active conflict zones derived from UCDP, ACLED and GDELT datasets"
          />
          <Divider />
          <MiniStat
            icon={Bug}
            label="Cyber"
            value={String(counts.cyberThreats || 0)}
            color="#f43f5e"
            tooltip="Active cyber threats, APT campaigns and DDoS incidents from threat intel feeds"
          />
          <Divider />
          <MiniStat
            icon={Layers}
            label="Layers"
            value={String(activeLayerCount)}
            color="#8b5cf6"
            tooltip="Number of data overlay layers currently visible on the globe"
          />
          <Divider />
          <MiniStat
            icon={Zap}
            label="Evt/Min"
            value={String(epm)}
            color="#ffaa00"
            tooltip="Events Per Minute — real-time ingestion throughput rate"
          />
        </div>

        {/* Right: Connection + Search + Clock */}
        <div className="flex items-center gap-3 text-xs font-mono">
          {/* Cmd+K hint */}
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/5 hover:border-white/10 transition"
            title="Command Palette (Ctrl+K)"
          >
            <Command className="w-2.5 h-2.5 text-intel-muted" />
            <span className="text-[8px] font-mono text-intel-muted">K</span>
          </button>

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Search toggle */}
          <button
            onClick={toggleSearch}
            className={`p-1.5 rounded-md transition ${showSearch ? "bg-intel-cyan/10 text-intel-cyan" : "hover:bg-white/5 text-intel-muted"}`}
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          {/* Channel Classification Badge (Feature 5) */}
          <div className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider border ${channel === "SOVEREIGN" ? "bg-red-500/20 text-red-400 border-red-500/30" :
              channel === "CLASSIFIED" ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
            }`}>
            {channel}
          </div>

          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            {connectionStatus === "connected" ? (
              <Wifi className="w-3 h-3 text-intel-green" />
            ) : (
              <WifiOff className="w-3 h-3 text-intel-red" />
            )}
            <div
              className={`w-1.5 h-1.5 rounded-full ${statusColor} animate-pulse-glow`}
            />
            <span className="text-intel-muted text-[9px] capitalize">
              {connectionStatus}
            </span>
          </div>

          <div className="w-px h-4 bg-white/20" />

          {/* Clock */}
          <div className="text-intel-cyan min-w-[65px] text-right tracking-widest text-[10px]">
            {clock}
          </div>
        </div>
      </div>

      {/* Search bar (expandable) */}
      {showSearch && (
        <div className="px-4 pb-2.5 animate-fade-in">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-intel-muted" />
            <input
              type="text"
              value={activeFilters.search || ""}
              onChange={(e) => setFilter("search", e.target.value)}
              placeholder={"Type \"/q\" for Graph Query (e.g. /q fragility > 0.8) or search events..."}
              className="w-full bg-white/[0.03] border border-intel-border/30 rounded-lg py-2 pl-9 pr-4 text-[11px] font-mono text-intel-text placeholder-intel-muted/50 focus:outline-none focus:border-intel-cyan/40 transition"
              autoFocus
            />
            {activeFilters.search && (
              <button
                onClick={() => setFilter("search", "")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-mono text-intel-muted hover:text-intel-cyan"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, color, tooltip }) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded cursor-default hover:bg-white/[0.04] transition-colors"
      title={tooltip || label}
    >
      <Icon className="w-3 h-3 flex-shrink-0" style={{ color }} />
      <div className="text-center">
        <div className="text-[11px] font-mono font-bold leading-none" style={{ color }}>
          {value}
        </div>
        <div className="text-[7px] font-mono text-intel-muted uppercase tracking-widest mt-0.5">
          {label}
        </div>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-intel-border/30 mx-0.5" />;
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="p-1.5 rounded-md transition hover:bg-white/5 text-intel-muted"
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <Sun className="w-3.5 h-3.5" />
      ) : (
        <Moon className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
