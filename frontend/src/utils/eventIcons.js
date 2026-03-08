import {
  Plane, Ship, Camera, Activity, Cloud, MapPin,
  Swords, Shield, Cable, Fuel, Flame, Atom,
  Server, Users, Rocket, Mountain,
  Anchor, Zap, Globe, AlertTriangle, Radio,
  Navigation, ShieldAlert, Radar,
  Truck, Thermometer, Bug,
} from "lucide-react";

const EVENT_CONFIG = {
  // === TRACKING ===
  aircraft: {
    label: "Flights",
    color: "#00d4ff",
    icon: Plane,
    category: "Tracking",
    description: "Live aircraft ADS-B transponder feeds",
  },
  ship: {
    label: "Maritime AIS",
    color: "#3b82f6",
    icon: Ship,
    category: "Tracking",
    description: "Vessel identification & positioning",
  },
  flights: {
    label: "Flight Paths",
    color: "#06b6d4",
    icon: Navigation,
    category: "Tracking",
    description: "Simulated global flight route arcs",
  },

  // === MILITARY & SECURITY ===
  conflicts: {
    label: "Conflicts",
    color: "#ef4444",
    icon: Swords,
    category: "Security",
    description: "Active conflict zones & UCDP events",
  },
  bases: {
    label: "Military Bases",
    color: "#f97316",
    icon: Shield,
    category: "Security",
    description: "Known military installations worldwide",
  },
  military: {
    label: "Military Activity",
    color: "#dc2626",
    icon: Radar,
    category: "Security",
    description: "Military operations & deployments",
  },
  nuclear: {
    label: "Nuclear Sites",
    color: "#facc15",
    icon: Atom,
    category: "Security",
    description: "Nuclear reactors, weapons sites, test zones",
  },
  sanctions: {
    label: "Sanctions",
    color: "#a855f7",
    icon: ShieldAlert,
    category: "Security",
    description: "Sanctioned entities & trade restrictions",
  },

  // === INFRASTRUCTURE ===
  cables: {
    label: "Submarine Cables",
    color: "#22d3ee",
    icon: Cable,
    category: "Infrastructure",
    description: "Undersea fiber optic cable network",
  },
  pipelines: {
    label: "Pipelines",
    color: "#f59e0b",
    icon: Fuel,
    category: "Infrastructure",
    description: "Oil & gas pipeline infrastructure",
  },
  datacenters: {
    label: "Data Centers",
    color: "#8b5cf6",
    icon: Server,
    category: "Infrastructure",
    description: "Major cloud & colocation facilities",
  },
  spaceports: {
    label: "Spaceports",
    color: "#e879f9",
    icon: Rocket,
    category: "Infrastructure",
    description: "Launch facilities & space centers",
  },
  waterways: {
    label: "Waterways",
    color: "#0ea5e9",
    icon: Anchor,
    category: "Infrastructure",
    description: "Strategic shipping chokepoints",
  },
  tradeRoutes: {
    label: "Trade Routes",
    color: "#14b8a6",
    icon: Truck,
    category: "Infrastructure",
    description: "Major global trade corridors",
  },

  // === ENVIRONMENT ===
  seismic: {
    label: "Seismic",
    color: "#ff5533",
    icon: Activity,
    category: "Environment",
    description: "Earthquake & tectonic activity",
  },
  weather: {
    label: "Weather",
    color: "#ffaa00",
    icon: Cloud,
    category: "Environment",
    description: "Severe weather alerts & storms",
  },
  fires: {
    label: "Fires",
    color: "#f97316",
    icon: Flame,
    category: "Environment",
    description: "Active wildfires & thermal hotspots",
  },
  natural: {
    label: "Natural Disasters",
    color: "#ef4444",
    icon: AlertTriangle,
    category: "Environment",
    description: "Hurricanes, floods, tsunamis, volcanic",
  },
  climate: {
    label: "Climate",
    color: "#10b981",
    icon: Thermometer,
    category: "Environment",
    description: "Climate anomalies & environmental shifts",
  },
  minerals: {
    label: "Minerals",
    color: "#d97706",
    icon: Mountain,
    category: "Environment",
    description: "Critical mineral deposits & mining",
  },

  // === CYBER & SOCIAL ===
  cyberThreats: {
    label: "Cyber Threats",
    color: "#f43f5e",
    icon: Bug,
    category: "Cyber & Social",
    description: "Active cyber attacks & threat intelligence",
  },
  outages: {
    label: "Outages",
    color: "#eab308",
    icon: Zap,
    category: "Cyber & Social",
    description: "Internet & power grid outages",
  },
  protests: {
    label: "Protests",
    color: "#a78bfa",
    icon: Users,
    category: "Cyber & Social",
    description: "Mass demonstrations & civil unrest",
  },
  displacement: {
    label: "Displacement",
    color: "#fb923c",
    icon: Globe,
    category: "Cyber & Social",
    description: "Refugee movements & forced displacement",
  },

  // === SURVEILLANCE ===
  webcam: {
    label: "Webcams",
    color: "#00ff88",
    icon: Camera,
    category: "Surveillance",
    description: "Public webcam feeds worldwide",
  },
  hotspots: {
    label: "Hotspots",
    color: "#f43f5e",
    icon: Radio,
    category: "Surveillance",
    description: "Detected activity hotspot clusters",
  },

  // === INTELLIGENCE ===
  insight: {
    label: "AI Insights",
    color: "#c084fc",
    icon: Radio,
    category: "Intelligence",
    description: "AI-generated intelligence insights",
  },
  correlation: {
    label: "Correlations",
    color: "#fb7185",
    icon: Radio,
    category: "Intelligence",
    description: "Auto-detected event correlations",
  },

  // === FALLBACK ===
  custom: {
    label: "Custom",
    color: "#b44dff",
    icon: MapPin,
    category: "Other",
    description: "User-defined custom events",
  },
};

