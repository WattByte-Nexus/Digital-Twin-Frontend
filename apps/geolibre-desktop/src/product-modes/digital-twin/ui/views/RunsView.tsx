import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
  surfaceThemeClassName,
  type SurfaceTheme,
} from "@geolibre/ui";
import {
  Download,
  ExternalLink,
  Filter,
  Flame,
  MapPinned,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { type ReactNode, type RefObject, useMemo, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  DEFAULT_RUN_FILTERS,
  filterRuns,
  runIdFromLocation,
  type RunFilters,
  type RunStatus,
  type SimulationRun,
} from "../simulation-flow";
import { RunDetailView } from "./RunDetailView";

interface RunsViewProps {
  location: string;
  mapControllerRef: RefObject<{ getMap: () => MapLibreMap | null } | null>;
  mapSlot: ReactNode;
  onCreateScenario: () => void;
  onOpenRun: (runId: string) => void;
  onReturnToRuns: () => void;
  runs: SimulationRun[];
  theme: SurfaceTheme;
}

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

function ActiveFilter({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge className="gap-1 pl-2.5 pr-1" variant="secondary">
      {label}
      <Button
        aria-label={`Remove ${label} filter`}
        className="size-5 rounded-full p-0"
        onClick={onRemove}
        size="icon"
        variant="ghost"
      >
        <X aria-hidden="true" className="size-3" />
      </Button>
    </Badge>
  );
}

export function RunsView({
  location,
  mapControllerRef,
  mapSlot,
  onCreateScenario,
  onOpenRun,
  onReturnToRuns,
  runs,
  theme,
}: RunsViewProps) {
  const selectedRunId = runIdFromLocation(location);
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? null;
  const [filters, setFilters] = useState<RunFilters>(DEFAULT_RUN_FILTERS);

  const visibleRuns = useMemo(() => filterRuns(runs, filters), [filters, runs]);
  const locations = useMemo(() => [...new Set(runs.map((run) => run.location))], [runs]);
  const scenarios = useMemo(() => [...new Set(runs.map((run) => run.scenario))], [runs]);

  if (selectedRun) {
    return (
      <RunDetailView
        mapControllerRef={mapControllerRef}
        mapSlot={mapSlot}
        onBack={onReturnToRuns}
        run={selectedRun}
      />
    );
  }

  if (selectedRunId) {
    return (
      <div className="grid h-full min-h-0 place-items-center bg-background p-6">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Run not found</CardTitle>
            <CardDescription>
              The run may have expired from this session or the link may be incorrect.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onReturnToRuns} variant="outline">
              Return to runs
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeFilterCount = [
    filters.status !== "all",
    filters.location !== "all",
    filters.scenario !== "all",
    filters.timeRange !== "all",
    filters.minimumBurnedArea > 0,
    filters.minimumSpreadRate > 0,
  ].filter(Boolean).length;

  const setFilter = <Key extends keyof RunFilters>(key: Key, value: RunFilters[Key]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4 lg:px-7">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Runs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor simulations, inspect results, and replay fire behavior.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Download aria-hidden="true" /> Export
          </Button>
          <Button onClick={onCreateScenario}>
            <Plus aria-hidden="true" /> New simulation
          </Button>
        </div>
      </header>

      <div className="border-b px-5 py-4 lg:px-7">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1 lg:max-w-sm">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              className="pl-9"
              onChange={(event) => setFilter("query", event.target.value)}
              placeholder="Search runs"
              type="search"
              value={filters.query}
            />
          </div>
          <SelectMenu onValueChange={(value) => setFilter("location", value)} value={filters.location}>
            <SelectMenuTrigger className="w-[185px]">
              <MapPinned aria-hidden="true" />
              <SelectMenuValue placeholder="All locations" />
            </SelectMenuTrigger>
            <SelectMenuContent className={theme === "dark" ? "dark" : undefined}>
              <SelectMenuItem value="all">All locations</SelectMenuItem>
              {locations.map((runLocation) => (
                <SelectMenuItem key={runLocation} value={runLocation}>{runLocation}</SelectMenuItem>
              ))}
            </SelectMenuContent>
          </SelectMenu>
          <SelectMenu onValueChange={(value) => setFilter("scenario", value)} value={filters.scenario}>
            <SelectMenuTrigger className="w-[210px]">
              <SelectMenuValue placeholder="All scenarios" />
            </SelectMenuTrigger>
            <SelectMenuContent className={theme === "dark" ? "dark" : undefined}>
              <SelectMenuItem value="all">All scenarios</SelectMenuItem>
              {scenarios.map((scenario) => (
                <SelectMenuItem key={scenario} value={scenario}>{scenario}</SelectMenuItem>
              ))}
            </SelectMenuContent>
          </SelectMenu>
          <SelectMenu
            onValueChange={(value) => setFilter("timeRange", value as RunFilters["timeRange"])}
            value={filters.timeRange}
          >
            <SelectMenuTrigger className="w-[150px]">
              <SelectMenuValue placeholder="Any time" />
            </SelectMenuTrigger>
            <SelectMenuContent className={theme === "dark" ? "dark" : undefined}>
              <SelectMenuItem value="all">Any time</SelectMenuItem>
              <SelectMenuItem value="today">Today</SelectMenuItem>
              <SelectMenuItem value="week">Last 7 days</SelectMenuItem>
            </SelectMenuContent>
          </SelectMenu>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Filter aria-hidden="true" />
                More filters
                {activeFilterCount > 0 ? <Badge variant="secondary">{activeFilterCount}</Badge> : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className={`${surfaceThemeClassName(theme)} w-[340px] p-4`}
            >
              <div className="space-y-5">
                <div>
                  <p className="font-medium text-foreground">Analytical filters</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Narrow runs by observed fire behavior.
                  </p>
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="burned-area-filter">Minimum burned area</Label>
                    <Badge variant="outline">{filters.minimumBurnedArea} acres</Badge>
                  </div>
                  <Slider
                    aria-label="Minimum burned area"
                    id="burned-area-filter"
                    max={1_500}
                    onValueChange={([value]) => setFilter("minimumBurnedArea", value ?? 0)}
                    step={100}
                    value={[filters.minimumBurnedArea]}
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="spread-rate-filter">Minimum spread rate</Label>
                    <Badge variant="outline">{filters.minimumSpreadRate.toFixed(1)} mph</Badge>
                  </div>
                  <Slider
                    aria-label="Minimum spread rate"
                    id="spread-rate-filter"
                    max={4}
                    onValueChange={([value]) => setFilter("minimumSpreadRate", value ?? 0)}
                    step={0.5}
                    value={[filters.minimumSpreadRate]}
                  />
                </div>
                <Button className="w-full" onClick={() => setFilters(DEFAULT_RUN_FILTERS)} variant="outline">
                  <RotateCcw aria-hidden="true" /> Reset filters
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <Tabs
          className="mt-4"
          onValueChange={(value) => setFilter("status", value as RunStatus | "all")}
          value={filters.status}
        >
          <TabsList variant="line">
            {(["all", "Running", "Completed", "Queued", "Failed"] as const).map((status) => (
              <TabsTrigger key={status} value={status}>
                {status === "all" ? "All" : status}
                <Badge className="ml-1" variant="secondary">
                  {status === "all" ? runs.length : runs.filter((run) => run.status === status).length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {activeFilterCount > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Active filters</span>
            {filters.location !== "all" ? <ActiveFilter label={filters.location} onRemove={() => setFilter("location", "all")} /> : null}
            {filters.scenario !== "all" ? <ActiveFilter label={filters.scenario} onRemove={() => setFilter("scenario", "all")} /> : null}
            {filters.timeRange !== "all" ? <ActiveFilter label={filters.timeRange === "today" ? "Today" : "Last 7 days"} onRemove={() => setFilter("timeRange", "all")} /> : null}
            {filters.minimumBurnedArea > 0 ? <ActiveFilter label={`≥ ${filters.minimumBurnedArea} acres`} onRemove={() => setFilter("minimumBurnedArea", 0)} /> : null}
            {filters.minimumSpreadRate > 0 ? <ActiveFilter label={`≥ ${filters.minimumSpreadRate.toFixed(1)} mph`} onRemove={() => setFilter("minimumSpreadRate", 0)} /> : null}
          </div>
        ) : null}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-5 lg:p-7">
          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="border-b px-5 py-4">
              <CardTitle className="text-base">Simulation history</CardTitle>
              <CardDescription>{visibleRuns.length} of {runs.length} runs</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Scenario</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Ignitions</TableHead>
                    <TableHead>Burned area</TableHead>
                    <TableHead>Peak spread</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRuns.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell><RunStatusBadge status={run.status} /></TableCell>
                      <TableCell>
                        <div className="min-w-[230px]">
                          <Button
                            className="h-auto justify-start p-0 text-left font-semibold"
                            onClick={() => onOpenRun(run.id)}
                            variant="link"
                          >
                            {run.scenario}
                          </Button>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">{run.id}</p>
                        </div>
                      </TableCell>
                      <TableCell>{run.location}</TableCell>
                      <TableCell className="whitespace-nowrap">{run.started}</TableCell>
                      <TableCell className="tabular-nums">{run.ignitionSources}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{run.burnedArea.toLocaleString()} acres</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{run.spreadRate.toFixed(1)} mph</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{run.duration}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-label={`Actions for ${run.id}`} size="icon" variant="ghost">
                              <MoreHorizontal aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className={theme === "dark" ? "dark" : undefined}>
                            <DropdownMenuItem onSelect={() => onOpenRun(run.id)}>
                              <ExternalLink aria-hidden="true" /> View results
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download aria-hidden="true" /> Export run
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {visibleRuns.length === 0 ? (
                <div className="grid min-h-64 place-items-center p-6 text-center">
                  <div>
                    <Flame aria-hidden="true" className="mx-auto size-7 text-muted-foreground" />
                    <p className="mt-3 font-medium text-foreground">No matching runs</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Adjust the filters or start a new simulation.
                    </p>
                    <Button className="mt-4" onClick={() => setFilters(DEFAULT_RUN_FILTERS)} variant="outline">
                      Reset filters
                    </Button>
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
