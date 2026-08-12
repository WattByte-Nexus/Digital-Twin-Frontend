import type { WeatherSettingsValue } from "@geolibre/ui";

export type RunStatus = "Running" | "Completed" | "Queued" | "Failed";
export type RunTimeRange = "all" | "today" | "week";

export interface IgnitionPoint {
  id: string;
  longitude: number;
  latitude: number;
}

export interface FireModelSettings {
  fuelMoisture: "observed" | "dry" | "very-dry";
  spotting: "off" | "standard" | "extended";
  crownFire: "enabled" | "disabled";
  cellSizeMeters: 10 | 30 | 90;
  outputIntervalMinutes: 5 | 15 | 30;
}

export const DEFAULT_FIRE_MODEL_SETTINGS: FireModelSettings = {
  fuelMoisture: "observed",
  spotting: "standard",
  crownFire: "enabled",
  cellSizeMeters: 30,
  outputIntervalMinutes: 15,
};

export interface SimulationRun {
  id: string;
  scenario: string;
  location: string;
  started: string;
  startedOrder: number;
  duration: string;
  durationHours: number;
  durationSeconds: number;
  progress: number;
  status: RunStatus;
  owner: string;
  ignitionSources: number;
  ignitionPoints: IgnitionPoint[];
  burnedArea: number;
  spreadRate: number;
  windSpeed: number;
  windDirection: number;
  modelVersion: string;
  modelSettings: FireModelSettings;
}

export interface RunFilters {
  query: string;
  status: RunStatus | "all";
  location: string;
  scenario: string;
  timeRange: RunTimeRange;
  minimumBurnedArea: number;
  minimumSpreadRate: number;
}

export interface ScenarioRunRequest {
  scenario: string;
  regionId: string;
  location: string;
  durationHours: number;
  ignitionPoints: IgnitionPoint[];
  weather: WeatherSettingsValue;
  modelSettings: FireModelSettings;
}

export interface RunSample {
  minute: number;
  burnedArea: number;
  spreadRate: number;
  intensity: number;
  exposedAssets: number;
}

export const DEFAULT_RUN_FILTERS: RunFilters = {
  query: "",
  status: "all",
  location: "all",
  scenario: "all",
  timeRange: "all",
  minimumBurnedArea: 0,
  minimumSpreadRate: 0,
};

const LAUNCHED_RUNS_STORAGE_KEY = "geolibre:digital-twin:launched-runs";

