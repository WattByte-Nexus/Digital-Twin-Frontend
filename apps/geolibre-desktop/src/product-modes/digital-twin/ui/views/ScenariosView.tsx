import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DEFAULT_WEATHER_SETTINGS,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  FilterButton,
  FilterChip,
  FilterSearch,
  FilterSelectTrigger,
  FilterToolbar,
  FilterToolbarRow,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  SelectMenu,
  SelectMenuContent,
  SelectMenuItem,
  SelectMenuValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  surfaceThemeClassName,
  type DigitalTwinRegion,
  type SurfaceTheme,
} from "@geolibre/ui";
import {
  Check,
  CloudSun,
  Copy,
  MapPinned,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_FIRE_MODEL_SETTINGS,
  type ScenarioRunRequest,
} from "../simulation-flow";
import { ScenarioBuilder, type ScenarioMapController } from "./ScenarioBuilder";

type ScenarioStatus = "Ready" | "Draft" | "Completed" | "Review";

interface Scenario {
  id: string;
  name: string;
  location: string;
  conditions: string;
  ignitionSources: number;
  owner: string;
  updated: string;
  status: ScenarioStatus;
}

const SCENARIOS: Scenario[] = [
  {
    id: "scenario-1",
    name: "Boulder Foothills — Wind East",
    location: "Boulder Foothills",
    conditions: "18 mph E · 4 hours",
    ignitionSources: 3,
    owner: "A. Chen",
    updated: "12 min ago",
    status: "Ready",
  },
  {
    id: "scenario-2",
    name: "Louisville Interface",
    location: "East County",
    conditions: "16 mph NE · 4 hours",
    ignitionSources: 2,
    owner: "A. Chen",
    updated: "38 min ago",
    status: "Completed",
  },
  {
    id: "scenario-3",
    name: "North Ridge — Dry Fuels",
    location: "Boulder North",
    conditions: "12 mph S · 8 hours",
    ignitionSources: 1,
    owner: "M. Rivera",
    updated: "1 hour ago",
    status: "Draft",
  },
  {
    id: "scenario-4",
    name: "Baseline Morning",
    location: "Boulder Foothills",
    conditions: "9 mph W · 4 hours",
    ignitionSources: 1,
    owner: "System",
    updated: "Today, 8:31 AM",
    status: "Completed",
  },
  {
    id: "scenario-5",
    name: "High Wind Watch",
    location: "Front Range",
    conditions: "31 mph W · 2 hours",
    ignitionSources: 4,
    owner: "J. Patel",
    updated: "Yesterday",
    status: "Review",
  },
];

const STATUS_VARIANT: Record<
  ScenarioStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  Ready: "default",
  Draft: "secondary",
  Completed: "outline",
  Review: "destructive",
};

const SCENARIO_CENTERS: Record<string, [longitude: number, latitude: number]> = {
  "Boulder Foothills": [-105.275, 40.018],
  "East County": [-105.102, 39.978],
  "Boulder North": [-105.267, 40.075],
  "Front Range": [-105.214, 39.858],
};

const WIND_DIRECTIONS: Record<string, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
};

function requestForScenario(
  scenario: Scenario,
  regionId: string,
): ScenarioRunRequest {
  const center = SCENARIO_CENTERS[scenario.location] ?? [-105.24, 40.01];
  const windSpeed = Number(scenario.conditions.match(/^(\d+)/)?.[1] ?? 0);
  const windDirectionLabel = scenario.conditions.match(/mph ([A-Z]+)/)?.[1] ?? "N";
  const durationHours = Number(scenario.conditions.match(/(\d+) hours?/)?.[1] ?? 4);
  return {
    scenario: scenario.name,
    regionId,
    location: scenario.location,
    durationHours,
    ignitionPoints: Array.from({ length: scenario.ignitionSources }, (_, index) => ({
      id: `${scenario.id}-ignition-${index + 1}`,
      longitude: center[0] + index * 0.0025,
      latitude: center[1] + index * 0.0015,
    })),
    weather: {
      ...DEFAULT_WEATHER_SETTINGS,
      events: {
        ...DEFAULT_WEATHER_SETTINGS.events,
        wind: windSpeed,
        windDirection: WIND_DIRECTIONS[windDirectionLabel] ?? 0,
      },
    },
    modelSettings: { ...DEFAULT_FIRE_MODEL_SETTINGS },
  };
}

