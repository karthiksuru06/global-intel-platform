# Architecture Document
## Global Intelligence Platform — Deep Dive

| Field | Value |
|---|---|
| **Version** | 2.0 |
| **Author** | Karthik |
| **Date** | March 2026 |

---

## 1. Architecture Overview

The Global Intelligence Platform uses a **microservices, event-driven architecture** where services are decoupled through Redis Streams. Services communicate asynchronously via published events rather than direct HTTP calls, enabling each service to scale and fail independently.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    REQUEST/DATA FLOW                                 │
│                                                                       │
│  External APIs ──────────────────────────────────────────────────   │
│       │                                                               │
│       │  HTTP GET (30s poll)                                          │
│       ▼                                                               │
│  Intelligence Engine (Python)                                         │
│       │  Normalize → GeoEvent schema                                  │
│       │  Store → PostgreSQL/PostGIS                                   │
│       │  XADD → Redis Stream "geo_events"                             │
│       │                                                               │
│       │  (every 60s) AI Analysis                                      │
│       │  XADD → Redis Stream "geo_events" (type=insight)             │
│       │                                                               │
│  Redis Streams ─────────────────────────────────────────────────── │
│       │  XREADGROUP (consumer group)                                  │
│       ▼                                                               │
│  API Gateway (Node.js)                                                │
│       │  Circular cache (2000 events)                                 │
│       │  Batch flush every 1s                                         │
│       │  ws.broadcast()                                               │
│       ▼                                                               │
│  Frontend (React + Cesium)                                            │
│       │  Zustand event store                                          │
│       │  Cesium entity rendering                                      │
│       ▼                                                               │
│  Operator sees real-time globe                                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Service Deep Dives

### 2.1 Intelligence Engine (`intelligence-engine/`)

**Language:** Python 3.12  
**Framework:** FastAPI (async)  
**Port:** 8000

The Intelligence Engine is the **data brain** of the platform. It has four responsibilities:
1. **Ingestion** — polling external APIs on a schedule
2. **Storage** — persisting normalized events to PostGIS
3. **Analysis** — running AI correlation on stored events
4. **Publishing** — pushing raw events and insights to Redis Streams

#### 2.1.1 Ingestion Layer

The `IngestionScheduler` (`ingestion/scheduler.py`) uses APScheduler to run data jobs on intervals:

```
Aircraft Job     → runs every INGESTION_INTERVAL seconds (default 30)
Ship Job         → runs every INGESTION_INTERVAL seconds
Webcam Job       → runs every 5 minutes (positions change rarely)
Seismic Job      → runs every INGESTION_INTERVAL seconds
```

Each service adapter (`aircraft_service.py`, `ship_service.py`, etc.):
1. Makes an async HTTP request to the external API (via `httpx`)
2. Parses the response into `GeoEvent` Pydantic models
3. Calls `event_bus.publish_event(event)` to write to Redis
4. Calls `storage.store_event(event)` to write to PostgreSQL

#### 2.1.2 Event Schema Normalisation

All external data — regardless of source — is normalised into the `GeoEvent` schema:

```python
class GeoEvent(BaseModel):
    id: str              # UUIDv4
    type: str            # "aircraft", "ship", etc.
    lat: float
    lon: float
    altitude: Optional[float]
    severity: Optional[int]   # 1-5
    timestamp: str            # ISO 8601 UTC
    source: str               # "opensky", "ais", etc.
    metadata: Dict[str, Any]  # Type-specific fields
```

This normalisation means the frontend and analysis engine can work with one unified model, regardless of how different the raw APIs are.

#### 2.1.3 Redis Event Bus (`event_bus/redis_stream.py`)

Events are published to Redis Streams using `XADD`:

```python
await redis.xadd("geo_events", {
    "payload": event.model_dump_json()
})
```

Redis Streams provide:
- **Persistence** — events survive Redis restarts (append-only log)
- **Consumer groups** — multiple gateway instances can share load
- **Acknowledgment** — `XACK` confirms event was processed

#### 2.1.4 Storage (`storage/db.py`)

PostgreSQL with the **PostGIS** extension is used for geospatial event storage.

The events table schema:
```sql
CREATE TABLE IF NOT EXISTS geo_events (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL,
    lat         DOUBLE PRECISION NOT NULL,
    lon         DOUBLE PRECISION NOT NULL,
    altitude    DOUBLE PRECISION,
    severity    INTEGER,
    timestamp   TIMESTAMPTZ NOT NULL,
    source      TEXT,
    metadata    JSONB,
    geom        GEOMETRY(Point, 4326)  -- PostGIS geography column
);

CREATE INDEX ON geo_events USING GIST (geom);  -- Spatial index
CREATE INDEX ON geo_events (type, timestamp DESC);
```