export const SIMULATION_RUNS: SimulationRun[] = [
  {
    id: "RUN-2026-08-11-1013",
    scenario: "Boulder Foothills — Wind East",
    location: "Boulder Foothills",
    started: "10:13 AM",
    startedOrder: 0,
    duration: "3m 42s",
    durationHours: 4,
    durationSeconds: 222,
    progress: 68,
    status: "Running",
    owner: "A. Chen",
    ignitionSources: 3,
    ignitionPoints: [
      { id: "run-1013-ignition-1", longitude: -105.315, latitude: 40.038 },
      { id: "run-1013-ignition-2", longitude: -105.302, latitude: 40.031 },
      { id: "run-1013-ignition-3", longitude: -105.291, latitude: 40.044 },
    ],
    burnedArea: 824,
    spreadRate: 2.4,
    windSpeed: 18,
    windDirection: 90,
    modelVersion: "FireSim 4.8",
    modelSettings: { ...DEFAULT_FIRE_MODEL_SETTINGS },
  },
  {
    id: "RUN-2026-08-11-0958",
    scenario: "Louisville Interface",
    location: "East County",
    started: "9:58 AM",
    startedOrder: 1,
    duration: "4m 08s",
    durationHours: 4,
    durationSeconds: 248,
    progress: 100,
    status: "Completed",
    owner: "A. Chen",
    ignitionSources: 2,
    ignitionPoints: [
      { id: "run-0958-ignition-1", longitude: -105.149, latitude: 39.985 },
      { id: "run-0958-ignition-2", longitude: -105.137, latitude: 39.976 },
    ],
    burnedArea: 1_284,
    spreadRate: 2.8,
    windSpeed: 16,
    windDirection: 45,
    modelVersion: "FireSim 4.8",
    modelSettings: { ...DEFAULT_FIRE_MODEL_SETTINGS },
  },
  {
    id: "RUN-2026-08-11-0915",
    scenario: "North Ridge — Dry Fuels",
    location: "Boulder North",
    started: "9:15 AM",
    startedOrder: 2,
    duration: "—",
    durationHours: 8,
    durationSeconds: 0,
    progress: 0,
    status: "Queued",
    owner: "M. Rivera",
    ignitionSources: 1,
    ignitionPoints: [
      { id: "run-0915-ignition-1", longitude: -105.274, latitude: 40.088 },
    ],
    burnedArea: 0,
    spreadRate: 0,
    windSpeed: 12,
    windDirection: 180,
    modelVersion: "FireSim 4.8",
    modelSettings: { ...DEFAULT_FIRE_MODEL_SETTINGS },
  },
  {
    id: "RUN-2026-08-11-0840",
    scenario: "Baseline Morning",
    location: "Boulder Foothills",
    started: "8:40 AM",
    startedOrder: 3,
    duration: "3m 51s",
    durationHours: 4,
    durationSeconds: 231,
    progress: 100,
    status: "Completed",
    owner: "System",
    ignitionSources: 1,
    ignitionPoints: [
      { id: "run-0840-ignition-1", longitude: -105.304, latitude: 40.027 },
    ],
    burnedArea: 642,
    spreadRate: 1.3,
    windSpeed: 9,
    windDirection: 270,
    modelVersion: "FireSim 4.7",
    modelSettings: { ...DEFAULT_FIRE_MODEL_SETTINGS },
  },
  {
    id: "RUN-2026-08-10-1642",
    scenario: "High Wind Watch",
    location: "Front Range",
    started: "Yesterday",
    startedOrder: 4,
    duration: "0m 46s",
    durationHours: 2,
    durationSeconds: 46,
    progress: 34,
    status: "Failed",
    owner: "J. Patel",
    ignitionSources: 4,
    ignitionPoints: [
      { id: "run-1642-ignition-1", longitude: -105.236, latitude: 40.054 },
      { id: "run-1642-ignition-2", longitude: -105.221, latitude: 40.046 },
      { id: "run-1642-ignition-3", longitude: -105.209, latitude: 40.061 },
      { id: "run-1642-ignition-4", longitude: -105.194, latitude: 40.052 },
    ],
    burnedArea: 318,
    spreadRate: 3.7,
    windSpeed: 31,
    windDirection: 270,
    modelVersion: "FireSim 4.8",
    modelSettings: { ...DEFAULT_FIRE_MODEL_SETTINGS },
  },
  {
    id: "RUN-2026-08-10-1510",
    scenario: "Superior South",
    location: "South County",
    started: "Yesterday",
    startedOrder: 5,
    duration: "4m 19s",
    durationHours: 4,
    durationSeconds: 259,
    progress: 100,
    status: "Completed",
    owner: "M. Rivera",
    ignitionSources: 2,
    ignitionPoints: [
      { id: "run-1510-ignition-1", longitude: -105.171, latitude: 39.928 },
      { id: "run-1510-ignition-2", longitude: -105.156, latitude: 39.919 },
    ],
    burnedArea: 1_086,
    spreadRate: 2.1,
    windSpeed: 14,
    windDirection: 225,
    modelVersion: "FireSim 4.8",
    modelSettings: { ...DEFAULT_FIRE_MODEL_SETTINGS },
  },
];

export function filterRuns(
  runs: SimulationRun[],
  filters: RunFilters,
): SimulationRun[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return runs.filter((run) => {
    const searchable = `${run.id} ${run.scenario} ${run.location} ${run.owner}`
      .toLocaleLowerCase();
    return (
      (!query || searchable.includes(query)) &&
      (filters.status === "all" || run.status === filters.status) &&
      (filters.location === "all" || run.location === filters.location) &&
      (filters.scenario === "all" || run.scenario === filters.scenario) &&
      (filters.timeRange === "all" ||
        (filters.timeRange === "today"
          ? run.started !== "Yesterday"
          : run.startedOrder <= 5)) &&
      run.burnedArea >= filters.minimumBurnedArea &&
      run.spreadRate >= filters.minimumSpreadRate
    );
  });
}

