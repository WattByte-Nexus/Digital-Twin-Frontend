import {
  Button, Card, CardContent, CardDescription, CardHeader, CardTitle, DEFAULT_WEATHER_SETTINGS,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, FilterSearch,
  FilterToolbar, FilterToolbarRow, ScrollArea, SelectMenu, SelectMenuContent, SelectMenuItem,
  SelectMenuTrigger, SelectMenuValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  surfaceThemeClassName, type DigitalTwinRegion, type SurfaceTheme,
} from "@geolibre/ui";
import { Copy, Flame, MoreHorizontal, Pencil, Plus, RefreshCw } from "lucide-react";
import { type ReactNode, type RefObject, useEffect, useState } from "react";
import {
  createDigitalTwinScenario, fetchDigitalTwinScenario, fetchDigitalTwinScenarios,
  scenarioSubmission, type DigitalTwinScenario,
} from "../../../../lib/digital-twin-scenarios";
import { type ScenarioRunRequest } from "../simulation-flow";
import { ScenarioBuilder, type ScenarioMapController } from "./ScenarioBuilder";

export function requestForSavedScenario(scenario: DigitalTwinScenario, regionName: string, asNew = false): Extract<ScenarioRunRequest, { mode: "synthetic" }> {
  return {
    mode: "synthetic", scenario: asNew ? `${scenario.name} copy` : scenario.name,
    scenarioId: asNew ? undefined : scenario.scenario_id,
    regionId: scenario.region_id, location: regionName, durationHours: scenario.duration_hours,
    bounds: { ...scenario.bounds }, baseWeatherVersion: scenario.base_weather_version,
    windSpeedMph: scenario.wind_speed.submitted_unit === "mph" ? scenario.wind_speed.submitted_value : scenario.wind_speed.canonical_meters_per_second / 0.44704,
    windDirectionDegrees: scenario.wind_direction.submitted_bearing_degrees,
    ignitionPoints: [], weather: DEFAULT_WEATHER_SETTINGS,
  };
}

