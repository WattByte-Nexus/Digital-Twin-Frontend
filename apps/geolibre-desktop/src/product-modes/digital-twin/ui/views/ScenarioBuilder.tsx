import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  DEFAULT_WEATHER_SETTINGS,
  FloatingMapPanel,
  FloatingMapPanelDragHandle,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  SelectMenu,
  SelectMenuContent,
  SelectMenuItem,
  SelectMenuTrigger,
  SelectMenuValue,
  Separator,
  Slider,
  WeatherSettingsFloatingPanel,
  WeatherSettingsPanel,
  surfaceThemeClassName,
  type SurfaceTheme,
  type WeatherSettingsValue,
} from "@geolibre/ui";
import {
  ArrowLeft,
  CloudSun,
  Crosshair,
  LocateFixed,
  MapPin,
  Play,
  RotateCcw,
  Trash2,
  Undo2,
  Wind,
} from "lucide-react";
import maplibregl, { LngLatBounds } from "maplibre-gl";
import {
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import type { IgnitionPoint, ScenarioRunRequest } from "../simulation-flow";

interface ScenarioBuilderProps {
  initialLocation: string;
  initialRequest?: ScenarioRunRequest;
  mapControllerRef: RefObject<ScenarioMapController | null>;
  mapSlot: ReactNode;
  onClose: () => void;
  onRun: (request: ScenarioRunRequest) => void;
  theme: SurfaceTheme;
}

export interface ScenarioMapController {
  getMap: () => maplibregl.Map | null;
}

function pointId(): string {
  return `ignition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function useIgnitionMap({
  enabled,
  mapControllerRef,
  points,
  selectedPointId,
  setPoints,
  setSelectedPointId,
}: {
  enabled: boolean;
  mapControllerRef: RefObject<ScenarioMapController | null>;
  points: IgnitionPoint[];
  selectedPointId: string | null;
  setPoints: Dispatch<SetStateAction<IgnitionPoint[]>>;
  setSelectedPointId: Dispatch<SetStateAction<string | null>>;
}) {
  useEffect(() => {
    let frame: number | null = null;
    let disposed = false;
    let cleanup = () => {};

    const attach = () => {
      const map = mapControllerRef.current?.getMap();
      if (!map) {
        frame = window.requestAnimationFrame(attach);
        return;
      }

      const canvas = map.getCanvas();
      const previousCursor = canvas.style.cursor;
      canvas.style.cursor = enabled ? "crosshair" : "";
      const markerRoots: Root[] = [];
      const markers = points.map((point, index) => {
        const container = document.createElement("div");
        const root = createRoot(container);
        markerRoots.push(root);
        root.render(
          <Button
            aria-label={`Ignition source ${index + 1}`}
            aria-pressed={selectedPointId === point.id}
            className="size-8 rounded-full border-2 border-background p-0 tabular-nums shadow-md"
            size="icon"
            type="button"
            variant={selectedPointId === point.id ? "default" : "secondary"}
            onClick={(event) => {
              event.stopPropagation();
              setSelectedPointId(point.id);
            }}
          >
            {index + 1}
          </Button>
        );
        const marker = new maplibregl.Marker({
          element: container,
          draggable: true,
        })
          .setLngLat([point.longitude, point.latitude])
          .addTo(map);
        marker.on("dragend", () => {
          const nextPosition = marker.getLngLat();
          setPoints((current) =>
            current.map((candidate) =>
              candidate.id === point.id
                ? {
                    ...candidate,
                    longitude: nextPosition.lng,
                    latitude: nextPosition.lat,
                  }
                : candidate
            )
          );
        });
        return marker;
      });

      const handleMapClick = (event: maplibregl.MapMouseEvent) => {
        if (!enabled) return;
        const nextPoint: IgnitionPoint = {
          id: pointId(),
          longitude: event.lngLat.lng,
          latitude: event.lngLat.lat,
        };
        setPoints((current) => [...current, nextPoint]);
        setSelectedPointId(nextPoint.id);
      };
      map.on("click", handleMapClick);

      cleanup = () => {
        map.off("click", handleMapClick);
        markers.forEach((marker) => marker.remove());
        markerRoots.forEach((root) => root.unmount());
        canvas.style.cursor = previousCursor;
      };
    };

    frame = window.requestAnimationFrame(() => {
      if (!disposed) attach();
    });
    return () => {
      disposed = true;
      if (frame !== null) window.cancelAnimationFrame(frame);
      cleanup();
    };
  }, [
    enabled,
    mapControllerRef,
    points,
    selectedPointId,
    setPoints,
    setSelectedPointId,
  ]);
}

function zoomToPoints(
  mapControllerRef: RefObject<ScenarioMapController | null>,
  points: IgnitionPoint[]
) {
  const map = mapControllerRef.current?.getMap();
  if (!map || points.length === 0) return;
  if (points.length === 1) {
    map.easeTo({
      center: [points[0].longitude, points[0].latitude],
      zoom: Math.max(map.getZoom(), 14),
      duration: 400,
    });
    return;
  }
  const bounds = new LngLatBounds();
  points.forEach((point) => bounds.extend([point.longitude, point.latitude]));
  map.fitBounds(bounds, { padding: 96, duration: 400, maxZoom: 15 });
}

export function ScenarioBuilder({
  initialLocation,
  initialRequest,
  mapControllerRef,
  mapSlot,
  onClose,
  onRun,
  theme,
}: ScenarioBuilderProps) {
  const [scenarioName, setScenarioName] = useState(
    initialRequest?.scenario ?? "Boulder Foothills — Wind East"
  );
  const [location, setLocation] = useState(
    initialRequest?.location ?? initialLocation
  );
  const [durationHours, setDurationHours] = useState(
    initialRequest?.durationHours ?? 4
  );
  const [placementActive, setPlacementActive] = useState(true);
  const [points, setPoints] = useState<IgnitionPoint[]>(
    () => initialRequest?.ignitionPoints.map((point) => ({ ...point })) ?? []
  );
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherSettingsValue>(() => {
    const initialWeather = initialRequest?.weather ?? {
      ...DEFAULT_WEATHER_SETTINGS,
      events: {
        ...DEFAULT_WEATHER_SETTINGS.events,
        wind: 18,
        windDirection: 90,
      },
    };
    return { ...initialWeather, events: { ...initialWeather.events } };
  });

  useIgnitionMap({
    enabled: placementActive,
    mapControllerRef,
    points,
    selectedPointId,
    setPoints,
    setSelectedPointId,
  });

  const selectedPoint =
    points.find((point) => point.id === selectedPointId) ?? null;
  const runLabel = `Run ${durationHours}-hour simulation`;
  const weatherSummary = useMemo(
    () =>
      `NWS · ${weather.events.wind.toFixed(0)} mph · ${
        weather.temperature
      }°C · Updated 8 min ago`,
    [weather.events.wind, weather.temperature]
  );

  const removeSelectedPoint = () => {
    if (!selectedPointId) return;
    setPoints((current) =>
      current.filter((point) => point.id !== selectedPointId)
    );
    setSelectedPointId(null);
  };

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-background">
      <div className="absolute inset-0">{mapSlot}</div>

      <Button
        aria-label="Back to scenarios"
        className="absolute left-4 top-4 z-20 border bg-background/95 text-foreground shadow-lg backdrop-blur"
        onClick={onClose}
        size="icon"
        title="Back to scenarios"
        type="button"
        variant="secondary"
      >
        <ArrowLeft aria-hidden="true" />
      </Button>

      <div className="pointer-events-none absolute inset-y-0 left-0 right-[432px] z-10 hidden md:block">
        <WeatherSettingsFloatingPanel
          location={location}
          onValueChange={setWeather}
          theme={theme}
          value={weather}
          trigger={
            <Button
              aria-label="Open weather settings"
              className="border bg-background/95 text-foreground shadow-lg backdrop-blur"
              size="icon"
              title="Weather settings"
              type="button"
              variant="secondary"
            >
              <CloudSun aria-hidden="true" />
            </Button>
          }
        />
      </div>

      <FloatingMapPanel
        aria-label="Simulation run setup"
        defaultSize={{ width: 416, height: 820 }}
        fitToBounds
      >
        <Card
          className="relative h-full gap-0 overflow-hidden rounded-[10px] py-0 shadow-xl"
          surface="panel"
        >
          <FloatingMapPanelDragHandle className="absolute inset-x-0 top-0 z-10 h-[54px] rounded-t-[10px]" />
          <CardHeader className="border-b px-5 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>Run setup</CardTitle>
                <CardDescription className="mt-1">
                  Define the area, ignition sources, weather, and model
                  duration.
                </CardDescription>
              </div>
              <Badge variant="secondary">Draft</Badge>
            </div>
          </CardHeader>

          <ScrollArea className="min-h-0 flex-1">
            <CardContent className="space-y-6 px-5 py-5">
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Badge
                    className="size-6 justify-center rounded-full p-0"
                    variant="outline"
                  >
                    1
                  </Badge>
                  Area
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scenario-name">Scenario name</Label>
                  <Input
                    id="scenario-name"
                    onChange={(event) => setScenarioName(event.target.value)}
                    value={scenarioName}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scenario-location">Simulation area</Label>
                  <SelectMenu
                    onValueChange={(nextLocation) => {
                      if (nextLocation !== location) {
                        setPoints([]);
                        setSelectedPointId(null);
                      }
                      setLocation(nextLocation);
                    }}
                    value={location}
                  >
                    <SelectMenuTrigger
                      className="w-full"
                      id="scenario-location"
                    >
                      <SelectMenuValue />
                    </SelectMenuTrigger>
                    <SelectMenuContent
                      className={theme === "dark" ? "dark" : undefined}
                    >
                      <SelectMenuItem value="Boulder Foothills">
                        Boulder Foothills
                      </SelectMenuItem>
                      <SelectMenuItem value="East County">
                        East County
                      </SelectMenuItem>
                      <SelectMenuItem value="Boulder North">
                        Boulder North
                      </SelectMenuItem>
                      <SelectMenuItem value="Front Range">
                        Front Range
                      </SelectMenuItem>
                    </SelectMenuContent>
                  </SelectMenu>
                </div>
              </section>

              <Separator />

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Badge
                      className="size-6 justify-center rounded-full p-0"
                      variant="outline"
                    >
                      2
                    </Badge>
                    Ignition sources
                  </div>
                  <Badge variant={points.length > 0 ? "default" : "secondary"}>
                    {points.length} selected
                  </Badge>
                </div>
                <Button
                  aria-pressed={placementActive}
                  className="w-full"
                  onClick={() => setPlacementActive((active) => !active)}
                  variant={placementActive ? "default" : "outline"}
                >
                  <Crosshair aria-hidden="true" />
                  {placementActive
                    ? "Click the map to place points"
                    : "Add ignition sources"}
                </Button>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    disabled={points.length === 0}
                    onClick={() => {
                      setPoints((current) => current.slice(0, -1));
                      setSelectedPointId(null);
                    }}
                    size="sm"
                    variant="outline"
                  >
                    <Undo2 aria-hidden="true" /> Undo
                  </Button>
                  <Button
                    disabled={points.length === 0}
                    onClick={() => zoomToPoints(mapControllerRef, points)}
                    size="sm"
                    variant="outline"
                  >
                    <LocateFixed aria-hidden="true" /> Zoom
                  </Button>
                  <Button
                    disabled={points.length === 0}
                    onClick={() => {
                      setPoints([]);
                      setSelectedPointId(null);
                    }}
                    size="sm"
                    variant="outline"
                  >
                    <RotateCcw aria-hidden="true" /> Clear
                  </Button>
                </div>
                {selectedPoint ? (
                  <Card className="gap-3 rounded-lg px-3 py-3" surface="glass">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          Selected ignition source
                        </p>
                        <p className="mt-1 truncate text-xs tabular-nums text-muted-foreground">
                          {selectedPoint.latitude.toFixed(5)},{" "}
                          {selectedPoint.longitude.toFixed(5)}
                        </p>
                      </div>
                      <Button
                        aria-label="Remove selected ignition source"
                        onClick={removeSelectedPoint}
                        size="icon"
                        variant="ghost"
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </Card>
                ) : null}
              </section>

              <Separator />

              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Badge
                    className="size-6 justify-center rounded-full p-0"
                    variant="outline"
                  >
                    3
                  </Badge>
                  Weather
                </div>
                <Card className="gap-3 rounded-lg px-3 py-3" surface="glass">
                  <div className="flex items-start gap-3">
                    <Wind
                      aria-hidden="true"
                      className="mt-0.5 size-4 text-muted-foreground"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Current inputs</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {weatherSummary}
                      </p>
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="outline">
                          Edit
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        className={`${surfaceThemeClassName(
                          theme
                        )} w-auto border-0 bg-transparent p-0 shadow-none`}
                      >
                        <WeatherSettingsPanel
                          location={location}
                          onValueChange={setWeather}
                          theme={theme}
                          value={weather}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </Card>
              </section>

              <Separator />

              <section className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Badge
                    className="size-6 justify-center rounded-full p-0"
                    variant="outline"
                  >
                    4
                  </Badge>
                  Model settings
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="simulation-duration">Duration</Label>
                    <Badge variant="outline">
                      {durationHours} {durationHours === 1 ? "hour" : "hours"}
                    </Badge>
                  </div>
                  <Slider
                    aria-label="Simulation duration in hours"
                    id="simulation-duration"
                    max={100}
                    min={1}
                    onValueChange={([value]) => setDurationHours(value ?? 1)}
                    step={1}
                    value={[durationHours]}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1 hour</span>
                    <span>100 hours</span>
                  </div>
                </div>
              </section>
            </CardContent>
          </ScrollArea>

          <CardFooter className="flex-col gap-3 border-t px-5 py-4">
            <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <MapPin aria-hidden="true" className="size-3.5" />
                {points.length} ignition{" "}
                {points.length === 1 ? "source" : "sources"}
              </span>
              <span>{durationHours} hour model</span>
            </div>
            <Button
              className="w-full"
              disabled={points.length === 0 || !scenarioName.trim()}
              onClick={() =>
                onRun({
                  scenario: scenarioName,
                  location,
                  durationHours,
                  ignitionPoints: points,
                  weather,
                })
              }
            >
              <Play aria-hidden="true" />
              {runLabel}
            </Button>
            {points.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground">
                Add at least one ignition source to start the simulation.
              </p>
            ) : null}
          </CardFooter>
        </Card>
      </FloatingMapPanel>
    </div>
  );
}
