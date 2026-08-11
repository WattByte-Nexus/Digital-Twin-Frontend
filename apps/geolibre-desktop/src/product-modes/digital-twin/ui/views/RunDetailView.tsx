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
  ScrollArea,
  Separator,
  Slider,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type ChartConfig,
} from "@geolibre/ui";
import {
  ArrowLeft,
  Download,
  Flame,
  Gauge,
  MapPin,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Timer,
  Trees,
  TriangleAlert,
  Wind,
} from "lucide-react";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import {
  analyticsForRun,
  burnedAreaPerimeter,
  formatSimulationTime,
  formatWindDirection,
  ignitionBounds,
  ignitionCenter,
  ignitionPointFeatures,
  initialRunSampleIndex,
  type SimulationRun,
} from "../simulation-flow";

interface RunDetailViewProps {
  mapControllerRef: RefObject<{ getMap: () => MapLibreMap | null } | null>;
  mapSlot: ReactNode;
  onBack: () => void;
  run: SimulationRun;
}

const PERIMETER_SOURCE_ID = "digital-twin-run-perimeter";
const PERIMETER_FILL_LAYER_ID = "digital-twin-run-perimeter-fill";
const PERIMETER_LINE_LAYER_ID = "digital-twin-run-perimeter-line";
const IGNITION_SOURCE_ID = "digital-twin-run-ignition-points";
const IGNITION_LAYER_ID = "digital-twin-run-ignition-points-circle";

