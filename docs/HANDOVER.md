# Technical Handover Document
## Global Intelligence Platform — Knowledge Transfer

| Field | Value |
|---|---|
| **Author** | Karthik |
| **Audience** | Incoming developers, future maintainers |
| **Date** | March 2026 |
| **Purpose** | Enable the next team to maintain, extend, or rebuild this system |

---

## Part 1: Understanding the System at a Glance

Before diving into code, understand the **mental model** of this system. Every design decision flows from this single principle:

> **"Events happen in the real world → we detect them → we show them → we understand them."**

The pipeline is:
```
World → APIs → Intelligence Engine → Redis → API Gateway → Frontend → Human
```

That's it. Everything else is detail.

---

## Part 2: Technology Primer

This section teaches you the key technologies well enough to work with this codebase and build similar systems. Read this even if you think you know these technologies — the explanations are specific to how they are used here.

---

### 2.1 Redis Streams — The Nervous System

**What it is:** Redis Streams is a persistent, append-only log built into Redis. Think of it as a simple Kafka.

**Why it's here:** Services need to pass events to each other without being tightly coupled. The Intelligence Engine shouldn't directly call the API Gateway's code — it should just publish "something happened" and forget about it.

**Key concepts:**

```
XADD stream_name * field1 value1 field2 value2
```
→ Append a new message to the stream. `*` auto-generates a timestamp-based ID.

```
XREADGROUP GROUP group_name consumer_name COUNT 100 STREAMS stream_name >
```
→ Read up to 100 unread messages as member of `group_name`. `>` means "give me only new messages, not ones other group members already got."

```
XACK stream_name group_name message_id
```
→ Tell Redis "I processed this message successfully." If you crash before ACKing, Redis will redeliver it.

**How this project uses it:**

1. Intelligence Engine: `XADD geo_events * payload <json>`
2. API Gateway: `XREADGROUP GROUP gateway_group gateway_1 ... STREAMS geo_events >`
3. API Gateway processes it → `XACK`

**Why consumer groups?** If you run two API Gateway instances, Redis divides messages between them (load balancing). Neither gets the same message twice. This is how you scale horizontally.

