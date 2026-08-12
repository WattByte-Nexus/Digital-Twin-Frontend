import {
  normalizeDigitalTwinApiUrl,
  resolveDigitalTwinApiUrl,
} from "./digital-twin-earth-engine";

type FetchLike = typeof fetch;

export type DigitalTwinRunStatus =
  | "QUEUED"
  | "STARTED"
  | "CANCEL_REQUESTED"
  | "CANCELLED"
  | "COMPLETED"
  | "FAILED";

export type DigitalTwinRunTriggerKind = "scenario" | "manual" | "automatic";

export interface DigitalTwinRegionRecord {
  id: string;
  name: string;
  status: "draft" | "published";
}

export interface DigitalTwinRunRecord {
  id: string;
  simulationId: string;
  regionId: string;
  regionName: string;
  scenarioId: string | null;
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
  resultAvailable: boolean;
  failureCode: string | null;
}

export interface DigitalTwinRunCatalog {
  regions: DigitalTwinRegionRecord[];
  runs: DigitalTwinRunRecord[];
}

export interface DigitalTwinScenarioRunSubmission {
  regionId: string;
  durationHours: number;
  ignitionPoints: ReadonlyArray<{
    latitude: number;
    longitude: number;
  }>;
  windSpeedMph: number;
  windDirectionDegrees: number;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function canonicalCursor(value: unknown): string | null {
  const cursor = nonEmptyString(value);
  return cursor !== null && /^(?:0|[1-9]\d*)$/.test(cursor) ? cursor : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function problemDetail(value: unknown): string | null {
  if (!isRecord(value)) return null;
  return nonEmptyString(value.detail) ?? nonEmptyString(value.title);
}

async function apiFailure(response: Response, operation: string): Promise<Error> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // The status remains useful when the API has no problem body.
  }
  const detail = problemDetail(body);
  return new Error(
    detail
      ? `${operation} failed (${response.status}): ${detail}`
      : `${operation} failed (${response.status}).`,
  );
}

