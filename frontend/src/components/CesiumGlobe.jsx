import { useRef, useEffect, useMemo, useCallback, useState } from "react";
import {
  Viewer,
  Entity,
  BillboardGraphics,
  LabelGraphics,
  PolylineGraphics,
  EllipseGraphics,
  PolygonGraphics,
} from "resium";
import {
  Cartesian3,
  Color,
  VerticalOrigin,
  HorizontalOrigin,
  LabelStyle,
  NearFarScalar,
  Cartesian2,
  UrlTemplateImageryProvider,
  ImageryLayer,
  ArcGisMapServerImageryProvider,
  PolylineDashMaterialProperty,
  PolylineGlowMaterialProperty,
  EllipsoidalOccluder,
  Ellipsoid,
  Rectangle,
  Math as CesiumMath,
  IonImageryProvider,
  CallbackProperty,
  JulianDate,
  PolygonHierarchy,
  Ion,
} from "cesium";
import useEventStore, { updateUrlState } from "../hooks/useEventStore";
import { getEventConfig, makeBillboardSvg, getBillboardType } from "../utils/eventIcons";

// ── ArcGIS Satellite: Robust, high-res tile feed.
const satelliteProvider = new UrlTemplateImageryProvider({
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  maximumLevel: 19,
  credit: "© Esri, Earthstar Geographics",
});

// Memoized SVG cache to prevent re-creation
const svgCache = new Map();
function getCachedSvg(color, size, type) {
  const key = `${color}-${size}-${type}`;
  if (!svgCache.has(key)) {
    svgCache.set(key, makeBillboardSvg(color, size, type));
  }
  return svgCache.get(key);
}

