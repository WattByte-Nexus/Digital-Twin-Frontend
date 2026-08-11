import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DIGITAL_TWIN_RUN_FILTERS,
  fetchDigitalTwinRunCatalog,
  filterDigitalTwinRuns,
} from "../apps/geolibre-desktop/src/lib/digital-twin-runs";

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

test("fetchDigitalTwinRunCatalog loads every region and run page from the API", async () => {
  const requestedUrls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);
    const parsed = new URL(url);

    if (parsed.pathname === "/api/v1/regions" && !parsed.searchParams.has("cursor")) {
      return jsonResponse({
        items: [
          {
            region_id: "boulder-co",
            name: "Boulder County",
            bounds: { west: -105.7, south: 39.8, east: -104.9, north: 40.3 },
            status: "published",
            published_revision_id: "revision-1",
          },
        ],
        next_cursor: "region-page-2",
      });
    }
    if (parsed.pathname === "/api/v1/regions") {
      return jsonResponse({
        items: [
          {
            region_id: "golden-co",
            name: "Golden",
            bounds: { west: -105.4, south: 39.6, east: -105.0, north: 40.0 },
            status: "published",
            published_revision_id: "revision-2",
          },
        ],
        next_cursor: null,
      });
    }
    if (parsed.pathname === "/api/v1/simulation-runs" && !parsed.searchParams.has("cursor")) {
      return jsonResponse({
        items: [
          {
            simulation_id: "simulation-1",
            run_id: "run-1",
            region_id: "boulder-co",
            status: "STARTED",
            trigger: {
              kind: "scenario",
              correlation_id: "request-1",
              scenario_id: "scenario-west-wind",
              base_weather_version: "2026-08-11T15:00:00Z",
              ignition_points: [{ lat: 40.02, lon: -105.27 }],
              duration_hours: 4,
              delta_t_hours: 1,
            },
            grid_geometry: {},
            tick_refs: [],
            final_result_ref: null,
            failure: null,
          },
        ],
        next_cursor: "run-page-2",
      });
    }
    if (parsed.pathname === "/api/v1/simulation-runs") {
      return jsonResponse({
        items: [
          {
            simulation_id: "simulation-2",
            run_id: "run-2",
            region_id: "golden-co",
            status: "COMPLETED",
            trigger: {
              kind: "manual",
              correlation_id: "request-2",
              ignition_location: { lat: 39.75, lon: -105.22 },
              delta_t_hours: 0.5,
              time: { mode: "duration", duration_hours: 2 },
            },
            grid_geometry: {},
            tick_refs: [
              { tick: 1, world_state_ref: "state://tick/1" },
              { tick: 2, world_state_ref: "state://tick/2" },
            ],
            final_result_ref: "state://result/2",
            failure: null,
          },
        ],
        next_cursor: null,
      });
    }
    return new Response(null, { status: 404 });
  };

  const catalog = await fetchDigitalTwinRunCatalog("https://engine.example.com", { fetchImpl });

  assert.deepEqual(
    requestedUrls.map((url) => new URL(url).pathname),
    [
      "/api/v1/regions",
      "/api/v1/simulation-runs",
      "/api/v1/regions",
      "/api/v1/simulation-runs",
    ],
  );
  assert.equal(new URL(requestedUrls[2]).searchParams.get("cursor"), "region-page-2");
  assert.equal(new URL(requestedUrls[3]).searchParams.get("cursor"), "run-page-2");
  assert.deepEqual(catalog.regions.map((region) => region.name), ["Boulder County", "Golden"]);
  assert.deepEqual(catalog.runs[0], {
    id: "run-1",
    simulationId: "simulation-1",
    regionId: "boulder-co",
    regionName: "Boulder County",
    scenarioId: "scenario-west-wind",
    triggerKind: "scenario",
    status: "STARTED",
    ignitionPoints: [{ id: "run-1-ignition-1", latitude: 40.02, longitude: -105.27 }],
    durationHours: 4,
    deltaTHours: 1,
    completedTicks: 0,
    expectedTicks: 4,
    resultAvailable: false,
    failureCode: null,
  });
  assert.equal(catalog.runs[1].regionName, "Golden");
  assert.equal(catalog.runs[1].triggerKind, "manual");
  assert.equal(catalog.runs[1].durationHours, 2);
  assert.equal(catalog.runs[1].completedTicks, 2);
});

test("filterDigitalTwinRuns filters authoritative API fields", () => {
  const runs = [
    {
      id: "run-1",
      simulationId: "simulation-1",
      regionId: "boulder-co",
      regionName: "Boulder County",
      scenarioId: "scenario-west-wind",
      triggerKind: "scenario" as const,
      status: "STARTED" as const,
      ignitionPoints: [],
      durationHours: 4,
      deltaTHours: 1,
      completedTicks: 1,
      expectedTicks: 4,
      resultAvailable: false,
      failureCode: null,
    },
    {
      id: "run-2",
      simulationId: "simulation-2",
      regionId: "golden-co",
      regionName: "Golden",
      scenarioId: null,
      triggerKind: "manual" as const,
      status: "COMPLETED" as const,
      ignitionPoints: [],
      durationHours: 2,
      deltaTHours: 0.5,
      completedTicks: 4,
      expectedTicks: 4,
      resultAvailable: true,
      failureCode: null,
    },
  ];

  assert.deepEqual(
    filterDigitalTwinRuns(runs, {
      ...DEFAULT_DIGITAL_TWIN_RUN_FILTERS,
      query: "west wind",
      regionId: "boulder-co",
      scenarioId: "scenario-west-wind",
      status: "STARTED",
    }).map((run) => run.id),
    ["run-1"],
  );
});

test("fetchDigitalTwinRunCatalog reports malformed API records", async () => {
  const fetchImpl: typeof fetch = async (input) =>
    jsonResponse(
      String(input).includes("/regions")
        ? { items: [{ region_id: "", name: "Missing identity" }], next_cursor: null }
        : { items: [], next_cursor: null },
    );

  await assert.rejects(
    fetchDigitalTwinRunCatalog("https://engine.example.com", { fetchImpl }),
    /region record/i,
  );
});