function parseRegion(value: unknown): DigitalTwinRegionRecord {
  if (!isRecord(value)) throw new Error("Digital Twin API returned an invalid region record.");
  const id = nonEmptyString(value.region_id);
  const name = nonEmptyString(value.name);
  const status = value.status;
  if (!id || !name || (status !== "draft" && status !== "published")) {
    throw new Error("Digital Twin API returned an invalid region record.");
  }
  return { id, name, status };
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
    if (!scenarioId || !Array.isArray(trigger.ignition_points)) {
      throw new Error(`Run ${runId} has an invalid scenario trigger.`);
    }
    return {
      scenarioId,
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
  return {
    scenarioId: null,
    triggerKind: kind === "manual" ? ("manual" as const) : ("automatic" as const),
    ignitionPoints: [ignition],
    durationHours: finiteNumber(time.duration_hours),
    deltaTHours: finiteNumber(trigger.delta_t_hours),
  };
}

function parseRun(
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
  const completedTicks = tickRefs.length;
  const expectedTicks =
    trigger.durationHours !== null &&
    trigger.deltaTHours !== null &&
    trigger.deltaTHours > 0
      ? Math.round(trigger.durationHours / trigger.deltaTHours)
      : null;
  const failure = isRecord(value.failure) ? value.failure : {};
  return {
    id,
    simulationId,
    regionId,
    regionName: regionNames.get(regionId) ?? regionId,
    scenarioId: trigger.scenarioId,
    triggerKind: trigger.triggerKind,
    status: status as DigitalTwinRunStatus,
    ignitionPoints: trigger.ignitionPoints,
    durationHours: trigger.durationHours,
    deltaTHours: trigger.deltaTHours,
    completedTicks,
    expectedTicks,
    resultAvailable: nonEmptyString(value.final_result_ref) !== null,
    failureCode: nonEmptyString(failure.code),
  };
}

interface ApiPage {
  items: unknown[];
  nextCursor: string | null;
}

async function requestPage(
  fetchImpl: FetchLike,
  apiUrl: string,
  path: string,
  cursor: string | null,
  signal?: AbortSignal,
): Promise<ApiPage> {
  const url = new URL(resolveDigitalTwinApiUrl(apiUrl, path));
  url.searchParams.set("limit", "100");
  if (cursor) url.searchParams.set("cursor", cursor);
  const response = await fetchImpl(url.href, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Digital Twin API request failed (${response.status}).`);
  }
  const value: unknown = await response.json();
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error("Digital Twin API returned an invalid paginated response.");
  }
  const nextCursor = value.next_cursor;
  if (nextCursor !== null && nextCursor !== undefined && !canonicalCursor(nextCursor)) {
    throw new Error("Digital Twin API returned an invalid page cursor.");
  }
  return { items: value.items, nextCursor: canonicalCursor(nextCursor) };
}

async function requestAllPages(
  fetchImpl: FetchLike,
  apiUrl: string,
  path: string,
  signal?: AbortSignal,
): Promise<unknown[]> {
  const items: unknown[] = [];
  let cursor: string | null = null;
  do {
    const page = await requestPage(fetchImpl, apiUrl, path, cursor, signal);
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return items;
}

export async function fetchDigitalTwinRunCatalog(
  value: string,
  options: { fetchImpl?: FetchLike; signal?: AbortSignal } = {},
): Promise<DigitalTwinRunCatalog> {
  const apiUrl = normalizeDigitalTwinApiUrl(value);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) throw new Error("This environment cannot connect to the Digital Twin API.");
  const [regionValues, runValues] = await Promise.all([
    requestAllPages(fetchImpl, apiUrl, "/api/v1/regions", options.signal),
    requestAllPages(fetchImpl, apiUrl, "/api/v1/simulation-runs", options.signal),
  ]);
  const regions = regionValues.map(parseRegion);
  const regionNames = new Map(regions.map((region) => [region.id, region.name]));
  const runs = runValues.map((run) => parseRun(run, regionNames));
  return { regions, runs };
}

function assertScenarioRunSubmission(
  submission: DigitalTwinScenarioRunSubmission,
): void {
  if (!submission.regionId.trim()) throw new Error("A simulation region is required.");
  if (!Number.isFinite(submission.durationHours) || submission.durationHours <= 0) {
    throw new Error("Simulation duration must be greater than zero.");
  }
  if (
    !Number.isFinite(submission.windSpeedMph) ||
    submission.windSpeedMph < 0 ||
    !Number.isFinite(submission.windDirectionDegrees) ||
    submission.windDirectionDegrees < 0 ||
    submission.windDirectionDegrees >= 360
  ) {
    throw new Error("Simulation wind settings are invalid.");
  }
  if (submission.ignitionPoints.length < 1 || submission.ignitionPoints.length > 100) {
    throw new Error("A simulation must have between 1 and 100 ignition points.");
  }
  for (const point of submission.ignitionPoints) {
    if (
      !Number.isFinite(point.latitude) ||
      !Number.isFinite(point.longitude) ||
      point.latitude < -90 ||
      point.latitude > 90 ||
      point.longitude < -180 ||
      point.longitude > 180
    ) {
      throw new Error("A simulation ignition point is invalid.");
    }
  }
}

function parseRegionBounds(value: unknown): {
  west: number;
  south: number;
  east: number;
  north: number;
} {
  if (!isRecord(value) || !isRecord(value.bounds)) {
    throw new Error("Digital Twin API returned an invalid region boundary.");
  }
  const west = finiteNumber(value.bounds.west);
  const south = finiteNumber(value.bounds.south);
  const east = finiteNumber(value.bounds.east);
  const north = finiteNumber(value.bounds.north);
  if (west === null || south === null || east === null || north === null || west >= east || south >= north) {
    throw new Error("Digital Twin API returned an invalid region boundary.");
  }
  return { west, south, east, north };
}

function latestReadyWeatherVersion(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error("Digital Twin API returned an invalid weather dataset list.");
  }
  for (const dataset of value.items) {
    if (!isRecord(dataset) || dataset.ready !== true) continue;
    const version = nonEmptyString(dataset.version);
    if (version) return version;
  }
  throw new Error("The selected region has no ready weather dataset.");
}

async function jsonResponse(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  operation: string,
): Promise<unknown> {
  const response = await fetchImpl(url, init);
  if (!response.ok) throw await apiFailure(response, operation);
  return response.json() as Promise<unknown>;
}

/** Create an Engine-owned scenario and queue its durable simulation run. */
export async function submitDigitalTwinScenarioRun(
  value: string,
  submission: DigitalTwinScenarioRunSubmission,
  options: { fetchImpl?: FetchLike; idempotencyKey?: string; signal?: AbortSignal } = {},
): Promise<DigitalTwinRunSubmission> {
  assertScenarioRunSubmission(submission);
  const apiUrl = normalizeDigitalTwinApiUrl(value);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) throw new Error("This environment cannot connect to the Digital Twin API.");

  const regionId = submission.regionId.trim();
  const regionPath = `/api/v1/regions/${encodeURIComponent(regionId)}`;
  const weatherPath = `${regionPath}/weather-datasets?limit=100`;
  const [regionValue, weatherValue] = await Promise.all([
    jsonResponse(
      fetchImpl,
      resolveDigitalTwinApiUrl(apiUrl, regionPath),
      { headers: { Accept: "application/json" }, signal: options.signal },
      "Region request",
    ),
    jsonResponse(
      fetchImpl,
      resolveDigitalTwinApiUrl(apiUrl, weatherPath),
      { headers: { Accept: "application/json" }, signal: options.signal },
      "Weather data request",
    ),
  ]);
  const bounds = parseRegionBounds(regionValue);
  const baseWeatherVersion = latestReadyWeatherVersion(weatherValue);
  const submissionId = options.idempotencyKey?.trim() || crypto.randomUUID();
  const scenarioValue = await jsonResponse(
    fetchImpl,
    resolveDigitalTwinApiUrl(apiUrl, "/api/v1/scenarios"),
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Idempotency-Key": `scenario-${submissionId}`,
      },
      body: JSON.stringify({
        region_id: regionId,
        geometry: {
          type: "Polygon",
          coordinates: [[
            [bounds.west, bounds.south],
            [bounds.east, bounds.south],
            [bounds.east, bounds.north],
            [bounds.west, bounds.north],
            [bounds.west, bounds.south],
          ]],
        },
        base_weather_version: baseWeatherVersion,
        wind_speed: { value: submission.windSpeedMph, unit: "mph" },
        wind_direction: {
          bearing_degrees: submission.windDirectionDegrees,
          reference: "towards",
        },
        duration_hours: submission.durationHours,
      }),
      signal: options.signal,
    },
    "Scenario creation",
  );
  const scenarioId = isRecord(scenarioValue) ? nonEmptyString(scenarioValue.scenario_id) : null;
  if (!scenarioId) throw new Error("Digital Twin API returned an invalid scenario record.");

  const runValue = await jsonResponse(
    fetchImpl,
    resolveDigitalTwinApiUrl(apiUrl, "/api/v1/simulation-runs"),
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Idempotency-Key": `run-${submissionId}`,
      },
      body: JSON.stringify({
        scenario_id: scenarioId,
        ignition_points: submission.ignitionPoints.map((point) => ({
          type: "Point",
          coordinates: [point.longitude, point.latitude],
        })),
      }),
      signal: options.signal,
    },
    "Simulation submission",
  );
  const runId = isRecord(runValue) ? nonEmptyString(runValue.run_id) : null;
  if (!runId) throw new Error("Digital Twin API returned an invalid simulation run record.");
  return { runId };
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
