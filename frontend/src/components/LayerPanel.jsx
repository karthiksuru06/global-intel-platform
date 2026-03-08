import { useState } from "react";
import {
  Layers, ChevronLeft, ChevronDown, ChevronRight,
  Eye, EyeOff, Search,
} from "lucide-react";
import useEventStore from "../hooks/useEventStore";
import { getEventConfig, getLayersByCategory } from "../utils/eventIcons";

const CATEGORY_ORDER = [
  "Tracking",
  "Security",
  "Infrastructure",
  "Environment",
  "Cyber & Social",
  "Surveillance",
];

const CATEGORY_COLORS = {
  "Tracking": "#00d4ff",
  "Security": "#ef4444",
  "Infrastructure": "#8b5cf6",
  "Environment": "#10b981",
  "Cyber & Social": "#f43f5e",
  "Surveillance": "#00ff88",
};

export default function LayerPanel() {
  const layers = useEventStore((s) => s.layers);
  const toggleLayer = useEventStore((s) => s.toggleLayer);
  const setAllLayers = useEventStore((s) => s.setAllLayers);
  const getEventCounts = useEventStore((s) => s.getEventCounts);
  const activeFilters = useEventStore((s) => s.activeFilters);
  const setFilter = useEventStore((s) => s.setFilter);
  const [collapsed, setCollapsed] = useState(false);
  const [expandedCats, setExpandedCats] = useState(() => {
    const init = {};
    CATEGORY_ORDER.forEach((c) => { init[c] = true; });
    return init;
  });
  const [searchQuery, setSearchQuery] = useState("");

  const counts = getEventCounts();
  const layersByCategory = getLayersByCategory();

  const toggleCat = (cat) => {
    setExpandedCats((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const activeCount = Object.values(layers).filter(Boolean).length;
  const totalCount = Object.keys(layers).length;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="glass-panel p-2.5 hover:bg-white/5 transition"
        title="Expand layers"
      >
        <Layers className="w-4 h-4 text-intel-cyan" />
      </button>
    );
  }

  return (
    <div className="glass-panel w-64 flex flex-col max-h-[calc(100vh-140px)] animate-slide-in-left">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-intel-border/30 flex-shrink-0">
        <div className="flex items-center gap-2 text-[10px] font-mono text-intel-cyan uppercase tracking-widest">
          <Layers className="w-3.5 h-3.5" />
          <span>Data Layers</span>
          <span className="ml-1 text-[9px] text-intel-muted bg-white/[0.04] px-1.5 py-0.5 rounded">
            {activeCount}/{totalCount}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAllLayers(true)}
            className="p-1 hover:bg-white/5 rounded transition text-[8px] font-mono text-intel-muted hover:text-intel-green"
            title="Enable all"
          >
            <Eye className="w-3 h-3" />
          </button>
          <button
            onClick={() => setAllLayers(false)}
            className="p-1 hover:bg-white/5 rounded transition text-[8px] font-mono text-intel-muted hover:text-intel-red"
            title="Disable all"
          >
            <EyeOff className="w-3 h-3" />
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 hover:bg-white/5 rounded transition"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-intel-muted" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pt-2 pb-1 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-intel-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter layers..."
            className="w-full bg-white/[0.03] border border-intel-border/30 rounded-md py-1.5 pl-7 pr-2 text-[10px] font-mono text-intel-text placeholder-intel-muted/50 focus:outline-none focus:border-intel-cyan/30"
          />
        </div>
      </div>

      {/* Category Groups */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {CATEGORY_ORDER.map((catName) => {
          const catLayers = layersByCategory[catName] || [];
          const filtered = searchQuery
            ? catLayers.filter((l) =>
                l.label.toLowerCase().includes(searchQuery.toLowerCase())
              )
            : catLayers;
          if (filtered.length === 0) return null;

          const isExpanded = expandedCats[catName];
          const catColor = CATEGORY_COLORS[catName] || "#6b6b8d";
          const activeCatCount = filtered.filter((l) => layers[l.key]).length;

          return (
            <div key={catName}>
              {/* Category header */}
              <button
                onClick={() => toggleCat(catName)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/[0.03] transition"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-intel-muted" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-intel-muted" />
                )}
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: catColor }}
                />
                <span className="text-[9px] font-mono text-intel-muted/80 uppercase tracking-[0.15em] flex-1 text-left">
                  {catName}
                </span>
                <span className="text-[8px] font-mono text-intel-muted bg-white/[0.03] px-1.5 py-0.5 rounded">
                  {activeCatCount}/{filtered.length}
                </span>
              </button>

              {/* Layer items */}
              {isExpanded && (
                <div className="ml-2 space-y-0.5 mt-0.5">
                  {filtered.map(({ key, label, color, icon: Icon, description }) => {
                    const active = layers[key];
                    const count = counts[key] || 0;
                    return (
                      <button
                        key={key}
                        onClick={() => toggleLayer(key)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-mono transition-all group ${
                          active
                            ? "bg-white/[0.04] text-intel-text"
                            : "text-intel-muted/40 hover:text-intel-muted/70"
                        }`}
                        title={description}
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-opacity"
                          style={{
                            backgroundColor: color,
                            opacity: active ? 1 : 0.15,
                          }}
                        />
                        <Icon
                          className="w-3.5 h-3.5 flex-shrink-0 transition-colors"
                          style={{ color: active ? color : undefined }}
                        />
                        <span className="flex-1 text-left truncate">{label}</span>
                        {count > 0 && (
                          <span
                            className="text-[8px] tabular-nums px-1 py-0.5 rounded bg-white/[0.03] min-w-[20px] text-center"
                            style={{ color: active ? color : undefined }}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Severity filter */}
      <div className="px-3 pb-2.5 pt-1.5 border-t border-intel-border/30 flex-shrink-0">
        <label className="block text-[9px] font-mono text-intel-muted uppercase tracking-wider mb-1.5">
          Min Severity: {activeFilters.minSeverity || "All"}
        </label>
        <input
          type="range"
          min="0"
          max="5"
          value={activeFilters.minSeverity}
          onChange={(e) => setFilter("minSeverity", parseInt(e.target.value))}
          className="w-full h-1 bg-intel-border rounded-lg appearance-none cursor-pointer accent-intel-cyan"
        />
        <div className="flex justify-between text-[8px] text-intel-muted mt-0.5">
          <span>All</span>
          <span>Critical</span>
        </div>
      </div>
    </div>
  );
}
