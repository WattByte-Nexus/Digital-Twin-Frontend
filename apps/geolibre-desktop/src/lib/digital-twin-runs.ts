import {
  normalizeDigitalTwinApiUrl,
  fetchDigitalTwinPages,
  requestDigitalTwinJson,
} from "./digital-twin-api";

import type { components } from "./digital-twin-contract.generated";

export type DigitalTwinWireRun = components["schemas"]["WildfireSimulationRun"];
type FetchLike = typeof fetch;

export type DigitalTwinRunStatus =
  | "QUEUED"
  | "STARTED"
  | "CANCEL_REQUESTED"
  | "CANCELLED"
  | "COMPLETED"
  | "FAILED";

export type DigitalTwinRunTriggerKind = "scenario" | "manual" | "automatic";

export interface DigitalTwinRegionBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface DigitalTwinRegionRecord {
  id: string;
  name: string;
  status: "draft" | "published";
  bounds: DigitalTwinRegionBounds;
}

export interface DigitalTwinRunRecord {
  id: string;
  simulationId: string;
  regionId: string;
  regionName: string;
  scenarioId: string | null;
  scenarioName: string | null;
  triggerKind: DigitalTwinRunTriggerKind;
  status: DigitalTwinRunStatus;
  ignitionPoints: Array<{
    id: string;
    latitude: number;
    longitude: number;
  }>;
  durationHours: number | null;
  deltaTHours: number | null;
  completedTicks: number;
  expectedTicks: number | null;
  burnedAreaHectares: number | null;
  resultAvailable: boolean;
  failureCode: string | null;
  failureMessage?: string | null;
}

export interface DigitalTwinRunCatalog {
  regions: DigitalTwinRegionRecord[];
  runs: DigitalTwinRunRecord[];
}

export function selectAuthorizedDigitalTwinRegions(
  engineRegions: readonly DigitalTwinRegionRecord[],
  authorizedRegionIds: readonly string[],
): DigitalTwinRegionRecord[] {
  const authorizedRegionIdSet = new Set(authorizedRegionIds);
  return engineRegions.filter((region) => authorizedRegionIdSet.has(region.id));
}

export interface DigitalTwinScenarioRunSubmission {
  scenarioName: string;
  regionId: string;
  durationHours: number;
  ignitionPoints: ReadonlyArray<{
    latitude: number;
    longitude: number;
  }>;
  windSpeedMph: number;
  windDirectionDegrees: number;
  baseWeatherVersion: string;
  bounds: DigitalTwinRegionBounds;
}

export interface DigitalTwinRunSubmission {
  runId: string;
}

export interface DigitalTwinRunFilters {
  query: string;
  status: DigitalTwinRunStatus | "all";
  regionId: string;
  scenarioId: string;
}

export const DEFAULT_DIGITAL_TWIN_RUN_FILTERS: DigitalTwinRunFilters = {
  query: "",
  status: "all",
  regionId: "all",
  scenarioId: "all",
};

const RUN_STATUSES = new Set<DigitalTwinRunStatus>([
  "QUEUED",
  "STARTED",
  "CANCEL_REQUESTED",
  "CANCELLED",
  "COMPLETED",
  "FAILED",
]);

const ACTIVE_RUN_STATUSES = new Set<DigitalTwinRunStatus>([
  "QUEUED",
  "STARTED",
  "CANCEL_REQUESTED",
]);

export function isDigitalTwinRunActive(status: DigitalTwinRunStatus): boolean {
  return ACTIVE_RUN_STATUSES.has(status);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseRegion(value: unknown): DigitalTwinRegionRecord {
  if (!isRecord(value)) throw new Error("Digital Twin API returned an invalid region record.");
  const id = nonEmptyString(value.region_id);
  const name = nonEmptyString(value.name);
  const status = value.status;
  if (!id || !name || (status !== "draft" && status !== "published")) {
    throw new Error("Digital Twin API returned an invalid region record.");
  }
  return { id, name, status, bounds: parseRegionBounds(value) };
}

function parseIgnitionPoint(
  value: unknown,
  runId: string,
  index: number,
): DigitalTwinRunRecord["ignitionPoints"][number] {
  if (!isRecord(value)) throw new Error(`Run ${runId} has an invalid ignition point.`);
  const latitude = finiteNumber(value.lat);
  const longitude = finiteNumber(value.lon);
  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error(`Run ${runId} has an invalid ignition point.`);
  }
  return { id: `${runId}-ignition-${index + 1}`, latitude, longitude };
}