export function runIdFromLocation(location: string): string | null {
  const pathname = location.split(/[?#]/, 1)[0] ?? "";
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0]?.toLowerCase() !== "regions") return null;
  if (parts[2]?.toLowerCase() !== "runs" || parts.length !== 4) return null;
  try {
    return decodeURIComponent(parts[3] ?? "") || null;
  } catch {
    return null;
  }
}

export function createSimulationRun(
  request: ScenarioRunRequest,
  sequence: number,
): SimulationRun {
  const timestamp = new Date();
  const id = `RUN-${timestamp.toISOString().slice(0, 10)}-${String(sequence).padStart(4, "0")}`;
  return {
    id,
    scenario: request.scenario.trim() || "Untitled scenario",
    location: request.location,
    started: "Just now",
    startedOrder: -sequence,
    duration: "0m 00s",
    durationHours: request.durationHours,
    durationSeconds: 0,
    progress: 4,
    status: "Running",
    owner: "You",
    ignitionSources: request.ignitionPoints.length,
    ignitionPoints: request.ignitionPoints.map((point) => ({ ...point })),
    burnedArea: 0,
    spreadRate: 0,
    windSpeed: request.weather.events.wind,
    windDirection: request.weather.events.windDirection,
    modelVersion: "FireSim 4.8",
    modelSettings: { ...request.modelSettings },
  };
}

const PERIMETER_SHAPE = [1, 0.84, 1.12, 0.92, 1.08, 0.81, 1.05, 0.9, 1.14, 0.88, 1.06, 0.86];

export function burnedAreaPerimeter(
  center: [longitude: number, latitude: number],
  burnedAreaAcres: number,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const radiusMeters = Math.max(45, Math.sqrt((Math.max(0, burnedAreaAcres) * 4_046.86) / Math.PI));
  const latitudeRadians = (center[1] * Math.PI) / 180;
  const latitudeMetersPerDegree = 110_540;
  const longitudeMetersPerDegree = Math.max(1, 111_320 * Math.cos(latitudeRadians));
  const ring = PERIMETER_SHAPE.map((shape, index) => {
    const angle = (index / PERIMETER_SHAPE.length) * Math.PI * 2;
    const radius = radiusMeters * shape;
    return [
      center[0] + (Math.cos(angle) * radius) / longitudeMetersPerDegree,
      center[1] + (Math.sin(angle) * radius) / latitudeMetersPerDegree,
    ];
  });
  ring.push([...ring[0]]);

  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [ring] },
  };
}

export function ignitionCenter(
  points: IgnitionPoint[],
): [longitude: number, latitude: number] | null {
  if (points.length === 0) return null;
  return points.reduce<[number, number]>(
    (center, point) => [
      center[0] + point.longitude / points.length,
      center[1] + point.latitude / points.length,
    ],
    [0, 0],
  );
}

export function ignitionPointFeatures(
  points: IgnitionPoint[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      properties: { id: point.id },
      geometry: {
        type: "Point",
        coordinates: [point.longitude, point.latitude],
      },
    })),
  };
}

export function ignitionBounds(
  points: IgnitionPoint[],
): [[west: number, south: number], [east: number, north: number]] | null {
  const firstPoint = points[0];
  if (!firstPoint) return null;
  return points.reduce<[[number, number], [number, number]]>(
    (bounds, point) => [
      [Math.min(bounds[0][0], point.longitude), Math.min(bounds[0][1], point.latitude)],
      [Math.max(bounds[1][0], point.longitude), Math.max(bounds[1][1], point.latitude)],
    ],
    [
      [firstPoint.longitude, firstPoint.latitude],
      [firstPoint.longitude, firstPoint.latitude],
    ],
  );
}

