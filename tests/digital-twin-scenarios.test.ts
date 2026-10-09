import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_WEATHER_SETTINGS } from "@geolibre/ui";
import { createDigitalTwinScenario, directRunBody, fetchDigitalTwinScenario, fetchDigitalTwinScenarios, fetchDigitalTwinWeatherPage, resolveDigitalTwinForecast, reviewedRunFingerprint, scenarioCreateBody, submitDigitalTwinRunRequest, utcTimestamp } from "../apps/geolibre-desktop/src/lib/digital-twin-scenarios";
import type { ScenarioRunRequest } from "../apps/geolibre-desktop/src/product-modes/digital-twin/ui/simulation-flow";

const request: Extract<ScenarioRunRequest, { mode: "synthetic" }> = {
  mode: "synthetic", scenario: "East wind", regionId: "region a", location: "Test region",
  durationHours: 4, baseWeatherVersion: "2026-10-09T12:00:00Z",
  bounds: { west: -106, south: 39, east: -105, north: 40 },
  windSpeedMph: 18, windDirectionDegrees: 90,
  ignitionPoints: [{ id: "local-1", latitude: 39.8, longitude: -105.3 }],
  weather: DEFAULT_WEATHER_SETTINGS,
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

test("scenario list/get preserve Engine identities and opaque pagination", async () => {
  const seen: URL[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input)); seen.push(url);
    return json(url.pathname.endsWith("/scenarios/scenario%2F1") ? { scenario_id: "scenario/1" } : { items: [{ scenario_id: "scenario/1" }], next_cursor: "opaque-token" });
  };
  const page = await fetchDigitalTwinScenarios("https://engine.test", "region a", "older:1", { fetchImpl });
  assert.equal(page.next_cursor, "opaque-token");
  assert.equal(seen[0].searchParams.get("region_id"), "region a");
  assert.equal(seen[0].searchParams.get("cursor"), "older:1");
  assert.equal((await fetchDigitalTwinScenario("https://engine.test", "scenario/1", { fetchImpl })).scenario_id, "scenario/1");
});

test("historical weather follows exact selected region and cursor; forecast carries both UTC selectors", async () => {
  const seen: URL[] = [];
  const fetchImpl: typeof fetch = async (input) => { seen.push(new URL(String(input))); return json(seen.at(-1)?.pathname.endsWith("resolve") ? { ready: true } : { items: [], next_cursor: null }); };
  await fetchDigitalTwinWeatherPage("https://engine.test", "region a", "older=100", { fetchImpl });
  await resolveDigitalTwinForecast("https://engine.test", "region a", "2026-10-09T06:00:00-06:00", "2026-10-09T08:00:00-06:00", { fetchImpl });
  assert.equal(seen[0].searchParams.get("cursor"), "older=100");
  assert.equal(seen[1].searchParams.get("issue_at_or_before"), "2026-10-09T12:00:00.000Z");
  assert.equal(seen[1].searchParams.get("valid_at"), "2026-10-09T14:00:00.000Z");
});

test("scenario save excludes run ignitions and accepts reviewed rectangular geometry", async () => {
  let body: Record<string, unknown> = {};
  const fetchImpl: typeof fetch = async (_input, init) => { body = JSON.parse(String(init?.body)); assert.equal(new Headers(init?.headers).get("Idempotency-Key"), "save-1"); return json({ scenario_id: "saved-1" }, 201); };
  const saved = await createDigitalTwinScenario("https://engine.test", { scenarioName: request.scenario, ...request }, { fetchImpl, idempotencyKey: "save-1" });
  assert.equal(saved.scenario_id, "saved-1");
  assert.equal(body.base_weather_version, "2026-10-09T12:00:00.000Z");
  assert.equal("ignition_points" in body, false);
  assert.deepEqual(body.geometry, { type: "Polygon", coordinates: [[[-106, 39], [-105, 39], [-105, 40], [-106, 40], [-106, 39]]] });
});