function triggerData(trigger: Record<string, unknown>, runId: string) {
  const kind = trigger.kind;
  if (kind === "scenario") {
    const scenarioId = nonEmptyString(trigger.scenario_id);
    const scenarioName = nonEmptyString(trigger.scenario_name);
    if (!scenarioId || !scenarioName || !Array.isArray(trigger.ignition_points)) {
      throw new Error(`Run ${runId} has an invalid scenario trigger.`);
    }
    return {
      scenarioId,
      scenarioName,
      triggerKind: "scenario" as const,
      ignitionPoints: trigger.ignition_points.map((point, index) =>
        parseIgnitionPoint(point, runId, index),
      ),
      durationHours: finiteNumber(trigger.duration_hours),
      deltaTHours: finiteNumber(trigger.delta_t_hours),
    };
  }

  const ignition = parseIgnitionPoint(trigger.ignition_location, runId, 0);
  const time = isRecord(trigger.time) ? trigger.time : {};
  if (kind === "manual" && time.mode !== "present_forecast" && time.mode !== "bounded") throw new Error(`Run ${runId} has an invalid time selection.`);
  return {
    scenarioId: null,
    scenarioName: null,
    triggerKind: kind === "manual" ? ("manual" as const) : ("automatic" as const),
    ignitionPoints: [ignition],
    durationHours: time.mode === "bounded"
      ? boundedDurationHours(time.start_at, time.end_at)
      : finiteNumber(time.duration_hours),
    deltaTHours: finiteNumber(trigger.delta_t_hours),
  };
}

export function boundedDurationHours(start: unknown, end: unknown): number | null {
  if (typeof start !== "string" || typeof end !== "string") return null;
  const duration = (Date.parse(end) - Date.parse(start)) / 3_600_000;
  return Number.isFinite(duration) && duration > 0 ? duration : null;
}

/** Match the Engine's simulation_tick_count, including float tolerance. */
export function digitalTwinTickCount(durationHours: number, deltaTHours: number): number {
  if (!Number.isFinite(durationHours) || durationHours <= 0 || !Number.isFinite(deltaTHours) || deltaTHours <= 0) {
    throw new Error("Duration and timestep must be positive finite numbers.");
  }
  const quotient = durationHours / deltaTHours;
  const nearest = Math.round(quotient);
  return Math.abs(quotient - nearest) <= Math.max(1e-12, 1e-12 * Math.max(Math.abs(quotient), nearest))
    ? nearest : Math.ceil(quotient);
}

export function parseDigitalTwinRun(
  value: unknown,
  regionNames: ReadonlyMap<string, string>,
): DigitalTwinRunRecord {
  if (!isRecord(value) || !isRecord(value.trigger)) {
    throw new Error("Digital Twin API returned an invalid simulation run record.");
  }
  const id = nonEmptyString(value.run_id);
  const simulationId = nonEmptyString(value.simulation_id);
  const regionId = nonEmptyString(value.region_id);
  const status = value.status;
  if (!id || !simulationId || !regionId || !RUN_STATUSES.has(status as DigitalTwinRunStatus)) {
    throw new Error("Digital Twin API returned an invalid simulation run record.");
  }
  const trigger = triggerData(value.trigger, id);
  const tickRefs = Array.isArray(value.tick_refs) ? value.tick_refs : [];
  const completedTicks = new Set(tickRefs.flatMap((ref) =>
    isRecord(ref) && Number.isInteger(ref.tick) && Number(ref.tick) > 0 ? [ref.tick] : [],
  )).size;
  const expectedTicks =
    trigger.durationHours !== null &&
    trigger.deltaTHours !== null &&
    trigger.deltaTHours > 0
      ? digitalTwinTickCount(trigger.durationHours, trigger.deltaTHours)
      : null;
  const failure = isRecord(value.failure) ? value.failure : {};
  const metrics = isRecord(value.metrics) ? value.metrics : {};
  const reportedBurnedAreaHectares = finiteNumber(metrics.burned_area_hectares);
  const burnedAreaHectares =
    reportedBurnedAreaHectares !== null && reportedBurnedAreaHectares >= 0
      ? reportedBurnedAreaHectares
      : null;
  if (status === "COMPLETED" && burnedAreaHectares === null) {
    throw new Error(`Run ${id} has invalid burned-area metrics.`);
  }
  return {
    id,
    simulationId,
    regionId,
    regionName: regionNames.get(regionId) ?? regionId,
    scenarioId: trigger.scenarioId,
    scenarioName: trigger.scenarioName,
    triggerKind: trigger.triggerKind,
    status: status as DigitalTwinRunStatus,
    ignitionPoints: trigger.ignitionPoints,
    durationHours: trigger.durationHours,
    deltaTHours: trigger.deltaTHours,
    completedTicks,
    expectedTicks,
    burnedAreaHectares,
    resultAvailable: nonEmptyString(value.final_result_ref) !== null,
    failureCode: nonEmptyString(failure.error_type),
    failureMessage: nonEmptyString(failure.error_message),
  };
}

export async function fetchDigitalTwinRunCatalog(
  value: string,
  options: { fetchImpl?: FetchLike; signal?: AbortSignal } = {},
): Promise<DigitalTwinRunCatalog> {
  const apiUrl = normalizeDigitalTwinApiUrl(value);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) throw new Error("This environment cannot connect to the Digital Twin API.");
  const [regions, runValues] = await Promise.all([
    fetchDigitalTwinRegions(apiUrl, { fetchImpl, signal: options.signal }),
    fetchDigitalTwinPages<unknown>(apiUrl, "/api/v1/simulation-runs", { fetchImpl, signal: options.signal }),
  ]);
  const regionNames = new Map(regions.map((region) => [region.id, region.name]));
  const runs = runValues.map((run) => parseDigitalTwinRun(run, regionNames));
  return { regions, runs };
}