export function analyticsForRun(run: SimulationRun): RunSample[] {
  const sampleCount = Math.min(
    241,
    Math.max(
      2,
      Math.ceil((run.durationHours * 60) / run.modelSettings.outputIntervalMinutes) + 1,
    ),
  );
  const fuelFactor =
    run.modelSettings.fuelMoisture === "very-dry"
      ? 1.3
      : run.modelSettings.fuelMoisture === "dry"
        ? 1.15
        : 1;
  const spottingFactor =
    run.modelSettings.spotting === "extended"
      ? 1.15
      : run.modelSettings.spotting === "off"
        ? 0.9
        : 1;
  const crownFactor = run.modelSettings.crownFire === "enabled" ? 1 : 0.85;
  const behaviorFactor = fuelFactor * spottingFactor * crownFactor;
  const finalArea =
    Math.max(run.burnedArea, run.status === "Queued" ? 0 : 640) * behaviorFactor;
  const finalRate =
    Math.max(run.spreadRate, run.status === "Queued" ? 0 : 1.8) * behaviorFactor;
  return Array.from({ length: sampleCount }, (_, index) => {
    const ratio = index / (sampleCount - 1);
    const eased = ratio * ratio * (3 - 2 * ratio);
    return {
      minute: Math.round((index * run.durationHours * 60) / (sampleCount - 1)),
      burnedArea: Math.round(finalArea * eased),
      spreadRate: Number((finalRate * Math.sin(ratio * Math.PI * 0.78)).toFixed(1)),
      intensity: Math.round((18 + 76 * Math.sin(ratio * Math.PI * 0.72)) * behaviorFactor),
      exposedAssets: Math.round(18 * eased),
    };
  });
}

export function initialRunSampleIndex(run: SimulationRun, sampleCount: number): number {
  if (sampleCount <= 1) return 0;
  return Math.min(
    sampleCount - 1,
    Math.max(0, Math.round((run.progress / 100) * (sampleCount - 1))),
  );
}

export function formatSimulationTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainingMinutes).padStart(2, "0")}`;
}

export function formatWindDirection(degrees: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const normalized = ((degrees % 360) + 360) % 360;
  return directions[Math.round(normalized / 45) % directions.length] ?? "N";
}

function isSimulationRun(value: unknown): value is SimulationRun {
  if (!value || typeof value !== "object") return false;
  const run = value as Partial<SimulationRun>;
  return (
    typeof run.id === "string" &&
    typeof run.scenario === "string" &&
    typeof run.location === "string" &&
    typeof run.started === "string" &&
    typeof run.startedOrder === "number" &&
    typeof run.duration === "string" &&
    typeof run.durationHours === "number" &&
    typeof run.durationSeconds === "number" &&
    typeof run.progress === "number" &&
    ["Running", "Completed", "Queued", "Failed"].includes(run.status ?? "") &&
    typeof run.owner === "string" &&
    typeof run.ignitionSources === "number" &&
    Array.isArray(run.ignitionPoints) &&
    run.ignitionPoints.length === run.ignitionSources &&
    run.ignitionPoints.every(
      (point) =>
        !!point &&
        typeof point === "object" &&
        typeof point.id === "string" &&
        Number.isFinite(point.longitude) &&
        Number.isFinite(point.latitude),
    ) &&
    typeof run.burnedArea === "number" &&
    typeof run.spreadRate === "number" &&
    typeof run.windSpeed === "number" &&
    typeof run.windDirection === "number" &&
    typeof run.modelVersion === "string" &&
    !!run.modelSettings &&
    ["observed", "dry", "very-dry"].includes(run.modelSettings.fuelMoisture) &&
    ["off", "standard", "extended"].includes(run.modelSettings.spotting) &&
    ["enabled", "disabled"].includes(run.modelSettings.crownFire) &&
    [10, 30, 90].includes(run.modelSettings.cellSizeMeters) &&
    [5, 15, 30].includes(run.modelSettings.outputIntervalMinutes)
  );
}

export function parseLaunchedSimulationRuns(serialized: string | null): SimulationRun[] {
  if (!serialized) return [];
  try {
    const value: unknown = JSON.parse(serialized);
    return Array.isArray(value) ? value.filter(isSimulationRun) : [];
  } catch {
    return [];
  }
}

export function loadLaunchedSimulationRuns(): SimulationRun[] {
  if (typeof window === "undefined") return [];
  try {
    return parseLaunchedSimulationRuns(window.sessionStorage.getItem(LAUNCHED_RUNS_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function persistLaunchedSimulationRuns(runs: SimulationRun[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(LAUNCHED_RUNS_STORAGE_KEY, JSON.stringify(runs));
  } catch {
    return;
  }
}
