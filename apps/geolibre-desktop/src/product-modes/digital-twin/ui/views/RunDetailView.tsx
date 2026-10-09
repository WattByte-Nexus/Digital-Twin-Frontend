import {
  Badge,
  Button,
  Card,
  ScrollArea,
} from "@geolibre/ui";
import {
  ArrowLeft,
  ChartNoAxesColumnIncreasing,
  Flame,
  MapPin,
  Timer,
  Waypoints,
} from "lucide-react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { type ReactNode, type RefObject, useEffect, useEffectEvent, useState } from "react";
import {
  digitalTwinRunStatusLabel,
  isDigitalTwinRunActive,
  type DigitalTwinRunRecord,
} from "../../../../lib/digital-twin-runs";
import { cancelDigitalTwinRun, watchDigitalTwinRun, type DigitalTwinRunConnection } from "../../../../lib/digital-twin-run-lifecycle";
import { focusMapOnIgnitions } from "../run-map-focus";
import { RunDetailTabs } from "./RunDetailTabs";
import { RunPlaybackWorkspace } from "./RunPlaybackWorkspace";

interface RunDetailViewProps {
  apiUrl: string;
  mapControllerRef: RefObject<{ getMap: () => MapLibreMap | null } | null>;
  mapSlot: ReactNode;
  onBack: () => void;
  run: DigitalTwinRunRecord;
  canCancel?: boolean;
}

const IGNITION_SOURCE_ID = "digital-twin-run-ignition-points";
const IGNITION_LAYER_ID = "digital-twin-run-ignition-points-circle";

function RunStatusBadge({ status }: Pick<DigitalTwinRunRecord, "status">) {
  const variant =
    status === "FAILED"
      ? "destructive"
      : status === "COMPLETED"
        ? "outline"
        : status === "QUEUED" || status === "CANCELLED"
          ? "secondary"
          : "default";
  return <Badge variant={variant}>{digitalTwinRunStatusLabel(status)}</Badge>;
}

function ignitionFeatures(run: DigitalTwinRunRecord): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: run.ignitionPoints.map((point) => ({
      type: "Feature",
      properties: { id: point.id },
      geometry: { type: "Point", coordinates: [point.longitude, point.latitude] },
    })),
  };
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
}) {
  return (
    <Card className="gap-3 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
      </div>
      <strong className="text-xl font-semibold tracking-tight text-foreground">{value}</strong>
    </Card>
  );
}

