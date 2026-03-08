import { X, MapPin, Clock, AlertTriangle, ExternalLink } from "lucide-react";
import useEventStore from "../hooks/useEventStore";
import { getEventConfig } from "../utils/eventIcons";
import {
  formatCoordinates,
  formatTimestamp,
  formatSeverity,
  formatEventType,
} from "../utils/formatters";

export default function EventDetail() {
  const selectedEvent = useEventStore((s) => s.selectedEvent);
  const clearSelection = useEventStore((s) => s.clearSelection);

  if (!selectedEvent) return null;

  const config = getEventConfig(selectedEvent.type);
  const severity = formatSeverity(selectedEvent.severity || 1);
  const Icon = config.icon || MapPin;

  return (
    <div className="glass-panel p-4 w-72 animate-fade-in">
      {/* Header with icon */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: config.color + "15" }}
          >
            <Icon className="w-4 h-4" style={{ color: config.color }} />
          </div>
          <div>
            <span className="text-xs font-mono font-semibold text-intel-text block leading-none">
              {selectedEvent.metadata?.name || formatEventType(selectedEvent.type)}
            </span>
            <span
              className="text-[9px] font-mono mt-0.5 block"
              style={{ color: config.color }}
            >
              {config.label}
            </span>
          </div>
        </div>
        <button
          onClick={clearSelection}
          className="p-1 hover:bg-white/10 rounded transition"
        >
          <X className="w-3.5 h-3.5 text-intel-muted" />
        </button>
      </div>

      {/* Info rows */}
      <div className="space-y-2.5 text-xs font-mono">
        {/* Coordinates */}
        <div className="flex items-start gap-2">
          <MapPin className="w-3.5 h-3.5 text-intel-muted mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-intel-text">
              {formatCoordinates(selectedEvent.lat, selectedEvent.lon)}
            </div>
            {selectedEvent.altitude > 0 && (
              <div className="text-intel-muted">
                Alt: {selectedEvent.altitude.toFixed(0)}m ({Math.round(selectedEvent.altitude * 3.281)}ft)
              </div>
            )}
          </div>
        </div>

        {/* Timestamp */}
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-intel-muted flex-shrink-0" />
          <div>
            <div className="text-intel-text">
              {formatTimestamp(selectedEvent.timestamp)}
            </div>
          </div>
        </div>

        {/* Severity */}
        {selectedEvent.severity && (
          <div className="flex items-center gap-2">
            <AlertTriangle
              className="w-3.5 h-3.5 flex-shrink-0"
              style={{ color: severity.color }}
            />
            <span
              className="px-2 py-0.5 rounded text-[10px] font-semibold"
              style={{
                color: severity.color,
                backgroundColor: severity.color + "20",
              }}
            >
              {severity.label} ({selectedEvent.severity}/5)
            </span>
          </div>
        )}

        {/* Source badge */}
        <div className="text-intel-muted flex items-center gap-2">
          <span>Source:</span>
          <span className="text-intel-text bg-white/[0.04] px-1.5 py-0.5 rounded text-[10px]">
            {selectedEvent.source}
          </span>
        </div>

        {/* Metadata */}
        {selectedEvent.metadata &&
          Object.keys(selectedEvent.metadata).length > 0 && (
            <div className="pt-2 border-t border-intel-border">
              <div className="text-[10px] text-intel-muted uppercase tracking-wider mb-1.5">
                Intelligence Data
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {Object.entries(selectedEvent.metadata).map(([key, val]) => {
                  if (key === "name") return null; // already shown in header
                  return (
                    <div key={key} className="flex justify-between gap-2">
                      <span className="text-intel-muted truncate text-[10px]">
                        {key.replace(/_/g, " ")}
                      </span>
                      <span className="text-intel-text text-right truncate max-w-[150px] text-[10px]">
                        {typeof val === "object" ? JSON.stringify(val) : String(val)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        {/* ID */}
        <div className="pt-2 border-t border-intel-border text-[9px] text-intel-muted truncate">
          ID: {selectedEvent.id}
        </div>
      </div>
    </div>
  );
}
