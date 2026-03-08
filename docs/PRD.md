# Product Requirements Document (PRD)
## Global Intelligence Platform — v2.0

| Field | Value |
|---|---|
| **Document Version** | 2.0 |
| **Status** | Final |
| **Author** | Karthik |
| **Date** | March 2026 |
| **Project Type** | Final Year Project — Computer Science / Cybersecurity Engineering |

---

## 1. Executive Summary

The **Global Intelligence Platform (GIP)** is a real-time geospatial intelligence system that ingests live data from open-source global feeds, processes it through an AI-powered correlation engine, and presents it to operators through an interactive 3D globe interface with 25+ data layers, animated flight path simulations, submarine cable and pipeline overlays, and a WorldMonitor-style intelligence dashboard.

The platform is positioned as an open-source, production-grade alternative to commercial geospatial intelligence tools (comparable to worldmonitor.app) — built entirely on commodity hardware, open APIs, and containerized services. v2.0 adds a comprehensive client-side simulation engine providing realistic global data across military, infrastructure, environmental, cyber, and social domains.

---

## 2. Problem Statement

### 2.1 The Gap

Geospatial situational awareness has traditionally been the domain of government agencies and large corporations with access to proprietary satellite feeds, licensed APIs, and expensive GIS software. There is no accessible, open-source, real-time system that:

- Aggregates multiple global data feeds (air, sea, seismic, weather) into a unified view
- Applies AI analysis to detect meaningful patterns across domains
- Delivers results to operators in real time through a modern web interface
- Can be deployed on a single machine with a single command

### 2.2 Impact

Without such a system, analysts must manually correlate data from disparate sources — a process that is slow, error-prone, and impossible to perform at scale.

---

## 3. Goals & Non-Goals

### 3.1 Goals (In Scope)

| Goal | Priority |
|---|---|
| Ingest live aircraft position data (ADS-B) | P0 |
| Ingest live maritime vessel data (AIS) | P0 |
| Display events on an interactive 3D globe | P0 |
| Deliver events to frontend via WebSocket in real time | P0 |
| Persist events in a geospatial database (PostGIS) | P0 |
| Run AI correlation and publish insights | P1 |
| Support 25+ layer types (flights, conflicts, bases, cables, pipelines, nuclear, cyber threats, data centers, protests, fires, minerals, spaceports, trade routes, sanctions, outages, displacement, climate, waterways, hotspots, etc.) | P0 |
| Support severity filtering and global search | P1 |
| Ingest webcam, seismic, and weather feeds | P1 |
| Deploy all services with Docker Compose | P0 |
| Support radius-based geospatial queries | P1 |
| Show events-per-minute timeline histogram with colour coding | P2 |
| Track WebSocket connection status with auto-reconnect | P1 |
| Simulate realistic flight paths between 30+ international airports with animated arcs | P0 |
| Render submarine cable network (8 major cables) as glowing polylines on globe | P1 |
| Render oil/gas pipeline infrastructure (6 major pipelines) as dashed polylines | P1 |
| Render global trade route corridors and shipping chokepoints | P1 |
| Simulate military bases, nuclear sites, conflict zones with real-world coordinates | P0 |
| WorldMonitor-style dashboard with categorized layer panel, stats overlay, search | P0 |
| Client-side simulation engine generating 150+ realistic events across all categories | P1 |
| Animated flight positions moving along great circle arcs in real time | P1 |

### 3.2 Non-Goals (Out of Scope for v1.0)

- User authentication / login system
- Multi-operator collaboration
- Mobile application
- Historical replay / scrubbing
- Proprietary or paid data feed integration
- Machine learning model training
- Threat scoring / classification ML model
- Alerting / notifications system

---

## 4. User Personas

### 4.1 Primary — Intelligence Analyst
**Name:** Alex, 28, Security Operations Analyst  
**Goal:** Monitor global aircraft and maritime movements to identify suspicious activity in a region of interest.  
**Pain point:** Currently uses 3 separate browser tabs and manually correlates timestamps.  
**Need:** A single unified view with AI-surfaced anomalies.

