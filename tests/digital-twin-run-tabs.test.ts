import assert from "node:assert/strict";
import test from "node:test";
import {
  loadRunTab,
  type DigitalTwinRunRecord,
} from "../apps/geolibre-desktop/src/product-modes/digital-twin/ui/digital-twin-run-api";

const run: DigitalTwinRunRecord = {
  simulation_id: "simulation-1",
  run_id: "run/1",
  region_id: "region-1",
  status: "COMPLETED",
  trigger: {
    kind: "scenario",
    correlation_id: "request-1",
    scenario_id: "scenario-1",
    scenario_name: "Foothills wind test",
    base_weather_version: "2026-08-11T12:00:00Z",
    ignition_points: [{ lat: 40, lon: -105 }],
    duration_hours: 2,
    delta_t_hours: 1,
  },
  grid_geometry: {},
  tick_refs: [
    { tick: 0, world_state_ref: "state://initial" },
    { tick: 1, world_state_ref: "state://tick-1" },
    { tick: 2, world_state_ref: "state://tick-2" },
  ],
  final_result_ref: "state://final",
  metrics: {
    final_burning_cells: 12,
    final_burned_cells: 44,
    burned_area_hectares: 5.04,
    peak_spread_rate_hectares_per_hour: 2.7,
    land_cover_breakdown: [
      {
        class_id: 7292,
        label: "Rocky Mountain Aspen Forest and Woodland",
        area_hectares: 3.6,
        percentage: 71.4,
      },
      {
        class_id: 7733,
        label: "Southern Rocky Mountain Ponderosa Pine Woodland",
        area_hectares: 1.44,
        percentage: 28.6,
      },
    ],
  },
  failure: null,
};

function json(value: unknown): Response {
  return Response.json(value);
}

test("run tabs load their authoritative API resources", async (context) => {
  await context.test("overview, inputs, and activity load current run metadata", async () => {
    for (const tab of ["overview", "inputs", "activity"] as const) {
      const calls: string[] = [];
      const data = await loadRunTab("http://engine.test", "run/1", tab, {
        fetchImpl: async (input) => {
          calls.push(String(input));
          return json(run);
        },
      });

      assert.equal(data.kind, tab);
      assert.deepEqual(calls, ["http://engine.test/api/v1/simulation-runs/run%2F1"]);
    }
  });

  await context.test("fire behavior loads every durable tick artifact", async () => {
    const calls: string[] = [];
    const data = await loadRunTab("http://engine.test", "run/1", "behavior", {
      fetchImpl: async (input) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith("run%2F1")) return json(run);
        const tick = Number(url.match(/\/ticks\/(\d+)\//)?.[1]);
        return json({
          type: "FeatureCollection",
          features: [{
            type: "Feature",
            geometry: null,
            properties: {
              tick,
              active_cell_count: tick * 12,
              weather_version: `weather-${tick}`,
            },
          }],
        });
      },
    });

    assert.equal(data.kind, "behavior");
    assert.deepEqual(data.samples, [
      {
        tick: 1,
        activeCellCount: 12,
        weatherVersion: "weather-1",
        result: {
          type: "FeatureCollection",
          features: [{
            type: "Feature",
            geometry: null,
            properties: {
              tick: 1,
              active_cell_count: 12,
              weather_version: "weather-1",
            },
          }],
        },
      },
      {
        tick: 2,
        activeCellCount: 24,
        weatherVersion: "weather-2",
        result: {
          type: "FeatureCollection",
          features: [{
            type: "Feature",
            geometry: null,
            properties: {
              tick: 2,
              active_cell_count: 24,
              weather_version: "weather-2",
            },
          }],
        },
      },
    ]);
    assert.deepEqual(calls, [
      "http://engine.test/api/v1/simulation-runs/run%2F1",
      "http://engine.test/api/v1/simulation-runs/run%2F1/ticks/1/result.geojson",
      "http://engine.test/api/v1/simulation-runs/run%2F1/ticks/2/result.geojson",
    ]);
  });

  await context.test("exposure combines result geometry with region assets", async () => {
    const calls: string[] = [];
    const result = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: { tick: 2, active_cell_count: 24 },
        geometry: {
          type: "Polygon",
          coordinates: [[[-105.1, 39.9], [-104.9, 39.9], [-104.9, 40.1], [-105.1, 40.1], [-105.1, 39.9]]],
        },
      }],
    };
    const assets = {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { asset_id: "inside", asset_type: "substation" }, geometry: { type: "Point", coordinates: [-105, 40] } },
        { type: "Feature", properties: { asset_id: "outside", asset_type: "substation" }, geometry: { type: "Point", coordinates: [-104, 40] } },
      ],
    };
    const data = await loadRunTab("http://engine.test", "run/1", "exposure", {
      fetchImpl: async (input) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith("run%2F1")) return json(run);
        if (url.endsWith("result.geojson")) return json(result);
        return json(assets);
      },
    });

    assert.equal(data.kind, "exposure");
    assert.deepEqual(data.exposedAssets.map((asset) => asset.properties.asset_id), ["inside"]);
    assert.deepEqual(calls, [
      "http://engine.test/api/v1/simulation-runs/run%2F1",
      "http://engine.test/api/v1/simulation-runs/run%2F1/result.geojson",
      "http://engine.test/api/v1/regions/region-1/assets.geojson",
    ]);
  });

  await context.test("exposure uses the latest immutable tick while a run is active", async () => {
    const calls: string[] = [];
    const activeRun = { ...run, status: "STARTED", final_result_ref: null };
    await loadRunTab("http://engine.test", "run/1", "exposure", {
      fetchImpl: async (input) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith("run%2F1")) return json(activeRun);
        return json({ type: "FeatureCollection", features: [] });
      },
    });

    assert.deepEqual(calls, [
      "http://engine.test/api/v1/simulation-runs/run%2F1",
      "http://engine.test/api/v1/simulation-runs/run%2F1/ticks/2/result.geojson",
      "http://engine.test/api/v1/regions/region-1/assets.geojson",
    ]);
  });
});

test("run tab loading surfaces API problem details", async () => {
  await assert.rejects(
    loadRunTab("http://engine.test", "missing", "overview", {
      fetchImpl: async () =>
        new Response(JSON.stringify({ detail: "Run not found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        }),
    }),
    /Run not found/,
  );
});

test("run tab loading rejects incomplete run metrics before rendering", async () => {
  const incompleteRun = {
    ...run,
    metrics: {
      final_burning_cells: 12,
      final_burned_cells: 44,
      peak_spread_rate_hectares_per_hour: 2.7,
    },
  };

  await assert.rejects(
    loadRunTab("http://engine.test", "run/1", "overview", {
      fetchImpl: async () => json(incompleteRun),
    }),
    /invalid run metrics/i,
  );
});

test("run tab loading rejects malformed EVT land-cover entries", async () => {
  const invalidRun = {
    ...run,
    metrics: {
      ...run.metrics!,
      land_cover_breakdown: [
        { class_id: 7292, label: "", area_hectares: 5.04, percentage: 101 },
      ],
    },
  };

  await assert.rejects(
    loadRunTab("http://engine.test", "run/1", "overview", {
      fetchImpl: async () => json(invalidRun),
    }),
    /invalid run metrics/i,
  );
});
