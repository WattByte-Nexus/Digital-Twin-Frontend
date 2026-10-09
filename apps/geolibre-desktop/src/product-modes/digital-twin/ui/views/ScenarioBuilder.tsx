import {
  Badge, Button, Card, CardContent, CardFooter, DEFAULT_WEATHER_SETTINGS,
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
  FloatingMapPanel, FloatingMapPanelDragHandle, Input, Label, ScrollArea,
  SelectMenu, SelectMenuContent, SelectMenuItem, SelectMenuTrigger, SelectMenuValue,
  Tabs, TabsList, TabsTrigger, surfaceThemeClassName,
  type DigitalTwinRegion, type SurfaceTheme,
} from "@geolibre/ui";
import { ArrowLeft, ArrowRight, Crosshair, Flame, Save, Trash2, Undo2, Redo2, RotateCcw, X } from "lucide-react";
import maplibregl from "maplibre-gl";
import { type Dispatch, type ReactNode, type RefObject, type SetStateAction, useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { fetchDigitalTwinRegionReadiness } from "../../../../lib/digital-twin-regions";
import { requestDigitalTwinJson } from "../../../../lib/digital-twin-api";
import type { DigitalTwinRegionBounds } from "../../../../lib/digital-twin-runs";
import {
  directRunBody, fetchDigitalTwinWeatherPage, reviewedRunFingerprint, resolveDigitalTwinForecast,
  scenarioCreateBody, scenarioSubmission, type DigitalTwinForecast, type DigitalTwinScenario, type DigitalTwinWeatherDataset,
} from "../../../../lib/digital-twin-scenarios";
import { ScenarioIgnitionCoordinates } from "./ScenarioIgnitionCoordinates";
import { type IgnitionPoint, type ScenarioRunRequest } from "../simulation-flow";

interface ScenarioBuilderProps {
  apiUrl: string;
  activeRegionId: string;
  initialRequest?: ScenarioRunRequest;
  mapControllerRef: RefObject<ScenarioMapController | null>;
  mapSlot: ReactNode;
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onRun: (request: ScenarioRunRequest, idempotencyKey: string) => Promise<void>;
  onSave: (request: Extract<ScenarioRunRequest, { mode: "synthetic" }>, idempotencyKey: string) => Promise<DigitalTwinScenario>;
  regions: readonly DigitalTwinRegion[];
  theme: SurfaceTheme;
}
export interface ScenarioMapController { getMap: () => maplibregl.Map | null }
type SetupStep = "area" | "ignitions" | "weather" | "time" | "review";
const SETUP_STEPS = ["area", "ignitions", "weather", "time", "review"] as const;
function pointId(): string {
  return `ignition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function useIgnitionMap({
  enabled,
  maximumPoints,
  mapControllerRef,
  points,
  selectedPointId,
  setPoints,
  setRedoPoints,
  setSelectedPointId,
}: {
  enabled: boolean;
  maximumPoints: number;
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
          draggable: enabled,
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
        if (!enabled || points.length >= maximumPoints) return;
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
    maximumPoints,
    mapControllerRef,
    points,
    selectedPointId,
    setPoints,
    setRedoPoints,
    setSelectedPointId,
  ]);
}

export function ScenarioBuilder({ apiUrl, activeRegionId, initialRequest, mapControllerRef, mapSlot, onClose, onDirtyChange, onRun, onSave, regions, theme }: ScenarioBuilderProps) {
  const initialSynthetic = initialRequest?.mode === "synthetic" ? initialRequest : undefined;
  const [scenarioName, setScenarioName] = useState(initialSynthetic?.scenario ?? "");
  const [scenarioId, setScenarioId] = useState(initialSynthetic?.scenarioId);
  const [mode, setMode] = useState<ScenarioRunRequest["mode"]>(initialRequest?.mode ?? "synthetic");
  const [regionId, setRegionId] = useState(initialRequest?.regionId ?? activeRegionId);
  const [durationHours, setDurationHours] = useState(initialRequest && "durationHours" in initialRequest ? initialRequest.durationHours : 4);
  const [deltaTHours, setDeltaTHours] = useState(initialRequest && "deltaTHours" in initialRequest ? initialRequest.deltaTHours : 1);
  const [startAt, setStartAt] = useState(initialRequest?.mode === "bounded" ? initialRequest.startAt : "");
  const [endAt, setEndAt] = useState(initialRequest?.mode === "bounded" ? initialRequest.endAt : "");
  const [windSpeed, setWindSpeed] = useState(initialSynthetic?.windSpeedMph ?? 18);
  const [windDirection, setWindDirection] = useState(initialSynthetic?.windDirectionDegrees ?? 90);
  const [bounds, setBounds] = useState<DigitalTwinRegionBounds | null>(initialSynthetic?.bounds ?? null);
  const [regionBounds, setRegionBounds] = useState<DigitalTwinRegionBounds | null>(null);
  const [baseWeatherVersion, setBaseWeatherVersion] = useState(initialSynthetic?.baseWeatherVersion ?? "");
  const [weatherDatasets, setWeatherDatasets] = useState<DigitalTwinWeatherDataset[]>([]);
  const [weatherCursor, setWeatherCursor] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [readiness, setReadiness] = useState<{ ready_to_simulate: boolean; reason_codes: string[] } | null>(null);
  const [activeStep, setActiveStep] = useState<SetupStep>(initialSynthetic?.scenarioId ? "ignitions" : "area");
  const [placementActive, setPlacementActive] = useState(true);
  const [points, setPoints] = useState<IgnitionPoint[]>(initialRequest?.ignitionPoints ?? []);
  const [redoPoints, setRedoPoints] = useState<IgnitionPoint[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [forecastIssueAt, setForecastIssueAt] = useState(new Date().toISOString());
  const [forecastValidAt, setForecastValidAt] = useState("");
  const [forecast, setForecast] = useState<DigitalTwinForecast | null>(null);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const frozenRef = useRef<{ fingerprint: string; key: string; request: ScenarioRunRequest } | null>(null);
  const frozenSaveRef = useRef<{ fingerprint: string; key: string; request: Extract<ScenarioRunRequest, { mode: "synthetic" }> } | null>(null);
  const weather = initialRequest?.weather ?? DEFAULT_WEATHER_SETTINGS;
  const location = regions.find((region) => region.id === regionId)?.name ?? regionId;
  const maximumPoints = mode === "synthetic" ? 100 : 1;
  const portalClass = `${surfaceThemeClassName(theme)} surface-glass-overlay min-w-[var(--radix-select-trigger-width)]`;

  useEffect(() => {
    const controller = new AbortController();
    setSourcesLoading(true);
    setSourceError(null);
    setReadiness(null);
    setWeatherDatasets([]);
    setWeatherCursor(null);
    void Promise.all([
      requestDigitalTwinJson<{ bounds: DigitalTwinRegionBounds }>(apiUrl, `/api/v1/regions/${encodeURIComponent(regionId)}`, { signal: controller.signal }),
      fetchDigitalTwinWeatherPage(apiUrl, regionId, null, { signal: controller.signal }),
      fetchDigitalTwinRegionReadiness(apiUrl, regionId, { signal: controller.signal }),
    ]).then(([region, page, ready]) => {
      if (controller.signal.aborted) return;
      setRegionBounds(region.bounds);
      setBounds((current) => current ?? region.bounds);
      setWeatherDatasets(page.items);
      setWeatherCursor(page.next_cursor);
      setReadiness(ready);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setSourceError(cause instanceof Error ? cause.message : "Region inputs are unavailable.");
    }).finally(() => { if (!controller.signal.aborted) setSourcesLoading(false); });
    return () => controller.abort();
  }, [apiUrl, regionId]);

  useIgnitionMap({ enabled: !isSubmitting && placementActive && activeStep === "ignitions"  , maximumPoints, mapControllerRef, points, selectedPointId, setPoints, setRedoPoints, setSelectedPointId });

  const request: ScenarioRunRequest = mode === "synthetic"
    ? { mode, scenario: scenarioName, scenarioId, regionId, location, durationHours, ignitionPoints: points, weather,
        bounds: bounds ?? { west: 0, south: 0, east: 0, north: 0 }, baseWeatherVersion, windSpeedMph: windSpeed, windDirectionDegrees: windDirection }
    : mode === "bounded"
      ? { mode, regionId, location, ignitionPoints: points, weather, startAt, endAt, deltaTHours }
      : { mode, regionId, location, ignitionPoints: points, weather, durationHours, deltaTHours };
  let validationError: string | null = null;
  let saveError: string | null = null;
  try {
    if (request.mode === "synthetic") {
      scenarioCreateBody(scenarioSubmission(request));
      if (!regionBounds || !bounds || bounds.west < regionBounds.west || bounds.east > regionBounds.east || bounds.south < regionBounds.south || bounds.north > regionBounds.north) throw new Error("The scenario extent must be inside the selected region.");
    }
  } catch (cause) { saveError = cause instanceof Error ? cause.message : "Review scenario inputs."; }
  try {
    if (saveError) throw new Error(saveError);
    if (points.length < 1 || points.length > maximumPoints) throw new Error(`Choose ${mode === "synthetic" ? "1–100" : "exactly one"} ignition point${mode === "synthetic" ? "s" : ""}.`);
    const extent = mode === "synthetic" ? bounds : regionBounds;
    if (!extent || points.some((point) => !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || point.longitude < extent.west || point.longitude > extent.east || point.latitude < extent.south || point.latitude > extent.north)) throw new Error("Ignitions must be inside the selected extent.");
    if (request.mode !== "synthetic") directRunBody(request);
    if (!readiness?.ready_to_simulate) throw new Error(readiness?.reason_codes.join(", ").replaceAll("_", " ") || "Region readiness has not been verified.");
  } catch (cause) { validationError = cause instanceof Error ? cause.message : "Review run inputs."; }
  const editableFingerprint = JSON.stringify({ mode, regionId, scenarioName, durationHours, deltaTHours, startAt, endAt, windSpeed, windDirection, bounds, baseWeatherVersion, points });
  const savedFingerprintRef = useRef(editableFingerprint);
  const dirty = editableFingerprint !== savedFingerprintRef.current || Boolean(initialSynthetic && !scenarioId);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => { onDirtyChange?.(false); }, [onDirtyChange]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const currentStepIndex = SETUP_STEPS.indexOf(activeStep);

  const handleRun = async () => {
    setIsSubmitting(true); setSubmissionError(null);
    try {
      const fingerprint = reviewedRunFingerprint(request);
      if (frozenRef.current?.fingerprint !== fingerprint) frozenRef.current = { fingerprint, key: crypto.randomUUID(), request: structuredClone(request) };
      await onRun(frozenRef.current.request, frozenRef.current.key);
    } catch (cause) { setSubmissionError(cause instanceof Error ? cause.message : "Run submission failed."); }
    finally { setIsSubmitting(false); }
  };
  const handleSave = async () => {
    if (request.mode !== "synthetic") return;
    setIsSubmitting(true); setSubmissionError(null);
    try {
      const fingerprint = JSON.stringify(scenarioCreateBody(scenarioSubmission(request)));
      if (frozenSaveRef.current?.fingerprint !== fingerprint) frozenSaveRef.current = { fingerprint, key: crypto.randomUUID(), request: structuredClone(request) };
      const saved = await onSave(frozenSaveRef.current.request, frozenSaveRef.current.key);
      // A scenario save persists environmental intent; run ignitions remain local.
      savedFingerprintRef.current = JSON.stringify({ mode, regionId, scenarioName, durationHours, deltaTHours, startAt, endAt, windSpeed, windDirection, bounds, baseWeatherVersion, points: [] });
      setScenarioId(saved.scenario_id); setSavedMessage(`Saved as ${saved.scenario_id}`);
    } catch (cause) { setSubmissionError(cause instanceof Error ? cause.message : "Scenario save failed."); }
    finally { setIsSubmitting(false); }
  };
  const loadMoreWeather = async () => {
    if (!weatherCursor) return;
    setSourcesLoading(true); setSourceError(null);
    try {
      const page = await fetchDigitalTwinWeatherPage(apiUrl, regionId, weatherCursor);
      setWeatherDatasets((current) => [...current, ...page.items]); setWeatherCursor(page.next_cursor);
    } catch (cause) { setSourceError(cause instanceof Error ? cause.message : "More weather could not be loaded."); }
    finally { setSourcesLoading(false); }
  };
  const changeRegion = (next: string) => {
    setRegionId(next); setBounds(null); setRegionBounds(null); setBaseWeatherVersion(""); setPoints([]); setRedoPoints([]); setForecast(null); setForecastError(null);
  };

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-background">
      <div className="absolute inset-0">{mapSlot}</div>
      <FloatingMapPanel aria-label="Simulation run setup" defaultSize={{ width: 416, height: 831 }} fitToBounds>
        <Card className={`${surfaceThemeClassName(theme)} relative h-full gap-0 overflow-hidden py-0`} surface="panel">
          <FloatingMapPanelDragHandle className="absolute inset-x-0 top-0 z-10 h-14" />
          <header className="relative flex bg-background items-start gap-3 border-b px-4 py-3">
            <div className="min-w-0 flex-1"><h2 className="text-base font-semibold">Run setup</h2><p className="mt-1 text-xs text-muted-foreground" role="status">{savedMessage ?? (scenarioId ? `Saved scenario ${scenarioId}` : "Unsaved changes · local draft")}</p></div>
            <Button aria-label="Close run setup" disabled={isSubmitting} className="relative z-20" onClick={() => dirty ? setDiscardOpen(true) : onClose()} size="icon" variant="ghost"><X aria-hidden="true" /></Button>
          </header>
          <Tabs value={activeStep} onValueChange={(value) => setActiveStep(value as SetupStep)} className="px-3 pt-3">
            <TabsList className="w-full">{SETUP_STEPS.map((step) => <TabsTrigger key={step} value={step} className="flex-1 capitalize">{step}</TabsTrigger>)}</TabsList>
          </Tabs>
          <ScrollArea className="min-h-0 flex-1"><CardContent className="space-y-4 p-4">
            <fieldset disabled={isSubmitting} className="min-w-0 space-y-4">
            {activeStep === "area" ? <>
              <div className="space-y-2"><Label htmlFor="run-input-mode">Input mode</Label><SelectMenu value={mode} onValueChange={(next) => { setMode(next as ScenarioRunRequest["mode"]); setSavedMessage(null); }} disabled={Boolean(scenarioId)}><SelectMenuTrigger id="run-input-mode" className="w-full"><SelectMenuValue /></SelectMenuTrigger><SelectMenuContent className={portalClass}><SelectMenuItem value="synthetic">Synthetic wind scenario</SelectMenuItem><SelectMenuItem value="present_forecast">Present / forecast</SelectMenuItem><SelectMenuItem value="bounded">Bounded UTC interval</SelectMenuItem></SelectMenuContent></SelectMenu></div>
              <div className="space-y-2"><Label htmlFor="scenario-location">Simulation region</Label><SelectMenu value={regionId} onValueChange={changeRegion} disabled={Boolean(scenarioId)}><SelectMenuTrigger id="scenario-location" className="w-full"><SelectMenuValue placeholder="Choose a region" /></SelectMenuTrigger><SelectMenuContent className={portalClass}>{regions.map((region) => <SelectMenuItem key={region.id} value={region.id}>{region.name}</SelectMenuItem>)}</SelectMenuContent></SelectMenu></div>
              {mode === "synthetic" ? <><Label htmlFor="scenario-name">Scenario name</Label><Input id="scenario-name" value={scenarioName} onChange={(event) => setScenarioName(event.target.value)} disabled={Boolean(scenarioId)} placeholder="Name this scenario" /><p className="text-xs text-muted-foreground">Select a rectangular extent inside the region. Saved scenarios remain immutable.</p><div className="grid grid-cols-2 gap-3">{(["west", "south", "east", "north"] as const).map((edge) => <div key={edge} className="space-y-1"><Label htmlFor={`scenario-${edge}`} className="capitalize">{edge}</Label><Input id={`scenario-${edge}`} type="number" step="any" value={bounds?.[edge] ?? ""} disabled={Boolean(scenarioId)} onChange={(event) => setBounds((current) => ({ ...(current ?? { west: 0, south: 0, east: 0, north: 0 }), [edge]: Number(event.target.value) }))} /></div>)}</div></> : null}
              <div className="rounded-md border p-3"><Badge variant={readiness?.ready_to_simulate ? "default" : "secondary"}>{readiness?.ready_to_simulate ? "Ready to simulate" : sourcesLoading ? "Checking readiness…" : "Not ready to simulate"}</Badge><p className="mt-2 text-xs text-muted-foreground">{readiness?.reason_codes.join(", ").replaceAll("_", " ") || "Publication and model readiness are checked separately."}</p></div>
              {scenarioId ? <p className="text-xs text-muted-foreground">To change saved conditions, return to the library and choose Edit as new.</p> : null}
            </> : null}
            {activeStep === "ignitions" ? <>
              <h3 className="font-semibold">Ignitions</h3><p className="text-xs text-muted-foreground">Click the map to place points, or drag markers to refine their coordinates.</p><p className="text-sm text-muted-foreground">{mode === "synthetic" ? "Choose 1–100 ordered ignition points for this run. Ignitions are not saved in the scenario." : "Direct runs accept exactly one ignition point."}</p>
              <Button variant="outline" aria-pressed={placementActive} onClick={() => setPlacementActive((current) => !current)}><Crosshair aria-hidden="true" />{placementActive ? "Pause map placement" : "Place on map"}</Button>
              {points.map((point, index) => <div className="flex items-center gap-2 rounded-md border p-2" key={point.id}><Badge variant="outline">{index + 1}</Badge><span className="flex-1 text-xs tabular-nums">{point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}</span><Button aria-label={`Remove ignition source ${index + 1}`} size="icon" variant="ghost" onClick={() => { setRedoPoints((current) => [...current, point]); setPoints((current) => current.filter((candidate) => candidate.id !== point.id)); }}><Trash2 aria-hidden="true" /></Button></div>)}
              <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={!points.length} onClick={() => { const point = points.at(-1); if (point) setRedoPoints((current) => [...current, point]); setPoints((current) => current.slice(0, -1)); }}><Undo2 aria-hidden="true" /> Undo</Button><Button size="sm" variant="outline" disabled={!redoPoints.length || points.length >= maximumPoints} onClick={() => { const point = redoPoints.at(-1); if (point) setPoints((current) => [...current, point]); setRedoPoints((current) => current.slice(0, -1)); }}><Redo2 aria-hidden="true" /> Redo</Button><Button size="sm" variant="outline" disabled={!points.length} onClick={() => { setRedoPoints((current) => [...current, ...points]); setPoints([]); }}><RotateCcw aria-hidden="true" /> Clear all</Button></div>
              <ScenarioIgnitionCoordinates disabled={points.length >= maximumPoints} onAdd={(latitude, longitude) => { setPoints((current) => [...current, { id: pointId(), latitude, longitude }]); setRedoPoints([]); }} />
            </> : null}
            {activeStep === "weather" ? <>
              {mode === "synthetic" ? <>
                <h3 className="font-semibold">Exact base weather</h3><p className="text-xs text-muted-foreground">Select the immutable version used by the Engine. Map appearance and lighting do not change these inputs.</p>
                <SelectMenu value={baseWeatherVersion} onValueChange={setBaseWeatherVersion} disabled={Boolean(scenarioId)}><SelectMenuTrigger className="w-full" aria-label="Base weather version"><SelectMenuValue placeholder="Choose an exact weather version" /></SelectMenuTrigger><SelectMenuContent className={portalClass}>{baseWeatherVersion && !weatherDatasets.some((dataset) => dataset.version === baseWeatherVersion) ? <SelectMenuItem value={baseWeatherVersion}>{baseWeatherVersion}</SelectMenuItem> : null}{weatherDatasets.map((dataset) => <SelectMenuItem key={dataset.dataset_id} value={dataset.version} disabled={!dataset.ready}>{dataset.version} · {dataset.source_kind} · {dataset.provider}{dataset.ready ? "" : " · unavailable"}</SelectMenuItem>)}</SelectMenuContent></SelectMenu>
                {weatherCursor ? <Button disabled={sourcesLoading} onClick={() => { void loadMoreWeather(); }} variant="outline">{sourcesLoading ? "Loading…" : "Load older weather"}</Button> : null}
                <p className="text-xs text-muted-foreground">{weatherDatasets.find((dataset) => dataset.version === baseWeatherVersion)?.band_names.join(", ")}</p>{weatherDatasets.find((dataset) => dataset.version === baseWeatherVersion) ? <p className="text-xs text-muted-foreground">Fresh for live monitoring until {weatherDatasets.find((dataset) => dataset.version === baseWeatherVersion)?.fresh_until}. Historical artifacts remain selectable when ready.</p> : null}
                <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="run-wind-speed">Wind speed (mph)</Label><Input id="run-wind-speed" type="number" min="0" step="any" value={windSpeed} disabled={Boolean(scenarioId)} onChange={(event) => setWindSpeed(Number(event.target.value))} /></div><div className="space-y-2"><Label htmlFor="run-wind-direction">Travel towards (°)</Label><Input id="run-wind-direction" type="number" min="0" max="359.999" step="any" value={windDirection} disabled={Boolean(scenarioId)} onChange={(event) => setWindDirection(Number(event.target.value))} /></div></div>
              </> : <>
                <h3 className="font-semibold">Forecast availability</h3><p className="text-xs text-muted-foreground">The Engine resolves weather when the run executes. This check previews one exact forecast; it does not reserve weather or guarantee coverage for every tick.</p>
                <Label htmlFor="forecast-issue-cutoff">Issue at or before (ISO UTC)</Label><Input id="forecast-issue-cutoff" value={forecastIssueAt} onChange={(event) => { setForecastIssueAt(event.target.value); setForecast(null); }} />
                <Label htmlFor="forecast-valid-time">Valid at (ISO UTC)</Label><Input id="forecast-valid-time" placeholder="2026-10-09T18:00:00Z" value={forecastValidAt} onChange={(event) => { setForecastValidAt(event.target.value); setForecast(null); }} />
                <Button variant="outline" disabled={forecastLoading} onClick={async () => { setForecastLoading(true); setForecastError(null); setForecast(null); try { setForecast(await resolveDigitalTwinForecast(apiUrl, regionId, forecastIssueAt, forecastValidAt)); } catch (cause) { setForecastError(cause instanceof Error ? cause.message : "Forecast unavailable."); } finally { setForecastLoading(false); } }}>{forecastLoading ? "Checking…" : "Check forecast"}</Button>
                {forecast ? <div className="rounded-md border p-3 text-xs"><p>{forecast.ready ? "Available" : "Artifact not ready"}: {forecast.dataset_id}</p><p>Issued {forecast.issue_time}</p><p>Valid {forecast.valid_time}</p><p>{forecast.fields.join(", ")}</p></div> : null}{forecastError ? <p role="alert" className="text-sm text-destructive">{forecastError}</p> : null}
              </>}
            </> : null}
            {activeStep === "time" ? <>
              <h3 className="font-semibold">Simulation time</h3>
              {mode === "bounded" ? <><Label htmlFor="run-start-at">Start instant (ISO with UTC offset)</Label><Input id="run-start-at" value={startAt} onChange={(event) => setStartAt(event.target.value)} placeholder="2026-10-09T12:00:00Z" /><Label htmlFor="run-end-at">End instant (ISO with UTC offset)</Label><Input id="run-end-at" value={endAt} onChange={(event) => setEndAt(event.target.value)} placeholder="2026-10-09T14:00:00Z" /></> : <><Label htmlFor="simulation-duration">Duration (hours)</Label><Input id="simulation-duration" type="number" min={mode === "synthetic" ? 1 : 0.01} step={mode === "synthetic" ? 1 : "any"} disabled={Boolean(scenarioId)} value={durationHours} onChange={(event) => setDurationHours(Number(event.target.value))} /></>}
              {mode === "synthetic" ? <p className="text-xs text-muted-foreground">The Engine uses one-hour timesteps for synthetic scenarios. Numerical model configuration is owned by the Engine.</p> : <><Label htmlFor="run-timestep">Timestep (hours)</Label><Input id="run-timestep" type="number" step="any" min="0.000001" value={deltaTHours} onChange={(event) => setDeltaTHours(Number(event.target.value))} /><p className="text-xs text-muted-foreground">Bounded intervals must divide into whole timesteps. Present / forecast may end with a partial tick.</p></>}
            </> : null}
            {activeStep === "review" ? <>
              <h3 className="font-semibold">Review accepted intent</h3><p className="text-xs text-muted-foreground">Retries preserve this exact request and identity. Changing accepted inputs starts a new intent.</p>
              <div className="space-y-2 rounded-md border p-3 text-sm"><p>{location} · {mode.replaceAll("_", " / ")}</p><p>{points.length} ignition point{points.length === 1 ? "" : "s"}</p>{mode === "synthetic" ? <><p>{scenarioName} · {durationHours} h</p><p>{baseWeatherVersion || "Base weather required"}</p><p>{windSpeed} mph towards {windDirection}°</p><p className="tabular-nums">Extent: {bounds ? `${bounds.west}, ${bounds.south} → ${bounds.east}, ${bounds.north}` : "required"}</p></> : mode === "bounded" ? <><p>{startAt || "Start required"}</p><p>{endAt || "End required"}</p><p>{deltaTHours} h timestep</p></> : <p>{durationHours} h · {deltaTHours} h timestep</p>}</div>
              {validationError ? <p className="text-sm text-destructive">{validationError}</p> : null}
              {mode === "synthetic" ? <Button className="w-full" disabled={Boolean(saveError) || isSubmitting || Boolean(scenarioId)} variant="outline" onClick={() => { void handleSave(); }}><Save aria-hidden="true" />Save scenario without running</Button> : null}
            </> : null}
            </fieldset>
            {sourceError ? <p role="alert" className="text-sm text-destructive">{sourceError}</p> : null}
            {submissionError ? <p role="alert" className="text-sm text-destructive">{submissionError}</p> : null}
          </CardContent></ScrollArea>
          <section aria-label="Configuration summary" className="grid grid-cols-4 divide-x border-t bg-background text-center text-xs"><div className="p-2"><p className="text-muted-foreground">Region</p><p className="truncate font-medium">{location}</p></div><div className="p-2"><p className="text-muted-foreground">Ignitions</p><p className="tabular-nums">{points.length}</p></div><div className="p-2"><p className="text-muted-foreground">Weather</p><p>{mode === "synthetic" ? `${windSpeed} mph` : "Engine resolved"}</p></div><div className="p-2"><p className="text-muted-foreground">Time</p><p>{mode === "bounded" ? "UTC interval" : `${durationHours} h`}</p></div></section>
          <CardFooter className="mt-auto flex-row justify-between border-t p-3"><Button variant="outline" disabled={currentStepIndex === 0 || isSubmitting} onClick={() => setActiveStep(SETUP_STEPS[currentStepIndex - 1])}><ArrowLeft aria-hidden="true" />Back</Button>{activeStep === "review" ? <Button disabled={Boolean(validationError) || isSubmitting} onClick={() => { void handleRun(); }}><Flame aria-hidden="true" />{isSubmitting ? "Submitting…" : "Run simulation"}</Button> : <Button onClick={() => setActiveStep(SETUP_STEPS[currentStepIndex + 1])}>Next<ArrowRight aria-hidden="true" /></Button>}</CardFooter>
        </Card>
      </FloatingMapPanel>
      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}><DialogContent className={`${surfaceThemeClassName(theme)} surface-glass-overlay`}><DialogHeader><DialogTitle>Discard local changes?</DialogTitle><DialogDescription>This draft has not been saved to the Engine. Closing discards unsaved setup and ignition points.</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDiscardOpen(false)}>Keep editing</Button><Button variant="destructive" onClick={onClose}>Discard changes</Button></div></DialogContent></Dialog>
    </div>
  );
}
