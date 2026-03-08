import { create } from "zustand";
import { ALL_LAYER_KEYS } from "../utils/eventIcons";

const TIME_RANGE_MS = {
  "1h": 3600000,
  "6h": 21600000,
  "24h": 86400000,
  "48h": 172800000,
  "7d": 604800000,
};

// URL Parsing for initial state
const queryParams = new URLSearchParams(window.location.search);

// Build default layers object — parse from URL if available, else all ON
const defaultLayers = {};
const urlLayersStr = queryParams.get("layers");
if (urlLayersStr) {
  const urlLayers = urlLayersStr.split(",");
  ALL_LAYER_KEYS.forEach((k) => {
    defaultLayers[k] = urlLayers.includes(k);
  });
} else {
  ALL_LAYER_KEYS.forEach((k) => {
    defaultLayers[k] = true;
  });
}

const initialTimeRange = queryParams.get("timeRange") || "7d";

// Helper to update the browser URL silently without reloading
export const updateUrlState = (updates) => {
  const url = new URL(window.location);
  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  });
  window.history.replaceState({}, "", url.toString());
};

const useEventStore = create((set, get) => ({
  // Events
  events: new Map(),
  eventList: [],

  // Filters
  activeFilters: {
    types: [],
    minSeverity: 0,
    timeRange: null,
    search: "",
  },

  // Layers (all 25+ layer types)
  layers: defaultLayers,

  // Selection
  selectedEvent: null,

  // Insights & correlations
  insights: [],
  correlations: [],

  // Connection
  connectionStatus: "disconnected",
  eventsPerMinute: 0,
  lastEventTime: null,

  // Globe
  cesiumViewer: null,
  timeRangeFilter: initialTimeRange,
  activeRegion: "global",

  // Flight simulation
  activeFlights: [],
  flightProgress: {},

  // Polyline data (cables, pipelines, trade routes)
  polylineData: {
    cables: [],
    pipelines: [],
    tradeRoutes: [],
    flightArcs: [],
  },

  // Dashboard stats
  stats: {
    totalTracking: 0,
    activeLayers: 0,
    threatLevel: 0,
    eventsPerMinute: 0,
    activeFlights: 0,
    activeConflicts: 0,
    cyberIncidents: 0,
  },

  // Viewport sender callback (set by useWebSocket)
  viewportSender: null,

  // Feature 5: Channel Classification
  channel: "UNCLASSIFIED",
  channelPermissions: ["events"],

  // UI State
  showSearch: false,
  showStats: true,
  sidebarCollapsed: false,
  rightPanelTab: "feed", // "feed" | "insights" | "detail"

  // ──────── ACTIONS ────────

  addEvent: (event) => {
    set((state) => {
      const events = new Map(state.events);
      events.set(event.id, event);
      if (events.size > 8000) {
        const firstKey = events.keys().next().value;
        events.delete(firstKey);
      }
      return {
        events,
        eventList: Array.from(events.values()),
        lastEventTime: new Date().toISOString(),
      };
    });
  },

  addEvents: (newEvents) => {
    set((state) => {
      const events = new Map(state.events);
      for (const ev of newEvents) {
        events.set(ev.id, ev);
      }
      while (events.size > 8000) {
        const firstKey = events.keys().next().value;
        events.delete(firstKey);
      }
      return {
        events,
        eventList: Array.from(events.values()),
        lastEventTime: new Date().toISOString(),
      };
    });
  },

  setFilter: (key, value) => {
    set((state) => ({
      activeFilters: { ...state.activeFilters, [key]: value },
    }));
  },

  toggleLayer: (layer) => {
    set((state) => {
      const newLayers = { ...state.layers, [layer]: !state.layers[layer] };
      const activeKeys = Object.entries(newLayers).filter(([_, v]) => v).map(([k]) => k);
      updateUrlState({ layers: activeKeys.join(",") });
      return { layers: newLayers };
    });
  },

  setAllLayers: (val) => {
    set((state) => {
      const layers = {};
      const activeKeys = [];
      for (const k of Object.keys(state.layers)) {
        layers[k] = val;
        if (val) activeKeys.push(k);
      }
      updateUrlState({ layers: activeKeys.length ? activeKeys.join(",") : "none" });
      return { layers };
    });
  },

  selectEvent: (event) => set({ selectedEvent: event, rightPanelTab: "detail" }),
  clearSelection: () => set({ selectedEvent: null }),
  clearEvents: () => set({ events: new Map(), eventList: [], selectedEvent: null }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setCesiumViewer: (viewer) => set({ cesiumViewer: viewer }),
  setTimeRangeFilter: (range) => {
    updateUrlState({ timeRange: range });
    set({ timeRangeFilter: range });
  },
  setActiveRegion: (region) => set({ activeRegion: region }),

  setActiveFlights: (flights) => set({ activeFlights: flights }),
  setPolylineData: (key, data) => {
    set((state) => ({
      polylineData: { ...state.polylineData, [key]: data },
    }));
  },

  setViewportSender: (fn) => set({ viewportSender: fn }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  setChannel: (channel, permissions) => set({ channel, channelPermissions: permissions || [] }),
  toggleSearch: () => set((s) => ({ showSearch: !s.showSearch })),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  addInsight: (insight) => {
    set((state) => ({
      insights: [...state.insights.slice(-49), insight],
    }));
  },
  setInsights: (insights) => set({ insights }),

  // ──────── COMPUTED ────────

  getFilteredEvents: () => {
    const state = get();
    let filtered = state.eventList;

    // Layer filter
    filtered = filtered.filter((e) => state.layers[e.type] !== false);

    // Type filter
    if (state.activeFilters.types.length > 0) {
      filtered = filtered.filter((e) =>
        state.activeFilters.types.includes(e.type)
      );
    }

    // Severity filter
    if (state.activeFilters.minSeverity > 0) {
      filtered = filtered.filter(
        (e) => (e.severity || 0) >= state.activeFilters.minSeverity
      );
    }

    // Time range filter
    const ms = TIME_RANGE_MS[state.timeRangeFilter];
    if (ms) {
      const cutoff = new Date(Date.now() - ms).toISOString();
      filtered = filtered.filter((e) => e.timestamp >= cutoff);
    }

    // Search filter
    if (state.activeFilters.search) {
      const q = state.activeFilters.search.toLowerCase();
      filtered = filtered.filter((e) => {
        const meta = e.metadata || {};
        return (
          (meta.name && meta.name.toLowerCase().includes(q)) ||
          (meta.callsign && meta.callsign.toLowerCase().includes(q)) ||
          (e.source && e.source.toLowerCase().includes(q)) ||
          (e.type && e.type.toLowerCase().includes(q))
        );
      });
    }

    return filtered;
  },

  getEventCounts: () => {
    const state = get();
    const counts = { total: state.eventList.length };
    for (const ev of state.eventList) {
      counts[ev.type] = (counts[ev.type] || 0) + 1;
    }
    return counts;
  },

  getThreatLevel: () => {
    const events = get().eventList;
    if (events.length === 0) return 0;
    const sum = events.reduce((acc, e) => acc + (e.severity || 1), 0);
    return Math.min(1, sum / (events.length * 5));
  },

  getActiveLayerCount: () => {
    const layers = get().layers;
    return Object.values(layers).filter(Boolean).length;
  },

  getStatsByCategory: () => {
    const events = get().eventList;
    const stats = {
      tracking: 0,
      security: 0,
      infrastructure: 0,
      environment: 0,
      cyber: 0,
      surveillance: 0,
    };
    const catMap = {
      aircraft: "tracking", ship: "tracking", flights: "tracking",
      conflicts: "security", bases: "security", military: "security",
      nuclear: "security", sanctions: "security",
      cables: "infrastructure", pipelines: "infrastructure", datacenters: "infrastructure",
      spaceports: "infrastructure", waterways: "infrastructure", tradeRoutes: "infrastructure",
      seismic: "environment", weather: "environment", fires: "environment",
      natural: "environment", climate: "environment", minerals: "environment",
      cyberThreats: "cyber", outages: "cyber", protests: "cyber", displacement: "cyber",
      webcam: "surveillance", hotspots: "surveillance",
      insight: "cyber", correlation: "cyber",
    };
    for (const ev of events) {
      const cat = catMap[ev.type];
      if (cat) stats[cat]++;
    }
    return stats;
  },
}));

export default useEventStore;
