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
  Input,
  ScrollArea,
  SelectMenu,
  SelectMenuContent,
  SelectMenuItem,
  SelectMenuTrigger,
  SelectMenuValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
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
import type { ScenarioRunRequest } from "../simulation-flow";
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

function requestForScenario(scenario: Scenario): ScenarioRunRequest {
  const center = SCENARIO_CENTERS[scenario.location] ?? [-105.24, 40.01];
  const windSpeed = Number(scenario.conditions.match(/^(\d+)/)?.[1] ?? 0);
  const windDirectionLabel = scenario.conditions.match(/mph ([A-Z]+)/)?.[1] ?? "N";
  const durationHours = Number(scenario.conditions.match(/(\d+) hours?/)?.[1] ?? 4);
  return {
    scenario: scenario.name,
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
  };
}

interface ScenariosViewProps {
  creationRequest: number;
  mapControllerRef: RefObject<ScenarioMapController | null>;
  mapSlot: ReactNode;
  onBuilderOpenChange: (open: boolean) => void;
  onRun: (request: ScenarioRunRequest) => void;
  theme: SurfaceTheme;
}

export function ScenariosView({
  creationRequest,
  mapControllerRef,
  mapSlot,
  onBuilderOpenChange,
  onRun,
  theme,
}: ScenariosViewProps) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("all");
  const [status, setStatus] = useState<ScenarioStatus | "All">("All");

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
        initialLocation="Boulder Foothills"
        initialRequest={selectedScenario ? requestForScenario(selectedScenario) : undefined}
        mapControllerRef={mapControllerRef}
        mapSlot={mapSlot}
        onClose={() => setBuilderOpen(false)}
        onRun={onRun}
        theme={theme}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4 lg:px-7">
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

      <div className="border-b px-5 py-4 lg:px-7">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1 lg:max-w-sm">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              className="pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search scenarios"
              type="search"
              value={query}
            />
          </div>
          <SelectMenu onValueChange={setLocation} value={location}>
            <SelectMenuTrigger className="w-[190px]">
              <MapPinned aria-hidden="true" />
              <SelectMenuValue placeholder="All locations" />
            </SelectMenuTrigger>
            <SelectMenuContent className={theme === "dark" ? "dark" : undefined}>
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
          <Button variant="outline">
            <SlidersHorizontal aria-hidden="true" />
            Filters
          </Button>
        </div>
        <Tabs
          className="mt-4"
          onValueChange={(value) => setStatus(value as ScenarioStatus | "All")}
          value={status}
        >
          <TabsList variant="line">
            {(["All", "Ready", "Draft", "Completed", "Review"] as const).map(
              (scenarioStatus) => (
                <TabsTrigger key={scenarioStatus} value={scenarioStatus}>
                  {scenarioStatus}
                  <Badge className="ml-1" variant="secondary">
                    {scenarioStatus === "All"
                      ? SCENARIOS.length
                      : SCENARIOS.filter((scenario) => scenario.status === scenarioStatus).length}
                  </Badge>
                </TabsTrigger>
              ),
            )}
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-5 lg:p-7">
          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="border-b px-5 py-4">
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