function formatBurnedArea(value: number | null): string {
  return value === null
    ? "Not available"
    : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ha`;
}

export function RunDetailView({ apiUrl, mapControllerRef, mapSlot, onBack, run, canCancel = false }: RunDetailViewProps) {
  const [liveRun, setLiveRun] = useState(run);

  const [connection, setConnection] = useState<DigitalTwinRunConnection>("connecting");
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [lastSuccess, setLastSuccess] = useState<Date | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const currentRun = useEffectEvent(() => liveRun);
  useEffect(() => {
    const controller = new AbortController();
    void watchDigitalTwinRun(apiUrl, currentRun(), {
      signal: controller.signal,
      onRun: setLiveRun,
      onConnection: (state, error) => { setConnection(state); setUpdateError(error?.message ?? null); },
      onSuccess: setLastSuccess,
    });
    const recover = () => setRevision((current) => current + 1);
    window.addEventListener("online", recover);
    return () => { controller.abort(); window.removeEventListener("online", recover); };
  }, [apiUrl, run.id, run.regionId, run.regionName, revision]);
  const cancel = async () => {
    setCancelling(true); setCancelError(null);
    try {
      const updated = await cancelDigitalTwinRun(apiUrl, liveRun.id, { regionNames: new Map([[liveRun.regionId, liveRun.regionName]]) });
      setLiveRun((current) => isDigitalTwinRunActive(updated.status) ? { ...updated, completedTicks: Math.max(current.completedTicks, updated.completedTicks), expectedTicks: current.expectedTicks ?? updated.expectedTicks } : updated); setRevision((current) => current + 1);
    } catch (cause) { setCancelError(cause instanceof Error ? cause.message : "Cancellation failed."); }
    finally { setCancelling(false); }
  };

  useEffect(() => {
    let frame = 0;
    let attachedMap: MapLibreMap | null = null;
    let focusedMap: MapLibreMap | null = null;
    let stopped = false;

    const removeLayer = (map: MapLibreMap) => {
      if (map.getLayer(IGNITION_LAYER_ID)) map.removeLayer(IGNITION_LAYER_ID);
      if (map.getSource(IGNITION_SOURCE_ID)) map.removeSource(IGNITION_SOURCE_ID);
    };
    const render = () => {
      if (stopped) return;
      const map = mapControllerRef.current?.getMap() ?? null;
      if (!map) {
        frame = window.requestAnimationFrame(render);
        return;
      }
      if (attachedMap !== map) {
        if (attachedMap) attachedMap.off("style.load", render);
        attachedMap = map;
        map.on("style.load", render);
      }
      if (focusedMap !== map) {
        map.resize();
      focusMapOnIgnitions(map, liveRun.ignitionPoints);
        focusedMap = map;
      }
      if (!map.isStyleLoaded()) {
        frame = window.requestAnimationFrame(render);
        return;
      }
      const data = ignitionFeatures(liveRun);
      const source = map.getSource(IGNITION_SOURCE_ID) as GeoJSONSource | undefined;
      if (source) source.setData(data);
      else map.addSource(IGNITION_SOURCE_ID, { type: "geojson", data });

      const destructive = window
        .getComputedStyle(document.documentElement)
        .getPropertyValue("--destructive")
        .trim();
      const background = window
        .getComputedStyle(document.documentElement)
        .getPropertyValue("--background")
        .trim();
      if (!map.getLayer(IGNITION_LAYER_ID)) {
        map.addLayer({
          id: IGNITION_LAYER_ID,
          type: "circle",
          source: IGNITION_SOURCE_ID,
          paint: {
            "circle-color": `hsl(${destructive})`,
            "circle-radius": 8,
            "circle-stroke-color": `hsl(${background})`,
            "circle-stroke-width": 3,
          },
        });
      }
    };

    render();
    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      if (attachedMap) {
        attachedMap.off("style.load", render);
        removeLayer(attachedMap);
      }
    };
  }, [liveRun, mapControllerRef]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-4 px-5 pb-2 pt-5 lg:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <Button aria-label="Back to runs" onClick={onBack} size="icon" variant="ghost">
            <ArrowLeft aria-hidden="true" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-mono text-xl font-semibold tracking-tight text-foreground">
                {liveRun.id}
              </h1>
              <RunStatusBadge status={liveRun.status} />
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {liveRun.scenarioName ?? `${liveRun.triggerKind} trigger`} · {liveRun.regionName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setRevision((current) => current + 1)}>Refresh status</Button>
          {isDigitalTwinRunActive(liveRun.status) ? <Button variant="destructive" disabled={!canCancel || cancelling || liveRun.status === "CANCEL_REQUESTED"} onClick={() => { void cancel(); }}>{cancelling ? "Requesting cancellation…" : liveRun.status === "CANCEL_REQUESTED" ? "Cancellation requested" : "Cancel run"}</Button> : null}
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-5 lg:p-7">
          <div className="space-y-1 rounded-md border p-3 text-sm" role="status">
            <p>{connection === "live" ? "Receiving live Engine updates" : connection === "settled" ? "Terminal state verified" : connection === "disconnected" ? "Disconnected · displayed results may be stale" : "Connecting to Engine…"}</p>
            <p className="text-xs text-muted-foreground">{lastSuccess ? `Last successful update: ${lastSuccess.toLocaleTimeString()}` : "No successful status update yet."}</p>
            {updateError ? <p className="text-destructive">{updateError}</p> : null}
            {cancelError ? <p role="alert" className="text-destructive">{cancelError}</p> : null}
            {liveRun.failureMessage ? <p className="text-destructive">{liveRun.failureMessage}</p> : null}
          </div>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Run summary">
            <SummaryCard icon={MapPin} label="Region" value={liveRun.regionName} />
            <SummaryCard
              icon={Timer}
              label="Simulation horizon"
              value={liveRun.durationHours === null ? "Not reported" : `${liveRun.durationHours} h`}
            />
            <SummaryCard
              icon={Flame}
              label="Ignition points"
              value={String(liveRun.ignitionPoints.length)}
            />
            <SummaryCard
              icon={ChartNoAxesColumnIncreasing}
              label="Area consumed"
              value={formatBurnedArea(liveRun.burnedAreaHectares)}
            />
            <SummaryCard
              icon={Waypoints}
              label="Completed compute ticks"
              value={`${liveRun.completedTicks}${liveRun.expectedTicks === null ? "" : ` / ${liveRun.expectedTicks}`}`}
            />
          </section>

          <RunPlaybackWorkspace
            apiUrl={apiUrl}
            mapControllerRef={mapControllerRef}
            mapSlot={mapSlot}
            run={liveRun}
          />

          <RunDetailTabs
            completedTicks={liveRun.completedTicks}
            apiUrl={apiUrl}
            key={`${apiUrl}:${liveRun.id}`}
            refreshKey={`${liveRun.status}:${liveRun.completedTicks}:${liveRun.resultAvailable}`}
            runId={liveRun.id}
          />
        </div>
      </ScrollArea>
    </div>
  );
}
