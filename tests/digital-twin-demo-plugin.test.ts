import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  ApiProblem,
  buildPowerLineNetwork,
  buildRegionBoundsGeoJson,
  buildRunRequest,
  buildScenarioRequest,
  createDigitalTwinClient,
  normalizeApiBaseUrl,
  selectDemoRegions,
  selectedTreeSummary,
} from "../apps/geolibre-desktop/public/plugins/digital-twin-demo/dist/index.js";

const pluginRoot = new URL(
  "../apps/geolibre-desktop/public/plugins/digital-twin-demo/",
  import.meta.url,
);

const region = {
  region_id: "front-range",
  name: "Front Range",
  status: "published",
  bounds: {
    west: -105.3,
    south: 39.7,
    east: -105.1,
    north: 39.9,
  },
};

const treeFeature = {
  type: "Feature" as const,
  geometry: {
    type: "Point" as const,
    coordinates: [-105.2, 39.8],
  },
  properties: {
    kind: "tree",
    asset_id: "tree-42",
    species: "ponderosa pine",
    height_m: 13.5,
  },
};

describe("digital-twin-demo bundled plugin", () => {
  it("places one pole model at each unique loaded power-line vertex and connects every span", () => {
    const network = buildPowerLineNetwork({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { kind: "power_line", asset_id: "span-1" },
          geometry: {
            type: "LineString",
            coordinates: [
              [-105.2, 40],
              [-105.1995, 40.0005],
            ],
          },
        },
        {
          type: "Feature",
          properties: { kind: "power_line", asset_id: "span-2" },
          geometry: {
            type: "LineString",
            coordinates: [
              [-105.1995, 40.0005],
              [-105.199, 40.001],
            ],
          },
        },
        {
          type: "Feature",
          properties: { kind: "tree", asset_id: "tree-1" },
          geometry: { type: "Point", coordinates: [-105.198, 40.002] },
        },
      ],
    });

    assert.equal(network.poles.length, 3);
    assert.deepEqual(
      network.poles.map((pole: { position: number[] }) => pole.position),
      [
        [-105.2, 40, 0],
        [-105.1995, 40.0005, 0],
        [-105.199, 40.001, 0],
      ],
    );
    assert.equal(network.conductors.length, 4);
    assert.ok(
      network.conductors.every(
        (conductor: { path: number[][] }) =>
          conductor.path.length === 2 &&
          conductor.path.every((coordinate) => coordinate[2] === 8.2),
      ),
    );
  });

  it("normalizes the configured API origin without losing a path prefix", () => {
    assert.equal(normalizeApiBaseUrl("http://127.0.0.1:8000/"), "http://127.0.0.1:8000");
    assert.equal(
      normalizeApiBaseUrl("https://demo.example.com/engine/api/"),
      "https://demo.example.com/engine/api",
    );
    assert.throws(() => normalizeApiBaseUrl("ftp://demo.example.com"), /http/i);
  });

  it("builds an axis-aligned scenario from the selected region and exact weather", () => {
    assert.deepEqual(
      buildScenarioRequest({
        region,
        weatherVersion: "2026-07-28T18:00:00Z",
        windSpeed: 15,
        windUnit: "mph",
        windBearing: 90,
        durationHours: 4,
      }),
      {
        region_id: "front-range",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-105.3, 39.7],
              [-105.1, 39.7],
              [-105.1, 39.9],
              [-105.3, 39.9],
              [-105.3, 39.7],
            ],
          ],
        },
        base_weather_version: "2026-07-28T18:00:00Z",
        wind_speed: { value: 15, unit: "mph" },
        wind_direction: { bearing_degrees: 90, reference: "towards" },
        duration_hours: 4,
      },
    );
  });

  it("builds visible region polygons and marks the selected bounds", () => {
    assert.deepEqual(
      buildRegionBoundsGeoJson(
        [
          {
            region_id: "golden-co",
            name: "Golden",
            bounds: { west: -105.4, south: 39.68, east: -105.15, north: 39.83 },
          },
          {
            region_id: "boulder-co",
            name: "Boulder",
            bounds: {
              west: -105.451725656711,
              south: 39.887996931377,
              east: -105.127274343289,
              north: 40.133003068623,
            },
          },
        ],
        "boulder-co",
      ),
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { region_id: "golden-co", name: "Golden", selected: false },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-105.4, 39.68],
                  [-105.15, 39.68],
                  [-105.15, 39.83],
                  [-105.4, 39.83],
                  [-105.4, 39.68],
                ],
              ],
            },
          },
          {
            type: "Feature",
            properties: { region_id: "boulder-co", name: "Boulder", selected: true },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-105.451725656711, 39.887996931377],
                  [-105.127274343289, 39.887996931377],
                  [-105.127274343289, 40.133003068623],
                  [-105.451725656711, 40.133003068623],
                  [-105.451725656711, 39.887996931377],
                ],
              ],
            },
          },
        ],
      },
    );
  });

  it("shows the seeded Boulder region first and excludes legacy and smoke-test regions", () => {
    const seededBoulder = {
      region_id: "seeded-boulder",
      name: "Boulder Demo",
      status: "published",
      bounds: {
        west: -105.212285,
        south: 40.000901,
        east: -105.178684,
        north: 40.034475,
      },
    };
    const golden = {
      region_id: "golden-co",
      name: "Golden",
      status: "published",
      bounds: { west: -105.4, south: 39.68, east: -105.15, north: 39.83 },
    };

    assert.deepEqual(
      selectDemoRegions([
        {
          region_id: "api-smoke",
          name: "API smoke published 969c7b2d",
          status: "published",
          bounds: { west: -105.3, south: 39.7, east: -105.1, north: 39.9 },
        },
        {
          region_id: "colorado",
          name: "Colorado",
          status: "published",
          bounds: {
            west: -105.451725656711,
            south: 39.887996931377,
            east: -105.127274343289,
            north: 40.133003068623,
          },
        },
        golden,
        {
          region_id: "boulder-co",
          name: "Boulder",
          status: "published",
          bounds: {
            west: -105.451725656711,
            south: 39.887996931377,
            east: -105.127274343289,
            north: 40.133003068623,
          },
        },
        {
          ...seededBoulder,
          region_id: "older-seeded-boulder",
        },
        seededBoulder,
      ]),
      [seededBoulder, golden],
    );
  });

  it("maps selected Engine tree coordinates to ordered GeoJSON ignition points", () => {
    const second = {
      ...treeFeature,
      geometry: { type: "Point" as const, coordinates: [-105.19, 39.81] },
      properties: { ...treeFeature.properties, asset_id: "tree-43" },
    };

    assert.deepEqual(buildRunRequest("scenario-1", [treeFeature, second]), {
      scenario_id: "scenario-1",
      ignition_points: [
        { type: "Point", coordinates: [-105.2, 39.8] },
        { type: "Point", coordinates: [-105.19, 39.81] },
      ],
    });
    assert.throws(() => buildRunRequest("scenario-1", []), /at least one tree/i);
  });

  it("formats selected tree lineage for the panel without dropping its asset id", () => {
    assert.deepEqual(selectedTreeSummary(treeFeature), {
      assetId: "tree-42",
      title: "ponderosa pine",
      detail: "13.5 m · 39.80000, -105.20000",
    });
  });

  it("sends idempotency and request identifiers through the API client", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          run_id: "run-1",
          scenario_id: "scenario-1",
          status: "queued",
          status_url: "/api/v1/simulation-runs/run-1",
          result_url: "/api/v1/simulation-runs/run-1/result.geojson",
        }),
        { status: 202, headers: { "content-type": "application/json" } },
      );
    };
    const client = createDigitalTwinClient("http://127.0.0.1:8000", { fetchImpl });

    await client.createRun(
      { scenario_id: "scenario-1", ignition_points: [{ type: "Point", coordinates: [-105, 40] }] },
      { idempotencyKey: "run-key", requestId: "request-1" },
    );

    assert.equal(calls[0].url, "http://127.0.0.1:8000/api/v1/simulation-runs");
    const headers = new Headers(calls[0].init?.headers);
    assert.equal(headers.get("Idempotency-Key"), "run-key");
    assert.equal(headers.get("X-Request-ID"), "request-1");
  });

  it("turns problem-details responses into a safe typed error", async () => {
    const client = createDigitalTwinClient("http://127.0.0.1:8000", {
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            type: "about:blank",
            title: "Conflict",
            status: 409,
            detail: "A run already owns this region.",
          }),
          { status: 409, headers: { "content-type": "application/problem+json" } },
        ),
    });

    await assert.rejects(
      () =>
        client.createRun(
          {
            scenario_id: "scenario-1",
            ignition_points: [{ type: "Point", coordinates: [-105, 40] }],
          },
          { idempotencyKey: "run-key", requestId: "request-1" },
        ),
      (error: unknown) => {
        assert.ok(error instanceof ApiProblem);
        assert.equal(error.status, 409);
        assert.equal(error.message, "A run already owns this region.");
        return true;
      },
    );
  });

  it("declares a matching bundled active-by-default plugin manifest", async () => {
    const manifest = JSON.parse(await readFile(new URL("plugin.json", pluginRoot), "utf8"));
    const poleModel = await readFile(new URL("assets/13.8kv_power_pole.glb", pluginRoot));
    const { default: plugin } = await import(
      "../apps/geolibre-desktop/public/plugins/digital-twin-demo/dist/index.js"
    );

    assert.ok(poleModel.byteLength > 0);
    assert.equal(manifest.activeByDefault, true);
    assert.equal(manifest.style, "dist/style.css");
    assert.equal(plugin.id, manifest.id);
    assert.equal(plugin.name, manifest.name);
    assert.equal(plugin.version, manifest.version);
    assert.equal(plugin.activeByDefault, undefined);
  });
});
