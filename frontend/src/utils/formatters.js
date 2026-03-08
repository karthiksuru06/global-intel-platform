import { formatDistanceToNow, parseISO } from "date-fns";

export function formatCoordinates(lat, lon) {
  const latDir = lat >= 0 ? "N" : "S";
  const lonDir = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}${latDir}, ${Math.abs(lon).toFixed(4)}${lonDir}`;
}

export function formatTimestamp(iso) {
  if (!iso) return "--";
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

export function formatSeverity(level) {
  const config = {
    1: { label: "Low", color: "#00ff88", bg: "bg-green-900/30" },
    2: { label: "Guarded", color: "#ffdd00", bg: "bg-yellow-900/30" },
    3: { label: "Elevated", color: "#ffaa00", bg: "bg-orange-900/30" },
    4: { label: "High", color: "#ff5533", bg: "bg-red-900/30" },
    5: { label: "Critical", color: "#b44dff", bg: "bg-purple-900/30" },
  };
  return config[level] || config[1];
}

export function formatEventType(type) {
  const names = {
    aircraft: "Aircraft",
    ship: "Maritime Vessel",
    flights: "Flight Path",
    webcam: "Webcam Feed",
    seismic: "Seismic Event",
    weather: "Weather Event",
    conflicts: "Conflict Zone",
    bases: "Military Base",
    military: "Military Activity",
    nuclear: "Nuclear Site",
    sanctions: "Sanctioned Entity",
    cables: "Submarine Cable",
    pipelines: "Pipeline",
    datacenters: "Data Center",
    spaceports: "Spaceport",
    waterways: "Waterway",
    tradeRoutes: "Trade Route",
    fires: "Wildfire",
    natural: "Natural Disaster",
    climate: "Climate Event",
    minerals: "Mineral Deposit",
    cyberThreats: "Cyber Threat",
    outages: "Outage",
    protests: "Protest",
    displacement: "Displacement",
    hotspots: "Activity Hotspot",
    custom: "Custom Event",
  };
  return names[type] || type;
}

export function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}