const AREA_CHART_CONFIG = {
  burnedArea: { label: "Burned area", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

const BEHAVIOR_CHART_CONFIG = {
  spreadRate: { label: "Spread rate", color: "hsl(var(--warning))" },
  intensity: { label: "Intensity", color: "hsl(var(--destructive))" },
} satisfies ChartConfig;

function RunStatusBadge({ status }: Pick<SimulationRun, "status">) {
  const variant =
    status === "Failed"
      ? "destructive"
      : status === "Completed"
        ? "outline"
        : status === "Queued"
          ? "secondary"
          : "default";
  return <Badge variant={variant}>{status}</Badge>;
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Trees;
  label: string;
  value: string;
}) {
  return (
    <Card className="gap-3 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
      </div>
      <strong className="text-2xl font-semibold tracking-tight text-foreground">{value}</strong>
    </Card>
  );
}

export function RunDetailView({ mapControllerRef, mapSlot, onBack, run }: RunDetailViewProps) {
  const samples = useMemo(() => analyticsForRun(run), [run]);
  const initialIndex = initialRunSampleIndex(run, samples.length);
  const [sampleIndex, setSampleIndex] = useState(initialIndex);
  const [playing, setPlaying] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const currentSample = samples[sampleIndex] ?? samples[0];
  const perimeterMapRef = useRef<MapLibreMap | null>(null);
  const perimeterCenterRef = useRef<[number, number] | null>(ignitionCenter(run.ignitionPoints));
  const perimeterAreaRef = useRef(currentSample.burnedArea);
  perimeterAreaRef.current = currentSample.burnedArea;

  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(() => {
      setSampleIndex((current) => {
        if (current >= samples.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 650);
    return () => window.clearInterval(interval);
  }, [playing, samples.length]);

  useEffect(() => {
    perimeterCenterRef.current = ignitionCenter(run.ignitionPoints);
    let animationFrame = 0;
    let attachedMap: MapLibreMap | null = null;
    let cameraPositioned = false;
    let stopped = false;

    const removeLayers = (map: MapLibreMap) => {
      if (map.getLayer(IGNITION_LAYER_ID)) map.removeLayer(IGNITION_LAYER_ID);
      if (map.getSource(IGNITION_SOURCE_ID)) map.removeSource(IGNITION_SOURCE_ID);
      if (map.getLayer(PERIMETER_LINE_LAYER_ID)) map.removeLayer(PERIMETER_LINE_LAYER_ID);
      if (map.getLayer(PERIMETER_FILL_LAYER_ID)) map.removeLayer(PERIMETER_FILL_LAYER_ID);
      if (map.getSource(PERIMETER_SOURCE_ID)) map.removeSource(PERIMETER_SOURCE_ID);
    };

    const ensureLayers = () => {
      if (stopped) return;
      const map = mapControllerRef.current?.getMap() ?? null;
      if (!map || !map.isStyleLoaded()) {
        animationFrame = window.requestAnimationFrame(ensureLayers);
        return;
      }

      if (attachedMap !== map) {
        if (attachedMap) attachedMap.off("style.load", ensureLayers);
        attachedMap = map;
        perimeterMapRef.current = map;
        map.on("style.load", ensureLayers);
      }

      if (!cameraPositioned) {
        const bounds = ignitionBounds(run.ignitionPoints);
        if (bounds) {
          const [[west, south], [east, north]] = bounds;
          if (west === east && south === north) {
            map.jumpTo({ center: [west, south], zoom: 14 });
          } else {
            map.fitBounds(bounds, { duration: 0, maxZoom: 14, padding: 96 });
          }
          cameraPositioned = true;
        }
      }

      if (!perimeterCenterRef.current) {
        const center = map.getCenter();
        perimeterCenterRef.current = [center.lng, center.lat];
      }
      const data = burnedAreaPerimeter(perimeterCenterRef.current, perimeterAreaRef.current);
      const source = map.getSource(PERIMETER_SOURCE_ID) as GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
      } else {
        map.addSource(PERIMETER_SOURCE_ID, { type: "geojson", data });
      }

      const destructive = window
        .getComputedStyle(document.documentElement)
        .getPropertyValue("--destructive")
        .trim();
      const fireColor = `hsl(${destructive})`;
      const background = window
        .getComputedStyle(document.documentElement)
        .getPropertyValue("--background")
        .trim();
      if (!map.getLayer(PERIMETER_FILL_LAYER_ID)) {
        map.addLayer({
          id: PERIMETER_FILL_LAYER_ID,
          type: "fill",
          source: PERIMETER_SOURCE_ID,
          paint: { "fill-color": fireColor, "fill-opacity": 0.22 },
        });
      }
      if (!map.getLayer(PERIMETER_LINE_LAYER_ID)) {
        map.addLayer({
          id: PERIMETER_LINE_LAYER_ID,
          type: "line",
          source: PERIMETER_SOURCE_ID,
          paint: {
            "line-color": fireColor,
            "line-dasharray": [3, 2],
            "line-width": 2.5,
          },
        });
      }

      const ignitionData = ignitionPointFeatures(run.ignitionPoints);
      const ignitionSource = map.getSource(IGNITION_SOURCE_ID) as GeoJSONSource | undefined;
      if (ignitionSource) {
        ignitionSource.setData(ignitionData);
      } else {
        map.addSource(IGNITION_SOURCE_ID, { type: "geojson", data: ignitionData });
      }
      if (!map.getLayer(IGNITION_LAYER_ID)) {
        map.addLayer({
          id: IGNITION_LAYER_ID,
          type: "circle",
          source: IGNITION_SOURCE_ID,
          paint: {
            "circle-color": fireColor,
            "circle-radius": 8,
            "circle-stroke-color": `hsl(${background})`,
            "circle-stroke-width": 3,
          },
        });
      }
    };

    ensureLayers();
    return () => {
      stopped = true;
      window.cancelAnimationFrame(animationFrame);
      if (attachedMap) {
        attachedMap.off("style.load", ensureLayers);
        removeLayers(attachedMap);
      }
      perimeterMapRef.current = null;
    };
  }, [mapControllerRef, run.id, run.ignitionPoints]);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      mapControllerRef.current?.getMap()?.resize();
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [mapControllerRef, mapExpanded]);

  useEffect(() => {
    const map = perimeterMapRef.current;
    const center = perimeterCenterRef.current;
    if (!map || !center) return;
    const source = map.getSource(PERIMETER_SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(burnedAreaPerimeter(center, currentSample.burnedArea));
  }, [currentSample.burnedArea]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4 lg:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <Button aria-label="Back to runs" onClick={onBack} size="icon" variant="ghost">
            <ArrowLeft aria-hidden="true" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
                {run.id}
              </h1>
              <RunStatusBadge status={run.status} />
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {run.scenario} · {run.location}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setSampleIndex(0);
              setPlaying(true);
            }}
            variant="outline"
          >
            <RotateCcw aria-hidden="true" /> Replay
          </Button>
          <Button variant="outline">
            <Download aria-hidden="true" /> Export
          </Button>
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-5 lg:p-7">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Run summary">
            <MetricCard
              icon={Trees}
              label="Burned area"
              value={`${currentSample.burnedArea.toLocaleString()} acres`}
            />
            <MetricCard
              icon={Gauge}
              label="Peak spread"
              value={`${run.spreadRate.toFixed(1)} mph`}
            />
            <MetricCard
              icon={TriangleAlert}
              label="Assets exposed"
              value={String(currentSample.exposedAssets)}
            />
            <MetricCard icon={Timer} label="Runtime" value={run.duration} />
          </section>

          <section
            className={`grid min-h-[420px] gap-4 ${
              mapExpanded
                ? "xl:grid-cols-1"
                : "xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.8fr)]"
            }`}
          >
            <Card
              className={`relative gap-0 overflow-hidden bg-background py-0 transition-[min-height] duration-300 motion-reduce:transition-none ${
                mapExpanded ? "min-h-[70vh]" : "min-h-[420px]"
              }`}
            >
              <div className="absolute inset-0">{mapSlot}</div>
              <Card className="absolute left-3 top-3 z-10 gap-1 rounded-lg bg-map-callout px-3 py-2 text-map-callout-foreground shadow-sm">
                <span className="text-xs text-map-callout-foreground/70">Simulation time</span>
                <strong className="font-mono text-sm text-map-callout-foreground">
                  {formatSimulationTime(currentSample.minute)}
                </strong>
              </Card>
              <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-2">
                <Badge variant="secondary">
                  <MapPin aria-hidden="true" /> {run.location}
                </Badge>
                <Badge variant="secondary">
                  <Flame aria-hidden="true" /> {run.ignitionPoints.length} ignition
                  {run.ignitionPoints.length === 1 ? " point" : " points"}
                </Badge>
              </div>
              <Button
                aria-label={mapExpanded ? "Restore map size" : "Expand map"}
                className="absolute bottom-3 right-3 z-20 shadow-md"
                onClick={() => setMapExpanded((expanded) => !expanded)}
                size="icon"
                title={mapExpanded ? "Restore map size" : "Expand map"}
                type="button"
                variant="secondary"
              >
                {mapExpanded ? (
                  <Minimize2 aria-hidden="true" />
                ) : (
                  <Maximize2 aria-hidden="true" />
                )}
              </Button>
            </Card>

            <Card
              className={`gap-4 px-5 py-4 ${
                mapExpanded ? "order-1" : "order-2 xl:col-span-2"
              }`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  aria-label={playing ? "Pause simulation replay" : "Play simulation replay"}
                  onClick={() => {
                    if (!playing && sampleIndex === samples.length - 1) setSampleIndex(0);
                    setPlaying((current) => !current);
                  }}
                  size="icon"
                >
                  {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                </Button>
                <span className="w-12 font-mono text-sm tabular-nums text-foreground">
                  {formatSimulationTime(currentSample.minute)}
                </span>
                <Slider
                  aria-label="Simulation replay time"
                  className="min-w-[220px] flex-1"
                  max={samples.length - 1}
                  min={0}
                  onValueChange={([value]) => {
                    setPlaying(false);
                    setSampleIndex(value ?? 0);
                  }}
                  step={1}
                  value={[sampleIndex]}
                />
                <span className="w-12 text-right font-mono text-sm tabular-nums text-muted-foreground">
                  {formatSimulationTime(samples.at(-1)?.minute ?? 0)}
                </span>
                <Badge variant="outline">2×</Badge>
              </div>
            </Card>

            <div
              className={`grid gap-4 md:grid-cols-2 ${
                mapExpanded ? "order-2" : "order-1 xl:grid-cols-1"
              }`}
            >
              <Card className="gap-3 py-4">
                <CardHeader className="px-4">
                  <CardTitle className="text-sm">Area burned over time</CardTitle>
                  <CardDescription>Acres inside the simulated perimeter</CardDescription>
                </CardHeader>
                <CardContent className="px-2">
                  <ChartContainer className="h-[150px] w-full" config={AREA_CHART_CONFIG}>
                    <AreaChart data={samples} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="burned-area-fill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-burnedArea)" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="var(--color-burnedArea)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="minute" tickFormatter={formatSimulationTime} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} width={42} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ReferenceLine x={currentSample.minute} stroke="hsl(var(--foreground))" strokeOpacity={0.35} />
                      <Area
                        dataKey="burnedArea"
                        fill="url(#burned-area-fill)"
                        stroke="var(--color-burnedArea)"
                        strokeWidth={2}
                        type="monotone"
                      />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card className="gap-3 py-4">
                <CardHeader className="px-4">
                  <CardTitle className="text-sm">Fire behavior</CardTitle>
                  <CardDescription>Spread rate and relative intensity</CardDescription>
                </CardHeader>
                <CardContent className="px-2">
                  <ChartContainer className="h-[150px] w-full" config={BEHAVIOR_CHART_CONFIG}>
                    <LineChart data={samples} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="minute" tickFormatter={formatSimulationTime} tickLine={false} />
                      <YAxis
                        axisLine={false}
                        domain={[0, 100]}
                        tickLine={false}
                        width={32}
                        yAxisId="intensity"
                      />
                      <YAxis
                        axisLine={false}
                        domain={[0, 4]}
                        hide
                        orientation="right"
                        tickLine={false}
                        yAxisId="spread"
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ReferenceLine x={currentSample.minute} stroke="hsl(var(--foreground))" strokeOpacity={0.35} />
                      <Line
                        dataKey="spreadRate"
                        dot={false}
                        stroke="var(--color-spreadRate)"
                        strokeWidth={2}
                        type="monotone"
                        yAxisId="spread"
                      />
                      <Line
                        dataKey="intensity"
                        dot={false}
                        stroke="var(--color-intensity)"
                        strokeWidth={2}
                        type="monotone"
                        yAxisId="intensity"
                      />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          </section>

          <Tabs defaultValue="overview">
            <TabsList variant="line">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="behavior">Fire behavior</TabsTrigger>
              <TabsTrigger value="exposure">Exposure</TabsTrigger>
              <TabsTrigger value="inputs">Inputs</TabsTrigger>
              <TabsTrigger value="activity">Activity and logs</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="gap-4 py-5">
                  <CardHeader className="px-5">
                    <CardTitle className="text-base">Run inputs</CardTitle>
                    <CardDescription>Conditions used for this simulation</CardDescription>
                  </CardHeader>
                  <CardContent className="px-5">
                    <Table>
                      <TableBody>
                        <TableRow><TableCell className="text-muted-foreground">Ignition sources</TableCell><TableCell className="text-right">{run.ignitionSources}</TableCell></TableRow>
                        <TableRow><TableCell className="text-muted-foreground">Wind</TableCell><TableCell className="text-right">{run.windSpeed.toFixed(0)} mph {formatWindDirection(run.windDirection)}</TableCell></TableRow>
                        <TableRow><TableCell className="text-muted-foreground">Model</TableCell><TableCell className="text-right">{run.modelVersion}</TableCell></TableRow>
                        <TableRow><TableCell className="text-muted-foreground">Owner</TableCell><TableCell className="text-right">{run.owner}</TableCell></TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
                <Card className="gap-4 py-5">
                  <CardHeader className="px-5">
                    <CardTitle className="text-base">Current timestep</CardTitle>
                    <CardDescription>Metrics synchronized with the replay timeline</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 px-5">
                    <div className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 text-muted-foreground"><Wind aria-hidden="true" className="size-4" /> Spread rate</span><strong>{currentSample.spreadRate.toFixed(1)} mph</strong></div>
                    <Separator />
                    <div className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 text-muted-foreground"><Trees aria-hidden="true" className="size-4" /> Burned area</span><strong>{currentSample.burnedArea.toLocaleString()} acres</strong></div>
                    <Separator />
                    <div className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 text-muted-foreground"><TriangleAlert aria-hidden="true" className="size-4" /> Assets exposed</span><strong>{currentSample.exposedAssets}</strong></div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            <TabsContent value="behavior"><Card className="px-5 py-5 text-sm text-muted-foreground">Detailed intensity, flame length, and directional spread diagnostics use the synchronized chart above.</Card></TabsContent>
            <TabsContent value="exposure"><Card className="px-5 py-5 text-sm text-muted-foreground">Exposure results include affected assets, circuits, structures, and response zones.</Card></TabsContent>
            <TabsContent value="inputs"><Card className="px-5 py-5 text-sm text-muted-foreground">Input provenance, weather snapshots, fuel layers, and model version are preserved with every run.</Card></TabsContent>
            <TabsContent value="activity"><Card className="px-5 py-5 text-sm text-muted-foreground">Queued · Inputs validated · Model started · Results published</Card></TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
