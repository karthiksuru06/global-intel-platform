# Core Engineering Philosophy: The 5 Golden Rules

These rules represent the technical "Bible" of the Global Intelligence Platform. Any future developer must adhere to these to maintain the system's performance and professional standing.

---

### 1️⃣ Schema Normalization (The Real Core)
Every external data point, regardless of its source (API, sensor, manual entry), **must** reduce to the unified `GeoEvent` schema. 

```json
{
  "id": "uuid-v4",
  "type": "flight | ship | earthquake | cyber | protest",
  "lat": 0.0,
  "lon": 0.0,
  "timestamp": "ISO-8601",
  "severity": 1-5,
  "metadata": {}
}
```
**Why?** If you skip this, the AI analysis and the frontend rendering logic become a messy collection of `if/else` blocks. Strict normalization keeps the architecture clean.

### 2️⃣ Event-Driven Backend (Non-Negotiable)
The system is built on a specific high-performance stack that must not be compromised:
- **FastAPI**: Used for asynchronous data ingestion.
- **Redis Streams**: Acts as the decoupling agent (Producer/Consumer).
- **Node.js WebSocket**: Handles the heavy I/O of real-time broadcasting.
- **PostGIS**: Manages spatial integrity and complex radius queries.

**The Pipeline**: `External APIs` → `FastAPI` → `Redis Streams` → `Node Gateway` → `React/Cesium`.

### 3️⃣ Viewport-Based Event Filtering (The Professional Edge)
A "Student Project" sends all 10,000 events to every client. A "Professional Dashboard" only sends what is visible.

**Logic**: Before broadcasting, the WebSocket Gateway must check:
```javascript
if(event.lat between bbox.minLat && bbox.maxLat && event.lon between bbox.minLon && bbox.maxLon) {
  // Only send if visible to client
}
```
This reduces network bandwidth and frontend GPU load by orders of magnitude.

### 4️⃣ Event Simulation (Persistent Activity)
"WorldMonitor" must never look dead. When real-world feeds are quiet, the simulation engine ([useSimulation.js](file:///c:/Users/karth/OneDrive/Desktop/cyber/global-intel-platform/frontend/src/hooks/useSimulation.js)) takes over:
- **Jitter**: Adds subtle movement to static markers.
- **Hotspot Generation**: Injects relevant events into known global hotspots.
- **Geodesic Flight Arcs**: Animates aircraft using **Great-Circle interpolation** (Haversine formula).

### 5️⃣ Cesium Optimization (GPU Integrity)
Rendering thousands of entities will kill any browser if not optimized:
- **Billboard Collections**: Batch-render icon markers.
- **RequestRenderMode**: Enable to only re-render the frame when data changes or the camera moves.
- **Throttled Updates**: WebSocket batches events at 1-second intervals.
- **Entity Capping**: Hard-cap visible entities at ~2000 to preserve 60 FPS performance.

---

## The "Wow" Factor
The "Wow" factor of this project doesn't come from flashy CSS; it comes from:
- **Smooth Geodesic Animation**: Watching a flight curve over the Atlantic.
- **Zero-Lag Updates**: Real-time events appearing instantly without stutter.
- **Layer Toggling**: Instant response when filtering data.
- **Forensic Accuracy**: Trusting that a spatial query is PostGIS-accurate.

**Philosophy**: *Glassmorphism is irrelevant if performance sucks.*