The `geom` column enables efficient radius queries using PostGIS spatial functions:
```sql
SELECT * FROM geo_events
WHERE ST_DWithin(geom::geography, ST_Point(:lon, :lat)::geography, :radius_m)
ORDER BY timestamp DESC
LIMIT :limit;
```

#### 2.1.5 AI Analyzer (`analysis/ai_analyzer.py`)

Runs every 60 seconds on the most recent 500 events:

**Spatial Clustering:**
- Groups events by type and geographic proximity (configurable radius)
- If cluster size exceeds threshold → generates `spatial_cluster` insight
- Insight includes cluster centroid, member count, and severity

**Temporal Analysis:**
- Calculates event rate for last 5 minutes vs. 30-minute average
- If current rate exceeds 2x average → generates `temporal_spike` insight

**Cross-Domain Correlation:**
- Checks for aircraft over maritime regions (aircraft + ship co-proximity)
- Detects seismic + atmospheric pattern co-occurrence

#### 2.1.6 Correlation Engine (`analysis/correlation_engine.py`)

Produces structured `CorrelationResult` records:
```python
class CorrelationResult(BaseModel):
    id: str
    correlation_type: str
    description: str
    confidence: float        # 0.0 - 1.0
    event_ids: List[str]     # Contributing event IDs
    timestamp: str
```

---

### 2.2 API Gateway (`api-gateway/`)

**Language:** Node.js 20  
**Framework:** Express 4  
**Port:** 3001

The API Gateway is the **real-time bridge** between the backend and all frontend clients. It has three core modules:

#### 2.2.1 Redis Subscriber (`redisSubscriber.js`)

Reads from Redis Streams using `XREADGROUP`:
- Joins consumer group `gateway_group`
- Polls `geo_events` stream in a tight async loop
- Emits `"event"` and `"insight"` Node EventEmitter events
- Acknowledges processed messages with `XACK`

Consumer groups allow running multiple gateway instances (horizontal scaling) without duplicate message delivery.

#### 2.2.2 Event Cache (`server.js` — `EventCache`)

An in-memory **circular buffer** that stores the last 2000 events:
```js
class EventCache {
  constructor(maxSize = 2000)
  add(event)          // Evicts oldest if full
  get(id)             // O(1) lookup by event ID
  getRecent(n, type)  // Recent N, optionally filtered by type
  // Used for history requests from new WS clients
}
```

#### 2.2.3 WebSocket Manager (`websocketManager.js`)

Manages all client WebSocket connections:
- `initialize(server)` — upgrades HTTP server to support WS
- `broadcastBatch(events)` — sends `event_batch` to all clients
- `broadcastInsight(insight)` — sends `insight` to all clients
- `onHistoryRequest(count, type)` — callback for history requests

**Batching Logic:**
```
Redis Event → eventBatch[]
                │
                ▼ every 1000ms
          flushBatch()
          wsManager.broadcastBatch(batch)
```

Batching prevents overwhelming the frontend with individual `send()` calls when hundreds of events arrive simultaneously (e.g., initial aircraft bulk load).

---

### 2.3 Frontend (`frontend/`)

**Framework:** React 19 + Vite 5  
**Globe Engine:** Cesium 1.121 + Resium 1.18  
**State:** Zustand 4.5

#### 2.3.1 State Management (`hooks/useEventStore.js`)

All application state lives in a **Zustand store** (v2.0 expanded):

```js
{
  events: Map<id, GeoEvent>,    // O(1) dedup by ID
  eventList: GeoEvent[],         // Sorted array for iteration
  layers: {                      // 25+ toggleable layers
    aircraft, ship, flights, conflicts, bases, military, nuclear,
    sanctions, cables, pipelines, datacenters, spaceports, waterways,
    tradeRoutes, seismic, weather, fires, natural, climate, minerals,
    cyberThreats, outages, protests, displacement, webcam, hotspots
  },
  activeFilters: { types, minSeverity, timeRange, search },
  selectedEvent: GeoEvent | null,
  insights: AIInsight[],
  connectionStatus: string,
  activeFlights: GeoEvent[],     // Animated flight positions
  polylineData: {                // Polyline overlays
    cables: CableDef[],
    pipelines: PipelineDef[],
    tradeRoutes: RouteDef[],
  },
  rightPanelTab: string,         // "feed" | "insights" | "stats" | "detail"

  // Computed
  getFilteredEvents() → GeoEvent[],
  getEventCounts() → { total, aircraft, ship, conflicts, ... },
  getStatsByCategory() → { tracking, security, infrastructure, ... },
  getActiveLayerCount() → number,
}
```

The `events` Map ensures deduplication — if the same aircraft transponder ID arrives twice, it updates the existing entry rather than creating a duplicate. Maximum store size is **8000 events** (oldest evicted).

