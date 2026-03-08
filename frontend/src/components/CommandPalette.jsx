import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, Globe, Shield, Newspaper, Activity, DollarSign, X, Command } from "lucide-react";
import useEventStore from "../hooks/useEventStore";

const COMMAND_ITEMS = [
  // Regions
  { id: "region:global", label: "Global View", category: "Regions", icon: Globe, action: "region" },
  { id: "region:americas", label: "Americas", category: "Regions", icon: Globe, action: "region" },
  { id: "region:europe", label: "Europe", category: "Regions", icon: Globe, action: "region" },
  { id: "region:mena", label: "Middle East & North Africa", category: "Regions", icon: Globe, action: "region" },
  { id: "region:asia", label: "Asia-Pacific", category: "Regions", icon: Globe, action: "region" },
  { id: "region:africa", label: "Africa", category: "Regions", icon: Globe, action: "region" },

  // Layer presets
  { id: "layers:military", label: "Military Layers Only", category: "Layer Presets", icon: Shield, action: "layers" },
  { id: "layers:all", label: "Enable All Layers", category: "Layer Presets", icon: Activity, action: "layers" },
  { id: "layers:none", label: "Disable All Layers", category: "Layer Presets", icon: Activity, action: "layers" },

  // Panels
  { id: "panel:feed", label: "Event Feed", category: "Panels", icon: Activity, action: "panel" },
  { id: "panel:insights", label: "AI Insights", category: "Panels", icon: Activity, action: "panel" },
  { id: "panel:stats", label: "Statistics", category: "Panels", icon: Activity, action: "panel" },

  // Countries (top tier-1)
  { id: "country:US", label: "United States", aliases: ["usa", "america", "pentagon", "washington"], category: "Countries", icon: Globe, action: "country" },
  { id: "country:RU", label: "Russia", aliases: ["kremlin", "putin", "moscow"], category: "Countries", icon: Globe, action: "country" },
  { id: "country:CN", label: "China", aliases: ["beijing", "pla", "xi"], category: "Countries", icon: Globe, action: "country" },
  { id: "country:UA", label: "Ukraine", aliases: ["kyiv", "zelensky"], category: "Countries", icon: Globe, action: "country" },
  { id: "country:IR", label: "Iran", aliases: ["tehran", "irgc"], category: "Countries", icon: Globe, action: "country" },
  { id: "country:IL", label: "Israel", aliases: ["tel aviv", "jerusalem", "idf"], category: "Countries", icon: Globe, action: "country" },
  { id: "country:TW", label: "Taiwan", aliases: ["taipei"], category: "Countries", icon: Globe, action: "country" },
  { id: "country:KP", label: "North Korea", aliases: ["dprk", "pyongyang"], category: "Countries", icon: Globe, action: "country" },
  { id: "country:SA", label: "Saudi Arabia", aliases: ["riyadh", "mbs"], category: "Countries", icon: Globe, action: "country" },
  { id: "country:JP", label: "Japan", aliases: ["tokyo"], category: "Countries", icon: Globe, action: "country" },
  { id: "country:DE", label: "Germany", aliases: ["berlin"], category: "Countries", icon: Globe, action: "country" },
  { id: "country:FR", label: "France", aliases: ["paris", "macron"], category: "Countries", icon: Globe, action: "country" },
  { id: "country:GB", label: "United Kingdom", aliases: ["london", "uk", "britain"], category: "Countries", icon: Globe, action: "country" },
  { id: "country:IN", label: "India", aliases: ["delhi", "modi"], category: "Countries", icon: Globe, action: "country" },
  { id: "country:SY", label: "Syria", aliases: ["damascus"], category: "Countries", icon: Globe, action: "country" },
  { id: "country:YE", label: "Yemen", aliases: ["houthi", "sanaa"], category: "Countries", icon: Globe, action: "country" },
];

function scoreMatch(item, query) {
  const q = query.toLowerCase();
  const label = item.label.toLowerCase();
  if (label === q) return 3; // Exact
  if (label.startsWith(q)) return 2; // Prefix
  if (label.includes(q)) return 1; // Substring
  // Check aliases
  if (item.aliases) {
    for (const alias of item.aliases) {
      if (alias.includes(q)) return 1;
    }
  }
  return 0;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const setActiveRegion = useEventStore((s) => s.setActiveRegion);
  const setAllLayers = useEventStore((s) => s.setAllLayers);
  const setRightPanelTab = useEventStore((s) => s.setRightPanelTab);

  // Cmd+K / Ctrl+K handler
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = query.length > 0
    ? COMMAND_ITEMS
        .map((item) => ({ ...item, score: scoreMatch(item, query) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
    : COMMAND_ITEMS.slice(0, 15);

  const handleSelect = useCallback((item) => {
    setOpen(false);
    switch (item.action) {
      case "region": {
        const region = item.id.split(":")[1];
        setActiveRegion(region);
        break;
      }
      case "layers": {
        const preset = item.id.split(":")[1];
        if (preset === "all") setAllLayers(true);
        else if (preset === "none") setAllLayers(false);
        break;
      }
      case "panel": {
        const panel = item.id.split(":")[1];
        setRightPanelTab(panel);
        break;
      }
      case "country": {
        // Navigate to country on globe
        break;
      }
    }
  }, [setActiveRegion, setAllLayers, setRightPanelTab]);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      handleSelect(filtered[selectedIndex]);
    }
  };

  if (!open) return null;

  // Group by category
  const grouped = {};
  for (const item of filtered) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-[520px] max-h-[400px] bg-[#0d0d1a]/95 border border-white/10 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
          <Search className="w-4 h-4 text-intel-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, countries, layers..."
            className="flex-1 bg-transparent text-sm font-mono text-intel-text placeholder:text-intel-muted/40 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-mono text-intel-muted">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[320px] overflow-y-auto p-2">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="mb-2">
              <div className="text-[9px] font-mono text-intel-muted/60 px-2 py-1 uppercase tracking-wider">
                {category}
              </div>
              {items.map((item) => {
                const idx = flatIndex++;
                const Icon = item.icon;
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-left transition ${
                      isSelected
                        ? "bg-intel-cyan/10 text-intel-cyan"
                        : "text-intel-text hover:bg-white/5"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-intel-cyan" : "text-intel-muted"}`} />
                    <span className="text-[11px] font-mono">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-6 text-[11px] text-intel-muted font-mono">
              No results for "{query}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