export default function CesiumGlobe() {
  const viewerRef = useRef(null);
  const getFilteredEvents = useEventStore((s) => s.getFilteredEvents);
  const selectEvent = useEventStore((s) => s.selectEvent);
  const selectedEvent = useEventStore((s) => s.selectedEvent);
  const setCesiumViewer = useEventStore((s) => s.setCesiumViewer);
  const activeFlights = useEventStore((s) => s.activeFlights);
  const polylineData = useEventStore((s) => s.polylineData);
  const layers = useEventStore((s) => s.layers);
  const viewportSender = useEventStore((s) => s.viewportSender);

  // Camera position state for occlusion checks
  const [cameraPos, setCameraPos] = useState(null);

  // Store viewer reference and configure scene
  useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer) return;

    setCesiumViewer(viewer);

    // Initial URL Camera Parsing
    const params = new URLSearchParams(window.location.search);
    const initLat = parseFloat(params.get("lat"));
    const initLon = parseFloat(params.get("lon"));
    const initZoom = parseFloat(params.get("zoom"));
    const initHeight = parseFloat(params.get("height"));

    if (!isNaN(initLat) && !isNaN(initLon)) {
      let finalHeight = 20000000;
      if (!isNaN(initHeight)) finalHeight = initHeight;
      else if (!isNaN(initZoom)) finalHeight = initZoom * 15000000;

      viewer.camera.setView({
        destination: Cartesian3.fromDegrees(initLon, initLat, finalHeight),
      });
    }

    // ── Photorealistic space environment ──
    // Pure space black background
    viewer.scene.backgroundColor = Color.BLACK;
    viewer.scene.globe.baseColor = Color.fromCssColorString("#030a12");

    // Atmosphere — the blue limb glow
    viewer.scene.globe.showGroundAtmosphere = true;
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.skyAtmosphere.hueShift = 0.02;       // Slightly warm blue
    viewer.scene.skyAtmosphere.saturationShift = 0.35;  // Rich saturated blue ring
    viewer.scene.skyAtmosphere.brightnessShift = 0.1;
    viewer.scene.skyAtmosphere.atmosphereLightIntensity = 15.0; // Bright limb
    viewer.scene.skyAtmosphere.atmosphereRayleighScaleHeight = 10000;
    viewer.scene.skyAtmosphere.atmosphereMieScaleHeight = 3200;

    // Sun — photorealistic day/night terminator lighting
    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.dynamicAtmosphereLighting = true;
    viewer.scene.globe.dynamicAtmosphereLightingFromSun = true;
    viewer.scene.globe.nightFadeOutDistance = 1.0e7; // City lights visible on night side
    viewer.scene.globe.nightFadeInDistance = 5.0e7;
    viewer.scene.sun.show = true;
    viewer.scene.sun.glowFactor = 3;
    viewer.scene.moon.show = true;

    // Star skybox — realistic stars in the void
    viewer.scene.skyBox.show = true;

    // Subtle depth fog
    viewer.scene.fog.enabled = true;
    viewer.scene.fog.density = 0.00005;
    viewer.scene.fog.minimumBrightness = 0.02;

    // High quality rendering
    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.scene.highDynamicRange = true;
    viewer.scene.fxaa = true;

    // Smooth camera
    viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
    viewer.scene.screenSpaceCameraController.minimumZoomDistance = 100;

    // Track camera moves for occlusion culling + viewport extraction
    const onCameraMove = () => {
      setCameraPos(viewer.camera.positionWC.clone());
    };

    // Extract viewport bbox and send to gateway on camera stop
    const onMoveEnd = () => {
      onCameraMove();

      try {
        const pos = viewer.camera.positionCartographic;
        updateUrlState({
          lat: CesiumMath.toDegrees(pos.latitude).toFixed(4),
          lon: CesiumMath.toDegrees(pos.longitude).toFixed(4),
          height: pos.height.toFixed(0),
          zoom: (pos.height / 15000000).toFixed(2),
        });
      } catch (e) {
        // Ignored
      }

      try {
        const rect = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
        if (rect && viewportSender) {
          viewportSender({
            lamin: CesiumMath.toDegrees(rect.south),
            lomin: CesiumMath.toDegrees(rect.west),
            lamax: CesiumMath.toDegrees(rect.north),
            lomax: CesiumMath.toDegrees(rect.east),
          });
        }
      } catch {
        // computeViewRectangle can fail in some edge cases
      }
    };

    viewer.camera.changed.addEventListener(onCameraMove);
    viewer.camera.moveEnd.addEventListener(onMoveEnd);
    // Set initial
    onCameraMove();

    return () => {
      viewer.camera.changed.removeEventListener(onCameraMove);
      viewer.camera.moveEnd.removeEventListener(onMoveEnd);
    };
  }, [setCesiumViewer, viewportSender]);

  const filteredEvents = getFilteredEvents();

  // Point entities — render all up to 2000, let WebGL depth testing handle spherical occlusion smoothly
  const visibleEvents = useMemo(() => {
    return filteredEvents
      .filter((e) => e.type !== "flights")
      .slice(-2000);
  }, [filteredEvents]);

  // Active flights 
  const visibleFlights = useMemo(() => {
    if (!layers.flights) return [];
    return activeFlights;
  }, [activeFlights, layers.flights]);

  const handleClick = useCallback(
    (event) => {
      if (event?.id?.entityData) {
        selectEvent(event.id.entityData);
      }
    },
    [selectEvent]
  );

  // Build polyline positions for cables
  const cableEntities = useMemo(() => {
    if (!layers.cables) return [];
    return (polylineData.cables || []).map((cable) => ({
      id: `cable-${cable.name}`,
      name: cable.name,
      color: cable.color,
      positions: Cartesian3.fromDegreesArray(
        cable.points.flatMap(([lon, lat]) => [lon, lat])
      ),
    }));
  }, [polylineData.cables, layers.cables]);

  // Pipeline polylines
  const pipelineEntities = useMemo(() => {
    if (!layers.pipelines) return [];
    return (polylineData.pipelines || []).map((pipe) => ({
      id: `pipe-${pipe.name}`,
      name: pipe.name,
      color: pipe.color,
      positions: Cartesian3.fromDegreesArray(
        pipe.points.flatMap(([lon, lat]) => [lon, lat])
      ),
    }));
  }, [polylineData.pipelines, layers.pipelines]);

  // Trade route polylines
  const tradeEntities = useMemo(() => {
    if (!layers.tradeRoutes) return [];
    return (polylineData.tradeRoutes || []).map((route) => ({
      id: `trade-${route.name}`,
      name: route.name,
      color: route.color,
      positions: Cartesian3.fromDegreesArray(
        route.points.flatMap(([lon, lat]) => [lon, lat])
      ),
    }));
  }, [polylineData.tradeRoutes, layers.tradeRoutes]);

  // Glowing geodesic arc entities from full arc geometry
  const flightArcEntities = useMemo(() => {
    if (!layers.flights) return [];
    return (polylineData.flightArcs || []).map((arcData) => {
      if (!arcData.arc || arcData.arc.length < 2) return null;
      // Convert arc points to elevated Cartesian3 — altitude exaggerated 10x for visual lift
      const positions = arcData.arc.map((pt) =>
        Cartesian3.fromDegrees(pt.lon, pt.lat, (pt.alt || 0) * 10)
      );
      return { id: arcData.id, positions, callsign: arcData.callsign, from: arcData.fromCity, to: arcData.toCity };
    }).filter(Boolean);
  }, [polylineData.flightArcs, layers.flights]);
  // Procedural Orbiting Moon
  // Mathematically calculates an orbit path around the Earth
  const moonPosition = useMemo(() => {
    return new CallbackProperty((time, result) => {
      // time is a JulianDate
      // 27.32 days for a full orbit. We speed it up slightly for visual effect.
      const days = time.dayNumber + time.secondsOfDay / 86400;
      const angle = (days * 2.5) % (Math.PI * 2); // Fast for dramatic effect

      const distance = 35000000; // 35,000km (Very close for visibility)
      // Calculate orbital plane (inclined slightly)
      const x = distance * Math.cos(angle);
      const y = distance * Math.sin(angle) * Math.cos(0.089); // ~5 degree incline
      const z = distance * Math.sin(angle) * Math.sin(0.089);

      return new Cartesian3(x, y, z);
    }, false);
  }, []);

  return (
    <Viewer

      ref={viewerRef}
      full
      timeline={false}
      animation={false}
      baseLayerPicker={false}
      geocoder={false}
      homeButton={false}
      sceneModePicker={false}
      navigationHelpButton={false}
      fullscreenButton={false}
      selectionIndicator={false}
      infoBox={false}
      scene3DOnly={true}
      requestRenderMode={true}
      maximumRenderTimeChange={0.1}
      onClick={handleClick}
      style={{ position: "absolute", inset: 0 }}
      baseLayer={new ImageryLayer(satelliteProvider)}
    >
      {/* ═══════════════ THE MOON ═══════════════ */}
      <Entity position={moonPosition} name="The Moon">
        <EllipsoidGraphics
          radii={new Cartesian3(1737400, 1737400, 1737400)}
          material={Color.fromCssColorString("#e5e7eb")} // Pale lunar gray
          maximumCone={Math.PI}
        />
      </Entity>

      {/* ═══════════════ THREAT ZONES ═══════════════ */}
      <Entity name="Eastern European Threat Zone" position={Cartesian3.fromDegrees(31.0, 48.0, 200000)}>
        <PolygonGraphics
          hierarchy={new PolygonHierarchy(Cartesian3.fromDegreesArray([
            22.0, 44.0,
            22.0, 52.0,
            40.0, 52.0,
            40.0, 44.0
          ]))}
          material={Color.fromCssColorString("#ef4444").withAlpha(0.15)}
          extrudedHeight={150000.0}
          outline={true}
          outlineColor={Color.fromCssColorString("#ef4444")}
        />
        <LabelGraphics
          text="EASTERN EUROPEAN THREAT ZONE"
          font="12px JetBrains Mono, monospace"
          fillColor={Color.fromCssColorString("#ef4444")}
          outlineColor={Color.BLACK}
          outlineWidth={2}
          style={LabelStyle.FILL_AND_OUTLINE}
          verticalOrigin={VerticalOrigin.BOTTOM}
          pixelOffset={new Cartesian2(0, -20)}
          scaleByDistance={new NearFarScalar(1e6, 1.0, 1e7, 0.0)}
        />
      </Entity>

      <Entity name="South China Sea Threshold Zone" position={Cartesian3.fromDegrees(115.0, 15.0, 50000)}>
        <PolygonGraphics
          hierarchy={new PolygonHierarchy(Cartesian3.fromDegreesArray([
            105.0, 5.0,
            105.0, 25.0,
            125.0, 25.0,
            125.0, 5.0
          ]))}
          material={Color.fromCssColorString("#f59e0b").withAlpha(0.15)}
          extrudedHeight={100000.0}
          outline={true}
          outlineColor={Color.fromCssColorString("#f59e0b")}
        />
        <LabelGraphics
          text="SOUTH CHINA SEA THRESHOLD ZONE"
          font="12px JetBrains Mono, monospace"
          fillColor={Color.fromCssColorString("#f59e0b")}
          outlineColor={Color.BLACK}
          outlineWidth={2}
          style={LabelStyle.FILL_AND_OUTLINE}
          verticalOrigin={VerticalOrigin.BOTTOM}
          pixelOffset={new Cartesian2(0, -20)}
          scaleByDistance={new NearFarScalar(1e6, 1.0, 1e7, 0.0)}
        />
      </Entity>

      {/* ═══════════════ SUBMARINE CABLES ═══════════════ */}
      {cableEntities.map((cable) => (
        <Entity key={cable.id} name={cable.name}>
          <PolylineGraphics
            positions={cable.positions}
            width={2}
            material={
              new PolylineGlowMaterialProperty({
                glowPower: 0.3,
                color: Color.fromCssColorString(cable.color).withAlpha(0.6),
              })
            }
            clampToGround={false}
          />
        </Entity>
      ))}

      {/* ═══════════════ PIPELINES ═══════════════ */}
      {pipelineEntities.map((pipe) => (
        <Entity key={pipe.id} name={pipe.name}>
          <PolylineGraphics
            positions={pipe.positions}
            width={2.5}
            material={
              new PolylineDashMaterialProperty({
                color: Color.fromCssColorString(pipe.color).withAlpha(0.7),
                dashLength: 16,
              })
            }
            clampToGround={false}
          />
        </Entity>
      ))}

      {/* ═══════════════ TRADE ROUTES ═══════════════ */}
      {tradeEntities.map((route) => (
        <Entity key={route.id} name={route.name}>
          <PolylineGraphics
            positions={route.positions}
            width={2}
            material={
              new PolylineDashMaterialProperty({
                color: Color.fromCssColorString(route.color).withAlpha(0.5),
                dashLength: 12,
                gapColor: Color.TRANSPARENT,
              })
            }
            clampToGround={false}
          />
        </Entity>
      ))}

      {/* ═══════════════ GEODESIC FLIGHT ARCS (glowing great-circle paths) ═══════════════ */}
      {flightArcEntities.map((arc) => (
        <Entity key={arc.id} name={`${arc.from} → ${arc.to}`}>
          <PolylineGraphics
            positions={arc.positions}
            width={3.0}
            material={
              new PolylineGlowMaterialProperty({
                glowPower: 0.5,
                taperPower: 0.1,
                color: Color.fromCssColorString("#38bdf8").withAlpha(0.9),
              })
            }
            clampToGround={false}
            arcType={0} /* ArcType.NONE — keep our pre-computed geodesic */
          />
        </Entity>
      ))}

      {/* ═══════════════ FLIGHT POSITIONS (animated dots) ═══════════════ */}
      {visibleFlights.map((flight) => {
        const isSelected = selectedEvent?.id === flight.id;
        const position = Cartesian3.fromDegrees(
          flight.lon,
          flight.lat,
          (flight.altitude || 10000) * 10 // match arc altitude exaggeration
        );

        return (
          <Entity
            key={flight.id}
            position={position}
            entityData={flight}
          >
            <BillboardGraphics
              image={getCachedSvg(
                isSelected ? "#ffffff" : "#06b6d4",
                isSelected ? 10 : 6,
                "flights"
              )}
              scale={isSelected ? 1.8 : 1.0}
              verticalOrigin={VerticalOrigin.CENTER}
              horizontalOrigin={HorizontalOrigin.CENTER}
              scaleByDistance={new NearFarScalar(1e3, 2.0, 1.5e7, 0.3)}
            />
            <LabelGraphics
              text={flight.metadata?.callsign || ""}
              font="10px JetBrains Mono, monospace"
              fillColor={Color.fromCssColorString("#06b6d4")}
              outlineColor={Color.BLACK}
              outlineWidth={2}
              style={LabelStyle.FILL_AND_OUTLINE}
              verticalOrigin={VerticalOrigin.BOTTOM}
              pixelOffset={new Cartesian2(0, -10)}
              scaleByDistance={new NearFarScalar(1e3, 1.0, 3e6, 0.0)}
            />
          </Entity>
        );
      })}

      {/* ═══════════════ POINT ENTITIES (all other types) ═══════════════ */}
      {visibleEvents.map((ev) => {
        const config = getEventConfig(ev.type);
        const isSelected = selectedEvent?.id === ev.id;
        const position = Cartesian3.fromDegrees(
          ev.lon,
          ev.lat,
          ev.altitude || 0
        );

        let label = "";
        if (ev.type === "aircraft")
          label = ev.metadata?.callsign || ev.metadata?.icao24 || "";
        else if (ev.type === "ship")
          label = ev.metadata?.vessel_name || ev.metadata?.mmsi || "";
        else if (ev.metadata?.name)
          label = ev.metadata.name;

        const billboardType = getBillboardType(ev.type);

        // Threat Scoring Engine Integration: Color based on risk_score
        let baseColor = isSelected ? "#ffffff" : config.color;
        let riskGrowth = 1.0;

        if (ev.risk_score > 60) {
          baseColor = "#ff3355"; // High Risk Red
          riskGrowth = 1.2;
        } else if (ev.risk_score > 30) {
          baseColor = "#ffaa00"; // Medium Risk Amber
          riskGrowth = 1.1;
        }

        return (
          <Entity
            key={ev.id}
            position={position}
            entityData={ev}
          >
            <BillboardGraphics
              image={getCachedSvg(
                baseColor,
                isSelected ? 14 : 8,
                billboardType
              )}
              scale={isSelected ? 1.5 : riskGrowth}
              verticalOrigin={VerticalOrigin.CENTER}
              horizontalOrigin={HorizontalOrigin.CENTER}
              scaleByDistance={new NearFarScalar(1e3, 1.5, 8e6, 0.4)}
            />
            {/* Uncertainty Halo (Risk-based impact zone) derived from model pressure */}
            {ev.risk_score > 60 && (
              <EllipseGraphics
                semiMajorAxis={ev.metadata?.impact_radius_km ? ev.metadata.impact_radius_km * 1000 : 500000}
                semiMinorAxis={ev.metadata?.impact_radius_km ? ev.metadata.impact_radius_km * 1000 : 500000}
                material={Color.fromCssColorString("#ff3355").withAlpha(0.1)}
                outline={true}
                outlineColor={Color.fromCssColorString("#ff3355").withAlpha(0.3)}
                outlineWidth={1}
                height={0}
              />
            )}
            {label && (
              <LabelGraphics
                text={label}
                font="10px JetBrains Mono, monospace"
                fillColor={Color.fromCssColorString(config.color)}
                outlineColor={Color.BLACK}
                outlineWidth={2}
                style={LabelStyle.FILL_AND_OUTLINE}
                verticalOrigin={VerticalOrigin.BOTTOM}
                pixelOffset={new Cartesian2(0, -14)}
                scaleByDistance={new NearFarScalar(1e3, 1.0, 5e6, 0.0)}
              />
            )}
          </Entity>
        );
      })}
    </Viewer>
  );
}
