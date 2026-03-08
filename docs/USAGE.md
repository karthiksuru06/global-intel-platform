# Operator Usage Guide
## Global Intelligence Platform — v2.0

| Field | Value |
|---|---|
| **Audience** | Platform Operators, Analysts, Evaluators |
| **Version** | 2.0 |
| **Date** | March 2026 |

---

## 1. Getting Started

### 1.1 System Requirements

| Requirement | Minimum | Recommended |
|---|---|---|
| **RAM** | 4 GB free | 8 GB free |
| **CPU** | 4 cores | 8 cores |
| **GPU** | WebGL 2.0 capable | Dedicated GPU |
| **Internet** | Required (live data feeds) | Stable broadband |
| **Browser** | Chrome 100+ / Edge 100+ | Latest Chrome |
| **OS** | Windows 10, macOS 12, Ubuntu 20.04 | Any with Docker |

### 1.2 Launching the Platform

**Method A — Full Docker (recommended)**

```bash
cd global-intel-platform
docker compose up --build
```

Wait for all services to report healthy (approx. 2–4 minutes on first run).

Open your browser and navigate to:
```
http://localhost:5173
```

**Method B — Dev Mode (for developers)**

```bash
# Start backend infrastructure only
docker compose up redis postgres intelligence-engine api-gateway

# In a separate terminal
cd frontend
npm install
npm run dev
```

Navigate to `http://localhost:5173`

### 1.3 Verifying Everything Is Running

Open these URLs in your browser to confirm all services are healthy:

| URL | Expected Response |
|---|---|
| http://localhost:5173 | 3D globe dashboard |
| http://localhost:3001/health | `{ "status": "ok", ... }` |
| http://localhost:8000/health | `{ "status": "healthy", ... }` |
| http://localhost:8000/docs | Swagger API documentation |

---

## 2. Interface Walkthrough

### 2.1 Layout Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│  TOP BAR — Brand · Events · Threat · Flights · Conflicts · Cyber ·        │
│            Layers · Evt/Min · Search · Connection · UTC Clock              │
├──────────────────────────────────────────────────────────────────────────┤
│  REGIONAL PRESETS — Global · Americas · Europe · MENA · Asia · Africa     │
├──────────────┬────────────────────────────────────────┬───────────────────┤
│              │                                        │  [Feed|Insights|  │
│  LAYER PANEL │                                        │   Stats|Detail]   │
│  (25+ layers │       3D GLOBE (Cesium)                │                   │
│   by category│  Flight arcs · Submarine cables        │  Live Feed /      │
│   with search│  Pipelines · Trade routes              │  AI Insights /    │
│   & counts)  │  Military bases · Nuclear sites        │  Global Stats /   │
│              │  Conflict zones · Cyber threats         │  Event Detail     │
│              │  + all other layers                     │                   │
├──────────────┴────────────────────────────────────────┴───────────────────┤
│  TIMELINE BAR — Threat Gauge · Time Range · Colour Histogram ·            │
│                 Flights · Conflicts · Fires · DCs · Total stats           │
└────────────────────────────────────────────────────────────────────────────┘
```

---

### 2.2 Top Bar

The top bar gives a live system overview:

| Element | Description |
|---|---|
| **Title** | "GLOBAL INTELLIGENCE PLATFORM" |
| **Events tracked** | Total events in memory (e.g., `874 events tracked`) |
| **Aircraft count** | Number of active aircraft events |
| **Vessels count** | Number of active maritime vessel events |
| **Connection dot** | 🟢 Connected / 🟡 Reconnecting / 🔴 Disconnected |
| **Status text** | Current WebSocket connection state |
| **UTC Clock** | Live UTC time (updates every second) |

---

### 2.3 Layer Panel (Left Sidebar)

The layer panel controls which types of events are visible on the globe.

#### Toggling Layers

The layer panel now supports **25+ data layers** organized into 6 categories, matching the WorldMonitor-style layout. Click any layer button to show/hide:

**Tracking:**
| Layer | Colour | Data Source |
|---|---|---|
| **Flights** | Cyan (`#00d4ff`) | OpenSky Network ADS-B |
| **Maritime AIS** | Blue (`#3b82f6`) | AIS vessel feeds |
| **Flight Paths** | Teal (`#06b6d4`) | Simulated great-circle arcs between airports |

**Security:**
| Layer | Colour | Data Source |
|---|---|---|
| **Conflicts** | Red (`#ef4444`) | UCDP/ACLED conflict database |
| **Military Bases** | Orange (`#f97316`) | OSINT military intelligence |
| **Military Activity** | Dark Red (`#dc2626`) | OSINT operational tracking |
| **Nuclear Sites** | Yellow (`#facc15`) | IAEA nuclear facility database |
| **Sanctions** | Purple (`#a855f7`) | OFAC/EU sanctions lists |

