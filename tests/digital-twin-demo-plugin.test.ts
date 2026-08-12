import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  ApiProblem,
  buildCanonicalRegionAssets,
  buildIgnitionPointFeature,
  buildOperationalPowerLineFeatures,
  buildPowerLineNetwork,
  buildPowerLineDetailView,
  buildRegionBoundsGeoJson,
  buildRunRequest,
  buildScenarioRequest,
  buildSimulationRunStatusView,
  buildSimulationReplayFrames,
  createDigitalTwinClient,
  createRunArtifactCoordinator,
  createSimulationReplayController,
  defaultApiUrl,
  mergeRunProgress,
  normalizeApiBaseUrl,
  REPLAY_CACHE_MAX_FRAMES,
  selectDemoRegions,
  selectedTreeSummary,
  SimulationReplayControl,
  TREE_CIRCLE_RADIUS_PX,
  validatePowerLineDetail,
  validatePowerLineSummaries,
  WildfireMapController,
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
  it("uses the same-origin Digital Twin proxy during local Vite development", () => {
    const runtimeWindow = {
      location: new URL("http://localhost:5173/?workspace=digital-twin"),
      localStorage: { getItem: () => "http://127.0.0.1:8000" },
    };

    assert.equal(
      defaultApiUrl(runtimeWindow),
      "http://localhost:5173/__digital_twin_api",
    );
  });

  it("makes the header's Runs mode a dedicated prior-runs view", async () => {
    const source = await readFile(new URL("dist/index.js", pluginRoot), "utf8");

    assert.match(source, /this\.scenarioSection\.hidden = showingRuns;/);
    assert.match(source, /this\.historySection\.hidden = !showingRuns;/);
    assert.match(source, /this\.scenarioSection\.append\(main, launch\);/);
  });

  it("keeps green tree circles the same screen size at every zoom level", async () => {
    const source = await readFile(new URL("dist/index.js", pluginRoot), "utf8");

    assert.equal(TREE_CIRCLE_RADIUS_PX, 5);
    assert.match(source, /"circle-radius": TREE_CIRCLE_RADIUS_PX/);
  });

  it("shows a pointer cursor when the green tree circles are hovered", async () => {
    const source = await readFile(new URL("dist/index.js", pluginRoot), "utf8");

    assert.match(source, /addEventListener\("mousemove", this\.onMapContainerMouseMove, true\)/);
    assert.match(source, /const cursor = active \? "pointer" : ""/);
    assert.match(source, /this\.mapContainer\.style\.cursor = cursor/);
  });

  it("uses a draggable accessible compass instead of a numeric wind-bearing spinner", async () => {
    const source = await readFile(new URL("dist/index.js", pluginRoot), "utf8");

    assert.match(source, /function createCompassControl\(input\)/);
    assert.match(source, /compass\.setAttribute\("role", "slider"\)/);
    assert.match(source, /compass\.addEventListener\("pointerdown"/);
    assert.match(source, /compass\.addEventListener\("pointermove"/);
    assert.match(source, /Math\.atan2\(dx, -dy\)/);
    assert.match(source, /needle\.style\.transform = `rotate\(\$\{rounded\}deg\)`/);
    assert.match(source, /this\.windBearingInput\.type = "hidden"/);
    assert.doesNotMatch(source, /this\.windBearingInput\.type = "number"/);
  });

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
              [-105.2, 40, 1_700],
              [-105.1995, 40, 1_701],
            ],
          },
        },
        {
          type: "Feature",
          properties: { kind: "power_line", asset_id: "span-2" },
          geometry: {
            type: "LineString",
            coordinates: [
              [-105.19950002, 40.00000002, 1_701],
              [-105.1995, 40.0005, 1_702],
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
        [-105.2, 40, 1_691.5],
        [-105.1995, 40, 1_692.5],
        [-105.1995, 40.0005, 1_693.5],
      ],
    );
    assert.ok(
      network.poles.every(
        (pole: { scale: number[] }) =>
          pole.scale.length === 3 &&
          pole.scale.every((axisScale) => Math.abs(axisScale - 8.5 / 9.375) < 1e-12),
      ),
    );
    assert.equal(network.conductors.length, 4);
    assert.ok(
      network.conductors.every(
        (conductor: { path: number[][] }) =>
          conductor.path.length === 2 &&
          conductor.path.every((coordinate) => coordinate[2] >= 1_700),
      ),
    );
    assert.deepEqual(network.conductors[0].path[1], network.conductors[2].path[0]);
    assert.deepEqual(network.conductors[1].path[1], network.conductors[3].path[0]);
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

  it("moves the camera to a region as soon as it is selected", async () => {
    const source = await readFile(new URL("dist/index.js", pluginRoot), "utf8");
    const loadRegionStart = source.indexOf("  async loadRegion(regionId) {");
    const loadRegionEnd = source.indexOf("\n  presentMapAfterFit()", loadRegionStart);
    const loadRegionSource = source.slice(loadRegionStart, loadRegionEnd);
    const cameraFit = loadRegionSource.indexOf("this.app.fitBounds?.(");
    const inventoryRequests = loadRegionSource.indexOf("await Promise.all([");

    assert.ok(loadRegionStart >= 0, "loadRegion must exist");
    assert.ok(cameraFit >= 0, "region selection must fit the camera");
    assert.ok(inventoryRequests >= 0, "region inventory must still load");
    assert.ok(
      cameraFit < inventoryRequests,
      "camera movement must not wait for region inventory requests",
    );
  });

  it("ships a connected Golden test power-line dataset", async () => {
    const fixtureUrl = new URL("assets/golden_test_power_lines.geojson", pluginRoot);
    const collection = JSON.parse(await readFile(fixtureUrl, "utf8"));

    assert.equal(collection.type, "FeatureCollection");
    assert.ok(collection.features.length >= 10);
    for (const [index, feature] of collection.features.entries()) {
      assert.equal(feature.geometry.type, "LineString");
      assert.equal(feature.geometry.coordinates.length, 2);
      assert.equal(feature.properties.asset_type, "power_line_span");
      for (const [longitude, latitude] of feature.geometry.coordinates) {
        assert.ok(longitude >= -105.25 && longitude <= -105.19, `span ${index + 1} longitude`);
        assert.ok(latitude >= 39.73 && latitude <= 39.78, `span ${index + 1} latitude`);
      }
    }

    const endpoints = collection.features.flatMap((feature: any) =>
      feature.geometry.coordinates.map((coordinate: number[]) => coordinate.join(",")),
    );
    assert.ok(new Set(endpoints).size < endpoints.length * 0.75, "spans must form a network");
  });

  it("renders the selected region as an outline without a fill", async () => {
    const source = await readFile(new URL("dist/index.js", pluginRoot), "utf8");

    assert.match(
      source,
      /"fill-opacity": \[\s*"case",\s*\["boolean", \["get", "selected"\], false\],\s*0,\s*0\.04,\s*\]/,
    );
  });

  it("shows the weather-enabled canonical Boulder region first and excludes seeded duplicates", () => {
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
    const canonicalBoulder = {
      region_id: "boulder-co",
      name: "Boulder",
      status: "published",
      bounds: {
        west: -105.451725656711,
        south: 39.887996931377,
        east: -105.127274343289,
        north: 40.133003068623,
      },
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
        canonicalBoulder,
        {
          ...seededBoulder,
          region_id: "older-seeded-boulder",
        },
        seededBoulder,
      ]),
      [canonicalBoulder, golden],
    );
  });

  it("maps arbitrary selected coordinates to ordered GeoJSON ignition points", () => {
    const second = {
      ...buildIgnitionPointFeature([-105.19, 39.81], "ignition-2"),
      geometry: { type: "Point" as const, coordinates: [-105.19, 39.81] },
    };

    assert.deepEqual(buildRunRequest("scenario-1", [treeFeature, second]), {
      scenario_id: "scenario-1",
      ignition_points: [
        { type: "Point", coordinates: [-105.2, 39.8] },
        { type: "Point", coordinates: [-105.19, 39.81] },
      ],
    });
    assert.throws(() => buildRunRequest("scenario-1", []), /at least one ignition point/i);
  });

  it("places an ignition point from every map-canvas click without requiring a tree hit", async () => {
    const source = await readFile(new URL("dist/index.js", pluginRoot), "utf8");

    assert.match(source, /canvas\?\.contains\(event\.target\)/);
    assert.match(source, /this\.map\.unproject\(/);
    assert.match(source, /buildIgnitionPointFeature\(\[lngLat\.lng, lngLat\.lat\]\)/);
  });

  it("renders ignition points above satellite imagery with a dual-contrast halo", async () => {
    const source = await readFile(new URL("dist/index.js", pluginRoot), "utf8");

    assert.match(source, /nearestTree \?\? buildIgnitionPointFeature/);
    assert.match(source, /id: SELECTION_HALO_LAYER_ID/);
    assert.match(source, /"circle-radius": TREE_CIRCLE_RADIUS_PX \+ 6/);
    assert.match(source, /"circle-color": "#ffffff"/);
    assert.match(source, /"circle-stroke-color": "#111827"/);
    assert.match(source, /"circle-radius": TREE_CIRCLE_RADIUS_PX \+ 2/);
    assert.match(source, /"circle-color": "#ff6b35"/);
    assert.match(source, /map\.moveLayer\(SELECTION_HALO_LAYER_ID\)/);
    assert.match(source, /map\.moveLayer\(SELECTION_LAYER_ID\)/);
    assert.doesNotMatch(source, /"circle-color": "rgba\(255,255,255,0\)"/);
  });

  it("toggles an existing orange ignition marker off when it is clicked again", async () => {
    const source = await readFile(new URL("dist/index.js", pluginRoot), "utf8");

    assert.match(source, /this\.selectionNearEvent = \(event\) =>/);
    assert.match(
      source,
      /selectedPoint \?\? nearestTree \?\? buildIgnitionPointFeature/,
    );
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

  it("loads canonical line summaries and encoded asset details through the API client", async () => {
    const calls: string[] = [];
    const client = createDigitalTwinClient("http://127.0.0.1:8000", {
      fetchImpl: async (input: string | URL | Request) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith("/assets")) return Response.json([]);
        return Response.json({
          kind: "power_line",
          asset_id: "line/7",
          region_id: "region/1",
          geometry: {
            type: "LineString",
            coordinates: [[-105.1, 40, 1_700], [-105, 40.1, 1_701]],
            bounds: { west: -105.1, south: 40, east: -105, north: 40.1 },
          },
          conductor: {
            mass_per_meter_kg_m: 1.35,
            span_length_m: 100,
            conductor_diameter_m: 0.019,
            horizontal_tension_n: 24525,
            air_density_kg_m3: 1.225,
            drag_coefficient: 1.2,
            static_sag_m: null,
            elastic_modulus_pa: null,
            cross_sectional_area_m2: null,
          },
          latest_physics: null,
        });
      },
    });

    await client.listPowerLineAssets("region/1");
    await client.getPowerLineAsset("region/1", "line/7");

    assert.deepEqual(calls, [
      "http://127.0.0.1:8000/api/v1/regions/region%2F1/assets",
      "http://127.0.0.1:8000/api/v1/regions/region%2F1/assets/line%2F7",
    ]);
  });

  it("turns canonical line assets into pickable GeoJSON", () => {
    assert.deepEqual(
      buildOperationalPowerLineFeatures([
        {
          kind: "power_line",
          asset_id: "line-7",
          region_id: "region-1",
          name: null,
          coordinates: [
            { lon: -105.1, lat: 40, elevation_m: 1_700 },
            { lon: -105, lat: 40.1, elevation_m: 1_701 },
          ],
        },
      ]),
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { kind: "power_line", asset_id: "line-7" },
            geometry: {
              type: "LineString",
              coordinates: [
                [-105.1, 40, 1_700],
                [-105, 40.1, 1_701],
              ],
            },
          },
        ],
      },
    );
  });

  it("renders canonical line assets without a second tree source", () => {
    const result = buildCanonicalRegionAssets([{
      kind: "power_line",
      asset_id: "canonical-line",
      region_id: "region-1",
      name: null,
      coordinates: [
        { lon: -105.1, lat: 40, elevation_m: 1_700 },
        { lon: -105, lat: 40.1, elevation_m: 1_701 },
      ],
    }]);

    assert.deepEqual(result.features.map((feature: { properties: { kind: string } }) => feature.properties.kind), [
      "power_line",
    ]);
  });

  it("accepts an empty asset catalog and rejects malformed line coordinates", () => {
    assert.deepEqual(validatePowerLineSummaries([]), []);
    assert.throws(
      () => validatePowerLineSummaries([{
        kind: "power_line",
        asset_id: "line-7",
        coordinates: [
          { lon: -105.1, lat: 40, elevation_m: 1_700 },
          { lon: 181, lat: 40, elevation_m: 1_701 },
        ],
      }]),
      /coordinate 2/i,
    );
    assert.throws(
      () => validatePowerLineSummaries([{
        kind: "power_line",
        asset_id: "line-7",
        coordinates: [
          { lon: "-105.1", lat: 40, elevation_m: 1_700 },
          { lon: -105, lat: 40.1, elevation_m: 1_701 },
        ],
      }]),
      /finite number/i,
    );
    const summary = {
      kind: "power_line",
      asset_id: "line-7",
      coordinates: [
        { lon: -105.1, lat: 40, elevation_m: 1_700 },
        { lon: -105, lat: 40.1, elevation_m: 1_701 },
      ],
    };
    assert.throws(() => validatePowerLineSummaries([summary, summary]), /duplicated/i);
  });

  it("builds explicit succeeded, failed, and awaiting-tick power-line detail states", () => {
    const base = {
      asset_id: "line-7",
      region_id: "region-1",
      geometry: {
        type: "LineString",
        coordinates: [
          [-105.1, 40, 1_700],
          [-105, 40.1, 1_701],
        ],
        bounds: { west: -105.1, south: 40, east: -105, north: 40.1 },
      },
      conductor: {
        mass_per_meter_kg_m: 1.35,
        span_length_m: 100,
        conductor_diameter_m: 0.019,
        horizontal_tension_n: 24525,
        air_density_kg_m3: 1.225,
        drag_coefficient: 1.2,
        static_sag_m: 0.675,
        elastic_modulus_pa: 77_000_000_000,
        cross_sectional_area_m2: 0.000386,
      },
    };

    const awaiting = buildPowerLineDetailView({ ...base, latest_physics: null });
    assert.equal(awaiting.statusLabel, "Awaiting first completed tick");
    assert.equal(awaiting.statusTone, "muted");
    assert.equal(awaiting.staticMetrics.some((item: { label: string }) => item.label === "Aerodynamic diameter"), false);
    assert.equal(awaiting.staticMetrics.find((item: { label: string }) => item.label === "Conductor diameter")?.value, "0.0190 m");

    const failed = buildPowerLineDetailView({
      ...base,
      latest_physics: {
        status: "failed",
        source: "failed",
        failure_kind: "non_convergent",
        tick: 9,
        line_snapshot: 3,
        weather_version: "2026-07-31T18:00:00Z",
        weather_source_ref: "weather://region-1/2026-07-31T18:00:00Z",
        feature_contract_version: "power-line-static-v1",
        model_version: "model-1",
        model_checksum: "a".repeat(64),
        cached_from_tick: null,
        routing_reason: null,
        solver_version: null,
        surrogate_confidence: null,
      },
    });
    assert.equal(failed.statusLabel, "Solve failed");
    assert.equal(failed.statusDetail, "Non-convergent · tick 9");
    assert.equal(failed.statusTone, "error");

    const succeeded = buildPowerLineDetailView({
      ...base,
      latest_physics: {
        status: "succeeded",
        source: "fem",
        tick: 9,
        line_snapshot: 3,
        weather_version: "2026-07-31T18:00:00Z",
        weather_source_ref: "weather://region-1/2026-07-31T18:00:00Z",
        wind_speed_mps: 18.4,
        midspan_displacement_m: 1.2,
        max_displacement_m: 1.5,
        max_displacement_position_m: 53,
        collision_envelope_m: { min_x: 0, max_x: 100, min_y: -1.51, max_y: 1.51 },
        feature_contract_version: "power-line-static-v1",
        model_version: "model-1",
        model_checksum: "a".repeat(64),
        cached_from_tick: null,
        routing_reason: "near_threshold",
        solver_version: "solver-2",
        surrogate_confidence: 0.73,
      },
    });
    assert.equal(succeeded.statusLabel, "Physics available");
    assert.equal(succeeded.statusDetail, "FEM · tick 9 · 18.4 m/s wind");
    assert.equal(succeeded.physicsMetrics.find((metric: { label: string }) => metric.label === "Max displacement")?.value, "1.50 m");
    assert.match(succeeded.footprintNote, /not verified vegetation contact/i);
  });

  it("validates detail IDs, conductor numbers, and physics discriminators", () => {
    const detail = {
      asset_id: "line-7",
      region_id: "region-1",
      geometry: {
        type: "LineString",
        coordinates: [[-105.1, 40, 1_700], [-105, 40.1, 1_701]],
        bounds: { west: -105.1, south: 40, east: -105, north: 40.1 },
      },
      conductor: {
        mass_per_meter_kg_m: 1.35,
        span_length_m: 100,
        conductor_diameter_m: 0.019,
        horizontal_tension_n: 24525,
        air_density_kg_m3: 1.225,
        drag_coefficient: 1.2,
        static_sag_m: null,
        elastic_modulus_pa: null,
        cross_sectional_area_m2: null,
      },
      latest_physics: null,
    };

    assert.equal(validatePowerLineDetail(detail, { regionId: "region-1", assetId: "line-7" }), detail);
    assert.throws(() => validatePowerLineDetail({ ...detail, asset_id: "wrong" }, { assetId: "line-7" }), /does not match/i);
    assert.throws(() => validatePowerLineDetail({ ...detail, conductor: { ...detail.conductor, span_length_m: "100" } }), /finite number/i);
    const { static_sag_m: _missingSag, ...conductorWithoutSag } = detail.conductor;
    assert.throws(() => validatePowerLineDetail({ ...detail, conductor: conductorWithoutSag }), /Static sag is required/i);
    assert.throws(() => validatePowerLineDetail({ ...detail, latest_physics: { status: "pending" } }), /unsupported status/i);
  });

  it("requires canonical line loading and clears stale map data during region switches", async () => {
    const source = await readFile(new URL("dist/index.js", pluginRoot), "utf8");

    assert.match(source, /this\.assetMap\.setData\(emptyFeatureCollection\(\), regionId\)/);
    assert.match(source, /Could not load power-line assets:/);
    assert.doesNotMatch(source, /Power-line details are unavailable/);
    assert.doesNotMatch(source, /return \[\];\s*\}\),\s*\]\);/);
  });

  it("restores power-line assets after style reload and aborts superseded detail requests", async () => {
    const source = await readFile(new URL("dist/index.js", pluginRoot), "utf8");

    assert.match(source, /this\.onStyleData = \(\) => this\.ensureLayers\(\)/);
    assert.match(source, /assetSource\.setData\(this\.data\)/);
    assert.match(source, /this\.powerLineDetailAbort\?\.abort\(\);\s*const abort = new AbortController\(\)/);
    assert.match(source, /if \(abort\.signal\.aborted \|\| this\.destroyed\) return;/);
  });

  it("gives operational power-line clicks priority over ignition placement", async () => {
    const source = await readFile(new URL("dist/index.js", pluginRoot), "utf8");
    const styles = await readFile(new URL("dist/style.css", pluginRoot), "utf8");

    assert.match(source, /const nearestPole = this\.poleNearEvent\(event\)/);
    assert.match(source, /const nearestPowerLine = nearestPole \?\? this\.powerLineNearEvent\(event\)/);
    assert.match(source, /if \(nearestPowerLine\) \{[\s\S]*this\.onPowerLineClick\(nearestPowerLine, \[anchor\.lng, anchor\.lat\]\)[\s\S]*return;/);
    assert.match(source, /showPowerLinePopup\(anchor, loading/);
    assert.match(source, /role", "dialog"/);
    assert.match(source, /className = "dt-power-line-popup"/);
    assert.match(styles, /\.dt-power-line-popup\s*\{/);
    assert.doesNotMatch(source, /showMessage\(`\$\{powerLineId\}: \$\{view\.statusLabel\}/);
  });

  it("streams named durable run progress and closes after terminal delivery", () => {
    class FakeEventSource {
      readonly url: string;
      readyState = 0;
      closed = false;
      listeners = new Map<string, Array<(event: MessageEvent) => void>>();

      constructor(url: string) {
        this.url = url;
      }

      addEventListener(name: string, listener: (event: MessageEvent) => void) {
        const listeners = this.listeners.get(name) ?? [];
        listeners.push(listener);
        this.listeners.set(name, listeners);
      }

      emit(name: string, data: object, lastEventId: string) {
        const event = { type: name, data: JSON.stringify(data), lastEventId } as MessageEvent;
        for (const listener of this.listeners.get(name) ?? []) listener(event);
      }

      close() {
        this.closed = true;
        this.readyState = 2;
      }
    }

    let source: FakeEventSource | undefined;
    const progress: Array<{ name: string; completedTicks: number; eventId: string }> = [];
    const client = createDigitalTwinClient("http://127.0.0.1:8000/engine", {
      eventSourceFactory: (url: string) => {
        source = new FakeEventSource(url);
        return source;
      },
    });

    client.watchRun("run/1", {
      onProgress: (payload: { completed_ticks: number }, event: MessageEvent) => {
        progress.push({
          name: event.type,
          completedTicks: payload.completed_ticks,
          eventId: event.lastEventId,
        });
      },
    });

    assert.equal(
      source?.url,
      "http://127.0.0.1:8000/engine/api/v1/simulation-runs/run%2F1/events",
    );
    source?.emit(
      "run_snapshot",
      {
        schema_version: 1,
        run_id: "run/1",
        status: "STARTED",
        completed_ticks: 1,
        total_ticks: 3,
        artifact_url: "/api/v1/simulation-runs/run%2F1/ticks/1/result.geojson",
      },
      "2-0",
    );
    source?.emit(
      "tick_completed",
      {
        schema_version: 1,
        run_id: "run/1",
        status: "STARTED",
        tick: 2,
        completed_ticks: 2,
        total_ticks: 3,
        artifact_url: "/api/v1/simulation-runs/run%2F1/ticks/2/result.geojson",
      },
      "3-0",
    );
    source?.emit(
      "run_completed",
      {
        schema_version: 1,
        run_id: "run/1",
        status: "COMPLETED",
        completed_ticks: 3,
        total_ticks: 3,
      },
      "4-0",
    );

    assert.deepEqual(progress, [
      { name: "run_snapshot", completedTicks: 1, eventId: "2-0" },
      { name: "tick_completed", completedTicks: 2, eventId: "3-0" },
      { name: "run_completed", completedTicks: 3, eventId: "4-0" },
    ]);
    assert.equal(source?.closed, true);
  });

  it("fetches immutable tick artifacts with strong ETag revalidation", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const artifact = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { tick: 4, active_cell_count: 12 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-105.2, 39.8],
                [-105.19, 39.8],
                [-105.19, 39.81],
                [-105.2, 39.8],
              ],
            ],
          },
        },
      ],
    };
    const responses = [
      new Response(JSON.stringify(artifact), {
        status: 200,
        headers: {
          "content-type": "application/geo+json",
          etag: '"tick-4"',
          "cache-control": "public, max-age=31536000, immutable",
        },
      }),
      new Response(null, { status: 304, headers: { etag: '"tick-4"' } }),
    ];
    const client = createDigitalTwinClient("http://127.0.0.1:8000/engine", {
      fetchImpl: async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: String(url), init });
        return responses.shift()!;
      },
    });

    const first = await client.getRunArtifact(
      "/api/v1/simulation-runs/run-1/ticks/4/result.geojson",
    );
    const second = await client.getRunArtifact(
      "/api/v1/simulation-runs/run-1/ticks/4/result.geojson",
      { etag: first.etag },
    );

    assert.deepEqual(first, {
      notModified: false,
      data: artifact,
      etag: '"tick-4"',
      url: "http://127.0.0.1:8000/engine/api/v1/simulation-runs/run-1/ticks/4/result.geojson",
    });
    assert.deepEqual(second, {
      notModified: true,
      data: null,
      etag: '"tick-4"',
      url: "http://127.0.0.1:8000/engine/api/v1/simulation-runs/run-1/ticks/4/result.geojson",
    });
    assert.equal(new Headers(calls[1].init?.headers).get("If-None-Match"), '"tick-4"');
  });

  it("applies every durable live tick in order when progress outruns artifact loading", async () => {
    type PendingArtifact = {
      signal?: AbortSignal;
      resolve: (value: {
        notModified: false;
        data: object;
        etag: string;
        url: string;
      }) => void;
    };
    const pending = new Map<string, PendingArtifact>();
    const applied: Array<{ tick: number; collection: object }> = [];
    const client = {
      resolveUrl: (path: string) => `http://engine.test${path}`,
      getRunArtifact: (path: string, options: { signal?: AbortSignal } = {}) =>
        new Promise((resolve) => {
          pending.set(path, {
            signal: options.signal,
            resolve: resolve as PendingArtifact["resolve"],
          });
        }),
    };
    const coordinator = createRunArtifactCoordinator(client, {
      onArtifact: (next: { tick: number; collection: object }) => applied.push(next),
    });
    const tickOneUrl = "/api/v1/simulation-runs/run-1/ticks/1/result.geojson";
    const tickTwoUrl = "/api/v1/simulation-runs/run-1/ticks/2/result.geojson";

    const tickOne = coordinator.update({
      run_id: "run-1",
      completed_ticks: 1,
      tick: 1,
      artifact_url: tickOneUrl,
    });
    const tickTwo = coordinator.update({
      run_id: "run-1",
      completed_ticks: 2,
      tick: 2,
      artifact_url: tickTwoUrl,
    });
    assert.equal(pending.get(tickOneUrl)?.signal?.aborted, false);
    assert.equal(pending.has(tickTwoUrl), true);
    pending.get(tickTwoUrl)?.resolve({
      notModified: false,
      data: { type: "FeatureCollection", features: [{ properties: { tick: 2 } }] },
      etag: '"tick-2"',
      url: `http://engine.test${tickTwoUrl}`,
    });
    await Promise.resolve();
    assert.deepEqual(applied, []);
    pending.get(tickOneUrl)?.resolve({
      notModified: false,
      data: { type: "FeatureCollection", features: [{ properties: { tick: 1 } }] },
      etag: '"tick-1"',
      url: `http://engine.test${tickOneUrl}`,
    });
    await tickOne;
    assert.deepEqual(applied.map(({ tick }) => tick), [1]);
    await tickTwo;

    assert.deepEqual(applied, [
      {
        runId: "run-1",
        tick: 1,
        artifactUrl: tickOneUrl,
        url: `http://engine.test${tickOneUrl}`,
        collection: {
          type: "FeatureCollection",
          features: [{ properties: { tick: 1 } }],
        },
      },
      {
        runId: "run-1",
        tick: 2,
        artifactUrl: tickTwoUrl,
        url: `http://engine.test${tickTwoUrl}`,
        collection: {
          type: "FeatureCollection",
          features: [{ properties: { tick: 2 } }],
        },
      },
    ]);
  });

  it("paces downloaded live ticks so each footprint reaches a browser frame", async () => {
    let now = 0;
    const waits: number[] = [];
    const applied: number[] = [];
    const client = {
      resolveUrl: (path: string) => `http://engine.test${path}`,
      getRunArtifact: async (path: string) => {
        const tick = Number(path.match(/\/ticks\/(\d+)\//)?.[1]);
        return {
          notModified: false,
          data: {
            type: "FeatureCollection",
            features: [{ properties: { tick } }],
          },
          etag: `"tick-${tick}"`,
          url: `http://engine.test${path}`,
        };
      },
    };
    const coordinator = createRunArtifactCoordinator(client, {
      liveFrameIntervalMs: 120,
      now: () => now,
      wait: async (milliseconds: number) => {
        waits.push(milliseconds);
        now += milliseconds;
      },
      onArtifact: ({ tick }: { tick: number }) => applied.push(tick),
    });

    await Promise.all([
      coordinator.update({
        run_id: "run-1",
        completed_ticks: 1,
        tick: 1,
        artifact_url: "/api/v1/simulation-runs/run-1/ticks/1/result.geojson",
      }),
      coordinator.update({
        run_id: "run-1",
        completed_ticks: 2,
        tick: 2,
        artifact_url: "/api/v1/simulation-runs/run-1/ticks/2/result.geojson",
      }),
    ]);

    assert.deepEqual(applied, [1, 2]);
    assert.deepEqual(waits, [120]);
  });

  it("drains queued live ticks before terminal run cleanup", async () => {
    const source = await readFile(new URL("dist/index.js", pluginRoot), "utf8");
    let resolveArtifact!: (value: {
      notModified: false;
      data: object;
      etag: string;
      url: string;
    }) => void;
    const applied: number[] = [];
    const client = {
      resolveUrl: (path: string) => `http://engine.test${path}`,
      getRunArtifact: () =>
        new Promise((resolve) => {
          resolveArtifact = resolve;
        }),
    };
    const coordinator = createRunArtifactCoordinator(client, {
      onArtifact: ({ tick }: { tick: number }) => applied.push(tick),
    });
    const artifactUrl = "/api/v1/simulation-runs/run-1/ticks/1/result.geojson";

    void coordinator.update({
      run_id: "run-1",
      completed_ticks: 1,
      tick: 1,
      artifact_url: artifactUrl,
    });
    const drained = coordinator.flush();
    let didDrain = false;
    void drained.then(() => {
      didDrain = true;
    });
    await Promise.resolve();
    assert.equal(didDrain, false);

    resolveArtifact({
      notModified: false,
      data: { type: "FeatureCollection", features: [{ properties: { tick: 1 } }] },
      etag: '"tick-1"',
      url: `http://engine.test${artifactUrl}`,
    });
    await drained;

    assert.deepEqual(applied, [1]);
    assert.match(
      source,
      /await this\.runArtifactCoordinator\?\.flush\(\);\s*this\.runArtifactCoordinator\?\.stop\(\)/,
    );
  });

  it("uses snapshot artifact URLs and deduplicates replayed progress", async () => {
    const calls: string[] = [];
    const applied: number[] = [];
    const client = {
      resolveUrl: (path: string) => `http://engine.test${path}`,
      getRunArtifact: async (path: string) => {
        calls.push(path);
        return {
          notModified: false,
          data: { type: "FeatureCollection", features: [] },
          etag: '"tick-3"',
          url: `http://engine.test${path}`,
        };
      },
    };
    const coordinator = createRunArtifactCoordinator(client, {
      onArtifact: ({ tick }: { tick: number }) => applied.push(tick),
    });
    const snapshot = {
      run_id: "run-1",
      completed_ticks: 3,
      artifact_url: "/api/v1/simulation-runs/run-1/ticks/3/result.geojson",
    };

    await coordinator.update(snapshot);
    await coordinator.update(snapshot);

    assert.deepEqual(calls, [snapshot.artifact_url]);
    assert.deepEqual(applied, [3]);
  });

  it("loads all newly completed artifacts while live monitoring falls back to polling", async () => {
    const source = await readFile(new URL("dist/index.js", pluginRoot), "utf8");
    const calls: string[] = [];
    const applied: number[] = [];
    const client = {
      resolveUrl: (path: string) => `http://engine.test${path}`,
      getRunArtifact: async (path: string) => {
        calls.push(path);
        const tick = Number(path.match(/\/ticks\/(\d+)\//)?.[1]);
        return {
          notModified: false,
          data: {
            type: "FeatureCollection",
            features: [{ properties: { tick } }],
          },
          etag: `"tick-${tick}"`,
          url: `http://engine.test${path}`,
        };
      },
    };
    const coordinator = createRunArtifactCoordinator(client, {
      onArtifact: ({ tick }: { tick: number }) => applied.push(tick),
    });
    const run = {
      run_id: "run-1",
      status: "STARTED",
      completed_ticks: 3,
      tick_refs: [
        { tick: 0, world_state_ref: "state://initial" },
        { tick: 1, world_state_ref: "state://tick-1" },
        { tick: 2, world_state_ref: "state://tick-2" },
        { tick: 3, world_state_ref: "state://tick-3" },
      ],
    };

    await coordinator.updateRun(run);
    await coordinator.updateRun(run);

    assert.deepEqual(calls, [
      "/api/v1/simulation-runs/run-1/ticks/1/result.geojson",
      "/api/v1/simulation-runs/run-1/ticks/2/result.geojson",
      "/api/v1/simulation-runs/run-1/ticks/3/result.geojson",
    ]);
    assert.deepEqual(applied, [1, 2, 3]);
    assert.match(source, /await this\.runArtifactCoordinator\?\.updateRun\(run\)/);
  });

  it("builds replay frames for every durable simulation tick", () => {
    assert.deepEqual(
      buildSimulationReplayFrames({
        run_id: "run/1",
        completed_ticks: 3,
        tick_refs: [
          { tick: 0, world_state_ref: "state://initial" },
          { tick: 1, world_state_ref: "state://tick-1" },
          {
            tick: 2,
            artifact_url: "https://untrusted.example/tick-2.geojson",
          },
        ],
      }),
      [
        {
          runId: "run/1",
          tick: 1,
          artifactUrl: "/api/v1/simulation-runs/run%2F1/ticks/1/result.geojson",
        },
        {
          runId: "run/1",
          tick: 2,
          artifactUrl: "/api/v1/simulation-runs/run%2F1/ticks/2/result.geojson",
        },
      ],
    );
    assert.deepEqual(
      buildSimulationReplayFrames({ run_id: "live-run", completed_ticks: 2 }),
      [
        {
          runId: "live-run",
          tick: 1,
          artifactUrl: "/api/v1/simulation-runs/live-run/ticks/1/result.geojson",
        },
        {
          runId: "live-run",
          tick: 2,
          artifactUrl: "/api/v1/simulation-runs/live-run/ticks/2/result.geojson",
        },
      ],
    );
  });

  it("keeps superseded tick downloads warm while applying only the newest request", async () => {
    type PendingReplay = {
      signal?: AbortSignal;
      resolve: (value: {
        notModified: false;
        data: object;
        etag: string;
        url: string;
      }) => void;
    };
    const pending = new Map<string, PendingReplay>();
    const calls: string[] = [];
    const applied: number[] = [];
    const client = {
      getRunArtifact: (path: string, options: { signal?: AbortSignal } = {}) => {
        calls.push(path);
        return new Promise((resolve) => {
          pending.set(path, {
            signal: options.signal,
            resolve: resolve as PendingReplay["resolve"],
          });
        });
      },
    };
    const replay = createSimulationReplayController(client, {
      onFrame: ({ tick }: { tick: number }) => applied.push(tick),
      prefetchRadius: 0,
    });
    replay.setRun({ run_id: "run-1", completed_ticks: 2 });

    const first = replay.showTick(1);
    const second = replay.showTick(2);
    const tickOneUrl = "/api/v1/simulation-runs/run-1/ticks/1/result.geojson";
    const tickTwoUrl = "/api/v1/simulation-runs/run-1/ticks/2/result.geojson";
    assert.equal(pending.get(tickOneUrl)?.signal?.aborted, false);
    pending.get(tickTwoUrl)?.resolve({
      notModified: false,
      data: {
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: { tick: 2 }, geometry: null }],
      },
      etag: '"tick-2"',
      url: `http://engine.test${tickTwoUrl}`,
    });
    await second;
    pending.get(tickOneUrl)?.resolve({
      notModified: false,
      data: {
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: { tick: 1 }, geometry: null }],
      },
      etag: '"stale-tick-1"',
      url: `http://engine.test${tickOneUrl}`,
    });
    await first;

    await replay.showTick(1);
    await replay.showTick(2);

    assert.deepEqual(applied, [2, 1, 2]);
    assert.deepEqual(calls, [tickOneUrl, tickTwoUrl]);
    replay.destroy();
  });

  it("prefetches nearby replay ticks with bounded concurrency", async () => {
    const calls: number[] = [];
    let active = 0;
    let maxActive = 0;
    const releases: Array<() => void> = [];
    const client = {
      getRunArtifact: async (path: string) => {
        const tick = Number(path.match(/ticks\/(\d+)/)?.[1]);
        calls.push(tick);
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise<void>((resolve) => releases.push(resolve));
        active -= 1;
        return {
          notModified: false,
          data: {
            type: "FeatureCollection",
            features: [{ type: "Feature", properties: { tick }, geometry: null }],
          },
          etag: `"tick-${tick}"`,
          url: `http://engine.test${path}`,
        };
      },
    };
    const replay = createSimulationReplayController(client, {
      prefetchConcurrency: 2,
      prefetchRadius: 2,
    });
    replay.setRun({ run_id: "run-1", completed_ticks: 8 });

    const prefetch = replay.prefetchTick(4);
    while (releases.length < 2) await Promise.resolve();
    assert.equal(maxActive, 2);
    while (active > 0 || calls.length < 5) {
      releases.splice(0).forEach((release) => release());
      await Promise.resolve();
    }
    await prefetch;

    assert.deepEqual(calls, [4, 3, 5, 2, 6]);
    replay.destroy();
  });

  it("bounds the replay cache while retaining recently viewed ticks", async () => {
    const calls: string[] = [];
    const client = {
      getRunArtifact: async (path: string) => {
        calls.push(path);
        const tick = Number(path.match(/ticks\/(\d+)/)?.[1]);
        return {
          notModified: false,
          data: {
            type: "FeatureCollection",
            features: [{ type: "Feature", properties: { tick }, geometry: null }],
          },
          etag: `"tick-${tick}"`,
          url: `http://engine.test${path}`,
        };
      },
    };
    const replay = createSimulationReplayController(client, { prefetchRadius: 0 });
    replay.setRun({
      run_id: "long-run",
      completed_ticks: REPLAY_CACHE_MAX_FRAMES + 1,
    });

    for (let tick = 1; tick <= REPLAY_CACHE_MAX_FRAMES + 1; tick += 1) {
      await replay.showTick(tick);
    }
    await replay.showTick(REPLAY_CACHE_MAX_FRAMES + 1);
    await replay.showTick(1);

    assert.equal(calls.length, REPLAY_CACHE_MAX_FRAMES + 2);
    assert.equal(
      calls.filter((path) => path.endsWith("/ticks/1/result.geojson")).length,
      2,
    );
    replay.destroy();
  });

  it("duplicates the GeoLibre time-slider transport and scrubbable dock for run replay", async () => {
    const source = await readFile(new URL("dist/index.js", pluginRoot), "utf8");

    assert.match(source, /class SimulationReplayControl/);
    assert.match(source, /className = "maplibregl-time-slider-dock dt-replay-dock"/);
    assert.match(source, /aria-label", "Previous simulation tick"/);
    assert.match(source, /aria-label", "Play simulation replay"/);
    assert.match(source, /this\.scrubber\.type = "range"/);
    assert.match(source, /maplibregl-time-slider-layout dt-replay-layout/);
    assert.match(source, /Wait for or cancel the active run before replaying a prior run/);
    assert.match(source, /resultLoadGeneration !== this\.resultLoadGeneration/);
  });

  it("does not resume autoplay after a manual scrub interrupts the first frame load", async () => {
    const pending = new Map<number, (value: object) => void>();
    const control = new SimulationReplayControl(
      (frame: { tick: number }) =>
        new Promise((resolve) => {
          pending.set(frame.tick, resolve);
        }),
    );
    control.playButton = {
      textContent: "",
      title: "",
      setAttribute: () => {},
      classList: { add: () => {}, remove: () => {} },
    };
    control.setFrames([
      { runId: "run-1", tick: 1, artifactUrl: "/tick-1" },
      { runId: "run-1", tick: 2, artifactUrl: "/tick-2" },
    ]);

    const autoplay = control.play({ fromStart: true });
    const manual = control.goToIndex(1, { manual: true });
    pending.get(1)?.({ collection: { type: "FeatureCollection", features: [] } });
    await autoplay;
    pending.get(2)?.({ collection: { type: "FeatureCollection", features: [] } });
    await manual;

    assert.equal(control.playing, false);
    control.onRemove();
  });

  it("coalesces live scrubber input to the newest tick on each browser frame", async () => {
    const selected: number[] = [];
    let scheduledFrame: (() => void) | null = null;
    const control = new SimulationReplayControl(
      async (frame: { tick: number }) => {
        selected.push(frame.tick);
        return { collection: { type: "FeatureCollection", features: [] } };
      },
      {
        requestFrame: (callback: () => void) => {
          scheduledFrame = callback;
          return 41;
        },
        cancelFrame: () => {
          scheduledFrame = null;
        },
      },
    );
    control.playButton = {
      textContent: "",
      title: "",
      setAttribute: () => {},
      classList: { add: () => {}, remove: () => {} },
    };
    control.setFrames(
      Array.from({ length: 100 }, (_, index) => ({
        runId: "run-1",
        tick: index + 1,
        artifactUrl: `/tick-${index + 1}`,
      })),
    );

    control.queueScrub(10);
    control.queueScrub(70);
    control.queueScrub(99);
    assert.deepEqual(selected, []);
    assert.equal(control.index, 99);

    scheduledFrame?.();
    await Promise.resolve();
    assert.deepEqual(selected, [100]);
    control.onRemove();
  });

  it("updates the map immediately while deferring replay store synchronization", () => {
    const sources = new Map<string, { data: object; setData: (data: object) => void }>();
    const layers = new Map<string, object>();
    const registrations: Array<{ geojson: object }> = [];
    let scheduledRegistration: (() => void) | null = null;
    const map = {
      isStyleLoaded: () => true,
      on: () => {},
      off: () => {},
      getSource: (id: string) => sources.get(id),
      addSource: (id: string, source: { data: object }) => {
        const mutable = {
          data: source.data,
          setData(data: object) {
            mutable.data = data;
          },
        };
        sources.set(id, mutable);
      },
      removeSource: (id: string) => sources.delete(id),
      getLayer: (id: string) => layers.get(id),
      addLayer: (layer: { id: string }) => layers.set(layer.id, layer),
      removeLayer: (id: string) => layers.delete(id),
      setLayoutProperty: () => {},
      setPaintProperty: () => {},
    };
    const app = {
      getMap: () => map,
      registerExternalNativeLayer: (registration: { geojson: object }) =>
        registrations.push(registration),
      unregisterExternalNativeLayer: () => {},
      subscribeExternalNativeLayerState: () => () => {},
    };
    const controller = new WildfireMapController(app, {
      scheduleRegistration: (callback: () => void) => {
        scheduledRegistration = callback;
        return 17;
      },
      cancelRegistration: () => {
        scheduledRegistration = null;
      },
    });
    const frame = (tick: number) => ({
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: { tick }, geometry: null }],
    });

    controller.setData(frame(1), {
      runId: "run-1",
      tick: 1,
      sourceUrl: "http://engine/tick-1",
      deferRegistration: true,
    });
    controller.setData(frame(2), {
      runId: "run-1",
      tick: 2,
      sourceUrl: "http://engine/tick-2",
      deferRegistration: true,
    });

    assert.deepEqual([...sources.values()][0].data, frame(2));
    assert.deepEqual(registrations, []);
    scheduledRegistration?.();
    assert.deepEqual(registrations.map(({ geojson }) => geojson), [frame(2)]);
    controller.destroy();
  });

  it("does not skip a replay tick when another advance is requested during loading", async () => {
    let resolveSelection: ((value: object) => void) | undefined;
    const selected: number[] = [];
    const control = new SimulationReplayControl(
      (frame: { tick: number }) =>
        new Promise((resolve) => {
          selected.push(frame.tick);
          resolveSelection = resolve;
        }),
    );
    control.playButton = {
      textContent: "",
      title: "",
      setAttribute: () => {},
      classList: { add: () => {}, remove: () => {} },
    };
    control.setFrames([
      { runId: "run-1", tick: 1, artifactUrl: "/tick-1" },
      { runId: "run-1", tick: 2, artifactUrl: "/tick-2" },
      { runId: "run-1", tick: 3, artifactUrl: "/tick-3" },
    ]);
    control.index = 0;
    control.playing = true;

    const firstAdvance = control.advance();
    const competingAdvance = control.advance();
    assert.deepEqual(selected, [2]);
    resolveSelection?.({ collection: { type: "FeatureCollection", features: [] } });
    await Promise.all([firstAdvance, competingAdvance]);

    assert.equal(control.index, 1);
    control.onRemove();
  });

  it("replaces one stable wildfire map source as durable ticks grow", () => {
    const sources = new Map<string, { data: object; setData: (data: object) => void }>();
    const layers = new Map<string, object>();
    const registrations: Array<{ id: string; geojson: object; opacity?: number }> = [];
    let addSourceCalls = 0;
    const map = {
      isStyleLoaded: () => true,
      on: () => {},
      off: () => {},
      getSource: (id: string) => sources.get(id),
      addSource: (id: string, source: { data: object }) => {
        addSourceCalls += 1;
        const mutable = {
          data: source.data,
          setData(data: object) {
            mutable.data = data;
          },
        };
        sources.set(id, mutable);
      },
      removeSource: (id: string) => sources.delete(id),
      getLayer: (id: string) => layers.get(id),
      addLayer: (layer: { id: string }) => layers.set(layer.id, layer),
      removeLayer: (id: string) => layers.delete(id),
      setLayoutProperty: () => {},
      setPaintProperty: () => {},
    };
    const app = {
      getMap: () => map,
      registerExternalNativeLayer: (registration: {
        id: string;
        geojson: object;
        opacity?: number;
      }) => registrations.push(registration),
      unregisterExternalNativeLayer: () => {},
      subscribeExternalNativeLayerState: (
        _id: string,
        callback: (state: { visible: boolean; opacity: number }) => void,
      ) => {
        callback({ visible: true, opacity: 1 });
        return () => {};
      },
    };
    const first = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { tick: 1 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
                [0, 0],
              ],
            ],
          },
        },
      ],
    };
    const second = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { tick: 2 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [0, 0],
                [2, 0],
                [2, 2],
                [0, 2],
                [0, 0],
              ],
            ],
          },
        },
      ],
    };
    const controller = new WildfireMapController(app);

    controller.setData(first, { runId: "run-1", tick: 1, sourceUrl: "http://engine/tick-1" });
    controller.setData(second, { runId: "run-1", tick: 2, sourceUrl: "http://engine/tick-2" });

    assert.equal(addSourceCalls, 1);
    assert.equal(layers.size, 2);
    assert.deepEqual([...sources.values()][0].data, second);
    assert.deepEqual(
      registrations.map(({ id, geojson }) => ({ id, geojson })),
      [
        { id: "digital-twin-demo-wildfire", geojson: first },
        { id: "digital-twin-demo-wildfire", geojson: second },
      ],
    );
    assert.equal(registrations[0].opacity, 0.82);
    assert.equal(registrations[1].opacity, undefined);
    controller.destroy();
  });

  it("merges streamed counts without discarding authoritative run lineage", () => {
    assert.deepEqual(
      mergeRunProgress(
        {
          run_id: "run-1",
          region_id: "front-range",
          status: "QUEUED",
          tick_refs: [{ tick: 0, world_state_ref: "state://tick-0" }],
        },
        {
          schema_version: 1,
          run_id: "run-1",
          status: "STARTED",
          completed_ticks: 2,
          total_ticks: 4,
          tick: 2,
        },
      ),
      {
        run_id: "run-1",
        region_id: "front-range",
        status: "STARTED",
        tick_refs: [{ tick: 0, world_state_ref: "state://tick-0" }],
        schema_version: 1,
        completed_ticks: 2,
        total_ticks: 4,
        tick: 2,
      },
    );
  });

  it("keeps live run progress monotonic when snapshots arrive out of order", () => {
    assert.deepEqual(
      mergeRunProgress(
        {
          run_id: "run-1",
          status: "COMPLETED",
          completed_ticks: 4,
          total_ticks: 4,
          tick: 4,
        },
        {
          schema_version: 1,
          run_id: "run-1",
          status: "STARTED",
          completed_ticks: 3,
          total_ticks: null,
          tick: 3,
        },
      ),
      {
        run_id: "run-1",
        status: "COMPLETED",
        completed_ticks: 4,
        total_ticks: 4,
        tick: 4,
        schema_version: 1,
      },
    );
  });

  it("builds stable determinate and indeterminate live status views", () => {
    assert.deepEqual(
      buildSimulationRunStatusView({
        run_id: "run-1",
        region_id: "front-range",
        status: "STARTED",
        completed_ticks: 3,
        total_ticks: 8,
      }),
      {
        active: true,
        completedTicks: 3,
        detail: "3 / 8 ticks completed",
        failure: null,
        identifier: "run-1",
        progressRatio: 0.375,
        progressText: "3 of 8 simulation ticks completed",
        regionText: "Region front-range",
        status: "STARTED",
        statusLabel: "STARTED",
        totalTicks: 8,
      },
    );
    assert.deepEqual(
      buildSimulationRunStatusView({
        scenario_id: "scenario-1",
        status: "SUBMITTING",
        completed_ticks: 0,
      }),
      {
        active: true,
        completedTicks: 0,
        detail: "0 ticks produced",
        failure: null,
        identifier: "scenario-1",
        progressRatio: null,
        progressText: "Simulation is SUBMITTING",
        regionText: "",
        status: "SUBMITTING",
        statusLabel: "SUBMITTING",
        totalTicks: null,
      },
    );
  });

  it("keeps the live status DOM stable and animates only the progress fill", async () => {
    const source = await readFile(new URL("dist/index.js", pluginRoot), "utf8");
    const styles = await readFile(new URL("dist/style.css", pluginRoot), "utf8");

    assert.doesNotMatch(
      source,
      /renderRunStatus\(run\) \{\s*this\.runStatus\.replaceChildren\(\)/,
    );
    assert.match(source, /this\.runProgressFill\.style\.setProperty\("--dt-run-progress"/);
    assert.match(source, /this\.runProgress\.setAttribute\("role", "progressbar"\)/);
    assert.match(styles, /\.dt-run-progress-fill\s*\{[^}]*transition: transform/s);
    assert.match(styles, /\.dt-run-progress-indeterminate \.dt-run-progress-fill/s);
    assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.dt-run-progress-fill/);
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
    const poleModel = await readFile(
      new URL(
        "../../assets/digital-twin/13.8kv_power_pole.glb",
        pluginRoot
      )
    );
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