export async function fetchDigitalTwinRegions(
  value: string,
  options: { fetchImpl?: FetchLike; signal?: AbortSignal } = {},
): Promise<DigitalTwinRegionRecord[]> {
  const apiUrl = normalizeDigitalTwinApiUrl(value);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) throw new Error("This environment cannot connect to the Digital Twin API.");
  const regionValues = await fetchDigitalTwinPages<unknown>(apiUrl, "/api/v1/regions", { fetchImpl, signal: options.signal });
  return regionValues.map(parseRegion);
}

export async function fetchDigitalTwinRun(
  value: string,
  runId: string,
  options: {
    fetchImpl?: FetchLike;
    regionNames?: ReadonlyMap<string, string>;
    signal?: AbortSignal;
  } = {},
): Promise<DigitalTwinRunRecord> {
  const apiUrl = normalizeDigitalTwinApiUrl(value);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) throw new Error("This environment cannot connect to the Digital Twin API.");
  const body = await requestDigitalTwinJson<unknown>(apiUrl, `/api/v1/simulation-runs/${encodeURIComponent(runId)}`, options);
  return parseDigitalTwinRun(body, options.regionNames ?? new Map());
}

/** Submit exactly the reviewed weather/extent rather than resolving mutable latest inputs. */
export async function submitDigitalTwinScenarioRun(
  apiUrl: string,
  submission: DigitalTwinScenarioRunSubmission,
  options: { fetchImpl?: FetchLike; idempotencyKey?: string; signal?: AbortSignal } = {},
): Promise<DigitalTwinRunSubmission> {
  const { createDigitalTwinScenario } = await import("./digital-twin-scenarios");
  const key = options.idempotencyKey ?? crypto.randomUUID();
  const scenario = await createDigitalTwinScenario(apiUrl, submission, { ...options, idempotencyKey: `scenario-${key}` });
  return submitDigitalTwinSavedScenarioRun(apiUrl, scenario.scenario_id, submission.ignitionPoints, { ...options, idempotencyKey: `run-${key}` });
}

export async function submitDigitalTwinSavedScenarioRun(
  apiUrl: string,
  scenarioId: string,
  points: DigitalTwinScenarioRunSubmission["ignitionPoints"],
  options: { fetchImpl?: FetchLike; idempotencyKey?: string; signal?: AbortSignal } = {},
): Promise<DigitalTwinRunSubmission> {
  if (!scenarioId || points.length < 1 || points.length > 100) throw new Error("Choose a scenario and between 1 and 100 ignition points.");
  const body = await requestDigitalTwinJson<{ run_id: string }>(apiUrl, "/api/v1/simulation-runs", {
    ...options, method: "POST", json: {
      scenario_id: scenarioId,
      ignition_points: points.map((point) => ({ type: "Point", coordinates: [point.longitude, point.latitude] })),
    },
  });
  if (!body.run_id) throw new Error("Digital Twin API returned an invalid simulation run record.");
  return { runId: body.run_id };
}

function parseRegionBounds(value: unknown): DigitalTwinRegionBounds {
  if (!isRecord(value) || !isRecord(value.bounds)) throw new Error("Digital Twin API returned an invalid region boundary.");
  const { west, south, east, north } = value.bounds;
  if (![west, south, east, north].every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate)) || Number(west) >= Number(east) || Number(south) >= Number(north)) {
    throw new Error("Digital Twin API returned an invalid region boundary.");
  }
  return { west: Number(west), south: Number(south), east: Number(east), north: Number(north) };
}

export function filterDigitalTwinRuns(
  runs: DigitalTwinRunRecord[],
  filters: DigitalTwinRunFilters,
): DigitalTwinRunRecord[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return runs.filter((run) => {
    const searchable = [
      run.id,
      run.simulationId,
      run.regionId,
      run.regionName,
      run.scenarioId,
      run.scenarioName,
      run.triggerKind,
    ]
      .filter(Boolean)
      .join(" ")
      .replaceAll("-", " ")
      .toLocaleLowerCase();
    return (
      (!query || searchable.includes(query)) &&
      (filters.status === "all" || run.status === filters.status) &&
      (filters.regionId === "all" || run.regionId === filters.regionId) &&
      (filters.scenarioId === "all" || run.scenarioId === filters.scenarioId)
    );
  });
}

export function digitalTwinRunStatusLabel(status: DigitalTwinRunStatus): string {
  if (status === "STARTED") return "Running";
  if (status === "CANCEL_REQUESTED") return "Cancelling";
  return status.charAt(0) + status.slice(1).toLocaleLowerCase();
}