test("retry after network failure preserves scenario weather, bounds, body and identity", async () => {
  const bodies: string[] = []; const keys: string[] = []; let failed = false;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.ok(["/api/v1/scenarios", "/api/v1/simulation-runs"].includes(url.pathname), "retry must not fetch newer weather or region extent");
    bodies.push(String(init?.body)); keys.push(new Headers(init?.headers).get("Idempotency-Key") ?? "");
    if (url.pathname.endsWith("scenarios")) return json({ scenario_id: "saved-1" });
    if (!failed) { failed = true; throw new TypeError("Network disconnected after acceptance"); }
    return json({ run_id: "run-1" });
  };
  await assert.rejects(submitDigitalTwinRunRequest("https://engine.test", request, { fetchImpl, idempotencyKey: "frozen-1" }), /Network disconnected/);
  assert.equal((await submitDigitalTwinRunRequest("https://engine.test", request, { fetchImpl, idempotencyKey: "frozen-1" })).runId, "run-1");
  assert.equal(bodies[0], bodies[2]); assert.equal(bodies[1], bodies[3]);
  assert.deepEqual(keys, ["scenario-frozen-1", "run-frozen-1", "scenario-frozen-1", "run-frozen-1"]);
});

test("running a saved scenario submits only its ID and operator-selected ignitions", async () => {
  const seen: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => { seen.push(new URL(String(input)).pathname); assert.deepEqual(JSON.parse(String(init?.body)), { scenario_id: "saved-1", ignition_points: [{ type: "Point", coordinates: [-105.3, 39.8] }] }); return json({ run_id: "run-1" }); };
  await submitDigitalTwinRunRequest("https://engine.test", { ...request, scenarioId: "saved-1" }, { fetchImpl, idempotencyKey: "intent-1" });
  assert.deepEqual(seen, ["/api/v1/simulation-runs"]);
});

test("fingerprint changes accepted input but ignores local map appearance and marker identity", () => {
  const fingerprint = reviewedRunFingerprint(request);
  assert.equal(reviewedRunFingerprint({ ...request, weather: { ...DEFAULT_WEATHER_SETTINGS, temperature: 99 }, ignitionPoints: request.ignitionPoints.map((point) => ({ ...point, id: "new-local-id" })) }), fingerprint);
  assert.notEqual(reviewedRunFingerprint({ ...request, baseWeatherVersion: "2026-10-09T13:00:00Z" }), fingerprint);
  assert.notEqual(reviewedRunFingerprint({ ...request, windSpeedMph: 19 }), fingerprint);
  assert.notEqual(reviewedRunFingerprint({ ...request, bounds: { ...request.bounds, west: -105.9 } }), fingerprint);
});

test("direct modes use one lat/lon ignition, explicit timestep and timezone-preserving UTC bounds", () => {
  const common = { regionId: "region", location: "Test region", weather: DEFAULT_WEATHER_SETTINGS, ignitionPoints: request.ignitionPoints };
  assert.deepEqual(directRunBody({ ...common, mode: "present_forecast", durationHours: 1.2, deltaTHours: 1 }), { region_id: "region", ignition_location: { lat: 39.8, lon: -105.3 }, time: { mode: "present_forecast", duration_hours: 1.2 }, delta_t_hours: 1 });
  assert.deepEqual(directRunBody({ ...common, mode: "bounded", startAt: "2026-10-09T06:00:00-06:00", endAt: "2026-10-09T08:00:00-06:00", deltaTHours: 0.5 }).time, { mode: "bounded", start_at: "2026-10-09T12:00:00.000Z", end_at: "2026-10-09T14:00:00.000Z" });
  assert.throws(() => directRunBody({ ...common, mode: "bounded", startAt: "2026-10-09T12:00:00Z", endAt: "2026-10-09T13:12:00Z", deltaTHours: 1 }), /whole timesteps/);
  assert.throws(() => directRunBody({ ...common, mode: "present_forecast", durationHours: 1, deltaTHours: 0 }), /positive/);
  assert.throws(() => directRunBody({ ...common, mode: "present_forecast", durationHours: 1, deltaTHours: 1, ignitionPoints: [...request.ignitionPoints, ...request.ignitionPoints] }), /exactly one/);
  assert.throws(() => utcTimestamp("2026-10-09T12:00:00"), /explicit UTC offset/);
});

test("invalid scenario geometry, wind and synthetic timestep are rejected before a write", () => {
  const submission = { scenarioName: request.scenario, ...request };
  assert.throws(() => scenarioCreateBody({ ...submission, bounds: { ...request.bounds, west: request.bounds.east } }), /rectangular/);
  assert.throws(() => scenarioCreateBody({ ...submission, windSpeedMph: -1 }), /nonnegative/);
  assert.throws(() => scenarioCreateBody({ ...submission, durationHours: 1.2 }), /whole one-hour/);
});
