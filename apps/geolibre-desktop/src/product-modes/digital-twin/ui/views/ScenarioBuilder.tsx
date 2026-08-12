import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  DEFAULT_WEATHER_SETTINGS,
  FloatingMapPanel,
  FloatingMapPanelDragHandle,
  Input,
  Label,
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  SelectMenu,
  SelectMenuContent,
  SelectMenuItem,
  SelectMenuTrigger,
  SelectMenuValue,
  Slider,
  WeatherSettingsPanel,
  type DigitalTwinRegion,
  type FloatingPanelAnchor,
  surfaceThemeClassName,
  type SurfaceTheme,
  type WeatherSettingsValue,
} from "@geolibre/ui";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  Clock3,
  CloudSun,
  Crosshair,
  FileText,
  Flame,
  MapPin,
  Redo2,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import maplibregl from "maplibre-gl";
import {
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  DEFAULT_FIRE_MODEL_SETTINGS,
  type FireModelSettings,
  type IgnitionPoint,
  type ScenarioRunRequest,
} from "../simulation-flow";

interface ScenarioBuilderProps {
  activeRegionId: string;
  initialRequest?: ScenarioRunRequest;
  mapControllerRef: RefObject<ScenarioMapController | null>;
  mapSlot: ReactNode;
  onClose: () => void;
  onRun: (request: ScenarioRunRequest, idempotencyKey: string) => Promise<void>;
  regions: readonly DigitalTwinRegion[];
  theme: SurfaceTheme;
}

export interface ScenarioMapController {
  getMap: () => maplibregl.Map | null;
}

type SetupStep = "area" | "ignitions" | "weather" | "model" | "review";

const SETUP_STEPS = [
  { id: "area", label: "Area", Icon: MapPin },
  { id: "ignitions", label: "Ignitions", Icon: Flame },
  { id: "weather", label: "Weather", Icon: CloudSun },
  { id: "model", label: "Model", Icon: SlidersHorizontal },
  { id: "review", label: "Review", Icon: FileText },
] as const;