interface ScenariosViewProps {
  apiUrl: string;
  activeRegionId: string;
  creationRequest: number;
  mapControllerRef: RefObject<ScenarioMapController | null>;
  mapSlot: ReactNode;
  onBuilderOpenChange: (open: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onRun: (request: ScenarioRunRequest, idempotencyKey: string) => Promise<void>;
  regions: readonly DigitalTwinRegion[];
  theme: SurfaceTheme;
}

export function ScenariosView({ apiUrl, activeRegionId, creationRequest, mapControllerRef, mapSlot, onBuilderOpenChange, onDirtyChange, onRun, regions, theme }: ScenariosViewProps) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [initialRequest, setInitialRequest] = useState<ScenarioRunRequest | undefined>();
  const [scenarios, setScenarios] = useState<DigitalTwinScenario[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [regionId, setRegionId] = useState(activeRegionId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [lastSuccess, setLastSuccess] = useState<Date | null>(null);

  useEffect(() => { onBuilderOpenChange(builderOpen); }, [builderOpen, onBuilderOpenChange]);
  useEffect(() => { if (creationRequest > 0) { setInitialRequest(undefined); setBuilderOpen(true); } }, [creationRequest]);
  useEffect(() => { setRegionId(activeRegionId); }, [activeRegionId]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null); setScenarios([]); setCursor(null);
    void fetchDigitalTwinScenarios(apiUrl, regionId, null, { signal: controller.signal }).then((page) => {
      if (controller.signal.aborted) return;
      setScenarios(page.items); setCursor(page.next_cursor); setLastSuccess(new Date());
    }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Scenarios could not be loaded."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [apiUrl, regionId, revision]);

  const openScenario = async (scenarioId: string, asNew: boolean) => {
    setLoading(true); setError(null);
    try {
      const scenario = await fetchDigitalTwinScenario(apiUrl, scenarioId);
      setInitialRequest(requestForSavedScenario(scenario, regions.find((region) => region.id === scenario.region_id)?.name ?? scenario.region_id, asNew));
      setBuilderOpen(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Scenario could not be retrieved."); }
    finally { setLoading(false); }
  };
  const loadMore = async () => {
    if (!cursor) return;
    setLoading(true); setError(null);
    try {
      const page = await fetchDigitalTwinScenarios(apiUrl, regionId, cursor);
      setScenarios((current) => [...current, ...page.items]); setCursor(page.next_cursor); setLastSuccess(new Date());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "More scenarios could not be loaded."); }
    finally { setLoading(false); }
  };
  const saveScenario = async (request: Extract<ScenarioRunRequest, { mode: "synthetic" }>, idempotencyKey: string) => {
    const saved = await createDigitalTwinScenario(apiUrl, scenarioSubmission(request), { idempotencyKey: `scenario-${idempotencyKey}` });
    setRevision((current) => current + 1);
    return saved;
  };
  if (builderOpen) return <ScenarioBuilder apiUrl={apiUrl} activeRegionId={activeRegionId} initialRequest={initialRequest} mapControllerRef={mapControllerRef} mapSlot={mapSlot} onClose={() => setBuilderOpen(false)} onDirtyChange={onDirtyChange} onRun={onRun} onSave={saveScenario} regions={regions} theme={theme} />;

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visible = scenarios.filter((scenario) => `${scenario.name} ${scenario.scenario_id} ${scenario.region_id} ${scenario.base_weather_version}`.toLocaleLowerCase().includes(normalizedQuery));
  const portalClass = `${surfaceThemeClassName(theme)} surface-glass-overlay min-w-[var(--radix-select-trigger-width)]`;
  return <div className="flex h-full min-h-0 flex-col bg-background">
    <header className="flex flex-wrap items-center justify-between gap-4 px-5 pb-2 pt-5 lg:px-7"><div><h1 className="text-2xl font-semibold tracking-tight">Scenarios</h1><p className="mt-1 max-w-prose text-sm text-muted-foreground">Immutable Engine scenarios store environmental intent. Choose ignitions when running.</p></div><div className="flex gap-2"><Button disabled={loading} onClick={() => setRevision((current) => current + 1)} variant="outline"><RefreshCw aria-hidden="true" />Refresh</Button><Button onClick={() => { setInitialRequest(undefined); setBuilderOpen(true); }}><Plus aria-hidden="true" />New setup</Button></div></header>
    <div className="px-5 py-3 lg:px-7"><FilterToolbar><FilterToolbarRow><FilterSearch aria-label="Search scenarios" placeholder="Search scenarios…" value={query} onValueChange={setQuery} /><SelectMenu value={regionId} onValueChange={setRegionId}><SelectMenuTrigger className="w-52" aria-label="Scenario region"><SelectMenuValue /></SelectMenuTrigger><SelectMenuContent className={portalClass}>{regions.map((region) => <SelectMenuItem key={region.id} value={region.id}>{region.name}</SelectMenuItem>)}</SelectMenuContent></SelectMenu></FilterToolbarRow></FilterToolbar></div>
    <ScrollArea className="min-h-0 flex-1"><div className="space-y-4 px-5 pb-5 lg:px-7">
      {error ? <Card><CardContent className="space-y-2 pt-4"><p role="alert" className="text-sm text-destructive">{error}</p><p className="text-xs text-muted-foreground">{lastSuccess ? `Last successful update: ${lastSuccess.toLocaleTimeString()}. Displayed records may be stale.` : "The scenario library is unavailable."}</p><Button onClick={() => setRevision((current) => current + 1)} variant="outline">Retry</Button></CardContent></Card> : null}
      <Card className="gap-0 overflow-hidden py-0"><CardHeader className="px-5 py-4"><CardTitle>Scenario library</CardTitle><CardDescription>{loading ? "Loading Engine records…" : `${visible.length} loaded records${cursor ? " · more available" : ""}`}</CardDescription></CardHeader><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Scenario</TableHead><TableHead>Region</TableHead><TableHead>Wind</TableHead><TableHead>Duration</TableHead><TableHead>Exact base weather</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>{visible.map((scenario) => <TableRow key={scenario.scenario_id}><TableCell><Button className="h-auto p-0 text-left font-semibold" variant="link" disabled={loading} onClick={() => { void openScenario(scenario.scenario_id, false); }}>{scenario.name}</Button><p className="mt-1 font-mono text-xs text-muted-foreground">{scenario.scenario_id}</p></TableCell><TableCell>{regions.find((region) => region.id === scenario.region_id)?.name ?? scenario.region_id}</TableCell><TableCell className="whitespace-nowrap tabular-nums">{scenario.wind_speed.submitted_value} {scenario.wind_speed.submitted_unit} towards {scenario.wind_direction.submitted_bearing_degrees}°</TableCell><TableCell className="tabular-nums">{scenario.duration_hours} h</TableCell><TableCell className="text-xs">{scenario.base_weather_version}</TableCell><TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Actions for ${scenario.name}`} disabled={loading}><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className={portalClass}><DropdownMenuItem onSelect={() => { void openScenario(scenario.scenario_id, false); }}><Flame aria-hidden="true" />Run saved scenario</DropdownMenuItem><DropdownMenuItem onSelect={() => { void openScenario(scenario.scenario_id, true); }}><Pencil aria-hidden="true" />Edit as new</DropdownMenuItem><DropdownMenuItem onSelect={() => { void openScenario(scenario.scenario_id, true); }}><Copy aria-hidden="true" />Duplicate as new</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell></TableRow>)}</TableBody></Table>{!loading && visible.length === 0 ? <div className="p-8 text-center"><p className="font-medium">{error ? "Scenario library unavailable" : "No saved scenarios"}</p><p className="mt-1 text-sm text-muted-foreground">{query ? "Adjust your search." : "Create a setup and save its reviewed environmental inputs."}</p></div> : null}</CardContent></Card>
      {cursor ? <Button disabled={loading} onClick={() => { void loadMore(); }} variant="outline">{loading ? "Loading…" : "Load more scenarios"}</Button> : null}
    </div></ScrollArea>
  </div>;
}