**Infrastructure:**
| Layer | Colour | Data Source |
|---|---|---|
| **Submarine Cables** | Cyan (`#22d3ee`) | Undersea fiber optic cable routes |
| **Pipelines** | Amber (`#f59e0b`) | Oil & gas pipeline infrastructure |
| **Data Centers** | Violet (`#8b5cf6`) | Major cloud/colocation facilities |
| **Spaceports** | Pink (`#e879f9`) | Launch facilities worldwide |
| **Waterways** | Sky Blue (`#0ea5e9`) | Strategic shipping chokepoints |
| **Trade Routes** | Teal (`#14b8a6`) | Major global trade corridors |

**Environment:**
| Layer | Colour | Data Source |
|---|---|---|
| **Seismic** | Red-Orange (`#ff5533`) | USGS Earthquake feed |
| **Weather** | Amber (`#ffaa00`) | Severe weather alerts |
| **Fires** | Orange (`#f97316`) | NASA FIRMS active fire data |
| **Natural Disasters** | Red (`#ef4444`) | Hurricanes, floods, volcanic |
| **Climate** | Emerald (`#10b981`) | Climate anomalies |
| **Minerals** | Dark Amber (`#d97706`) | Critical mineral deposits |

**Cyber & Social:**
| Layer | Colour | Data Source |
|---|---|---|
| **Cyber Threats** | Rose (`#f43f5e`) | APT/ransomware threat intel |
| **Outages** | Yellow (`#eab308`) | Internet/power grid outages |
| **Protests** | Lavender (`#a78bfa`) | Civil unrest tracking |
| **Displacement** | Light Orange (`#fb923c`) | UNHCR refugee data |

**Surveillance:**
| Layer | Colour | Data Source |
|---|---|---|
| **Webcams** | Green (`#00ff88`) | Windy.com public cameras |
| **Hotspots** | Rose (`#f43f5e`) | Auto-detected activity clusters |

Each button shows the **live event count**. Categories can be expanded/collapsed. Use the "Enable All" / "Disable All" buttons in the header to bulk toggle. A search box filters layers by name.

#### Severity Filter

The **Min Severity** range slider (below the layer toggles) filters out low-significance events:

| Value | Effect |
|---|---|
| **0 / All** | Show all events regardless of severity |
| **1** | Show only severity 1 and above (most events) |
| **3** | Show severity 3, 4, 5 only (notable events) |
| **5** | Show only critical events |

Drag the slider right to increase the minimum severity threshold.

---

### 2.4 The 3D Globe

The globe is rendered using **Cesium** with OpenStreetMap tile imagery. It is fully interactive.

#### Navigation Controls

| Action | Control |
|---|---|
| **Rotate globe** | Left-click + drag |
| **Zoom in/out** | Scroll wheel |
| **Pan / tilt** | Right-click + drag |
| **Tilt camera** | Middle-click + drag |
| **Select event** | Left-click on a billboard marker |
| **Reset view** | Double-click on globe surface |

#### Reading the Markers

Each event is shown as a coloured dot (billboard):
- **Dot colour** = event type (see Layer Panel colours above)
- **Dot size** = selected events are 1.5x larger and shown in white
- **Label** = aircraft show callsign, vessels show vessel name (appears when zoomed in)
- Labels **fade out** when zoomed far out to reduce clutter (Cesium LOD scaling)

#### Clicking an Event

Click any dot on the globe to open the **Event Detail Panel** on the right. The selected marker turns white.

---

### 2.5 Event Detail Panel (Right Side)

When you click on a globe marker, the detail panel opens showing:

| Field | Description |
|---|---|
| **Type badge** | Event type name (e.g. "Aircraft", "Maritime Vessel") |
| **Coordinates** | Latitude / Longitude in degrees |
| **Altitude** | Altitude in metres (where applicable) |
| **Timestamp** | Relative time (e.g. "3 minutes ago") + exact ISO timestamp |
| **Severity** | Colour-coded severity badge (Low / Elevated / High / Critical) |
| **Source** | Data source that ingested this event (e.g. `opensky`) |
| **Metadata** | Type-specific fields (callsign, MMSI, vessel name, magnitude, etc.) |
| **ID** | Unique event UUID |

Click the **✕** button in the panel header to deselect the event.

---

### 2.6 AI Insights Panel (Right Side)

Located below (or alongside) the Event Detail panel. Shows the latest AI-generated intelligence assessments.

Each insight card shows:
- **Category icon** — 🔺 Threat / 🔍 Pattern / 📈 Trend / ℹ️ Info
- **Title** — Short description of the detected pattern
- **Description** — Detailed explanation from the AI analyzer
- **Category badge** — `spatial_cluster`, `temporal_spike`, `anomaly`, `trend`
- **Relative time** — When the insight was generated

