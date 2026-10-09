import { requestDigitalTwinJson, resolveDigitalTwinApiUrl, type DigitalTwinRequestOptions } from "./digital-twin-api";
import { boundedDurationHours, digitalTwinTickCount, submitDigitalTwinSavedScenarioRun, type DigitalTwinScenarioRunSubmission } from "./digital-twin-runs";
import type { ScenarioRunRequest } from "../product-modes/digital-twin/ui/simulation-flow";

import type { components } from "./digital-twin-contract.generated";

export type DigitalTwinScenario = components["schemas"]["SyntheticWindScenario"];
export type DigitalTwinWeatherDataset = components["schemas"]["WeatherDataset"];
export type DigitalTwinForecast = components["schemas"]["ForecastDataset"];

export interface DigitalTwinPage<T> { items: T[]; next_cursor: string | null }
type Options = Pick<DigitalTwinRequestOptions, "fetchImpl" | "idempotencyKey"> & { signal?: AbortSignal };

async function page<T>(apiUrl: string, path: string, cursor: string | null, options: Options): Promise<DigitalTwinPage<T>> {
  const url = new URL(resolveDigitalTwinApiUrl(apiUrl, path));
  url.searchParams.set("limit", "100");
  if (cursor) url.searchParams.set("cursor", cursor);
  const result = await requestDigitalTwinJson<DigitalTwinPage<T>>(apiUrl, url.href, options);
  if (!Array.isArray(result.items) || !(result.next_cursor === null || typeof result.next_cursor === "string" && result.next_cursor !== cursor && result.next_cursor.length > 0)) {
    throw new Error("Digital Twin API returned an invalid collection page.");
  }
  return result;
}

export function fetchDigitalTwinScenarios(apiUrl: string, regionId: string, cursor: string | null = null, options: Options = {}) {
  return page<DigitalTwinScenario>(apiUrl, `/api/v1/scenarios?region_id=${encodeURIComponent(regionId)}`, cursor, options);
}

export function fetchDigitalTwinScenario(apiUrl: string, scenarioId: string, options: Options = {}) {
  return requestDigitalTwinJson<DigitalTwinScenario>(apiUrl, `/api/v1/scenarios/${encodeURIComponent(scenarioId)}`, options);
}

export function fetchDigitalTwinWeatherPage(apiUrl: string, regionId: string, cursor: string | null = null, options: Options = {}) {
  return page<DigitalTwinWeatherDataset>(apiUrl, `/api/v1/regions/${encodeURIComponent(regionId)}/weather-datasets`, cursor, options);
}

export function resolveDigitalTwinForecast(apiUrl: string, regionId: string, issueAtOrBefore: string, validAt: string, options: Options = {}) {
  const params = new URLSearchParams({ issue_at_or_before: utcTimestamp(issueAtOrBefore), valid_at: utcTimestamp(validAt) });
  return requestDigitalTwinJson<DigitalTwinForecast>(apiUrl, `/api/v1/regions/${encodeURIComponent(regionId)}/weather-forecasts/resolve?${params}`, options);
}

export function utcTimestamp(value: string): string {
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error("Enter an ISO timestamp with an explicit UTC offset, such as 2026-10-09T12:00:00Z.");
  }
  return new Date(value).toISOString();
}

export function scenarioCreateBody(submission: Omit<DigitalTwinScenarioRunSubmission, "ignitionPoints">) {
  const { bounds } = submission;
  if (!submission.scenarioName.trim() || !submission.regionId || !submission.baseWeatherVersion) throw new Error("Choose a name, region, and exact base-weather version.");
  if (!Object.values(bounds).every(Number.isFinite) || bounds.west < -180 || bounds.east > 180 || bounds.south < -90 || bounds.north > 90 || bounds.west >= bounds.east || bounds.south >= bounds.north) throw new Error("Select a valid rectangular extent.");
  if (!Number.isFinite(submission.durationHours) || submission.durationHours <= 0 || !Number.isInteger(submission.durationHours)) throw new Error("Synthetic scenario duration must contain whole one-hour Engine ticks.");
  if (!Number.isFinite(submission.windSpeedMph) || submission.windSpeedMph < 0 || !Number.isFinite(submission.windDirectionDegrees) || submission.windDirectionDegrees < 0 || submission.windDirectionDegrees >= 360) throw new Error("Wind must be nonnegative with a bearing from 0 to less than 360 degrees.");
  return {
    name: submission.scenarioName.trim(), region_id: submission.regionId,
    geometry: { type: "Polygon" as const, coordinates: [[
      [bounds.west, bounds.south], [bounds.east, bounds.south], [bounds.east, bounds.north], [bounds.west, bounds.north], [bounds.west, bounds.south],
    ]] },
    base_weather_version: utcTimestamp(submission.baseWeatherVersion),
    wind_speed: { value: submission.windSpeedMph, unit: "mph" as const },
    wind_direction: { bearing_degrees: submission.windDirectionDegrees, reference: "towards" as const },
    duration_hours: submission.durationHours,
  };
}