#### 2.3.1b Simulation Engine (`hooks/useSimulation.js`)

The v2.0 client-side simulation engine provides realistic data visualization without requiring live API access:

1. **Static Event Generation** — On mount, generates 150+ events across all categories using real-world coordinates (military bases, nuclear sites, conflict zones, data centers, spaceports, cyber threat origins, protest locations, fire hotspots, mineral deposits, displacement zones, climate events, etc.)

2. **Flight Path Simulation** — Generates 36 flight routes between 30+ major international airports. Each flight follows a **great circle arc** (geodesic) with parabolic altitude curves peaking at ~11km cruising altitude. Aircraft positions are animated at 60fps using `requestAnimationFrame`.

3. **Polyline Data** — Sets up 8 submarine cable routes, 6 pipeline routes, and 6 trade route corridors as Cesium polylines with glow/dash materials.

4. **Dynamic Event Injection** — Every 5 seconds, injects new simulated aircraft and ship positions to maintain the illusion of live feed activity.

#### 2.3.2 WebSocket Hook (`hooks/useWebSocket.js`)

Features:
- Connects to `ws://localhost:3001` on mount
- Auto-reconnects with **exponential backoff** (1s → 2s → 4s … max 30s)
- Requests history of last 500 events on first connect
- Handles 4 message types: `event`, `event_batch`, `history`, `insight`
- Cleans up on component unmount (closes socket, clears timers)

#### 2.3.3 Globe Rendering (`components/CesiumGlobe.jsx`)

Built with **Resium** (React wrapper for Cesium):

```jsx
<Viewer ...options>
  {visibleEvents.map(ev => (
    <Entity key={ev.id} position={Cartesian3.fromDegrees(ev.lon, ev.lat, ev.altitude)}>
      <BillboardGraphics image={makeBillboardSvg(config.color, size)} />
      {label && <LabelGraphics text={label} ... />}
    </Entity>
  ))}
</Viewer>
```

**Performance decisions:**
- Maximum **2000 point entities** rendered simultaneously (older events dropped via `slice(-2000)`)
- Billboard SVG generated as base64 data URIs with **caching** (no network requests, no re-creation)
- `NearFarScalar` on labels — labels disappear when zoomed out (LOD)
- `disableDepthTestDistance: POSITIVE_INFINITY` — markers render above terrain
- Type-specific billboard shapes (nuclear=radiation ring, conflict=pulsing dot, base=diamond, cyber=hex)
- Flight entities rendered separately from point entities for independent update cycles

**Polyline Rendering (v2.0):**
```jsx
// Submarine cables — glowing polylines
<PolylineGraphics material={new PolylineGlowMaterialProperty({
  glowPower: 0.3, color: Color.fromCssColorString(cable.color).withAlpha(0.6)
})} />

// Pipelines — dashed polylines
<PolylineGraphics material={new PolylineDashMaterialProperty({
  color: Color.fromCssColorString(pipe.color).withAlpha(0.7), dashLength: 16
})} />

// Trade routes — semi-transparent dashed lines
<PolylineGraphics material={new PolylineDashMaterialProperty({
  color: Color.fromCssColorString(route.color).withAlpha(0.5), dashLength: 12
})} />
```

**Satellite Imagery (Esri):**
```js
const satelliteProvider = new UrlTemplateImageryProvider({
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  maximumLevel: 19,
});
```

No Cesium Ion token required. Esri satellite tiles are free for non-commercial use.

---

## 3. Infrastructure

### 3.1 Docker Compose

All 5 services are defined in `docker-compose.yml`:

```
redis         → image: redis:7-alpine         (port 6379)
postgres      → image: postgis/postgis:16-3.4  (port 5432)
intelligence-engine → build: ./intelligence-engine (port 8000)
api-gateway   → build: ./api-gateway           (port 3001)
frontend      → build: ./frontend              (port 5173)
```

**Health checks** ensure dependent services wait for dependencies:
- `intelligence-engine` waits for `redis` and `postgres` to be healthy
- `api-gateway` waits for `redis`
- `frontend` waits for `api-gateway`

**Startup sequence:**
```
1. Redis starts + passes healthcheck
2. PostgreSQL starts + passes healthcheck
3. Intelligence Engine starts (connects to both)
4. API Gateway starts (connects to Redis)
5. Frontend builds and starts
```

### 3.2 Redis Streams Architecture

```
Producer (Intelligence Engine)
    XADD geo_events * payload <json>
         │
         ▼
    Redis Stream: geo_events
    [1234-0] { payload: {...aircraft...} }
    [1235-0] { payload: {...ship...} }
    [1236-0] { payload: {...insight...} }
         │
         ▼ XREADGROUP GROUP gateway_group gateway_1
Consumer (API Gateway)
    → processes messages
    → XACK geo_events gateway_group <message-id>
```

