import { useEffect, useState } from "react";
import { useAppStore } from "@geolibre/core";
import { cn } from "@geolibre/ui";
import { Bell, Bug } from "lucide-react";
import { formatSpeedKmh } from "../../lib/gps-tracking";

interface StatusMetricProps {
  label: string;
  value: string;
  className?: string;
}

function StatusMetric({ label, value, className }: StatusMetricProps) {
  return (
    <span className={cn("inline-flex shrink-0 items-baseline gap-1.5 px-1.5", className)}>
      <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
        {label}
      </span>
      <span className="font-mono text-[11px] font-medium tabular-nums text-foreground/85">
        {value}
      </span>
    </span>
  );
}

interface StatusBarProps {
  alertsLabel?: string;
  compact?: boolean;
  diagnosticsErrorCount: number;
  diagnosticsWarningCount: number;
  onOpenAlerts?: () => void;
  onOpenDiagnostics: () => void;
}

export function StatusBar({
  alertsLabel,
  compact = false,
  diagnosticsErrorCount,
  diagnosticsWarningCount,
  onOpenAlerts,
  onOpenDiagnostics,
}: StatusBarProps) {
  const pointerCoords = useAppStore((s) => s.pointerCoords);
  const gpsStatus = useAppStore((s) => s.gpsStatus);
  const mapView = useAppStore((s) => s.mapView);
  const diagnosticsCount = diagnosticsErrorCount + diagnosticsWarningCount;

  // Re-render every few seconds while a GPS fix is shown so its age stays live.
  const [, setGpsTick] = useState(0);
  const gpsActive = gpsStatus != null;
  useEffect(() => {
    if (!gpsActive) return;
    const id = setInterval(() => setGpsTick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, [gpsActive]);

  const gpsAgeS = gpsStatus
    ? Math.max(0, Math.round((Date.now() - gpsStatus.timestamp) / 1000))
    : 0;
  const gpsCoords = gpsStatus ? `${gpsStatus.lng.toFixed(5)}, ${gpsStatus.lat.toFixed(5)}` : null;
  // Compact status bars get coordinates only; the full form matches the GPS
  // dialog's readout formatting (space before the units).
  const gpsText = gpsStatus
    ? compact
      ? gpsCoords
      : `${gpsCoords} ±${Math.round(gpsStatus.accuracy)} m` +
        (gpsStatus.speed != null ? ` ${formatSpeedKmh(gpsStatus.speed)} km/h` : "") +
        (gpsAgeS >= 10 ? ` (${gpsAgeS}s)` : "")
    : null;

  const coordText = pointerCoords
    ? `${pointerCoords[0].toFixed(5)}, ${pointerCoords[1].toFixed(5)}`
    : "—";

  const bboxText = mapView.bbox ? mapView.bbox.map((n) => n.toFixed(4)).join(", ") : "—";

  return (
    <footer
      className={cn(
        "flex min-h-9 shrink-0 items-center gap-2 overflow-y-hidden whitespace-nowrap border-t border-border/80 bg-background/95 px-3 py-1 shadow-[0_-1px_10px_rgb(15_23_42/0.05)] backdrop-blur-sm",
        compact ? "overflow-hidden" : "overflow-x-auto",
      )}
    >
      <div className="flex min-w-0 items-center gap-0.5 rounded-md border border-border/70 bg-muted/45 py-0.5 shadow-sm">
        <StatusMetric label={compact ? "XY" : "Coordinates"} value={coordText} />
        {gpsText && <StatusMetric label="GPS" value={gpsText} />}
        <StatusMetric label="Zoom" value={mapView.zoom.toFixed(2)} />
        <StatusMetric label="Bearing" value={`${mapView.bearing.toFixed(1)}°`} />
        <StatusMetric label="Pitch" value={`${mapView.pitch.toFixed(1)}°`} />
      </div>
      {compact ? null : (
        <StatusMetric className="min-w-0 flex-1 truncate" label="Map extent" value={bboxText} />
      )}
      {onOpenAlerts && alertsLabel ? (
        <button
          type="button"
          className="ms-auto inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-500/20 dark:text-amber-200"
          onClick={onOpenAlerts}
        >
          <Bell aria-hidden="true" className="h-3.5 w-3.5" />
          {alertsLabel}
        </button>
      ) : null}
      <button
        type="button"
        className={cn(
          "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-transparent px-2 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground",
          !onOpenAlerts && "ms-auto",
          diagnosticsErrorCount > 0 && "text-red-700 dark:text-red-300",
          diagnosticsErrorCount === 0 &&
            diagnosticsWarningCount > 0 &&
            "text-amber-700 dark:text-amber-300",
        )}
        onClick={onOpenDiagnostics}
      >
        <Bug className="h-3.5 w-3.5" />
        {compact ? "Diag" : "Diagnostics"}
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] leading-none tabular-nums text-foreground/80">
          {diagnosticsCount}
        </span>
      </button>
    </footer>
  );
}