**Learning resources:**
- [Redis Streams intro](https://redis.io/docs/data-types/streams/)
- `redis-py` Python docs (for the Intelligence Engine)
- `ioredis` npm docs (for the API Gateway)

---

### 2.2 PostGIS — Understanding Spatial Data

**What it is:** PostGIS is a PostgreSQL extension that adds a `GEOMETRY` data type and hundreds of spatial functions (distance, intersection, etc.).

**The key concept:** Latitude/longitude pairs are not just numbers — they represent points on a sphere. Normal SQL can't correctly calculate distance between coordinates. PostGIS can.

**Core data type used here:**
```sql
geom GEOMETRY(Point, 4326)
```
- `GEOMETRY(Point)` — this column stores a single point
- `4326` — SRID (Spatial Reference ID), code for WGS84 (the GPS coordinate system)

**The spatial index:**
```sql
CREATE INDEX ON geo_events USING GIST (geom);
```
Without this index, a radius query scans every row. With it, PostgreSQL uses an R-tree spatial index to eliminate most rows instantly. **Always create this index.**

**The radius query:**
```sql
WHERE ST_DWithin(
  geom::geography,              -- convert to geography type (sphere)
  ST_Point(:lon, :lat)::geography,  -- the search centre point
  :radius_m                     -- distance in METRES (geography uses meters)
)
```

`::geography` forces metre-accurate geodetic calculation (vs. flat-earth approximation). For distances > 100km, this matters.

**Inserting a point:**
```python
# In SQLAlchemy / GeoAlchemy2
from geoalchemy2 import WKTElement
geom = WKTElement(f"POINT({event.lon} {event.lat})", srid=4326)
```

Note the order: **longitude first, then latitude** in WKT format. This trips everyone up.

**Learning path:**
1. Install PostgreSQL + PostGIS locally
2. Do the [PostGIS tutorials](https://postgis.net/workshops/postgis-intro/)
3. Understand SRID 4326 vs 3857 (web mercator)
4. Practice ST_DWithin, ST_Contains, ST_Distance

---

### 2.3 WebSockets — Real-Time Push

**What it is:** A persistent, two-way TCP connection between browser and server. Unlike HTTP (request → response → close), WebSocket stays open and either side can send at any time.

**The protocol upgrade:**
```
Client: GET /  HTTP/1.1
        Upgrade: websocket
        Connection: Upgrade

Server: HTTP/1.1 101 Switching Protocols
        Upgrade: websocket
        Connection: Upgrade
```

After this handshake, it's raw TCP frames — no more HTTP overhead.

**How the gateway uses it** (`websocketManager.js`):
```js
// Server-side: node 'ws' library
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  this.clients.add(ws);
  ws.on('message', (data) => { /* handle client messages */ });
  ws.on('close', () => { this.clients.delete(ws); });
});

// Broadcast to all clients
this.clients.forEach(client => {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(payload));
  }
});
```

**How the frontend uses it** (`useWebSocket.js`):
```js
const ws = new WebSocket("ws://localhost:3001");
ws.onopen = () => { /* send history request */ };
ws.onmessage = (e) => { const msg = JSON.parse(e.data); /* update store */ };
ws.onclose = () => { /* schedule reconnect */ };
```

**The reconnection pattern** is critical:
```js
// Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
```

Never reconnect in a tight loop — you'll overwhelm the server on restart.

**Key lesson:** WebSocket is stateless from the server's perspective. If a client reconnects, the new connection has no memory of the old one. That's why the client sends a `get_history` request on connect.

---

### 2.4 React 19 + Zustand — State Management

**What changed in React 19 that matters here:**

`resium@1.18.x` uses `React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED`. This internal changed between React 18 and 19. **Do not downgrade React 18 or upgrade resium independently — keep them in sync.**

**Zustand — minimal global state:**
```js
const useEventStore = create((set, get) => ({
  events: new Map(),        // The store itself
  addEvent: (event) => set((state) => {
    const events = new Map(state.events);
    events.set(event.id, event);  // Map deduplicates by ID
    return { events, eventList: Array.from(events.values()) };
  }),
}));

// In any component:
const addEvent = useEventStore(s => s.addEvent);  // Only re-renders if addEvent changes
```

**Why Map instead of Array?**
- O(1) lookup by event ID
- Natural deduplication (duplicate aircraft positions update, not append)
- Easier bulk operations

**The computed selectors** (`getFilteredEvents`, `getEventCounts`) use `get()` to access current state inside the store — these are called from components and return fresh values each time.

---

### 2.5 Cesium / Resium — 3D Globe

**What Cesium is:** A WebGL 3D globe engine. It handles the math and rendering of an Earth-shaped sphere with real coordinate systems.

**What Resium is:** React bindings for Cesium. Instead of the imperative Cesium API, you use declarative JSX.

**Critical concept — Cesium objects are NOT React objects:**
```jsx
// WRONG: passing a plain JS object as a Cesium property
<BillboardGraphics color={{ r: 1, g: 0, b: 0 }} />

// CORRECT: pass a Cesium Color instance
<BillboardGraphics color={Color.fromCssColorString("#ff0000")} />
```

Cesium properties expect Cesium types (Color, Cartesian3, NearFarScalar, etc.). Always import from the `cesium` package.

**The skyAtmosphere gotcha** (the bug we fixed):
```jsx
// WRONG — resium passes true directly to Cesium, which expects a SkyAtmosphere object
<Viewer skyAtmosphere={true} />

// CORRECT — omit it entirely (enabled by default)
<Viewer />
```

**Coordinate system:**
- Cesium uses `Cartesian3` (XYZ from Earth's centre) internally
- You supply coordinates as `Cartesian3.fromDegrees(longitude, latitude, altitudeMeters)`
- Note: **longitude first**, then latitude — matching PostGIS convention

**Entity vs. Primitive:**
- `Entity` (what we use): declarative, selectable, supports labels/billboards — ~1000-3000 limit
- `Primitive` (advanced): more performant for 10,000+ markers but harder to work with

**LOD (Level of Detail):**
```js
scaleByDistance={new NearFarScalar(1e3, 1.5, 8e6, 0.4)}
```
`NearFarScalar(near_distance, near_value, far_distance, far_value)` — billboard scales from 1.5x at 1km to 0.4x at 8000km. Labels use this to disappear at global zoom levels.

**Learning Cesium properly:**
1. Read [Cesium Sandcastle](https://sandcastle.cesium.com/) examples
2. Understand the difference between Scene, Camera, Viewer
3. Learn about imagery layers and terrain providers
4. Study Entity vs. Primitive APIs

---

### 2.6 FastAPI + asyncio — The Python Backend

**async/await in Python:**
```python
# DO NOT use requests library — it's synchronous and blocks the event loop
import httpx

async def fetch_aircraft():
    async with httpx.AsyncClient() as client:
        resp = await client.get("https://opensky-network.org/api/states/all")
        # The event loop is free to do other work while waiting
        return resp.json()
```

**FastAPI lifespan** — startup/shutdown logic:
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup code here
    await event_bus.connect()
    ingestion_scheduler.start()
    
    yield  # App runs here
    
    # Shutdown code here
    await event_bus.disconnect()
    ingestion_scheduler.stop()

app = FastAPI(lifespan=lifespan)
```

This is the correct FastAPI v0.95+ pattern. Do not use deprecated `@app.on_event("startup")`.

**Pydantic v2 (used throughout):**
```python
class GeoEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    type: str
    lat: float
    metadata: dict = {}

# Serialise
event.model_dump()         # Returns dict
event.model_dump_json()    # Returns JSON string

# Deserialise
GeoEvent.model_validate(raw_dict)
GeoEvent.model_validate_json(json_string)
```

Note: Pydantic v2 uses `model_dump()` not `dict()`, and `model_validate()` not `parse_obj()`. Legacy methods still work but emit deprecation warnings.

---

## Part 3: Extending the System

### 3.1 Adding a New Data Source

Example: Adding a **flight delay** feed from an airport API.

**Step 1: Create the service adapter** (`intelligence-engine/ingestion/delay_service.py`):

```python
import httpx
from models.schemas import GeoEvent
from utils.logger import get_logger

logger = get_logger(__name__)

async def fetch_flight_delays(event_bus):
    """Fetch flight delay events from airport API."""
    url = "https://api.example.com/delays"
    
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        logger.error("Failed to fetch delays: %s", e)
        return
    
    for flight in data.get("delays", []):
        event = GeoEvent(
            type="custom",                    # or add "delay" to event types
            lat=float(flight["airport_lat"]),
            lon=float(flight["airport_lon"]),
            severity=1 if flight["delay_min"] < 60 else 2,
            source="airport-delays",
            metadata={
                "flight": flight["flight_number"],
                "delay_minutes": flight["delay_min"],
                "airport": flight["airport_code"],
            }
        )
        await event_bus.publish_event(event)
    
    logger.info("Ingested %d delay events", len(data.get("delays", [])))
```

**Step 2: Register with the scheduler** (`ingestion/scheduler.py`):

```python
from ingestion.delay_service import fetch_flight_delays

class IngestionScheduler:
    def start(self):
        self.scheduler.add_job(
            self._run_delays,
            trigger="interval",
            seconds=300,  # Every 5 minutes
            id="delay_ingestion",
        )
        self.scheduler.start()
    
    async def _run_delays(self):
        await fetch_flight_delays(self.event_bus)
```

**Step 3: Add the type to the frontend** (`utils/eventIcons.js`):

```js
const EVENT_CONFIG = {
  // ... existing types ...
  delay: {
    label: "Flight Delays",
    color: "#ff9500",
    icon: "Clock",
  },
};
```

**Step 4: Add to LayerPanel** (`components/LayerPanel.jsx`):

```js
import { Clock } from "lucide-react";

const LAYER_ICONS = {
  // ... existing ...
  delay: Clock,
};

const LAYERS = ["aircraft", "ship", "webcam", "seismic", "weather", "delay"];
```

**Step 5: Add to Zustand store layers** (`hooks/useEventStore.js`):

```js
layers: {
  aircraft: true,
  ship: true,
  webcam: true,
  seismic: true,
  weather: true,
  delay: true,   // ADD THIS
},
```

That's the complete pattern. ≈ 50 lines of code to add a new live data source.

---

### 3.2 Adding a New AI Detection Pattern

Edit `analysis/ai_analyzer.py` and add a method to the `AIAnalyzer` class:

```python
async def _detect_convoy_pattern(self, events: List[GeoEvent]) -> List[AIInsight]:
    """Detect groups of ships travelling in convoy formation."""
    insights = []
    ship_events = [e for e in events if e.type == "ship"]
    
    # Group ships within 5km of each other
    clusters = self._spatial_cluster(ship_events, radius_km=5, min_count=3)
    
    for cluster in clusters:
        insights.append(AIInsight(
            title=f"Convoy pattern: {len(cluster)} vessels within 5km",
            description="Multiple vessels detected in close formation — possible convoy.",
            category="pattern",
            severity=2,
            related_event_ids=[e.id for e in cluster],
        ))
    
    return insights
```

Then call it in `analyze_events()`:

```python
async def analyze_events(self, events):
    insights = []
    insights += await self._detect_spatial_clusters(events)
    insights += await self._detect_temporal_spikes(events)
    insights += await self._detect_convoy_pattern(events)  # Your new one
    return insights
```

---

### 3.3 Adding Authentication

The gateway has a placeholder auth middleware in `server.js`:

```js
app.use("/api", (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (apiKey && apiKey.length > 0) return next();
  next();  // Currently allows all unauthenticated requests
});
```

To add real JWT auth:
1. Add `jsonwebtoken` npm package
2. Replace the placeholder with JWT verification
3. On the frontend, store the token in `localStorage` and attach to WS connection headers
4. Consider using an identity provider (Keycloak, Auth0) for proper session management

---

### 3.4 Adding Historical Replay

The database already stores all events with timestamps. To add replay:

1. Add a date range picker to the `TimelineBar` component
2. On range selection, call `GET /events?since=<start>&until=<end>&limit=5000`
3. Clear the Zustand store and populate with historical events
4. Add a "replay active" indicator to the UI
5. Lock out the WebSocket live feed during replay

---

## Part 4: Common Pitfalls (Learn from These)

### ❌ Pitfall 1: React + Resium Version Mismatch
**Problem:** `resium@1.18.x` uses React 19 internals. If you install React 18, you get `TypeError: Cannot read properties of undefined (reading 'recentlyCreatedOwnerStacks')`.

**Rule:** Always check resium's peerDependencies before changing React version. Run `npm info resium peerDependencies`.

---

### ❌ Pitfall 2: Longitude vs Latitude Order
**Problem:** WGS84 coordinates are `lat, lon` in speech but `lon, lat` in most GIS APIs.

**Rule:**
- SQL PostGIS WKT: `POINT(longitude latitude)` — lon first
- Cesium: `Cartesian3.fromDegrees(longitude, latitude, altitude)` — lon first
- JSON data: typically `{ lat: ..., lon: ... }` — but always check!

Swapped coordinates will put events in the wrong hemisphere (or the ocean).

---

### ❌ Pitfall 3: Blocking the Event Loop
**Problem:** Using `requests` library (synchronous) inside an async FastAPI handler. This blocks the whole Python event loop — all other requests wait.

**Rule:** In async Python code, always use `httpx.AsyncClient` or `aiohttp`, never `requests`.

---

### ❌ Pitfall 4: Not Acknowledging Redis Messages
**Problem:** If the API Gateway reads Redis Stream messages but crashes before `XACK`, Redis will redeliver them on restart. This causes event duplicates.

**Rule:** Always `XACK` after successfully processing a message. Use try/finally if needed.

---

### ❌ Pitfall 5: Excessive Cesium Entities
**Problem:** Rendering 5000+ Cesium entities severely degrades GPU performance. The globe becomes unresponsive.

**Rule:** Cap rendered entities at ~1500 using `slice(-1500)`. For more data, use Cesium `Primitive` or clustering instead of individual `Entity` objects.

---

### ❌ Pitfall 6: Reconnecting WebSocket in a Tight Loop
**Problem:** If the server is down, reconnecting immediately in a loop creates thousands of connection attempts per second.

**Rule:** Always use exponential backoff with a maximum delay. This is implemented in `useWebSocket.js` — don't remove it.

---

### ❌ Pitfall 7: Forgetting the PostGIS Spatial Index
**Problem:** `ST_DWithin` queries without a GIST index do a full table scan. At 100,000 events, this takes seconds.

**Rule:** Always create `CREATE INDEX ... USING GIST (geom)` on spatial columns. Done in `storage/db.py` — don't remove it if you recreate the schema.

---

## Part 5: Architecture Patterns to Carry Forward

These patterns from this project are production patterns — use them in your next system:

### Pattern 1: Event Normalisation
No matter how different your data sources are, define **one canonical event schema** and translate everything into it. This is the single most important architectural decision in this project.

### Pattern 2: Event Bus Decoupling
Producers (Intelligence Engine) don't know about consumers (API Gateway). They just publish to a stream. This means you can add new consumers (analytics, alerting, ML pipeline) without changing the producer.

### Pattern 3: Circular Buffer Cache
The in-memory event cache in the API Gateway allows new WebSocket clients to immediately get recent history without hitting the database. Always have a fast in-memory layer in front of your DB for hot data.

### Pattern 4: Batched WebSocket Broadcasting
Never send one WebSocket message per event when events arrive in bursts. Batch them (1s intervals here) to prevent browser main thread starvation.

### Pattern 5: Computed Selectors in State
Don't store derived data (filtered events, computed counts) in the state. Compute it on-demand with `getFilteredEvents()`, `getEventCounts()`. This avoids sync bugs between raw and derived state.

---

## Part 6: Deployment Beyond Docker

The current system runs on a single machine with Docker Compose. To go to production:

### Cloud Deployment (AWS / Azure / GCP)

| Component | Cloud Equivalent |
|---|---|
| PostgreSQL + PostGIS | AWS RDS + PostGIS extension / Google Cloud SQL |
| Redis | AWS ElastiCache / Azure Cache for Redis |
| Intelligence Engine | AWS ECS / Google Cloud Run / Kubernetes pod |
| API Gateway | AWS ECS / Kubernetes pod (can run multiple replicas) |
| Frontend | AWS S3 + CloudFront (static files from `npm run build`) |

### Scaling the API Gateway

Redis consumer groups already handle horizontal scaling:
1. Deploy N API Gateway instances
2. Each joins consumer group `gateway_group` with a unique consumer name
3. Redis automatically distributes stream messages across all instances
4. Add a load balancer for WebSocket sticky sessions

### Environment Variables in Production

Never commit `.env` files. Use:
- AWS Secrets Manager / Parameter Store
- Azure Key Vault
- Kubernetes Secrets
- HashiCorp Vault

---

## Part 7: Recommended Learning Path

For a developer coming to this codebase with basic web knowledge:

**Week 1 — Foundation**
- [ ] Docker & Docker Compose (official Getting Started guide)
- [ ] Redis data structures (Strings, Lists, Streams) — redis.io/docs
- [ ] PostgreSQL basics + one PostGIS tutorial

**Week 2 — Python Backend**
- [ ] Python `async`/`await` — Real Python async guide
- [ ] FastAPI tutorial (official) — focus on lifespan, Pydantic v2, async routes
- [ ] SQLAlchemy 2.0 async tutorial
- [ ] GeoAlchemy2 quickstart

**Week 3 — Node.js Middleware**
- [ ] Node.js event loop explanation (The Node Beginner Book)
- [ ] WebSocket protocol — MDN Web Docs
- [ ] `ws` npm package docs
- [ ] `ioredis` Streams examples

**Week 4 — Frontend**
- [ ] React 19 — official docs (hooks, state, effects)
- [ ] Zustand — github.com/pmndrs/zustand README
- [ ] Cesium Sandcastle — 5 interactive examples
- [ ] Resium — resium.reearth.io docs

**Ongoing**
- [ ] System Design Interview book (Designing Data-Intensive Applications — Kleppmann)
- [ ] Redis University (free courses)
- [ ] PostGIS in Action (book)

---

## Part 8: Contacts & Resources

| Resource | Link |
|---|---|
| OpenSky Network API | https://opensky-network.org/apidoc/ |
| Cesium Documentation | https://cesium.com/learn/cesiumjs/ref-doc/ |
| Resium Documentation | https://resium.reearth.io/ |
| PostGIS Documentation | https://postgis.net/docs/ |
| Redis Streams | https://redis.io/docs/data-types/streams/ |
| FastAPI Documentation | https://fastapi.tiangolo.com/ |
| Zustand GitHub | https://github.com/pmndrs/zustand |
| React 19 Docs | https://react.dev/ |

---

*This handover document was written to be the document the author wished they had when starting this project. Maintain it as the system evolves.*
