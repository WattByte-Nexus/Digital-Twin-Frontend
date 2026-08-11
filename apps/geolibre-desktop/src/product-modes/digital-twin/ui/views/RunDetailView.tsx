import {
  Badge,
  Button,
  Card,
  ScrollArea,
} from "@geolibre/ui";
import {
  ArrowLeft,
  Flame,
  MapPin,
  Timer,
  Waypoints,
} from "lucide-react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { type ReactNode, type RefObject, useEffect } from "react";
import {
  digitalTwinRunStatusLabel,
  type DigitalTwinRunRecord,
} from "../../../../lib/digital-twin-runs";
import { focusMapOnIgnitions } from "../run-map-focus";
import { RunDetailTabs } from "./RunDetailTabs";
import { RunPlaybackWorkspace } from "./RunPlaybackWorkspace";

interface RunDetailViewProps {
  apiUrl: string;
  mapControllerRef: RefObject<{ getMap: () => MapLibreMap | null } | null>;
  mapSlot: ReactNode;
  onBack: () => void;
  run: DigitalTwinRunRecord;
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

export function RunDetailView({ apiUrl, mapControllerRef, mapSlot, onBack, run }: RunDetailViewProps) {
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
        focusMapOnIgnitions(map, run.ignitionPoints);
        focusedMap = map;
      }
      if (!map.isStyleLoaded()) {
        frame = window.requestAnimationFrame(render);
        return;
      }
      const data = ignitionFeatures(run);
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
  }, [mapControllerRef, run]);

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
                {run.id}
              </h1>
              <RunStatusBadge status={run.status} />
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {run.scenarioId ?? `${run.triggerKind} trigger`} · {run.regionName}
            </p>
          </div>
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-5 lg:p-7">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Run summary">
            <SummaryCard icon={MapPin} label="Region" value={run.regionName} />
            <SummaryCard
              icon={Timer}
              label="Simulation horizon"
              value={run.durationHours === null ? "Not reported" : `${run.durationHours} h`}
            />
            <SummaryCard
              icon={Flame}
              label="Ignition points"
              value={String(run.ignitionPoints.length)}
            />
            <SummaryCard
              icon={Waypoints}
              label="Completed snapshots"
              value={`${run.completedTicks}${run.expectedTicks === null ? "" : ` / ${run.expectedTicks}`}`}
            />
          </section>

          <RunPlaybackWorkspace
            apiUrl={apiUrl}
            mapControllerRef={mapControllerRef}
            mapSlot={mapSlot}
            run={run}
          />

          <RunDetailTabs apiUrl={apiUrl} key={`${apiUrl}:${run.id}`} runId={run.id} />
        </div>
      </ScrollArea>
    </div>
  );
}
