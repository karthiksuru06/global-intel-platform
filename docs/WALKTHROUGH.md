# Global Intelligence Platform: Project Walkthrough

This walkthrough demonstrates how the core features of the platform translated from concept to implementation.

## 1. Interactive 3D Planetary Dashboard
The primary interface is a custom-built 3D globe powered by **CesiumJS**.

- **Implementation**: [CesiumGlobe.jsx](file:///c:/Users/karth/OneDrive/Desktop/cyber/global-intel-platform/frontend/src/components/CesiumGlobe.jsx)
- **Features**: 
    - Real-time entity rendering for aircraft, ships, and infrastructure.
    - Dynamic layer toggling (25+ categories).
    - Custom SVG billboard generation for high-density data visualization.

---

## 2. Real-Time Flight Path Simulation
To ensure a "live" feel regardless of external API status, we implemented a Great Circle Arc simulation.

- **Implementation**: [useSimulation.js](file:///c:/Users/karth/OneDrive/Desktop/cyber/global-intel-platform/frontend/src/hooks/useSimulation.js)
- **Logic**: Calculates geodesic paths between major airports (JFK to LHR, SIN to SYD, etc.) and animates aircraft along these arcs at 60 FPS using `requestAnimationFrame`.

---

## 3. High-Performance Event Streaming
The platform can handle bursts of hundreds of events per second without crashing the browser.

- **Implementation**: [websocketManager.js](file:///c:/Users/karth/OneDrive/Desktop/cyber/global-intel-platform/api-gateway/websocketManager.js) & [useWebSocket.js](file:///c:/Users/karth/OneDrive/Desktop/cyber/global-intel-platform/frontend/src/hooks/useWebSocket.js)
- **Mechanism**: The backend buffers events into 1-second batches. The frontend receives these batches and performs atomic updates to the Zustand store, preventing the React "render-loop" from being overwhelmed.

---

## 4. AI Pattern Detection
The "Intelligence" in the platform comes from the background AI analysis.

- **Implementation**: [ai_analyzer.py](file:///c:/Users/karth/OneDrive/Desktop/cyber/global-intel-platform/intelligence-engine/analysis/ai_analyzer.py)
- **Example**: It detects "Suspicious Aircraft Activity" by scanning metadata for emergency squawk codes (7500/7700) or missing callsigns, automatically generating a high-severity `insight` event that is broadcast to all operators.

---

## 5. Geospatial Intelligence Storage
Every event is indexed spatially for rapid forensic retrieval.

- **Implementation**: [db.py](file:///c:/Users/karth/OneDrive/Desktop/cyber/global-intel-platform/intelligence-engine/storage/db.py)
- **Technology**: **PostGIS** GIST indexing allows the platform to perform complex radius queries (e.g., "Find all events within 50km of Sydney Harbor") in milliseconds across thousands of records.