interface ScenariosViewProps {
  activeRegionId: string;
  creationRequest: number;
  mapControllerRef: RefObject<ScenarioMapController | null>;
  mapSlot: ReactNode;
  onBuilderOpenChange: (open: boolean) => void;
  onRun: (request: ScenarioRunRequest, idempotencyKey: string) => Promise<void>;
  regions: readonly DigitalTwinRegion[];
  theme: SurfaceTheme;
}

export function ScenariosView({
  activeRegionId,
  creationRequest,
  mapControllerRef,
  mapSlot,
  onBuilderOpenChange,
  onRun,
  regions,
  theme,
}: ScenariosViewProps) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("all");
  const [status, setStatus] = useState<ScenarioStatus | "All">("All");
  const activeFilterCount = [location !== "all", status !== "All"].filter(Boolean).length;

  useEffect(() => {
    onBuilderOpenChange(builderOpen);
  }, [builderOpen, onBuilderOpenChange]);

  useEffect(() => {
    if (creationRequest > 0) {
      setSelectedScenario(null);
      setBuilderOpen(true);
    }
  }, [creationRequest]);

  const filteredScenarios = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return SCENARIOS.filter(
      (scenario) =>
        (status === "All" || scenario.status === status) &&
        (location === "all" || scenario.location === location) &&
        (!normalizedQuery ||
          `${scenario.name} ${scenario.location} ${scenario.conditions} ${scenario.owner}`
            .toLocaleLowerCase()
            .includes(normalizedQuery)),
    );
  }, [location, query, status]);

  if (builderOpen) {
    return (
      <ScenarioBuilder
        activeRegionId={activeRegionId}
        initialRequest={selectedScenario ? requestForScenario(selectedScenario, activeRegionId) : undefined}
        mapControllerRef={mapControllerRef}
        mapSlot={mapSlot}
        onClose={() => setBuilderOpen(false)}
        onRun={onRun}
        regions={regions}
        theme={theme}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-4 px-5 pb-2 pt-5 lg:px-7">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Scenarios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define repeatable conditions before starting a simulation.
          </p>
        </div>
        <Button
          onClick={() => {
            setSelectedScenario(null);
            setBuilderOpen(true);
          }}
        >
          <Plus aria-hidden="true" />
          New scenario
        </Button>
      </header>

      <div className="px-5 pb-5 pt-2 lg:px-7">
        <FilterToolbar>
          <FilterToolbarRow>
            <FilterSearch
              aria-label="Search scenarios"
              onValueChange={setQuery}
              placeholder="Search scenarios…"
              value={query}
            />
          <SelectMenu onValueChange={setLocation} value={location}>
            <FilterSelectTrigger className="w-48">
              <MapPinned aria-hidden="true" />
              <SelectMenuValue placeholder="All locations" />
            </FilterSelectTrigger>
            <SelectMenuContent
              className={`${surfaceThemeClassName(theme)} surface-glass-overlay min-w-[var(--radix-select-trigger-width)]`}
              position="popper"
            >
              <SelectMenuItem value="all">All locations</SelectMenuItem>
              {[...new Set(SCENARIOS.map((scenario) => scenario.location))].map(
                (scenarioLocation) => (
                  <SelectMenuItem key={scenarioLocation} value={scenarioLocation}>
                    {scenarioLocation}
                  </SelectMenuItem>
                ),
              )}
            </SelectMenuContent>
          </SelectMenu>
            <Popover>
              <PopoverTrigger asChild>
                <FilterButton aria-label="Open scenario filters">
                  <SlidersHorizontal aria-hidden="true" className="size-3.5" />
                  Filters
                  {status !== "All" ? (
                    <Badge className="ml-0.5 h-4 min-w-4 px-1 text-[10px]" variant="secondary">1</Badge>
                  ) : null}
                </FilterButton>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className={`${surfaceThemeClassName(theme)} surface-glass-overlay w-64 p-0`}
              >
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">Filter scenarios</p>
                    <p className="text-xs text-muted-foreground">Choose a workflow status.</p>
                  </div>
                  {status !== "All" ? (
                    <Button
                      className="h-7 px-2 text-xs"
                      onClick={() => setStatus("All")}
                      size="sm"
                      variant="ghost"
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
                <div className="bg-surface-subtle p-1.5">
                  {(["All", "Ready", "Draft", "Completed", "Review"] as const).map(
                    (scenarioStatus) => (
                      <Button
                        aria-pressed={status === scenarioStatus}
                        className="h-8 w-full justify-between px-2 text-xs font-normal data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
                        data-active={status === scenarioStatus}
                        key={scenarioStatus}
                        onClick={() => setStatus(scenarioStatus)}
                        size="sm"
                        variant="ghost"
                      >
                        <span className="flex items-center gap-2">
                          <Check
                            aria-hidden="true"
                            className={status === scenarioStatus ? "size-3.5" : "size-3.5 opacity-0"}
                          />
                          {scenarioStatus === "All" ? "Any status" : scenarioStatus}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {scenarioStatus === "All"
                            ? SCENARIOS.length
                            : SCENARIOS.filter((scenario) => scenario.status === scenarioStatus).length}
                        </span>
                      </Button>
                    ),
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </FilterToolbarRow>

          {activeFilterCount > 0 ? (
            <FilterToolbarRow aria-label="Active scenario filters">
              {location !== "all" ? (
                <FilterChip label={`Location: ${location}`} onRemove={() => setLocation("all")} />
              ) : null}
              {status !== "All" ? (
                <FilterChip label={`Status: ${status}`} onRemove={() => setStatus("All")} />
              ) : null}
              <Button
                className="h-7 px-2 text-[11px] text-muted-foreground"
                onClick={() => {
                  setLocation("all");
                  setStatus("All");
                }}
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
          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="px-5 py-4">
              <CardTitle className="text-base">Scenario library</CardTitle>
              <CardDescription>
                {filteredScenarios.length} of {SCENARIOS.length} scenarios
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scenario</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Conditions</TableHead>
                    <TableHead>Ignitions</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredScenarios.map((scenario) => (
                    <TableRow key={scenario.id}>
                      <TableCell>
                        <div className="min-w-[220px]">
                          <Button
                            className="h-auto justify-start p-0 text-left font-semibold"
                            onClick={() => {
                              setSelectedScenario(scenario);
                              setBuilderOpen(true);
                            }}
                            variant="link"
                          >
                            {scenario.name}
                          </Button>
                          <p className="mt-1 text-xs text-muted-foreground">{scenario.owner}</p>
                        </div>
                      </TableCell>
                      <TableCell>{scenario.location}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2 whitespace-nowrap">
                          <CloudSun aria-hidden="true" className="size-4 text-muted-foreground" />
                          {scenario.conditions}
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums">{scenario.ignitionSources}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {scenario.updated}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[scenario.status]}>
                          {scenario.status === "Completed" ? <Check aria-hidden="true" /> : null}
                          {scenario.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-label={`Actions for ${scenario.name}`} size="icon" variant="ghost">
                              <MoreHorizontal aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className={theme === "dark" ? "dark" : undefined}
                          >
                            <DropdownMenuItem
                              onSelect={() => {
                                setSelectedScenario(scenario);
                                setBuilderOpen(true);
                              }}
                            >
                              <Pencil aria-hidden="true" /> Edit setup
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy aria-hidden="true" /> Duplicate
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredScenarios.length === 0 ? (
                <div className="grid min-h-56 place-items-center p-6 text-center">
                  <div>
                    <Search aria-hidden="true" className="mx-auto size-6 text-muted-foreground" />
                    <p className="mt-3 font-medium text-foreground">No matching scenarios</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Adjust the search, status, or location filter.
                    </p>
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