// All layer keys in category order
export const ALL_LAYER_KEYS = Object.keys(EVENT_CONFIG).filter(k => k !== "custom");

// Get grouped layers by category
export function getLayersByCategory() {
  const categories = {};
  for (const [key, config] of Object.entries(EVENT_CONFIG)) {
    if (key === "custom") continue;
    const cat = config.category;
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({ key, ...config });
  }
  return categories;
}

export function getEventConfig(type) {
  return EVENT_CONFIG[type] || EVENT_CONFIG.custom;
}

// SVG billboard with type-specific paths
export function makeBillboardSvg(color, size = 16, type = "default") {
  let inner = "";
  const cx = size, cy = size;
  // Common visual treatment for all icons to pop on satellite terrain
  const shadow = `filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.8))"`;

  switch (type) {
    case "aircraft":
    case "flights":
      // Sleek jet pointing perfectly upwards (rotation handled by Cesium if desired, else general icon)
      inner = `
        <svg x="${cx - size / 1.2}" y="${cy - size / 1.2}" width="${size * 1.6}" height="${size * 1.6}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${shadow}>
          <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.2-1.1.6L3 8l6 5.5-4 4-2.5-.5-1.5 1.5 3 1.5 1.5 3 1.5-1.5-.5-2.5 4-4 5.5 6l1.2-.7c.4-.2.7-.6.6-1.1Z"/>
        </svg>
      `;
      break;

    case "ship":
      // Maritime vessel
      inner = `
        <svg x="${cx - size / 1.2}" y="${cy - size / 1.2}" width="${size * 1.6}" height="${size * 1.6}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${shadow}>
          <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
          <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/>
          <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/>
          <path d="M12 10v4"/>
          <path d="M12 2v3"/>
        </svg>
      `;
      break;

    case "nuclear":
    case "minerals":
      // Concentric radioactive/warning-style loops
      inner = `
        <circle cx="${cx}" cy="${cy}" r="${size - 2}" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="2" ${shadow}/>
        <circle cx="${cx}" cy="${cy}" r="${size / 2.5}" fill="${color}" stroke="#111827" stroke-width="1.5"/>
        <path d="M ${cx} ${cy - size / 2} v -${size / 3} M ${cx + size / 2.5} ${cy + size / 3} l ${size / 4.5} ${size / 4.5} M ${cx - size / 2.5} ${cy + size / 3} l -${size / 4.5} ${size / 4.5}" stroke="#111827" stroke-width="2" stroke-linecap="round"/>
      `;
      break;

    case "conflicts":
    case "military":
      // Combat crosshairs
      inner = `
        <circle cx="${cx}" cy="${cy}" r="${size - 3}" fill="none" stroke="${color}" stroke-width="2.5" ${shadow}/>
        <path d="M ${cx} ${cy - size + 1} v ${size / 1.5} M ${cx} ${cy + size - 1} v -${size / 1.5} M ${cx - size + 1} ${cy} h ${size / 1.5} M ${cx + size - 1} ${cy} h -${size / 1.5}" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="${cx}" cy="${cy}" r="1.5" fill="red"/>
      `;
      break;

    case "bases":
      // Heavy fortified shield chevron
      inner = `
        <svg x="${cx - size / 1.2}" y="${cy - size / 1.2}" width="${size * 1.6}" height="${size * 1.6}" viewBox="0 0 24 24" fill="${color}" fill-opacity="0.3" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${shadow}>
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2-1 4-1.5 7-1.5s5 .5 7 1.5a1 1 0 0 1 1 1z"/>
        </svg>
      `;
      break;

    case "cyberThreats":
    case "datacenters":
      // Sharp distinct hexagon
      inner = `
        <svg x="${cx - size / 1.2}" y="${cy - size / 1.2}" width="${size * 1.6}" height="${size * 1.6}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${shadow}>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <circle cx="12" cy="12" r="3" fill="${color}" stroke="none"/>
        </svg>
      `;
      break;

    default:
      // A precision targeting ring for generic points
      inner = `
        <circle cx="${cx}" cy="${cy}" r="${size - 3}" fill="${color}" fill-opacity="0.3" stroke="${color}" stroke-width="2.5" ${shadow}/>
        <circle cx="${cx}" cy="${cy}" r="${size / 3.5}" fill="white" stroke="#111827" stroke-width="1.0" ${shadow}/>
      `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size * 2}" height="${size * 2}" viewBox="0 0 ${size * 2} ${size * 2}">${inner}</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function getBillboardType(eventType) {
  const typeMap = {
    nuclear: "nuclear",
    conflicts: "conflict",
    bases: "base",
    military: "base",
    cyberThreats: "cyber",
    hotspots: "conflict",
  };
  return typeMap[eventType] || "default";
}

export function getSeverityColor(severity) {
  const colors = {
    1: "#00ff88",
    2: "#ffdd00",
    3: "#ffaa00",
    4: "#ff5533",
    5: "#b44dff",
  };
  return colors[severity] || "#6b6b8d";
}

export default EVENT_CONFIG;
