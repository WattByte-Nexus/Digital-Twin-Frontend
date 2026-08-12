import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FilterButton,
  FilterChip,
  FilterSearch,
  FilterSelectTrigger,
  FilterToolbar,
  FilterToolbarRow,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  SelectMenu,
  SelectMenuContent,
  SelectMenuItem,
  SelectMenuValue,
  SortableTableHeader,
  Separator,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  surfaceThemeClassName,
  type SurfaceTheme,
} from "@geolibre/ui";
import {
  AlertCircle,
  Flame,
  LoaderCircle,
  MapPinned,
  Plus,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { type ReactNode, type RefObject, useMemo, useState } from "react";
import {
  DEFAULT_DIGITAL_TWIN_RUN_FILTERS,
  digitalTwinRunStatusLabel,
  filterDigitalTwinRuns,
  type DigitalTwinRegionRecord,
  type DigitalTwinRunFilters,
  type DigitalTwinRunRecord,
  type DigitalTwinRunStatus,
} from "../../../../lib/digital-twin-runs";
import { runIdFromLocation } from "../simulation-flow";
import { RunDetailView } from "./RunDetailView";

interface RunsViewProps {
  apiUrl: string;
  error: Error | null;
  isLoading: boolean;
  location: string;
  mapControllerRef: RefObject<{ getMap: () => MapLibreMap | null } | null>;
  mapSlot: ReactNode;
  onCreateScenario: () => void;
  onOpenRun: (runId: string) => void;
  onRefresh: () => void;
  onReturnToRuns: () => void;
  regions: DigitalTwinRegionRecord[];
  runs: DigitalTwinRunRecord[];
  theme: SurfaceTheme;
}

const RUN_STATUSES: DigitalTwinRunStatus[] = [
  "STARTED",
  "QUEUED",
  "COMPLETED",
  "FAILED",
  "CANCEL_REQUESTED",
  "CANCELLED",
];

type RunSortKey =
  | "status"
  | "scenario"
  | "region"
  | "run"
  | "trigger"
  | "horizon"
  | "ignitions"
  | "snapshots";
type SortDirection = "asc" | "desc";

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

function formatHours(value: number | null): string {
  return value === null ? "Not reported" : `${value.toLocaleString()} h`;
}

export function RunsView({
  apiUrl,
  error,
  isLoading,
  location,
  mapControllerRef,
  mapSlot,
  onCreateScenario,
  onOpenRun,
  onRefresh,
  onReturnToRuns,
  regions,
  runs,
  theme,
}: RunsViewProps) {
  const selectedRunId = runIdFromLocation(location);
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? null;
  const [filters, setFilters] = useState<DigitalTwinRunFilters>(
    DEFAULT_DIGITAL_TWIN_RUN_FILTERS,
  );
  const [sortKey, setSortKey] = useState<RunSortKey>("run");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const visibleRuns = useMemo(() => {
    const valueFor = (run: DigitalTwinRunRecord) => {
      switch (sortKey) {
        case "status":
          return digitalTwinRunStatusLabel(run.status);
        case "scenario":
          return run.scenarioId ?? "";
        case "region":
          return run.regionName;
        case "run":
          return run.id;
        case "trigger":
          return run.triggerKind;
        case "horizon":
          return run.durationHours ?? Number.POSITIVE_INFINITY;
        case "ignitions":
          return run.ignitionPoints.length;
        case "snapshots":
          return run.completedTicks;
      }
    };

    return [...filterDigitalTwinRuns(runs, filters)].sort((left, right) => {
      const a = valueFor(left);
      const b = valueFor(right);
      const comparison =
        typeof a === "number" && typeof b === "number"
          ? a - b
          : String(a).localeCompare(String(b), undefined, { numeric: true });
      return comparison * (sortDirection === "asc" ? 1 : -1);
    });
  }, [filters, runs, sortDirection, sortKey]);
  const scenarios = useMemo(
    () =>
      [...new Set(runs.flatMap((run) => (run.scenarioId ? [run.scenarioId] : [])))].sort(
        (left, right) => left.localeCompare(right),
      ),
    [runs],
  );
  const regionNames = useMemo(
    () => new Map(regions.map((region) => [region.id, region.name])),
    [regions],
  );

  if (selectedRun) {
    return (
      <RunDetailView
        apiUrl={apiUrl}
        mapControllerRef={mapControllerRef}
        mapSlot={mapSlot}
        onBack={onReturnToRuns}
        run={selectedRun}
      />
    );
  }

  if (selectedRunId && !isLoading) {
    return (
      <div className="grid h-full min-h-0 place-items-center bg-background p-6">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Run not found</CardTitle>
            <CardDescription>
              The Digital Twin API did not return a run with this identifier.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onReturnToRuns} variant="outline">Return to runs</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeFilterCount = [
    filters.status !== "all",
    filters.regionId !== "all",
    filters.scenarioId !== "all",
  ].filter(Boolean).length;
  const menuFilterCount = [
    filters.status !== "all",
    filters.scenarioId !== "all",
  ].filter(Boolean).length;
  const setFilter = <Key extends keyof DigitalTwinRunFilters>(
    key: Key,
    value: DigitalTwinRunFilters[Key],
  ) => setFilters((current) => ({ ...current, [key]: value }));
  const sort = (key: RunSortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-4 px-5 pb-2 pt-5 lg:px-7">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Runs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Authoritative simulation runs from the Digital Twin API.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button disabled={isLoading} onClick={onRefresh} variant="outline">
            <RefreshCw aria-hidden="true" className={isLoading ? "animate-spin" : undefined} />
            Refresh
          </Button>
          <Button onClick={onCreateScenario}>
            <Plus aria-hidden="true" /> New simulation
          </Button>
        </div>
      </header>

      <div className="px-5 pb-5 pt-2 lg:px-7">
        <FilterToolbar>
          <FilterToolbarRow>
            <FilterSearch
              aria-label="Search runs"
              onValueChange={(value) => setFilter("query", value)}
              placeholder="Search runs…"
              value={filters.query}
            />
          <SelectMenu
            onValueChange={(value) => setFilter("regionId", value)}
            value={filters.regionId}
          >
            <FilterSelectTrigger className="w-48">
              <MapPinned aria-hidden="true" />
              <SelectMenuValue placeholder="All regions" />
            </FilterSelectTrigger>
            <SelectMenuContent
              className={`${surfaceThemeClassName(theme)} surface-glass-overlay min-w-[var(--radix-select-trigger-width)]`}
              position="popper"
            >
              <SelectMenuItem value="all">All regions</SelectMenuItem>
              {regions.map((region) => (
                <SelectMenuItem key={region.id} value={region.id}>{region.name}</SelectMenuItem>
              ))}
            </SelectMenuContent>
          </SelectMenu>
            <Popover>
              <PopoverTrigger asChild>
                <FilterButton aria-label="Open run filters">
                  <SlidersHorizontal aria-hidden="true" className="size-3.5" />
                  Filters
                  {menuFilterCount > 0 ? (
                    <Badge className="ml-0.5 h-4 min-w-4 px-1 text-[10px]" variant="secondary">
                      {menuFilterCount}
                    </Badge>
                  ) : null}
                </FilterButton>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className={`${surfaceThemeClassName(theme)} surface-glass-overlay w-72 p-0`}
              >
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">Filter runs</p>
                    <p className="text-xs text-muted-foreground">Narrow the simulation history.</p>
                  </div>
                  {menuFilterCount > 0 ? (
                    <Button
                      className="h-7 px-2 text-xs"
                      onClick={() =>
                        setFilters((current) => ({ ...current, scenarioId: "all", status: "all" }))
                      }
                      size="sm"
                      variant="ghost"
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
                <Separator />
                <div className="space-y-3 p-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <SelectMenu
                      onValueChange={(value) =>
                        setFilter("status", value as DigitalTwinRunStatus | "all")
                      }
                      value={filters.status}
                    >
                      <FilterSelectTrigger className="w-full">
                        <SelectMenuValue placeholder="Any status" />
                      </FilterSelectTrigger>
                      <SelectMenuContent
                        className={`${surfaceThemeClassName(theme)} surface-glass-overlay min-w-[var(--radix-select-trigger-width)]`}
                        position="popper"
                      >
                        <SelectMenuItem value="all">Any status</SelectMenuItem>
                        {RUN_STATUSES.map((status) => (
                          <SelectMenuItem key={status} value={status}>
                            {digitalTwinRunStatusLabel(status)}
                            <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                              {runs.filter((run) => run.status === status).length}
                            </span>
                          </SelectMenuItem>
                        ))}
                      </SelectMenuContent>
                    </SelectMenu>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Scenario</Label>
                    <SelectMenu
                      onValueChange={(value) => setFilter("scenarioId", value)}
                      value={filters.scenarioId}
                    >
                      <FilterSelectTrigger className="w-full">
                        <SelectMenuValue placeholder="All scenarios" />
                      </FilterSelectTrigger>
                      <SelectMenuContent
                        className={`${surfaceThemeClassName(theme)} surface-glass-overlay min-w-[var(--radix-select-trigger-width)]`}
                        position="popper"
                      >
                        <SelectMenuItem value="all">All scenarios</SelectMenuItem>
                        {scenarios.map((scenarioId) => (
                          <SelectMenuItem key={scenarioId} value={scenarioId}>{scenarioId}</SelectMenuItem>
                        ))}
                      </SelectMenuContent>
                    </SelectMenu>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </FilterToolbarRow>

          {activeFilterCount > 0 ? (
            <FilterToolbarRow aria-label="Active run filters">
            {filters.regionId !== "all" ? (
              <FilterChip
                label={`Region: ${regionNames.get(filters.regionId) ?? filters.regionId}`}
                onRemove={() => setFilter("regionId", "all")}
              />
            ) : null}
            {filters.scenarioId !== "all" ? (
              <FilterChip
                label={`Scenario: ${filters.scenarioId}`}
                onRemove={() => setFilter("scenarioId", "all")}
              />
            ) : null}
            {filters.status !== "all" ? (
              <FilterChip
                label={`Status: ${digitalTwinRunStatusLabel(filters.status)}`}
                onRemove={() => setFilter("status", "all")}
              />
            ) : null}
              <Button
                className="h-7 px-2 text-[11px] text-muted-foreground"
                onClick={() => setFilters(DEFAULT_DIGITAL_TWIN_RUN_FILTERS)}
                size="sm"
                variant="ghost"
              >
                Clear all
              </Button>
            </FilterToolbarRow>
          ) : null}
        </FilterToolbar>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-5 pb-5 lg:px-7 lg:pb-7">
          {error ? (
            <Card className="mb-4 bg-destructive/5">
              <CardContent className="flex flex-wrap items-center gap-3 px-5">
                <AlertCircle aria-hidden="true" className="size-5 text-destructive" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">Runs could not be loaded</p>
                  <p className="text-sm text-muted-foreground">{error.message}</p>
                </div>
                <Button onClick={onRefresh} variant="outline">Try again</Button>
              </CardContent>
            </Card>
          ) : null}
          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="px-5 py-4">
              <CardTitle className="text-base">Simulation history</CardTitle>
              <CardDescription>{visibleRuns.length} of {runs.length} API runs</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <SortableTableHeader active={sortKey === "status"} direction={sortDirection} onClick={() => sort("status")}>
                        Status
                      </SortableTableHeader>
                    </TableHead>
                    <TableHead>
                      <SortableTableHeader active={sortKey === "scenario"} direction={sortDirection} onClick={() => sort("scenario")}>
                        Scenario
                      </SortableTableHeader>
                    </TableHead>
                    <TableHead>
                      <SortableTableHeader active={sortKey === "region"} direction={sortDirection} onClick={() => sort("region")}>
                        Region
                      </SortableTableHeader>
                    </TableHead>
                    <TableHead>
                      <SortableTableHeader active={sortKey === "run"} direction={sortDirection} onClick={() => sort("run")}>
                        Run
                      </SortableTableHeader>
                    </TableHead>
                    <TableHead>
                      <SortableTableHeader active={sortKey === "trigger"} direction={sortDirection} onClick={() => sort("trigger")}>
                        Trigger
                      </SortableTableHeader>
                    </TableHead>
                    <TableHead>
                      <SortableTableHeader active={sortKey === "horizon"} direction={sortDirection} onClick={() => sort("horizon")}>
                        Horizon
                      </SortableTableHeader>
                    </TableHead>
                    <TableHead>
                      <SortableTableHeader active={sortKey === "ignitions"} direction={sortDirection} onClick={() => sort("ignitions")}>
                        Ignitions
                      </SortableTableHeader>
                    </TableHead>
                    <TableHead>
                      <SortableTableHeader active={sortKey === "snapshots"} direction={sortDirection} onClick={() => sort("snapshots")}>
                        Snapshots
                      </SortableTableHeader>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRuns.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell><RunStatusBadge status={run.status} /></TableCell>
                      <TableCell>
                        <Button
                          className="h-auto justify-start p-0 text-left font-medium"
                          onClick={() => onOpenRun(run.id)}
                          variant="link"
                        >
                          {run.scenarioId ?? "—"}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div>{run.regionName}</div>
                        <div className="font-mono text-xs text-muted-foreground">{run.regionId}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{run.id}</TableCell>
                      <TableCell className="capitalize">{run.triggerKind}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatHours(run.durationHours)}
                      </TableCell>
                      <TableCell className="tabular-nums">{run.ignitionPoints.length}</TableCell>
                      <TableCell className="tabular-nums">
                        {run.completedTicks}{run.expectedTicks === null ? "" : ` / ${run.expectedTicks}`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {isLoading && runs.length === 0 ? (
                <div className="grid min-h-64 place-items-center p-6 text-center">
                  <div>
                    <LoaderCircle aria-hidden="true" className="mx-auto size-7 animate-spin text-muted-foreground" />
                    <p className="mt-3 font-medium text-foreground">Loading API runs</p>
                  </div>
                </div>
              ) : visibleRuns.length === 0 ? (
                <div className="grid min-h-64 place-items-center p-6 text-center">
                  <div>
                    <Flame aria-hidden="true" className="mx-auto size-7 text-muted-foreground" />
                    <p className="mt-3 font-medium text-foreground">No matching API runs</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Adjust the filters or refresh the Digital Twin API.
                    </p>
                    {activeFilterCount > 0 ? (
                      <Button
                        className="mt-4"
                        onClick={() => setFilters(DEFAULT_DIGITAL_TWIN_RUN_FILTERS)}
                        variant="outline"
                      >
                        Reset filters
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
