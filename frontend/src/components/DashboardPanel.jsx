import { useState, useEffect, useMemo } from "react";
import {
  Camera, TrendingUp, TrendingDown, Activity, Wifi, ChevronUp, ChevronDown, Monitor, BarChart3, Eye, Cpu, HardDrive, Gauge, Signal, Video, Radio, Shield, Zap, Ship, Fuel, Globe, Newspaper, Info
} from "lucide-react";
import useEventStore from "../hooks/useEventStore";

// Intelligence Panel Imports
import EventFeed from "./EventFeed";
import InsightsPanel from "./InsightsPanel";
import StatsOverlay from "./StatsOverlay";
import CIIPanel from "./CIIPanel";
import FinancePanel from "./FinancePanel";
import ConflictTracker from "./ConflictTracker";
import FleetTracker from "./FleetTracker";
import PredictionMarkets from "./PredictionMarkets";
import GNSSPanel from "./GNSSPanel";
import TravelAdvisoryPanel from "./TravelAdvisoryPanel";
import InfrastructurePanel from "./InfrastructurePanel";
import AirportStatus from "./AirportStatus";
import MLAnalysisPanel from "./MLAnalysisPanel";
import EventDetail from "./EventDetail";

const APIS = [
  { name: "Intel Engine", status: "online", latency: 12 },
  { name: "Security Gateway", status: "online", latency: 8 },
  { name: "OpenSky Network", status: "online", latency: 45 },
  { name: "Marine AIS", status: "online", latency: 67 },
  { name: "GDELT Events", status: "online", latency: 41 },
];

