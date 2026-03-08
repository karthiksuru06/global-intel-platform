import { useEffect, useRef } from "react";
import useEventStore from "./useEventStore";
import {
  AIRPORTS,
  FLIGHT_ROUTES,
  SUBMARINE_CABLES,
  PIPELINES,
  TRADE_ROUTES,
  generateGreatCircleArc,
  generateSimulationEvents,
} from "../utils/simulationData";

/**
 * Master simulation hook:
 * 1. Loads all static geo data (bases, nukes, conflicts, etc.) once
 * 2. Generates animated flight paths between airports
 * 3. Continuously updates flight positions along arcs
 * 4. Sets up polyline data for cables, pipelines, trade routes
 */
export default function useSimulation() {
  const addEvents = useEventStore((s) => s.addEvents);
  const setActiveFlights = useEventStore((s) => s.setActiveFlights);
  const setPolylineData = useEventStore((s) => s.setPolylineData);
  const initialized = useRef(false);
  const animFrame = useRef(null);
  const flightsRef = useRef([]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // ── 1. Load static simulation events ──
    const staticEvents = generateSimulationEvents();
    addEvents(staticEvents);

    // ── 2. Set up polyline data for cables/pipelines/trade routes ──
    setPolylineData("cables", SUBMARINE_CABLES);
    setPolylineData("pipelines", PIPELINES);
    setPolylineData("tradeRoutes", TRADE_ROUTES);

    // ── 3. Generate flight arcs ──
    const airportMap = {};
    AIRPORTS.forEach((a) => { airportMap[a.code] = a; });

    const flights = FLIGHT_ROUTES.map((route, i) => {
      const from = airportMap[route[0]];
      const to = airportMap[route[1]];
      if (!from || !to) return null;

      const arc = generateGreatCircleArc(from, to, 100);
      const speed = 0.3 + Math.random() * 0.4; // varying speeds
      const startOffset = Math.random(); // stagger departures

      return {
        id: `flight-${route[0]}-${route[1]}-${i}`,
        from,
        to,
        arc,
        progress: startOffset,
        speed,
        callsign: `${route[0].substring(0, 2)}${100 + Math.floor(Math.random() * 900)}`,
        altitude: 10000 + Math.random() * 2000,
      };
    }).filter(Boolean);

    flightsRef.current = flights;

    // Expose full arc geometry to the globe renderer for glowing geodesic arcs
    setPolylineData("flightArcs", flights.map((f) => ({
      id: f.id,
      from: f.from.code,
      to: f.to.code,
      fromCity: f.from.city,
      toCity: f.to.city,
      callsign: f.callsign,
      arc: f.arc, // full array of {lat, lon, alt} points
    })));

    // ── 4. Animation loop for flight positions ──
    let lastTime = performance.now();

    function animate(time) {
      const dt = (time - lastTime) / 1000; // seconds
      lastTime = time;

      const flightEvents = [];

      for (const flight of flightsRef.current) {
        // Advance progress
        flight.progress += dt * flight.speed * 0.02;
        if (flight.progress > 1) flight.progress -= 1; // loop back

        // Get current position on arc
        const idx = Math.floor(flight.progress * (flight.arc.length - 1));
        const pos = flight.arc[Math.min(idx, flight.arc.length - 1)];

        // Compute heading from arc
        const nextIdx = Math.min(idx + 1, flight.arc.length - 1);
        const nextPos = flight.arc[nextIdx];
        const heading = Math.atan2(
          nextPos.lon - pos.lon,
          nextPos.lat - pos.lat
        ) * (180 / Math.PI);

        flightEvents.push({
          id: flight.id,
          type: "flights",
          lat: pos.lat,
          lon: pos.lon,
          altitude: pos.alt,
          severity: 1,
          timestamp: new Date().toISOString(),
          source: "flight-sim",
          metadata: {
            callsign: flight.callsign,
            from: flight.from.code,
            to: flight.to.code,
            from_city: flight.from.city,
            to_city: flight.to.city,
            altitude_ft: Math.round(pos.alt * 3.281),
            heading: Math.round(heading),
            progress: Math.round(flight.progress * 100) + "%",
          },
        });
      }

      setActiveFlights(flightEvents);
      animFrame.current = requestAnimationFrame(animate);
    }

    animFrame.current = requestAnimationFrame(animate);

    // ── 5. Periodic refresh of dynamic events (jitter simulates movement) ──
    const refreshInterval = setInterval(() => {
      // Add a few new random events to simulate live feed
      const now = new Date().toISOString();
      const dynamicEvents = [];

      // Simulate new aircraft detections
      for (let i = 0; i < 3; i++) {
        dynamicEvents.push({
          id: `aircraft-live-${Date.now()}-${i}`,
          type: "aircraft",
          lat: -60 + Math.random() * 120,
          lon: -180 + Math.random() * 360,
          altitude: 8000 + Math.random() * 5000,
          severity: 1,
          timestamp: now,
          source: "opensky",
          metadata: {
            callsign: `SIM${Math.floor(Math.random() * 9999)}`,
            icao24: Math.random().toString(16).substring(2, 8),
            velocity: Math.round(200 + Math.random() * 400),
            on_ground: false,
          },
        });
      }

      // Simulate ship positions
      for (let i = 0; i < 2; i++) {
        dynamicEvents.push({
          id: `ship-live-${Date.now()}-${i}`,
          type: "ship",
          lat: -50 + Math.random() * 100,
          lon: -180 + Math.random() * 360,
          altitude: 0,
          severity: 1,
          timestamp: now,
          source: "ais",
          metadata: {
            vessel_name: `VESSEL-${Math.floor(Math.random() * 999)}`,
            mmsi: String(200000000 + Math.floor(Math.random() * 99999999)),
            speed_knots: Math.round(5 + Math.random() * 20),
          },
        });
      }

      addEvents(dynamicEvents);
    }, 5000);

    return () => {
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      clearInterval(refreshInterval);
    };
  }, [addEvents, setActiveFlights, setPolylineData]);
}