### 4.2 Secondary — Researcher
**Name:** Dr. Priya, 35, Academic Researcher (Geospatial Systems)  
**Goal:** Study spatial correlations between seismic activity and human movement patterns.  
**Pain point:** No free tool exists to overlay seismic and aircraft data on the same map.  
**Need:** A platform that normalises different data types into a common event format.

### 4.3 Tertiary — Developer
**Name:** Sam, 22, Software Engineering Student  
**Goal:** Understand how to build distributed real-time systems.  
**Pain point:** Most real-world distributed system examples are toy demos.  
**Need:** A well-structured, production-grade codebase to learn from.

---

## 5. User Stories & Acceptance Criteria

### Epic 1: Globe Visualization

**US-01** — As an analyst, I want to see all active global events on a 3D globe so that I can quickly build situational awareness.

| Acceptance Criteria |
|---|
| AC1: On page load, the Cesium 3D globe renders within 5 seconds |
| AC2: All active events are shown as coloured billboards on the globe |
| AC3: Each event type has a distinct colour (aircraft=cyan, ship=blue, seismic=red, etc.) |
| AC4: Clicking a billboard opens an event detail panel |
| AC5: The globe supports zoom, rotation, and pan via mouse/touch |

**US-02** — As an analyst, I want to filter events by type and severity so I can focus on what's relevant.

| Acceptance Criteria |
|---|
| AC1: Layer panel shows toggle for each event type |
| AC2: Toggling a layer immediately removes/adds markers on globe |
| AC3: Severity slider filters events below the selected threshold |
| AC4: Filter state persists until manually changed |

### Epic 2: Real-Time Data

**US-03** — As an analyst, I want events to appear on the globe automatically as they are detected so I don't need to refresh.

| Acceptance Criteria |
|---|
| AC1: New events appear on globe within 2 seconds of being published to Redis |
| AC2: WebSocket connection status is visible in top bar |
| AC3: If WebSocket disconnects, client automatically reconnects (exponential backoff) |
| AC4: On reconnect, client requests history of last 500 events |

**US-04** — As an analyst, I want to see a live events-per-minute counter so I can detect activity surges.

| Acceptance Criteria |
|---|
| AC1: Events-per-minute stat is shown in the bottom timeline bar |
| AC2: Histogram displays event distribution over selected time range (1H/6H/24H/ALL) |
| AC3: Most active event type is displayed |

### Epic 3: AI Insights

**US-05** — As an analyst, I want the system to automatically surface unusual patterns so I don't miss critical events.

| Acceptance Criteria |
|---|
| AC1: AI Insights panel shows latest detected patterns |
| AC2: Each insight has a title, description, category, and severity |
| AC3: Insights update every 60 seconds |
| AC4: Up to 50 insights are buffered and shown newest-first |

### Epic 4: Infrastructure

**US-06** — As a developer, I want to deploy the entire system with a single command.

| Acceptance Criteria |
|---|
| AC1: `docker compose up --build` starts all 5 services |
| AC2: Frontend is accessible at localhost:5173 within 3 minutes of command execution |
| AC3: Services restart automatically if they crash (`restart: unless-stopped`) |
| AC4: Health endpoints exist for all backend services |

---

## 6. Functional Requirements

### 6.1 Intelligence Engine

| ID | Requirement |
|---|---|
| FR-IE-01 | SHALL poll OpenSky Network every 30 seconds and publish aircraft positions |
| FR-IE-02 | SHALL poll maritime AIS feed every 30 seconds and publish vessel positions |
| FR-IE-03 | SHALL poll USGS earthquake feed every 30 seconds and publish seismic events |
| FR-IE-04 | SHALL poll Windy webcam API and publish camera positions |
| FR-IE-05 | SHALL store all events in PostgreSQL/PostGIS database |
| FR-IE-06 | SHALL support geospatial radius queries on stored events |
| FR-IE-07 | SHALL run AI correlation analysis every 60 seconds |
| FR-IE-08 | SHALL publish AI insights to Redis for distribution |
| FR-IE-09 | SHALL expose REST API at port 8000 |
| FR-IE-10 | SHALL expose Swagger interactive docs at `/docs` |