export function createDigitalTwinScenario(apiUrl: string, submission: Omit<DigitalTwinScenarioRunSubmission, "ignitionPoints">, options: Options = {}) {
  return requestDigitalTwinJson<DigitalTwinScenario>(apiUrl, "/api/v1/scenarios", {
    ...options, method: "POST", json: scenarioCreateBody(submission),
  });
}

export function scenarioSubmission(request: Extract<ScenarioRunRequest, { mode: "synthetic" }>): DigitalTwinScenarioRunSubmission {
  return { scenarioName: request.scenario, regionId: request.regionId, durationHours: request.durationHours, bounds: request.bounds, baseWeatherVersion: request.baseWeatherVersion, windSpeedMph: request.windSpeedMph, windDirectionDegrees: request.windDirectionDegrees, ignitionPoints: request.ignitionPoints };
}

export function directRunBody(request: Exclude<ScenarioRunRequest, { mode: "synthetic" }>) {
  if (request.ignitionPoints.length !== 1) throw new Error("Direct runs require exactly one ignition point.");
  const point = request.ignitionPoints[0];
  if (!request.regionId || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180) throw new Error("Choose a region and a valid ignition point.");
  const time = request.mode === "bounded"
    ? { mode: "bounded" as const, start_at: utcTimestamp(request.startAt), end_at: utcTimestamp(request.endAt) }
    : { mode: "present_forecast" as const, duration_hours: request.durationHours };
  const duration = time.mode === "bounded" ? boundedDurationHours(time.start_at, time.end_at) : time.duration_hours;
  if (duration === null) throw new Error("End time must be after start time.");
  const count = digitalTwinTickCount(duration, request.deltaTHours);
  if (time.mode === "bounded" && Math.abs(duration / request.deltaTHours - count) > Math.max(1e-12, 1e-12 * count)) throw new Error("The bounded interval must contain whole timesteps.");
  return { region_id: request.regionId, ignition_location: { lat: point.latitude, lon: point.longitude }, time, delta_t_hours: request.deltaTHours };
}

export async function submitDigitalTwinRunRequest(apiUrl: string, request: ScenarioRunRequest, options: Options = {}) {
  const key = options.idempotencyKey ?? crypto.randomUUID();
  if (request.mode === "synthetic") {
    const scenario = request.scenarioId
      ? { scenario_id: request.scenarioId }
      : await createDigitalTwinScenario(apiUrl, scenarioSubmission(request), { ...options, idempotencyKey: `scenario-${key}` });
    return submitDigitalTwinSavedScenarioRun(apiUrl, scenario.scenario_id, request.ignitionPoints, { ...options, idempotencyKey: `run-${key}` });
  }
  const result = await requestDigitalTwinJson<{ run_id: string }>(apiUrl, "/api/v1/simulation-runs", { ...options, idempotencyKey: `run-${key}`, method: "POST", json: directRunBody(request) });
  if (!result.run_id) throw new Error("Digital Twin API returned an invalid run identity.");
  return { runId: result.run_id };
}

/** A changed accepted body rotates identity; appearance changes do not. */
export function reviewedRunFingerprint(request: ScenarioRunRequest): string {
  return JSON.stringify(request.mode === "synthetic"
    ? { scenario: scenarioCreateBody(scenarioSubmission(request)), scenario_id: request.scenarioId ?? null, ignition_points: request.ignitionPoints.map(({ longitude, latitude }) => [longitude, latitude]) }
    : directRunBody(request));
}