The panel shows up to **50 insights**, newest first. New insights push older ones down.

A counter badge on the panel header shows the total insight count (max 50).

---

### 2.7 Timeline Bar (Bottom)

The timeline bar provides temporal analysis of event activity.

#### Time Range Selector

Four preset ranges (click to switch):

| Button | Range |
|---|---|
| **1H** | Last 1 hour |
| **6H** | Last 6 hours |
| **24H** | Last 24 hours |
| **ALL** | All events in memory |

#### Event Histogram

The horizontal bar chart shows event distribution across the selected time range, divided into **20 equal buckets**. Taller bars = more events in that time period. Use this to spot activity spikes.

#### Stats Row

| Stat | Description |
|---|---|
| **⚡ evt/min** | Events received in the last 60 seconds |
| **active:** | Most active event type currently |
| **buffer:** | Total events currently held in the frontend store |

---

## 3. Advanced Usage

### 3.1 Querying the API Directly

The Intelligence Engine exposes a full REST API with interactive docs at:
```
http://localhost:8000/docs
```

Useful queries:

```bash
# Get latest 200 aircraft events
GET http://localhost:8000/events?type=aircraft&limit=200

# Get seismic events with severity ≥ 3
GET http://localhost:8000/events?type=seismic&severity=3

# Get events within 100km of London
GET http://localhost:8000/events/nearby?lat=51.5&lon=-0.12&radius_km=100

# Get events from the last hour
GET http://localhost:8000/events?since=2026-03-01T14:00:00Z

# Get all current AI insights
GET http://localhost:8000/insights

# Get correlation results
GET http://localhost:8000/correlations
```

### 3.2 Posting Custom Events

You can inject a custom event via the API:

```bash
curl -X POST http://localhost:8000/events \
  -H "Content-Type: application/json" \
  -d '{
    "type": "custom",
    "lat": 48.8566,
    "lon": 2.3522,
    "severity": 3,
    "metadata": { "label": "Paris Incident", "notes": "Test event" },
    "source": "manual"
  }'
```

The event will appear on the globe within 1–2 seconds.

### 3.3 Bounding Box Queries

Filter events within a geographic bounding box (lamin, lomin, lamax, lomax):

```
GET http://localhost:8000/events?bbox=-10.0,35.0,40.0,70.0
```

This queries events within the European region (roughly).

### 3.4 Monitoring System Health

```bash
# Intelligence Engine health (includes Redis status)
GET http://localhost:8000/health

# API Gateway health (includes WS client count, uptime)
GET http://localhost:3001/health
```

---

## 4. Understanding the Data

### 4.1 Aircraft Events (`type: aircraft`)

| Metadata Field | Description |
|---|---|
| `icao24` | 24-bit ICAO aircraft transponder code |
| `callsign` | Flight callsign (e.g. `QFA001`, `UAE201`) |
| `velocity` | Ground speed in m/s |
| `vertical_rate` | Climb/descent rate in m/s |
| `on_ground` | Boolean — whether aircraft is on the ground |
| `origin_country` | Country of registration |

Aircraft positions update every 30 seconds from the OpenSky Network.

### 4.2 Maritime Events (`type: ship`)

| Metadata Field | Description |
|---|---|
| `mmsi` | Maritime Mobile Service Identity (unique vessel ID) |
| `vessel_name` | Ship name |
| `ship_type` | Vessel category (cargo, tanker, passenger, etc.) |
| `speed` | Speed over ground in knots |
| `course` | Course over ground in degrees |
| `destination` | Declared destination port |

### 4.3 Seismic Events (`type: seismic`)

| Metadata Field | Description |
|---|---|
| `magnitude` | Richter scale magnitude |
| `depth_km` | Depth of earthquake in kilometres |
| `place` | Human-readable location description |
| `usgs_id` | USGS event identifier |

Severity is mapped from magnitude:
- Magnitude < 4.0 → Severity 1
- Magnitude 4.0–5.0 → Severity 2
- Magnitude 5.0–6.0 → Severity 3
- Magnitude 6.0–7.0 → Severity 4
- Magnitude ≥ 7.0 → Severity 5

### 4.4 Webcam Events (`type: webcam`)

| Metadata Field | Description |
|---|---|
| `name` | Camera name / location |
| `url` | Direct webcam stream URL (where available) |
| `windy_id` | Windy.com camera identifier |

Webcam positions rarely change, so they are ingested every 5 minutes.

### 4.5 AI Insight Categories