### 6.2 API Gateway

| ID | Requirement |
|---|---|
| FR-GW-01 | SHALL subscribe to Redis Streams consumer group |
| FR-GW-02 | SHALL maintain an in-memory circular event cache (max 2000 events) |
| FR-GW-03 | SHALL serve WebSocket connections at port 3001 |
| FR-GW-04 | SHALL batch events and broadcast every 1 second (max 150/batch) |
| FR-GW-05 | SHALL broadcast AI insights to all connected WS clients |
| FR-GW-06 | SHALL respond to history requests with cached events |
| FR-GW-07 | SHALL expose health endpoint at `GET /health` |

### 6.3 Frontend

| ID | Requirement |
|---|---|
| FR-FE-01 | SHALL render a 3D globe using Cesium with OpenStreetMap tiles |
| FR-FE-02 | SHALL display event markers as coloured billboards |
| FR-FE-03 | SHALL show label (callsign / vessel name) for aircraft and ships |
| FR-FE-04 | SHALL display event detail panel on billboard click |
| FR-FE-05 | SHALL display AI insights panel with latest analysis |
| FR-FE-06 | SHALL display layer panel with per-type toggles and event counts |
| FR-FE-07 | SHALL display timeline bar with histogram and events/min |
| FR-FE-08 | SHALL maintain WebSocket connection with auto-reconnect |
| FR-FE-09 | SHALL buffer up to 5000 events in Zustand store |
| FR-FE-10 | SHALL limit rendered Cesium entities to 1500 for performance |

---

## 7. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | Frontend must render 1000+ simultaneous globe entities at ≥30fps |
| **Latency** | Event-to-display latency must be < 2 seconds end-to-end |
| **Reliability** | All services must have health checks and `restart: unless-stopped` |
| **Scalability** | Redis Streams consumer group allows horizontal gateway scaling |
| **Security** | All external API calls are GET-only; no user data is stored |
| **Portability** | System must run on Windows, Linux, and macOS via Docker |
| **Data retention** | Database stores events indefinitely (no auto-expiry in v1.0) |
| **Open source** | All data sources must be freely accessible without paid API keys |

---

## 8. Data Models

### GeoEvent
```json
{
  "id": "string (UUIDv4)",
  "type": "aircraft | ship | flights | webcam | seismic | weather | conflicts | bases | military | nuclear | sanctions | cables | pipelines | datacenters | spaceports | waterways | tradeRoutes | fires | natural | climate | minerals | cyberThreats | outages | protests | displacement | hotspots | custom",
  "lat": "float (-90 to 90)",
  "lon": "float (-180 to 180)",
  "altitude": "float | null",
  "severity": "integer (1-5) | null",
  "timestamp": "string (ISO 8601 UTC)",
  "source": "string",
  "metadata": "object (type-specific)"
}
```

### AIInsight
```json
{
  "id": "string (UUIDv4)",
  "title": "string",
  "description": "string",
  "category": "spatial_cluster | temporal_spike | anomaly | trend | info",
  "severity": "integer (1-5)",
  "timestamp": "string (ISO 8601 UTC)",
  "related_event_ids": "string[]"
}
```

---

## 9. Dependencies & Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| OpenSky API rate limit | Medium | High | Cache results, spread poll intervals |
| Cesium performance degradation | Low | High | Entity limit (1500), LOD scaling |
| Redis unavailability | Low | Critical | Health checks; services restart automatically |
| PostGIS spatial query timeout | Low | Medium | Index on geom column; limit query results |
| React version mismatch with resium | High (historical) | Critical | Pin resium + React versions together |

---

## 10. Success Metrics

| Metric | Target |
|---|---|
| Events tracked simultaneously | ≥ 500 |
| Aircraft events per polling cycle | ≥ 200 |
| AI insights generated per hour | ≥ 10 |
| WebSocket clients supported concurrently | ≥ 50 |
| Time from `docker compose up` to live globe | < 5 minutes |
| Globe frame rate with 1000 entities | ≥ 30 FPS |
| Event-to-display latency | < 2 seconds |