Consumer groups allow:
- **Load balancing** — add more gateway replicas, Redis distributes messages
- **Fault tolerance** — unacknowledged messages are re-delivered after timeout
- **History** — new consumers can read from message ID 0 to get all history

### 3.3 PostgreSQL / PostGIS

PostGIS adds spatial data types and functions to PostgreSQL:

| Feature | Usage |
|---|---|
| `GEOMETRY(Point, 4326)` | WGS84 coordinate storage |
| `GIST` index on `geom` | Spatial index for fast radius queries |
| `ST_DWithin` | Radius query (as-the-crow-flies) |
| `ST_Point::geography` | Meters-accurate geodetic calculations |

The `JSONB` type for `metadata` allows flexible, schema-less per-type fields (aircraft callsign, vessel MMSI, earthquake magnitude, etc.) without requiring schema changes for each new event type.

---

## 4. Network Topology

```
Host Machine
├── :5173  → Frontend (Docker / or Vite dev server)
├── :3001  → API Gateway (Docker)
│              ├── HTTP  → /health, /api/events
│              └── WS    → ws://localhost:3001
├── :8000  → Intelligence Engine (Docker)
│              └── HTTP  → /docs, /events, /correlations, /insights
├── :5432  → PostgreSQL (Docker) [internal only recommended]
└── :6379  → Redis      (Docker) [internal only recommended]

Internal Docker Network (bridge)
├── redis:6379       (service name "redis")
├── postgres:5432    (service name "postgres")
├── intelligence-engine:8000
└── api-gateway:3001
```

Services communicate internally by Docker service name (e.g., `redis://redis:6379`), not by localhost port.

---

## 5. Design Decisions & Rationale

### 5.1 Why Redis Streams instead of direct HTTP or Kafka?

| Option | Reason rejected |
|---|---|
| Direct HTTP (pull) | Frontend would need to poll, causing unnecessary load and latency |
| Kafka | Significant operational overhead; overkill for single-machine deployment |
| Redis Pub/Sub | No persistence — if gateway restarts, missed messages are lost |
| **Redis Streams** ✅ | Persistent, consumer groups, lightweight, single dependency |

### 5.2 Why Node.js for the Gateway (not Python)?

The API Gateway's primary job is I/O-bound: reading from Redis and broadcasting to WebSockets. Node.js's event loop excels at this with minimal memory overhead. Python's asyncio would work, but Node's `ws` library is more mature for production WebSocket servers.

### 5.3 Why Cesium instead of Leaflet/MapboxGL?

| Library | Limitation |
|---|---|
| Leaflet | 2D only; no 3D globe; poor for planetary-scale data |
| MapboxGL | Paid API for satellite/terrain; not fully open |
| Deck.gl | Excellent for heat maps but not natively globe-shaped |
| **Cesium** ✅ | 3D globe, WebGL, open core, excellent for geospatial data at planetary scale |

### 5.4 Why Zustand instead of Redux?

Redux requires significant boilerplate for what is essentially one global event store. Zustand provides the same subscription model with ~5x less code and no context providers needed.

### 5.5 Why React 19?

`resium@1.18.x` was compiled against React 19's internal APIs (specifically `__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.recentlyCreatedOwnerStacks`). React 18 does not expose this internal, causing a crash on mount. Upgrading to React 19 resolved this compatibility issue.

---

## 6. Failure Modes & Recovery

| Failure | Effect | Recovery |
|---|---|---|
| Redis goes down | Intelligence Engine stops publishing; Gateway stops receiving | `restart: unless-stopped` + reconnect logic in both services |
| PostgreSQL goes down | Event persistence fails; ingestion continues to Redis | DB operations use try/except; events still flow via Redis |
| Intelligence Engine crashes | No new events or insights | Docker restarts it; Gateway serves cached events |
| API Gateway crashes | Frontend WebSocket drops | Docker restarts it; Frontend auto-reconnects (exponential backoff) |
| OpenSky API unavailable | Aircraft events stop; other feeds continue | Per-service error handling; scheduler retries next cycle |
| Frontend JavaScript crash | Blank screen | Root-level error boundary (future: v1.1) |

---

## 7. Performance Characteristics

| Metric | Measured Value |
|---|---|
| Events tracked simultaneously | 900+ (900 aircraft + vessels observed) |
| Frontend entity rendering | 1500 entities at ~60 FPS (Chrome, AMD GPU) |
| WebSocket batch frequency | 1s intervals |
| Max events per batch | 150 |
| Redis Stream message rate | ~200-300 messages/30s cycle |
| Intelligence Engine RAM | ~150 MB |
| API Gateway RAM | ~80 MB |
| PostgreSQL (PostGIS) RAM | ~256 MB |
| Redis RAM | ~30 MB |
| Total system RAM footprint | ~700 MB |
