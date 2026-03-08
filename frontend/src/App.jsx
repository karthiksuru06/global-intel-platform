import React from "react";
import CesiumGlobe from "./components/CesiumGlobe";
import TopBar from "./components/TopBar";
import RegionalPresets from "./components/RegionalPresets";
import LayerPanel from "./components/LayerPanel";
import EventDetail from "./components/EventDetail";
import EventFeed from "./components/EventFeed";
import TimelineBar from "./components/TimelineBar";
import InsightsPanel from "./components/InsightsPanel";
import StatsOverlay from "./components/StatsOverlay";
import MapLegend from "./components/MapLegend";
import DashboardPanel from "./components/DashboardPanel";
import NewsFeed from "./components/NewsFeed";
import CIIPanel from "./components/CIIPanel";
import FinancePanel from "./components/FinancePanel";
import CommandPalette from "./components/CommandPalette";
import TelegramFeed from "./components/TelegramFeed";
import RocketAlerts from "./components/RocketAlerts";
import GNSSPanel from "./components/GNSSPanel";
import TravelAdvisoryPanel from "./components/TravelAdvisoryPanel";
import ConflictTracker from "./components/ConflictTracker";
import InfrastructurePanel from "./components/InfrastructurePanel";
import PredictionMarkets from "./components/PredictionMarkets";
import FleetTracker from "./components/FleetTracker";
import AirportStatus from "./components/AirportStatus";
import MLAnalysisPanel from "./components/MLAnalysisPanel";
import useWebSocket from "./hooks/useWebSocket";
import useSimulation from "./hooks/useSimulation";
import useEventStore from "./hooks/useEventStore";
import StockTicker from "./components/StockTicker";

function App() {
  const { sendViewport } = useWebSocket();
  useSimulation();

  const setViewportSender = useEventStore((s) => s.setViewportSender);

  // Store viewport sender so CesiumGlobe can use it
  React.useEffect(() => {
    setViewportSender(sendViewport);
  }, [sendViewport, setViewportSender]);

  const rightPanelTab = useEventStore((s) => s.rightPanelTab);
  const setRightPanelTab = useEventStore((s) => s.setRightPanelTab);
  const selectedEvent = useEventStore((s) => s.selectedEvent);

  return (
    <div className="w-screen h-screen overflow-hidden bg-intel-bg relative">
      {/* 3D Globe -- full screen background */}
      <CesiumGlobe />

      {/* Advanced Control Room Overlays */}
      <div className="scanline" />
      <div className="glow-atmosphere" />

      {/* Vignette overlay — subtle, so satellite globe shows clearly */}
      <div
        className="absolute inset-0 pointer-events-none z-[4]"
        style={{
          background: "radial-gradient(ellipse at center, transparent 55%, rgba(2,4,8,0.25) 100%)",
        }}
      />

      {/* Command Palette (Cmd+K) */}
      <CommandPalette />

      {/* Overlay UI */}
      <div className="absolute inset-0 pointer-events-none flex flex-col z-10">
        {/* Top Bar */}
        <div className="pointer-events-auto m-2.5 mb-0">
          <TopBar />
        </div>

        {/* Regional Presets */}
        <div className="pointer-events-auto mx-2.5 mt-1.5">
          <RegionalPresets />
        </div>

        {/* Middle: sidebars */}
        <div className="flex-1 flex justify-between p-2.5 min-h-0">
          {/* Left sidebar - Layers + Legend + News */}
          <div className="pointer-events-auto self-start space-y-2 flex flex-col max-h-[calc(100vh-160px)]">
            <LayerPanel />
            <MapLegend />
          </div>

          {/* Center-left: News + Telegram + Alerts */}
          <div className="pointer-events-auto self-start ml-2 max-h-[calc(100vh-160px)] overflow-y-auto space-y-2">
            <NewsFeed />
            <TelegramFeed />
            <RocketAlerts />
          </div>

          {/* Spacer - Full viewport for globe visibility */}
          <div className="flex-1" />
        </div>

        {/* Bottom bar - Primary Control Surface */}
        <div className="pointer-events-auto m-2.5 mt-0 space-y-1.5 z-20">
          <TimelineBar />
          <DashboardPanel />
          <StockTicker />
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label, highlight }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-[10px] font-mono rounded-md transition-all ${active
        ? highlight
          ? "bg-intel-amber/15 text-intel-amber"
          : "bg-intel-cyan/15 text-intel-cyan"
        : "text-intel-muted hover:text-intel-text hover:bg-white/[0.03]"
        }`}
    >
      {label}
    </button>
  );
}

export default App;
