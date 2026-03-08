import { useMemo, useState } from "react";
import {
  Radio, MapPin, ChevronRight, Filter,
} from "lucide-react";
import useEventStore from "../hooks/useEventStore";
import { getEventConfig } from "../utils/eventIcons";
import { formatTimestamp, formatCoordinates, formatSeverity } from "../utils/formatters";
import { Cartesian3 } from "cesium";

export default function EventFeed() {
  const eventList = useEventStore((s) => s.eventList);
  const selectEvent = useEventStore((s) => s.selectEvent);
  const cesiumViewer = useEventStore((s) => s.cesiumViewer);
  const activeFlights = useEventStore((s) => s.activeFlights);
  const [typeFilter, setTypeFilter] = useState("all");

  // Combine events + active flights, sorted by recency
  const allEvents = useMemo(() => {
    const combined = [...eventList, ...activeFlights];
    return combined.slice(-80).reverse();
  }, [eventList, activeFlights]);

  const filteredEvents = useMemo(() => {
    if (typeFilter === "all") return allEvents;
    return allEvents.filter((e) => e.type === typeFilter);
  }, [allEvents, typeFilter]);

  const recentEvents = filteredEvents.slice(0, 60);

  // Get unique types for filter
  const eventTypes = useMemo(() => {
    const types = new Set(allEvents.map((e) => e.type));
    return Array.from(types);
  }, [allEvents]);

  const handleClick = (ev) => {
    selectEvent(ev);
    if (cesiumViewer) {
      cesiumViewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(ev.lon, ev.lat, 500000),
        duration: 1.5,
      });
    }
  };

  return (
    <div className="glass-panel w-72 max-h-[calc(100vh-200px)] flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-intel-border/30 flex-shrink-0">
        <div className="flex items-center gap-2 text-[10px] font-mono text-intel-cyan uppercase tracking-widest">
          <Radio className="w-3.5 h-3.5" />
          <span>Live Feed</span>
        </div>
        <div className="flex items-center gap-1">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-white/[0.04] border border-intel-border/30 rounded text-[9px] font-mono text-intel-muted px-1.5 py-0.5 focus:outline-none"
          >
            <option value="all">All Types</option>
            {eventTypes.map((t) => (
              <option key={t} value={t}>
                {getEventConfig(t).label}
              </option>
            ))}
          </select>
          <span className="text-[9px] font-mono text-intel-muted bg-white/[0.04] px-2 py-0.5 rounded-md">
            {recentEvents.length}
          </span>
        </div>
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {recentEvents.length === 0 ? (
          <div className="text-center py-10">
            <Radio className="w-6 h-6 text-intel-border mx-auto mb-2" />
            <p className="text-[10px] text-intel-muted">Waiting for events...</p>
          </div>
        ) : (
          recentEvents.map((ev) => {
            const config = getEventConfig(ev.type);
            const Icon = config.icon || MapPin;
            const severity = formatSeverity(ev.severity || 1);
            const name = ev.metadata?.name || ev.metadata?.callsign || ev.metadata?.vessel_name || config.label;

            return (
              <button
                key={ev.id}
                onClick={() => handleClick(ev)}
                className="w-full text-left p-2 rounded-lg hover:bg-white/[0.04] transition-all group"
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: config.color + "12" }}
                  >
                    <Icon
                      className="w-3.5 h-3.5"
                      style={{ color: config.color }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-intel-text truncate">
                        {name}
                      </span>
                      {ev.severity && ev.severity >= 3 && (
                        <span
                          className="text-[7px] font-mono px-1 py-0.5 rounded-sm flex-shrink-0"
                          style={{
                            color: severity.color,
                            backgroundColor: severity.color + "18",
                          }}
                        >
                          {severity.label}
                        </span>
                      )}
                    </div>
                    <div className="text-[8px] font-mono text-intel-muted truncate mt-0.5">
                      {formatCoordinates(ev.lat, ev.lon)}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className="text-[7px] font-mono px-1 py-0.5 rounded"
                        style={{ color: config.color, backgroundColor: config.color + "10" }}
                      >
                        {config.label}
                      </span>
                      <span className="text-[8px] font-mono text-intel-muted/50">
                        {formatTimestamp(ev.timestamp)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-3 h-3 text-intel-muted/20 group-hover:text-intel-muted/50 transition mt-2 flex-shrink-0" />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
