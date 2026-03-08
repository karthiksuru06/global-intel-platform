import useEventStore from "../hooks/useEventStore";
import { Cartesian3 } from "cesium";

const REGIONS = [
  { id: "global", label: "Global", lon: 0, lat: 20, alt: 20000000 },
  { id: "americas", label: "Americas", lon: -90, lat: 20, alt: 12000000 },
  { id: "europe", label: "Europe", lon: 15, lat: 50, alt: 6000000 },
  { id: "mena", label: "MENA", lon: 40, lat: 28, alt: 7000000 },
  { id: "asia", label: "Asia", lon: 100, lat: 35, alt: 10000000 },
  { id: "africa", label: "Africa", lon: 20, lat: 0, alt: 9000000 },
  { id: "oceania", label: "Oceania", lon: 140, lat: -25, alt: 8000000 },
  { id: "latam", label: "Latin America", lon: -60, lat: -15, alt: 10000000 },
];

export default function RegionalPresets() {
  const activeRegion = useEventStore((s) => s.activeRegion);
  const setActiveRegion = useEventStore((s) => s.setActiveRegion);
  const cesiumViewer = useEventStore((s) => s.cesiumViewer);

  const handleRegionClick = (region) => {
    setActiveRegion(region.id);
    if (cesiumViewer) {
      cesiumViewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(region.lon, region.lat, region.alt),
        duration: 2.0,
      });
    }
  };

  return (
    <div className="flex items-center gap-1 px-1">
      {REGIONS.map((region) => (
        <button
          key={region.id}
          onClick={() => handleRegionClick(region)}
          className={`px-3.5 py-1.5 text-[11px] font-mono rounded-md transition-all min-h-[28px] ${activeRegion === region.id
              ? "bg-intel-cyan/15 text-intel-cyan border border-intel-cyan/25 shadow-sm"
              : "text-intel-muted hover:text-intel-text hover:bg-white/[0.05] border border-transparent"
            }`}
        >
          {region.label}
        </button>
      ))}
    </div>
  );
}