| Category | Meaning | Example |
|---|---|---|
| `spatial_cluster` | Unusual geographic concentration | "15 aircraft within 50km over the Pacific" |
| `temporal_spike` | Sudden surge in event rate | "Seismic event rate 3x above baseline" |
| `anomaly` | Statistical outlier | "Vessel in unusual shipping lane" |
| `trend` | Long-term pattern | "Aircraft traffic increasing in European airspace" |
| `info` | General information | "New high-severity seismic event detected" |

---

## 5. Performance Tips

### For best globe performance:
- Use **Google Chrome** or **Microsoft Edge** (best WebGL performance)
- If the globe feels sluggish with many entities, use the **severity filter** to reduce visible markers
- The layer toggles are the fastest way to declutter the view
- The system automatically limits to **1500 rendered entities** for performance

### For querying large datasets:
- Always use the `limit` parameter when querying the API
- Use `type=` filter to narrow results before applying other filters
- For geographic queries, prefer `nearby` (PostGIS optimised) over `bbox`

### For multiple browser tabs:
- Each tab creates its own WebSocket connection
- All tabs receive the same real-time events
- State (selected event, layer toggles) is per-tab only

---

## 6. Troubleshooting

## 5b. Simulation Features (v2.0)

### Flight Path Simulation

The platform simulates **36 realistic flight routes** between 30+ major international airports (JFK, LHR, DXB, HND, SIN, SYD, etc.). Each flight:
- Follows a **great circle arc** (geodesic path) on the globe
- Has a parabolic **altitude curve** peaking at ~11,000m (cruising altitude)
- Moves in real-time with randomized speeds and staggered departures
- Shows callsign labels when zoomed in
- Can be clicked for route details (origin, destination, altitude, heading, progress)

### Submarine Cable Overlay

8 major undersea fiber optic cable routes are rendered as **glowing polylines**:
- TAT-14 (Transatlantic), SEA-ME-WE 3, Pacific Crossing, SAFE, IMEWE, AAE-1, MAREA, APCN-2
- Toggle via the "Submarine Cables" layer in Infrastructure category

### Pipeline Overlay

6 major oil & gas pipelines rendered as **dashed polylines**:
- Nord Stream (Baltic Sea), Trans-Siberian, Keystone XL, TAPI, BTC, Trans-Mediterranean
- Toggle via the "Pipelines" layer in Infrastructure category

### Trade Route Overlay

6 global trade corridors rendered as semi-transparent dashed lines:
- Strait of Malacca, Suez Canal, Panama Canal, Cape of Good Hope, Northern Sea Route, China-Europe Rail (BRI)

### Static Intelligence Data

150+ pre-loaded data points using real-world approximate coordinates:
- **18 military bases** (Camp Humphreys, Ramstein, Diego Garcia, etc.)
- **13 nuclear sites** (Chernobyl, Fukushima, Natanz, Yongbyon, etc.)
- **15 conflict zones** (Ukraine, Gaza, Sudan, Myanmar, etc.)
- **12 data centers** (AWS US-East-1, Google The Dalles, Meta Luleå, etc.)
- **10 spaceports** (Kennedy, Baikonur, Starbase, etc.)
- **8 cyber threat origins** (APT28, APT41, Lazarus Group, etc.)
- **10 protest locations**, **10 fire hotspots**, **10 mineral deposits**
- **8 displacement zones**, **8 climate events**, **6 outage hotspots**
- **8 waterway chokepoints**, **5 sanctioned entities**, **5 hotspot clusters**

---

## 6. Troubleshooting

### Globe shows blank black screen
- **Cause:** JavaScript error on load (check browser console F12)
- **Fix:** Hard refresh with Ctrl+Shift+R

### Connection dot shows "Disconnected"
- **Cause:** API Gateway isn't running or WebSocket can't connect
- **Check:** `http://localhost:3001/health` — if this fails, the gateway is down
- **Fix:** Ensure Docker containers are all running (`docker compose ps`)

### No events appearing after a few minutes
- **Cause:** Intelligence Engine may not have connectivity to external APIs
- **Check:** `docker compose logs intelligence-engine` — look for HTTP errors
- **Fix:** Check firewall / network settings; some corporate networks block external API calls

### Globe tiles not loading (all grey)
- **Cause:** OpenStreetMap tile server unreachable (needs internet)
- **Fix:** Check internet connectivity; OSM tile server may be temporarily down

### "50 AI Insights" but insights panel is empty
- **Cause:** Insights haven't been generated yet (runs every 60s, needs ~500 events first)
- **Wait:** Give the system 2–3 minutes to accumulate events and run analysis

### Docker build fails
- **Cause:** Port conflict, insufficient RAM, or network issue during `npm install`
- **Check:** `docker compose ps` and `docker compose logs <service-name>`
- **Fix:** `docker compose down` then `docker compose up --build`