function pointId(): string {
  return `ignition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function useIgnitionMap({
  enabled,
  mapControllerRef,
  points,
  selectedPointId,
  setPoints,
  setRedoPoints,
  setSelectedPointId,
}: {
  enabled: boolean;
  mapControllerRef: RefObject<ScenarioMapController | null>;
  points: IgnitionPoint[];
  selectedPointId: string | null;
  setPoints: Dispatch<SetStateAction<IgnitionPoint[]>>;
  setRedoPoints: Dispatch<SetStateAction<IgnitionPoint[]>>;
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
      const ignitionCursorClass = "digital-twin-ignition-placement-cursor";
      canvas.classList.toggle(ignitionCursorClass, enabled);
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
        setRedoPoints([]);
        setSelectedPointId(nextPoint.id);
      };
      map.on("click", handleMapClick);

      cleanup = () => {
        map.off("click", handleMapClick);
        markers.forEach((marker) => marker.remove());
        queueMicrotask(() => markerRoots.forEach((root) => root.unmount()));
        canvas.classList.remove(ignitionCursorClass);
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
    setRedoPoints,
    setSelectedPointId,
  ]);
}

export function ScenarioBuilder({
  activeRegionId,
  initialRequest,
  mapControllerRef,
  mapSlot,
  onClose,
  onRun,
  regions,
  theme,
}: ScenarioBuilderProps) {
  const [scenarioName, setScenarioName] = useState(
    initialRequest?.scenario ?? ""
  );
  const [regionId, setRegionId] = useState(
    () =>
      (regions.some((region) => region.id === initialRequest?.regionId)
        ? initialRequest?.regionId
        : regions.find((region) => region.name === initialRequest?.location)?.id) ??
      (regions.some((region) => region.id === activeRegionId)
        ? activeRegionId
        : regions[0]?.id ?? "")
  );
  const [durationHours, setDurationHours] = useState(
    initialRequest?.durationHours ?? 4
  );
  const [modelSettings, setModelSettings] = useState<FireModelSettings>(() => ({
    ...(initialRequest?.modelSettings ?? DEFAULT_FIRE_MODEL_SETTINGS),
  }));
  const [activeStep, setActiveStep] = useState<SetupStep>(
    initialRequest ? "ignitions" : "area"
  );
  const [placementActive, setPlacementActive] = useState(true);
  const [points, setPoints] = useState<IgnitionPoint[]>(
    () => initialRequest?.ignitionPoints.map((point) => ({ ...point })) ?? []
  );
  const [redoPoints, setRedoPoints] = useState<IgnitionPoint[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const submissionIdRef = useRef<string | null>(null);
  const [runSetupAnchor, setRunSetupAnchor] = useState<FloatingPanelAnchor>({
    edge: "right",
    offset: 0,
  });
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
    enabled: placementActive && activeStep === "ignitions",
    mapControllerRef,
    points,
    selectedPointId,
    setPoints,
    setRedoPoints,
    setSelectedPointId,
  });

  const activeRegion = regions.find((region) => region.id === regionId);
  const location = activeRegion?.name ?? "";
  const weatherEditorSide =
    runSetupAnchor.edge === "left" ||
    ((runSetupAnchor.edge === "top" || runSetupAnchor.edge === "bottom") &&
      runSetupAnchor.offset < 0.5)
      ? "right"
      : "left";
  const weatherSummary = useMemo(
    () =>
      `NWS · ${weather.events.wind.toFixed(0)} mph · ${weather.temperature}°C`,
    [weather.events.wind, weather.temperature]
  );

  const areaComplete = Boolean(scenarioName.trim() && location);
  const ignitionsComplete = points.length > 0;
  const readyToRun = areaComplete && ignitionsComplete;
  const stepComplete = (step: SetupStep) => {
    if (step === "area") return areaComplete;
    if (step === "ignitions") return ignitionsComplete;
    if (step === "weather" || step === "model") return true;
    return readyToRun;
  };
  const activeStepIndex = SETUP_STEPS.findIndex((step) => step.id === activeStep);
  const previousStep = SETUP_STEPS[activeStepIndex - 1];
  const nextStep = SETUP_STEPS[activeStepIndex + 1];
  const nextDisabled =
    (activeStep === "area" && !areaComplete) ||
    (activeStep === "ignitions" && !ignitionsComplete) ||
    (activeStep === "review" && !readyToRun);

  const removePoint = (pointId: string) => {
    const removedPoint = points.find((point) => point.id === pointId);
    if (removedPoint) setRedoPoints((current) => [...current, removedPoint]);
    setPoints((current) => current.filter((point) => point.id !== pointId));
    if (selectedPointId === pointId) setSelectedPointId(null);
  };

  const handleNext = async () => {
    if (nextStep) {
      setActiveStep(nextStep.id);
      return;
    }
    setIsSubmitting(true);
    setSubmissionError(null);
    try {
      const submissionId = submissionIdRef.current ?? crypto.randomUUID();
      submissionIdRef.current = submissionId;
      await onRun({
        scenario: scenarioName,
        regionId,
        location,
        durationHours,
        ignitionPoints: points,
        weather,
        modelSettings,
      }, submissionId);
    } catch (cause) {
      setSubmissionError(
        cause instanceof Error ? cause.message : "Simulation submission failed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-background">
      <div className="absolute inset-0">{mapSlot}</div>

      <Popover>
        <FloatingMapPanel
          aria-label="Simulation run setup"
          defaultSize={{ width: 416, height: 831 }}
          fitToBounds
          onAnchorChange={setRunSetupAnchor}
        >
          <PopoverAnchor asChild>
            <Card
              className={`${surfaceThemeClassName(
                theme
              )} relative h-full gap-0 overflow-hidden rounded-[10px] py-0 shadow-xl`}
              surface="panel"
            >
              <FloatingMapPanelDragHandle className="absolute inset-x-0 top-0 z-10 h-[58px] rounded-t-[10px]" />
              <header className="relative flex min-h-[58px] items-start border-b bg-background px-4 py-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-card-foreground">
                    Run setup
                  </h2>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <CircleCheck aria-hidden="true" className="size-3 text-primary" />
                    Draft autosaved just now
                  </p>
                </div>
                <Button
                  aria-label="Close run setup"
                  className="relative z-20 -mr-2 -mt-1"
                  onClick={onClose}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" />
                </Button>
              </header>

              <nav aria-label="Run setup steps" className="px-3 py-3">
                <ol className="grid grid-cols-5">
                  {SETUP_STEPS.map(({ id, label, Icon }, index) => {
                    const complete = stepComplete(id);
                    const active = activeStep === id;
                    return (
                      <li className="relative" key={id}>
                        {index > 0 ? (
                          <span
                            aria-hidden="true"
                            className="absolute right-1/2 top-3 h-px w-full bg-border"
                          />
                        ) : null}
                        <button
                          aria-current={active ? "step" : undefined}
                          className="relative z-10 flex w-full flex-col items-center gap-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          onClick={() => setActiveStep(id)}
                          type="button"
                        >
                          <span
                            className={`flex size-6 items-center justify-center rounded-full border bg-background ${
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : complete
                                  ? "border-primary text-primary"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {active ? (
                              index + 1
                            ) : complete ? (
                              <Check aria-hidden="true" className="size-3.5" />
                            ) : (
                              <Icon aria-hidden="true" className="size-3.5" />
                            )}
                          </span>
                          <span className={active ? "text-foreground" : undefined}>
                            {label}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </nav>

              <ScrollArea className="min-h-0 flex-1">
                <CardContent className="space-y-4 px-3 py-4">
                  {activeStep === "area" ? (
                  <section className="space-y-4">
                    <div>
                      <h3 className="text-[16px] font-semibold">Area</h3>
                      <p className="mt-1 text-xs leading-4 text-muted-foreground">
                        Name the scenario and choose its simulation region.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="scenario-name">Scenario name</Label>
                      <Input
                        id="scenario-name"
                        onChange={(event) =>
                          setScenarioName(event.target.value)
                        }
                        placeholder="Name this scenario"
                        value={scenarioName}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="scenario-location">Simulation area</Label>
                      <SelectMenu
                        onValueChange={(nextRegionId) => {
                          if (nextRegionId !== regionId) {
                            setPoints([]);
                            setRedoPoints([]);
                            setSelectedPointId(null);
                          }
                          setRegionId(nextRegionId);
                        }}
                        value={regionId}
                      >
                        <SelectMenuTrigger
                          className="w-full"
                          disabled={regions.length === 0}
                          id="scenario-location"
                        >
                          <SelectMenuValue placeholder="No simulation areas available" />
                        </SelectMenuTrigger>
                        <SelectMenuContent
                          className={surfaceThemeClassName(theme)}
                        >
                          {regions.map((region) => (
                            <SelectMenuItem key={region.id} value={region.id}>
                              {region.name}
                            </SelectMenuItem>
                          ))}
                        </SelectMenuContent>
                      </SelectMenu>
                    </div>
                    <div className="rounded-md border border-input p-3">
                      <div className="flex items-start gap-3">
                        <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium">Selected region</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {activeRegion?.description || "Choose a simulation area to review its coverage."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>
                  ) : null}

                  {activeStep === "ignitions" ? (
                  <section className="space-y-3">
                    <div>
                      <h3 className="text-[16px] font-semibold">Ignitions</h3>
                      <p className="mt-1 text-xs leading-4 text-muted-foreground">
                        Add one or more ignition sources to start the simulation.
                      </p>
                    </div>
                    <Button
                      aria-pressed={placementActive}
                      className={
                        placementActive
                          ? "w-full shadow-sm"
                          : "w-full bg-muted/40 hover:bg-muted"
                      }
                      onClick={() => setPlacementActive((active) => !active)}
                      variant={placementActive ? "default" : "outline"}
                    >
                      <Crosshair aria-hidden="true" />
                      {placementActive
                        ? "Click the map to place points"
                        : "Add ignition sources"}
                    </Button>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium">
                        {points.length} ignition {points.length === 1 ? "source" : "sources"}
                      </span>
                      <Badge variant="outline">Point mode</Badge>
                    </div>
                    {points.length > 0 ? (
                      <div className="divide-y overflow-hidden rounded-md border border-input">
                        {points.map((point, index) => (
                          <div
                            className={`flex items-start gap-2.5 px-2.5 py-2.5 ${
                              selectedPointId === point.id ? "border-l-2 border-l-primary" : ""
                            }`}
                            key={point.id}
                          >
                            <button
                              aria-label={`Select ignition source ${index + 1}`}
                              className="flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() => setSelectedPointId(point.id)}
                              type="button"
                            >
                              <Flame aria-hidden="true" className="size-3" />
                            </button>
                            <span className="pt-0.5 text-xs font-semibold">{index + 1}</span>
                            <button
                              className="min-w-0 flex-1 text-left"
                              onClick={() => setSelectedPointId(point.id)}
                              type="button"
                            >
                              <span className="block truncate text-xs font-medium tabular-nums">
                                {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
                              </span>
                              <span className="mt-1 block text-[10px] text-muted-foreground">
                                Point source
                              </span>
                            </button>
                            <Button
                              aria-label={`Remove ignition source ${index + 1}`}
                              className="-mr-1 -mt-1"
                              onClick={() => removePoint(point.id)}
                              size="icon"
                              variant="ghost"
                            >
                              <Trash2 aria-hidden="true" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-md border border-dashed px-3 py-5 text-center text-xs text-muted-foreground">
                        No ignition sources placed yet.
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        disabled={points.length === 0}
                        onClick={() => {
                          setPoints((current) => {
                            const removedPoint = current.at(-1);
                            if (removedPoint) {
                              setRedoPoints((redo) => [...redo, removedPoint]);
                            }
                            return current.slice(0, -1);
                          });
                          setSelectedPointId(null);
                        }}
                        size="sm"
                        variant="outline"
                      >
                        <Undo2 aria-hidden="true" /> Undo
                      </Button>
                      <Button
                        disabled={redoPoints.length === 0}
                        onClick={() => {
                          const restoredPoint = redoPoints.at(-1);
                          if (!restoredPoint) return;
                          setRedoPoints((current) => current.slice(0, -1));
                          setPoints((current) => [...current, restoredPoint]);
                          setSelectedPointId(restoredPoint.id);
                        }}
                        size="sm"
                        variant="outline"
                      >
                        <Redo2 aria-hidden="true" /> Redo
                      </Button>
                      <Button
                        disabled={points.length === 0}
                        onClick={() => {
                          setRedoPoints((current) => [...current, ...points]);
                          setPoints([]);
                          setSelectedPointId(null);
                        }}
                        size="sm"
                        variant="outline"
                      >
                        <RotateCcw aria-hidden="true" /> Clear all
                      </Button>
                    </div>
                  </section>
                  ) : null}

                  {activeStep === "weather" ? (
                    <section className="space-y-4">
                      <div>
                        <h3 className="text-[16px] font-semibold">Weather</h3>
                        <p className="mt-1 text-xs leading-4 text-muted-foreground">
                          Review the atmospheric inputs used by the model.
                        </p>
                      </div>
                      <div className="flex items-center gap-3 rounded-md border border-input px-3 py-3">
                        <CloudSun aria-hidden="true" className="size-5 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium">
                            {weather.mode === "auto" ? "Automatic weather" : "Manual weather"}
                          </p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{weatherSummary}</p>
                        </div>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="outline">
                          Edit
                        </Button>
                      </PopoverTrigger>
                      </div>
                      <div className="grid grid-cols-2 overflow-hidden rounded-md border border-input [&>*:nth-child(odd)]:border-r [&>*:not(:nth-last-child(-n+2))]:border-b">
                        <div className="px-3 py-2.5">
                          <p className="text-[10px] text-muted-foreground">Valid date</p>
                          <p className="mt-1 text-xs font-medium">{weather.date}</p>
                        </div>
                        <div className="px-3 py-2.5">
                          <p className="text-[10px] text-muted-foreground">Local time</p>
                          <p className="mt-1 text-xs font-medium tabular-nums">
                            {String(weather.hour).padStart(2, "0")}:{String(weather.minute).padStart(2, "0")}
                          </p>
                        </div>
                        <div className="px-3 py-2.5">
                          <p className="text-[10px] text-muted-foreground">Season</p>
                          <p className="mt-1 text-xs font-medium">{weather.season}</p>
                        </div>
                        <div className="px-3 py-2.5">
                          <p className="text-[10px] text-muted-foreground">Temperature</p>
                          <p className="mt-1 text-xs font-medium tabular-nums">{weather.temperature}°C</p>
                        </div>
                        <div className="px-3 py-2.5">
                          <p className="text-[10px] text-muted-foreground">Wind</p>
                          <p className="mt-1 text-xs font-medium tabular-nums">{weather.events.wind.toFixed(0)} mph</p>
                        </div>
                        <div className="px-3 py-2.5">
                          <p className="text-[10px] text-muted-foreground">Direction</p>
                          <p className="mt-1 text-xs font-medium tabular-nums">{weather.events.windDirection.toFixed(0)}°</p>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-medium">Weather observations</h4>
                        <div className="mt-2 grid grid-cols-4 divide-x overflow-hidden rounded-md border border-input">
                          {[
                            ["Humidity", weather.events.relativeHumidity, "%"],
                            ["Gust", weather.events.windGust, "mph"],
                            ["Precip.", weather.events.precipitationLastHour, "mm"],
                            ["Visibility", weather.events.visibility, "km"],
                          ].map(([label, value, unit]) => (
                            <div className="px-2 py-2 text-center" key={label}>
                              <p className="text-[10px] text-muted-foreground">{label}</p>
                              <p className="mt-1 text-xs font-medium tabular-nums">
                                {value}
                                {unit}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                  ) : null}

                  {activeStep === "model" ? (
                  <section className="space-y-4">
                    <div>
                      <h3 className="text-[16px] font-semibold">Model</h3>
                      <p className="mt-1 text-xs leading-4 text-muted-foreground">
                        Set the simulation horizon for this run.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="simulation-duration">Duration</Label>
                        <Badge variant="outline">
                          {durationHours}{" "}
                          {durationHours === 1 ? "hour" : "hours"}
                        </Badge>
                      </div>
                      <Slider
                        aria-label="Simulation duration in hours"
                        id="simulation-duration"
                        max={100}
                        min={1}
                        onValueChange={([value]) =>
                          setDurationHours(value ?? 1)
                        }
                        step={1}
                        value={[durationHours]}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>1 hour</span>
                        <span>100 hours</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <h4 className="text-xs font-medium">Fire behavior</h4>
                        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                          Control the assumptions that drive spread and intensity.
                        </p>
                      </div>
                      <div className="divide-y overflow-hidden rounded-md border border-input">
                        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                          <div className="min-w-0">
                            <Label className="text-xs" htmlFor="fuel-moisture">Fuel moisture</Label>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">Moisture applied to live and dead fuels</p>
                          </div>
                          <SelectMenu
                            onValueChange={(value) =>
                              setModelSettings((current) => ({
                                ...current,
                                fuelMoisture: value as FireModelSettings["fuelMoisture"],
                              }))
                            }
                            value={modelSettings.fuelMoisture}
                          >
                            <SelectMenuTrigger className="h-8 w-36" id="fuel-moisture">
                              <SelectMenuValue />
                            </SelectMenuTrigger>
                            <SelectMenuContent>
                              <SelectMenuItem value="observed">Observed</SelectMenuItem>
                              <SelectMenuItem value="dry">Dry −10%</SelectMenuItem>
                              <SelectMenuItem value="very-dry">Very dry −20%</SelectMenuItem>
                            </SelectMenuContent>
                          </SelectMenu>
                        </div>
                        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                          <div className="min-w-0">
                            <Label className="text-xs" htmlFor="ember-spotting">Ember spotting</Label>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">Allow new ignitions ahead of the front</p>
                          </div>
                          <SelectMenu
                            onValueChange={(value) =>
                              setModelSettings((current) => ({
                                ...current,
                                spotting: value as FireModelSettings["spotting"],
                              }))
                            }
                            value={modelSettings.spotting}
                          >
                            <SelectMenuTrigger className="h-8 w-36" id="ember-spotting">
                              <SelectMenuValue />
                            </SelectMenuTrigger>
                            <SelectMenuContent>
                              <SelectMenuItem value="off">Off</SelectMenuItem>
                              <SelectMenuItem value="standard">500 m</SelectMenuItem>
                              <SelectMenuItem value="extended">2 km</SelectMenuItem>
                            </SelectMenuContent>
                          </SelectMenu>
                        </div>
                        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                          <div className="min-w-0">
                            <Label className="text-xs" htmlFor="crown-fire">Crown fire</Label>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">Model transition from surface to canopy</p>
                          </div>
                          <SelectMenu
                            onValueChange={(value) =>
                              setModelSettings((current) => ({
                                ...current,
                                crownFire: value as FireModelSettings["crownFire"],
                              }))
                            }
                            value={modelSettings.crownFire}
                          >
                            <SelectMenuTrigger className="h-8 w-36" id="crown-fire">
                              <SelectMenuValue />
                            </SelectMenuTrigger>
                            <SelectMenuContent>
                              <SelectMenuItem value="enabled">Enabled</SelectMenuItem>
                              <SelectMenuItem value="disabled">Disabled</SelectMenuItem>
                            </SelectMenuContent>
                          </SelectMenu>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <h4 className="text-xs font-medium">Computation</h4>
                        <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                          Balance spatial detail, playback detail, and run time.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-md border border-input p-2.5">
                          <Label className="text-[10px] text-muted-foreground" htmlFor="grid-resolution">Grid resolution</Label>
                          <SelectMenu
                            onValueChange={(value) =>
                              setModelSettings((current) => ({
                                ...current,
                                cellSizeMeters: Number(value) as FireModelSettings["cellSizeMeters"],
                              }))
                            }
                            value={String(modelSettings.cellSizeMeters)}
                          >
                            <SelectMenuTrigger className="mt-2 h-8 w-full" id="grid-resolution">
                              <SelectMenuValue />
                            </SelectMenuTrigger>
                            <SelectMenuContent>
                              <SelectMenuItem value="10">10 m · Fine</SelectMenuItem>
                              <SelectMenuItem value="30">30 m · Balanced</SelectMenuItem>
                              <SelectMenuItem value="90">90 m · Fast</SelectMenuItem>
                            </SelectMenuContent>
                          </SelectMenu>
                        </div>
                        <div className="rounded-md border border-input p-2.5">
                          <Label className="text-[10px] text-muted-foreground" htmlFor="output-interval">Output interval</Label>
                          <SelectMenu
                            onValueChange={(value) =>
                              setModelSettings((current) => ({
                                ...current,
                                outputIntervalMinutes: Number(value) as FireModelSettings["outputIntervalMinutes"],
                              }))
                            }
                            value={String(modelSettings.outputIntervalMinutes)}
                          >
                            <SelectMenuTrigger className="mt-2 h-8 w-full" id="output-interval">
                              <SelectMenuValue />
                            </SelectMenuTrigger>
                            <SelectMenuContent>
                              <SelectMenuItem value="5">Every 5 min</SelectMenuItem>
                              <SelectMenuItem value="15">Every 15 min</SelectMenuItem>
                              <SelectMenuItem value="30">Every 30 min</SelectMenuItem>
                            </SelectMenuContent>
                          </SelectMenu>
                        </div>
                      </div>
                    </div>
                  </section>
                  ) : null}

                  {activeStep === "review" ? (
                    <section className="space-y-4">
                      <div>
                        <h3 className="text-[16px] font-semibold">Review</h3>
                        <p className="mt-1 text-xs leading-4 text-muted-foreground">
                          Confirm the scenario configuration before launching.
                        </p>
                      </div>
                      {!readyToRun ? (
                        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                          Add a scenario name, area, and at least one ignition source.
                        </p>
                      ) : null}
                      <div className="divide-y overflow-hidden rounded-md border border-input">
                        <button
                          className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted/40"
                          onClick={() => setActiveStep("area")}
                          type="button"
                        >
                          <CircleCheck aria-hidden="true" className={`size-4 shrink-0 ${areaComplete ? "text-primary" : "text-muted-foreground"}`} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-medium">Scenario and area</span>
                            <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                              {scenarioName.trim() || "Scenario name required"} · {location || "Area required"}
                            </span>
                          </span>
                          <span className="text-[10px] text-muted-foreground">Edit</span>
                        </button>
                        <button
                          className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted/40"
                          onClick={() => setActiveStep("ignitions")}
                          type="button"
                        >
                          <CircleCheck aria-hidden="true" className={`size-4 shrink-0 ${ignitionsComplete ? "text-primary" : "text-muted-foreground"}`} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-medium">Ignition sources</span>
                            <span className="mt-1 block text-[10px] text-muted-foreground">
                              {points.length} point {points.length === 1 ? "source" : "sources"} configured
                            </span>
                          </span>
                          <span className="text-[10px] text-muted-foreground">Edit</span>
                        </button>
                        <button
                          className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted/40"
                          onClick={() => setActiveStep("weather")}
                          type="button"
                        >
                          <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-primary" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-medium">Weather inputs</span>
                            <span className="mt-1 block truncate text-[10px] text-muted-foreground">{weatherSummary}</span>
                          </span>
                          <span className="text-[10px] text-muted-foreground">Edit</span>
                        </button>
                        <button
                          className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted/40"
                          onClick={() => setActiveStep("model")}
                          type="button"
                        >
                          <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-primary" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-medium">Model runtime</span>
                            <span className="mt-1 block text-[10px] text-muted-foreground">
                              {modelSettings.cellSizeMeters} m grid · {modelSettings.outputIntervalMinutes} min outputs · {durationHours} hours
                            </span>
                          </span>
                          <span className="text-[10px] text-muted-foreground">Edit</span>
                        </button>
                      </div>
                    </section>
                  ) : null}

                </CardContent>
              </ScrollArea>

              <section
                aria-label="Configuration summary"
                className="grid grid-cols-4 divide-x border-t bg-background"
              >
                <button
                  aria-label={`Area: ${location || "Not selected"}`}
                  className="flex min-w-0 flex-col items-center gap-1 px-1.5 py-2.5 text-center hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => setActiveStep("area")}
                  title={location || "Choose an area"}
                  type="button"
                >
                  <MapPin aria-hidden="true" className="size-3.5 text-muted-foreground" />
                  <span className="max-w-full truncate text-[11px] font-medium">
                    {location || "No area"}
                  </span>
                </button>
                <button
                  aria-label={`Weather: ${weatherSummary}`}
                  className="flex min-w-0 flex-col items-center gap-1 px-1.5 py-2.5 text-center hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => setActiveStep("weather")}
                  title={weatherSummary}
                  type="button"
                >
                  <CloudSun aria-hidden="true" className="size-3.5 text-muted-foreground" />
                  <span className="max-w-full truncate text-[11px] font-medium">
                    {weather.events.wind.toFixed(0)} mph · {weather.temperature}°
                  </span>
                </button>
                <button
                  aria-label={`Model: ${modelSettings.cellSizeMeters} meter grid`}
                  className="flex min-w-0 flex-col items-center gap-1 px-1.5 py-2.5 text-center hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => setActiveStep("model")}
                  title={`${modelSettings.cellSizeMeters} meter grid, ${modelSettings.outputIntervalMinutes} minute outputs`}
                  type="button"
                >
                  <SlidersHorizontal aria-hidden="true" className="size-3.5 text-muted-foreground" />
                  <span className="max-w-full truncate text-[11px] font-medium">{modelSettings.cellSizeMeters} m grid</span>
                </button>
                <button
                  aria-label={`Duration: ${durationHours} hours`}
                  className="flex min-w-0 flex-col items-center gap-1 px-1.5 py-2.5 text-center hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => setActiveStep("review")}
                  title={`${durationHours}-hour duration`}
                  type="button"
                >
                  <Clock3 aria-hidden="true" className="size-3.5 text-muted-foreground" />
                  <span className="max-w-full truncate text-[11px] font-medium">{durationHours} hours</span>
                </button>
              </section>

              <CardFooter className="mt-auto flex-row items-center justify-between border-t bg-background px-3 py-3">
                <Button
                  aria-label={previousStep ? `Back to ${previousStep.label}` : "No previous step"}
                  disabled={!previousStep}
                  onClick={() => previousStep && setActiveStep(previousStep.id)}
                  size="icon"
                  variant="outline"
                >
                  <ArrowLeft aria-hidden="true" />
                </Button>
                {submissionError ? (
                  <p className="max-w-52 truncate text-xs text-destructive" role="alert" title={submissionError}>
                    {submissionError}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{SETUP_STEPS[activeStepIndex].label}</span>
                    {" · "}{activeStepIndex + 1} of {SETUP_STEPS.length}
                  </p>
                )}
                <Button
                  aria-label={nextStep ? `Continue to ${nextStep.label}` : `Run ${durationHours}-hour simulation`}
                  disabled={nextDisabled || isSubmitting}
                  onClick={handleNext}
                  size="icon"
                >
                  <ArrowRight aria-hidden="true" />
                </Button>
              </CardFooter>
            </Card>
          </PopoverAnchor>
        </FloatingMapPanel>
        <PopoverContent
          align="center"
          avoidCollisions={false}
          className={`${surfaceThemeClassName(
            theme
          )} z-10 w-auto border-0 bg-transparent p-0 shadow-none`}
          side={weatherEditorSide}
          sideOffset={12}
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
  );
}
