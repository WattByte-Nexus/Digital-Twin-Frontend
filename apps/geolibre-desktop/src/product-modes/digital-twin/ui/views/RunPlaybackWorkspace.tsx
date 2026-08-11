import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Skeleton,
  Slider,
  type ChartConfig,
} from "@geolibre/ui";
import {
  AlertCircle,
  Flame,
  MapPin,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RefreshCw,
} from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import type { DigitalTwinRunRecord as CatalogRunRecord } from "../../../../lib/digital-twin-runs";
import {
  loadRunTab,
  type RunTabData,
} from "../digital-twin-run-api";
import { focusMapOnIgnitions } from "../run-map-focus";
import { removeRunPlaybackFrame, renderRunPlaybackFrame } from "../run-playback-map";

interface RunPlaybackWorkspaceProps {
  apiUrl: string;
  mapControllerRef: RefObject<{ getMap: () => MapLibreMap | null } | null>;
  mapSlot: ReactNode;
  run: CatalogRunRecord;
}

type BehaviorData = Extract<RunTabData, { kind: "behavior" }>;
type BehaviorState =
  | { status: "loading" }
  | { status: "ready"; data: BehaviorData }
  | { status: "error"; message: string };

const AREA_CONFIG = {
  affectedAreaHectares: { label: "Affected area", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

const BEHAVIOR_CONFIG = {
  activeCellCount: { label: "Active fire cells", color: "hsl(var(--destructive))" },
} satisfies ChartConfig;

function PlaybackCharts({
  data,
  selectedTick,
}: {
  data: BehaviorData;
  selectedTick: number | null;
}) {
  const samples = useMemo(() => {
    const resolution = Number(data.run.grid_geometry.resolution_m);
    const squareMetersPerCell = Number.isFinite(resolution) && resolution > 0 ? resolution ** 2 : 0;
    return data.samples.map((sample) => ({
      ...sample,
      affectedAreaHectares: (sample.activeCellCount * squareMetersPerCell) / 10_000,
    }));
  }, [data]);

  if (samples.length === 0) {
    return (
      <Card className="px-5 py-8 text-center text-sm text-muted-foreground">
        Graphs will appear when the Engine publishes the first durable tick.
      </Card>
    );
  }

  return (
    <>
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-sm">Affected area over time</CardTitle>
          <CardDescription>Hectares derived from the persisted grid</CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          <ChartContainer className="h-[190px] w-full" config={AREA_CONFIG}>
            <AreaChart data={samples} margin={{ left: 4, right: 12, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="tick" tickLine={false} />
              <YAxis axisLine={false} tickLine={false} width={52} />
              <ChartTooltip content={<ChartTooltipContent />} />
              {selectedTick === null ? null : <ReferenceLine stroke="var(--border)" x={selectedTick} />}
              <Area
                dataKey="affectedAreaHectares"
                fill="var(--color-affectedAreaHectares)"
                fillOpacity={0.18}
                stroke="var(--color-affectedAreaHectares)"
                strokeWidth={2}
                type="monotone"
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-sm">Active fire cells</CardTitle>
          <CardDescription>Recorded at each immutable simulation tick</CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          <ChartContainer className="h-[190px] w-full" config={BEHAVIOR_CONFIG}>
            <LineChart data={samples} margin={{ left: 4, right: 12, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="tick" tickLine={false} />
              <YAxis axisLine={false} tickLine={false} width={48} />
              <ChartTooltip content={<ChartTooltipContent />} />
              {selectedTick === null ? null : <ReferenceLine stroke="var(--border)" x={selectedTick} />}
              <Line
                dataKey="activeCellCount"
                dot={false}
                stroke="var(--color-activeCellCount)"
                strokeWidth={2}
                type="monotone"
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </>
  );
}

export function RunPlaybackWorkspace({
  apiUrl,
  mapControllerRef,
  mapSlot,
  run,
}: RunPlaybackWorkspaceProps) {
  const [behavior, setBehavior] = useState<BehaviorState>({ status: "loading" });
  const [mapExpanded, setMapExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [sampleIndex, setSampleIndex] = useState(0);
  const playbackMapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setBehavior({ status: "loading" });
    void loadRunTab(apiUrl, run.id, "behavior", { signal: controller.signal }).then(
      (data) => {
        if (data.kind !== "behavior") return;
        setBehavior({ status: "ready", data });
        setSampleIndex(Math.max(0, data.samples.length - 1));
      },
      (cause: unknown) => {
        if (controller.signal.aborted) return;
        setBehavior({
          status: "error",
          message: cause instanceof Error ? cause.message : "Unexpected Digital Twin API error.",
        });
      },
    );
    return () => controller.abort();
  }, [apiUrl, reloadToken, run.id]);

  const sampleCount = behavior.status === "ready" ? behavior.data.samples.length : 0;
  const selectedSample = behavior.status === "ready" ? behavior.data.samples[sampleIndex] : undefined;

  useEffect(() => {
    if (!selectedSample) return;
    let frame = 0;
    let attachedMap: MapLibreMap | null = null;
    let stopped = false;

    const render = () => {
      if (stopped) return;
      const map = mapControllerRef.current?.getMap() ?? null;
      if (!map || !map.isStyleLoaded()) {
        frame = window.requestAnimationFrame(render);
        return;
      }
      if (attachedMap !== map) {
        attachedMap?.off("style.load", render);
        attachedMap = map;
        map.on("style.load", render);
      }
      playbackMapRef.current = map;
      const styles = window.getComputedStyle(document.documentElement);
      renderRunPlaybackFrame(map, selectedSample.result, {
        result: `hsl(${styles.getPropertyValue("--destructive").trim()})`,
      });
    };

    render();
    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      attachedMap?.off("style.load", render);
    };
  }, [mapControllerRef, selectedSample]);

  useEffect(
    () => () => {
      if (playbackMapRef.current) removeRunPlaybackFrame(playbackMapRef.current);
      playbackMapRef.current = null;
    },
    [run.id],
  );

  useEffect(() => {
    if (!playing || sampleCount < 2) return;
    const interval = window.setInterval(() => {
      setSampleIndex((current) => {
        if (current >= sampleCount - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 650);
    return () => window.clearInterval(interval);
  }, [playing, sampleCount]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const map = mapControllerRef.current?.getMap();
      if (!map) return;
      map.resize();
      focusMapOnIgnitions(map, run.ignitionPoints);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mapControllerRef, mapExpanded, run.ignitionPoints]);

  const charts =
    behavior.status === "ready" ? (
      <PlaybackCharts data={behavior.data} selectedTick={selectedSample?.tick ?? null} />
    ) : behavior.status === "error" ? (
      <Card className="items-center gap-3 px-5 py-8 text-center">
        <AlertCircle aria-hidden="true" className="size-6 text-destructive" />
        <p className="font-medium">Run graphs could not be loaded.</p>
        <p className="text-sm text-muted-foreground">{behavior.message}</p>
        <Button onClick={() => setReloadToken((token) => token + 1)} variant="outline">
          <RefreshCw aria-hidden="true" /> Retry
        </Button>
      </Card>
    ) : (
      <>
        <Card className="space-y-3 px-4 py-4"><Skeleton className="h-5 w-40" /><Skeleton className="h-[190px] w-full" /></Card>
        <Card className="space-y-3 px-4 py-4"><Skeleton className="h-5 w-36" /><Skeleton className="h-[190px] w-full" /></Card>
      </>
    );

  return (
    <section
      aria-label="Run playback and visual analysis"
      className={`grid gap-4 ${mapExpanded ? "lg:grid-cols-1" : "lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.8fr)]"}`}
    >
      <div className="grid min-w-0 gap-3">
        <Card className={`relative gap-0 overflow-hidden bg-background py-0 ${mapExpanded ? "min-h-[70vh]" : "min-h-[500px]"}`}>
          <div className="absolute inset-0">{mapSlot}</div>
          <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
            <Badge variant="secondary"><MapPin aria-hidden="true" /> {run.regionName}</Badge>
            <Badge variant="secondary"><Flame aria-hidden="true" /> {run.ignitionPoints.length} ignition points</Badge>
          </div>
          <Button
            aria-label={mapExpanded ? "Restore map size" : "Expand map"}
            className="absolute right-3 top-3 z-20 shadow-md"
            onClick={() => setMapExpanded((expanded) => !expanded)}
            size="icon"
            title={mapExpanded ? "Restore map size" : "Expand map"}
            variant="secondary"
          >
            {mapExpanded ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
          </Button>
        </Card>

        <Card
          aria-label="Simulation timeline"
          className="flex-row items-center gap-3 px-3 py-2"
        >
          <Button
            aria-label={playing ? "Pause playback" : "Play playback"}
            disabled={sampleCount < 2}
            onClick={() => {
              if (!playing && sampleIndex >= sampleCount - 1) setSampleIndex(0);
              setPlaying((current) => !current);
            }}
            size="icon"
            variant="secondary"
          >
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </Button>
          <Slider
            aria-label="Simulation playback tick"
            className="min-w-0 flex-1"
            disabled={sampleCount < 2}
            max={Math.max(0, sampleCount - 1)}
            onValueChange={([value]) => {
              setPlaying(false);
              setSampleIndex(value ?? 0);
            }}
            step={1}
            value={[Math.min(sampleIndex, Math.max(0, sampleCount - 1))]}
          />
          <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
            {selectedSample ? `Tick ${selectedSample.tick}` : "No ticks"}
          </span>
        </Card>
      </div>

      <div className={`grid gap-4 ${mapExpanded ? "lg:grid-cols-2" : "grid-cols-1"}`}>
        {charts}
      </div>
    </section>
  );
}
