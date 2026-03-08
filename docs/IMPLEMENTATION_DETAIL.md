# Global Intelligence Platform: Implementation Summary

This document provides a comprehensive overview of all custom logic and structural components implemented from scratch for this project.

## 1. Intelligence Engine (Python / FastAPI)
*The core "brain" responsible for data ingestion, normalization, and analysis.*

### Core Modules
- **Dynamic Ingestion Scheduler** ([scheduler.py](file:///c:/Users/karth/OneDrive/Desktop/cyber/global-intel-platform/intelligence-engine/ingestion/scheduler.py)): Custom APScheduler implementation that manages asynchronous polling jobs for 5+ data sources (OpenSky, AIS, USGS, Windy, NOAA).
- **Service Adapters**: Custom logic for each data source to handle specific API quirks and normalize them into a unified `GeoEvent` schema:
    - [aircraft_service.py](file:///c:/Users/karth/OneDrive/Desktop/cyber/global-intel-platform/intelligence-engine/ingestion/aircraft_service.py)
    - [ship_service.py](file:///c:/Users/karth/OneDrive/Desktop/cyber/global-intel-platform/intelligence-engine/ingestion/ship_service.py)
    - [webcam_service.py](file:///c:/Users/karth/OneDrive/Desktop/cyber/global-intel-platform/intelligence-engine/ingestion/webcam_service.py)
- **AI Analyzer** ([ai_analyzer.py](file:///c:/Users/karth/OneDrive/Desktop/cyber/global-intel-platform/intelligence-engine/analysis/ai_analyzer.py)): A custom-built pattern detection engine that identifies spatial clusters, temporal spikes, and suspicious activity (e.g., emergency squawk codes).
- **Redis Event Bus** ([redis_stream.py](file:///c:/Users/karth/OneDrive/Desktop/cyber/global-intel-platform/intelligence-engine/event_bus/redis_stream.py)): A custom wrapper around Redis Streams for high-performance, asynchronous event publishing.
- **Geospatial Storage** ([db.py](file:///c:/Users/karth/OneDrive/Desktop/cyber/global-intel-platform/intelligence-engine/storage/db.py)): PostGIS-integrated SQLAlchemy models and spatial query logic (radius search, centroid calculation).

---

## 2. API Gateway (Node.js / Express)
*The real-time bridge between the backend streams and the frontend.*

### Core Modules
- **WebSocket Manager** ([websocketManager.js](file:///c:/Users/karth/OneDrive/Desktop/cyber/global-intel-platform/api-gateway/websocketManager.js)): Highly customized WebSocket server that supports:
    - **Real-time Batching**: Buffers incoming events and flushes them to clients every 1s to prevent UI lag.
    - **Spatial Filtering**: Custom logic to only send events to clients based on their visible viewport (bounding box).
    - **Type Filtering**: Allows clients to subscribe/unsubscribe to specific event categories.
- **Redis Stream Subscriber** ([redisSubscriber.js](file:///c:/Users/karth/OneDrive/Desktop/cyber/global-intel-platform/api-gateway/redisSubscriber.js)): Implements Redis Consumer Groups (`XREADGROUP`) to ensure load balancing and stateful message delivery across multiple gateway instances.
- **In-Memory Event Cache**: A circular buffer maintaining the last 2000 events for instant history delivery to new connections.

---

## 3. Frontend (React / Cesium)
*The interactive 3D visualization platform.*

### Core Modules
- **Cesium Globe Orchestrator** ([CesiumGlobe.jsx](file:///c:/Users/karth/OneDrive/Desktop/cyber/global-intel-platform/frontend/src/components/CesiumGlobe.jsx)): Custom Resium implementation rendering 25+ dynamic layers, including custom billboard icons, glowing submarine cables, and dashed trade route polylines.
- **Planetary Simulation Engine** ([useSimulation.js](file:///c:/Users/karth/OneDrive/Desktop/cyber/global-intel-platform/frontend/src/hooks/useSimulation.js)): A sophisticated client-side engine that:
    - Generates 150+ realistic initial events across global hotspots.
    - Animates 36+ real-world flight paths using **Great Circle Arc** (geodesic) calculations.
    - Simulates jitters and updates for non-live feeds to maintain a dynamic environment.
- **Global Event State** ([useEventStore.js](file:///c:/Users/karth/OneDrive/Desktop/cyber/global-intel-platform/frontend/src/hooks/useEventStore.js)): A custom Zustand store optimized for holding up to 8000 events with O(1) lookups and reactive UI updates.
- **Futuristic UI System**: Custom Tailwind-based glassmorphism design system integrated throughout sidebar panels, top bars, and the timeline histogram.

---

## 4. Key Architectural Decisions
- **Microservices Deployment**: Fully containerized multi-service environment managed via [docker-compose.yml](file:///c:/Users/karth/OneDrive/Desktop/cyber/global-intel-platform/docker-compose.yml).
- **Event-Driven Coupling**: Zero direct dependencies between the Intelligence Engine and the Gateway, decoupled via Redis Streams.
- **Schema Normalization**: Every external data point is reduced to the `GeoEvent` schema, enabling unified processing for AI and visualization.
- **Performance Standards**: Follows the [Core Philosophy](file:///c:/Users/karth/OneDrive/Desktop/cyber/global-intel-platform/docs/CORE_PHILOSOPHY.md) (Viewport filtering, Batching, Geodesic Simulation).