export default function DashboardPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("metrics"); // "metrics" | "intelligence" | "news" | "webcams"
  const channel = useEventStore((s) => s.channel);
  const eventList = useEventStore((s) => s.eventList);
  const selectedEvent = useEventStore((s) => s.selectedEvent);
  const rightPanelTab = useEventStore((s) => s.rightPanelTab);
  const setRightPanelTab = useEventStore((s) => s.setRightPanelTab);

  const [metrics, setMetrics] = useState({
    evtPerSec: 12, latency: 23, cpuUsage: 34, memUsage: 67, bandwidth: 145, connections: 842, uptime: "99.97%",
  });

  // Extract live webcams from store
  const liveWebcams = useMemo(() => {
    return eventList.filter(e => e.type === "webcam").slice(0, 6);
  }, [eventList]);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setMetrics((prev) => ({
        evtPerSec: Math.max(1, prev.evtPerSec + Math.floor((Math.random() - 0.5) * 5)),
        latency: Math.max(5, prev.latency + Math.floor((Math.random() - 0.5) * 8)),
        cpuUsage: Math.max(10, Math.min(95, prev.cpuUsage + Math.floor((Math.random() - 0.5) * 6))),
        memUsage: Math.max(30, Math.min(95, prev.memUsage + Math.floor((Math.random() - 0.5) * 3))),
        bandwidth: Math.max(50, Math.min(500, prev.bandwidth + Math.floor((Math.random() - 0.5) * 20))),
        connections: Math.max(500, prev.connections + Math.floor((Math.random() - 0.5) * 50)),
        uptime: prev.uptime,
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, [isOpen]);

  return (
    <div className="glass-panel overflow-hidden border-t border-intel-cyan/20">
      {/* Toggle header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-1.5 flex items-center justify-between text-[10px] font-mono text-intel-muted hover:text-intel-cyan transition-colors bg-intel-bg/40"
      >
        <div className="flex items-center gap-2">
          <Monitor className="w-3 h-3" />
          <span className="uppercase tracking-wider font-bold text-intel-cyan/80">Command Hub</span>
          <span className="w-1.5 h-1.5 rounded-full bg-intel-green animate-pulse" />
          <span className="text-intel-green/70 text-[8px]">CORE OPERATIONAL</span>
        </div>

        <div className="flex items-center gap-4">
          {isOpen && (
            <div className="flex items-center gap-1 mr-4 overflow-x-auto no-scrollbar">
              <TabLink active={activeTab === "metrics"} onClick={() => setActiveTab("metrics")} icon={Activity} label="System" />
              <TabLink active={activeTab === "intelligence"} onClick={() => setActiveTab("intelligence")} icon={Globe} label="Intel Reports" />
              <TabLink active={activeTab === "news"} onClick={() => setActiveTab("news")} icon={Newspaper} label="Video News" />
              <TabLink active={activeTab === "webcams"} onClick={() => setActiveTab("webcams")} icon={Video} label="Theater Cams" />
            </div>
          )}
          {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </div>
      </button>

      {/* Content Area */}
      {isOpen && (
        <div className="p-3 animate-slide-up bg-intel-bg/60 min-h-[320px] max-h-[500px] overflow-y-auto overflow-x-hidden">
          {/* TAB: SYSTEM METRICS */}
          {activeTab === "metrics" && (
            <div className="grid grid-cols-4 gap-4 h-full">
              <div className="col-span-1 space-y-4">
                <SectionHeader icon={Gauge} label="Sovereign Performance" />
                <div className="space-y-3">
                  <MetricBar icon={Cpu} label="Neural Load" value={metrics.cpuUsage} max={100} unit="%" color="#00d4ff" />
                  <MetricBar icon={HardDrive} label="Buffer Health" value={metrics.memUsage} max={100} unit="%" color="#ffaa00" />
                  <MetricBar icon={Wifi} label="Data Flux" value={metrics.bandwidth} max={500} unit=" Mbps" color="#b44dff" />
                  <MetricBar icon={Activity} label="Active Peers" value={metrics.connections} max={2000} unit="" color="#00ff88" />
                </div>
              </div>
              <div className="col-span-3">
                <SectionHeader icon={Zap} label="Core Network Infrastructure Status" />
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {APIS.map(api => (
                    <div key={api.name} className="flex flex-col p-2 bg-black/20 rounded border border-white/5 hover:border-intel-cyan/30 transition-all">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-intel-text">{api.name}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-intel-green" />
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[8px] text-intel-muted">
                        <span>LATENCY</span>
                        <span className="tabular-nums">{api.latency}ms</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-col p-2 bg-intel-cyan/5 rounded border border-intel-cyan/20">
                    <span className="text-[10px] font-bold text-intel-cyan">UPTIME ENGINE</span>
                    <span className="text-[16px] font-mono font-bold text-white mt-1 tabular-nums">99.987%</span>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="p-3 bg-red-500/5 rounded border border-red-500/20">
                    <span className="text-[8px] font-bold text-red-400 uppercase tracking-widest">Global Threat Index</span>
                    <div className="text-2xl font-mono text-red-500 font-bold mt-1">ELEVATED</div>
                  </div>
                  <div className="p-3 bg-intel-cyan/5 rounded border border-intel-cyan/20">
                    <span className="text-[8px] font-bold text-intel-cyan uppercase tracking-widest">Active Channels</span>
                    <div className="text-2xl font-mono text-white font-bold mt-1 tabular-nums">1.4K+</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: INTELLIGENCE REPORTS (Original Right Side Panels) */}
          {activeTab === "intelligence" && (
            <div className="grid grid-cols-[200px_1fr] gap-4 h-full">
              <div className="flex flex-col gap-1 border-r border-white/5 pr-2 overflow-y-auto">
                <SectionHeader icon={Shield} label="Analysis Modules" />
                <TabButton active={rightPanelTab === "feed"} onClick={() => setRightPanelTab("feed")} label="Event Feed" />
                <TabButton active={rightPanelTab === "insights"} onClick={() => setRightPanelTab("insights")} label="AI Strategy" />
                <TabButton active={rightPanelTab === "finance"} onClick={() => setRightPanelTab("finance")} label="Market Intel" />
                <TabButton active={rightPanelTab === "conflicts"} onClick={() => setRightPanelTab("conflicts")} label="Theater Maps" />
                <TabButton active={rightPanelTab === "stats"} onClick={() => setRightPanelTab("stats")} label="Core Stats" />
                <TabButton active={rightPanelTab === "cii"} onClick={() => setRightPanelTab("cii")} label="CII Index" />
                <TabButton active={rightPanelTab === "fleet"} onClick={() => setRightPanelTab("fleet")} label="Fleet Tracker" />
                <TabButton active={rightPanelTab === "infra"} onClick={() => setRightPanelTab("infra")} label="Infra Nodes" />
                {selectedEvent && <TabButton active={rightPanelTab === "detail"} onClick={() => setRightPanelTab("detail")} label="Selected Detail" highlight />}
              </div>
              <div className="overflow-y-auto pr-2 custom-scrollbar">
                {rightPanelTab === "detail" && selectedEvent && <EventDetail />}
                {rightPanelTab === "feed" && <EventFeed />}
                {rightPanelTab === "insights" && <InsightsPanel />}
                {rightPanelTab === "stats" && <StatsOverlay />}
                {rightPanelTab === "cii" && <CIIPanel />}
                {rightPanelTab === "finance" && <FinancePanel />}
                {rightPanelTab === "conflicts" && <ConflictTracker />}
                {rightPanelTab === "fleet" && <FleetTracker />}
                {rightPanelTab === "predictions" && <PredictionMarkets />}
                {rightPanelTab === "gnss" && <GNSSPanel />}
                {rightPanelTab === "travel" && <TravelAdvisoryPanel />}
                {rightPanelTab === "infra" && <InfrastructurePanel />}
                {rightPanelTab === "airports" && <AirportStatus />}
                {rightPanelTab === "ml" && <MLAnalysisPanel />}
              </div>
            </div>
          )}

          {/* TAB: VIDEO NEWS FEEDS */}
          {activeTab === "news" && (
            <div className="grid grid-cols-3 gap-3 h-[400px]">
              <NewsStream title="AL JAZEERA LIVE" url="https://www.youtube.com/embed/live_stream?channel=UCNye-wNBqNL5ZzHSJj3l8Bg&autoplay=1&mute=1" />
              <NewsStream title="BLOOMBERG GLOBAL" url="https://www.youtube.com/embed/live_stream?channel=UCIALMKvObZNtJ6zjM5elV9Q&autoplay=1&mute=1" />
              <NewsStream title="SKY NEWS INTEL" url="https://www.youtube.com/embed/live_stream?channel=UCoMdktPbSTqxWKVv659BEDg&autoplay=1&mute=1" />
            </div>
          )}

          {/* TAB: THEATER WEBCAMS */}
          {activeTab === "webcams" && (
            <div className="space-y-3">
              <SectionHeader icon={Camera} label="Real-Time Theater Surveillance (Ground Assets)" />
              <div className="grid grid-cols-4 gap-2">
                {liveWebcams.length > 0 ? liveWebcams.map(cam => (
                  <WebcamView key={cam.id} cam={cam} />
                )) : (
                  <div className="col-span-4 p-8 text-center bg-black/20 rounded border border-dashed border-white/10 text-intel-muted font-mono text-sm uppercase">
                    Scanning for available ground visual reconnaissance...
                  </div>
                )}
                {/* Default Fallbacks */}
                {liveWebcams.length < 4 && ["Kyiv Post 1", "Suez Transit", "Panama Lock", "Shibuya Mast"].map(n => (
                  <div key={n} className="aspect-video bg-black/40 rounded border border-white/5 flex flex-col items-center justify-center relative overflow-hidden group">
                    <Video className="w-8 h-8 text-intel-muted/20" />
                    <div className="absolute inset-0 bg-camera-noise opacity-10" />
                    <span className="absolute bottom-2 left-2 text-[8px] font-mono text-intel-muted uppercase">{n} [SIMULATED]</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NewsStream({ title, url }) {
  return (
    <div className="relative rounded-lg overflow-hidden border border-white/10 bg-black/40 group flex flex-col">
      <div className="px-3 py-1.5 bg-black/60 border-b border-white/5 flex items-center justify-between">
        <span className="text-[10px] font-bold text-intel-text tracking-widest">{title}</span>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[8px] font-bold text-red-500">LIVE</span>
        </div>
      </div>
      <div className="flex-1 bg-black">
        <iframe
          src={url}
          className="w-full h-full border-none opacity-80 group-hover:opacity-100 transition-opacity"
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      </div>
    </div>
  );
}

function WebcamView({ cam }) {
  return (
    <div className="aspect-video bg-black/80 rounded border border-intel-cyan/30 flex flex-col items-center justify-center relative overflow-hidden group cursor-crosshair">
      <div className="absolute inset-0 bg-camera-noise opacity-20" />
      <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-intel-cyan/20 border border-intel-cyan/40 text-[7px] font-mono text-intel-cyan uppercase rounded">
        DECRYPTED STREAM
      </div>
      <div className="text-center p-2 z-10">
        <Eye className="w-6 h-6 text-intel-cyan/50 mb-1 mx-auto" />
        <div className="text-[10px] font-bold text-white uppercase">{cam.metadata?.name || "RECON ASSET"}</div>
        <div className="text-[8px] text-intel-muted font-mono">{cam.lat.toFixed(4)}, {cam.lon.toFixed(4)}</div>
      </div>
      <div className="absolute bottom-0 inset-x-0 h-4 bg-black/60 flex items-center px-1.5 justify-between translate-y-full group-hover:translate-y-0 transition-transform">
        <span className="text-[8px] text-intel-cyan font-mono">{cam.metadata?.status?.toUpperCase()}</span>
        <span className="text-[8px] text-intel-muted font-mono">{cam.metadata?.resolution} @ {cam.metadata?.fps}fps</span>
      </div>
    </div>
  );
}

function TabLink({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-mono border transition-all ${active ? "bg-intel-cyan/20 border-intel-cyan/40 text-intel-cyan" : "border-transparent text-intel-muted hover:text-intel-text hover:bg-white/5"}`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="uppercase tracking-tighter">{label}</span>
    </button>
  );
}

function TabButton({ active, onClick, label, highlight }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-[9px] font-mono rounded flex items-center justify-between transition-all border ${active ? (highlight ? "bg-intel-amber/20 border-intel-amber/40 text-intel-amber" : "bg-intel-cyan/20 border-intel-cyan/40 text-intel-cyan") : "border-white/5 text-intel-muted hover:text-intel-text hover:bg-white/5"}`}
    >
      <span>{label}</span>
      {active && <div className="w-1 h-1 rounded-full bg-current" />}
    </button>
  );
}

function SectionHeader({ icon: Icon, label }) {
  return (
    <div className="text-[9px] font-mono text-intel-cyan uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-intel-border/20">
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </div>
  );
}

function MetricBar({ icon: Icon, label, value, max, unit, color }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="space-y-[2px]">
      <div className="flex items-center justify-between text-[8px] font-mono">
        <div className="flex items-center gap-1 text-intel-muted">
          <Icon className="w-2.5 h-2.5 opacity-50" />
          <span>{label}</span>
        </div>
        <span className="text-intel-text tabular-nums font-bold">
          {value}{unit}
        </span>
      </div>
      <div className="h-[3px] bg-intel-border/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 shadow-[0_0_8px_rgba(0,212,255,0.4)]"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
