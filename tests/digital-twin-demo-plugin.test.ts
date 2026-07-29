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
  createRunArtifactCoordinator,
  mergeRunProgress,
  normalizeApiBaseUrl,
  selectDemoAssetRegionIds,
  selectDemoRegions,
  selectedTreeSummary,
  TREE_CIRCLE_RADIUS_PX,
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

  it("uses an accessible compass instead of a numeric wind-bearing spinner", async () => {
    const source = await readFile(new URL("dist/index.js", pluginRoot), "utf8");

    assert.match(source, /function createCompassControl\(input\)/);
    assert.match(source, /compass\.setAttribute\("role", "radiogroup"\)/);
    assert.match(source, /\{ label: "N", value: 0 \}/);
    assert.match(source, /\{ label: "E", value: 90 \}/);
    assert.match(source, /\{ label: "S", value: 180 \}/);
    assert.match(source, /\{ label: "W", value: 270 \}/);
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
              [-105.2, 40],
              [-105.1995, 40],
            ],
          },
        },
        {
          type: "Feature",
          properties: { kind: "power_line", asset_id: "span-2" },
          geometry: {
            type: "LineString",
            coordinates: [
              [-105.19950002, 40.00000002],
              [-105.1995, 40.0005],
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
        [-105.1995, 40, 0],
        [-105.1995, 40.0005, 0],
      ],
    );
    assert.ok(
      network.poles.every(
        (pole: { scale: number[] }) =>
          pole.scale.length === 3 &&
          pole.scale.every((axisScale) => Math.abs(axisScale - 10.36 / 9.375) < 1e-12),
      ),
    );
    assert.equal(network.conductors.length, 4);
    assert.ok(
      network.conductors.every(
        (conductor: { path: number[][] }) =>
          conductor.path.length === 2 &&
          conductor.path.every((coordinate) => coordinate[2] === 9.5),
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
    assert.deepEqual(
      selectDemoAssetRegionIds([
        canonicalBoulder,
        { ...seededBoulder, region_id: "older-seeded-boulder" },
        seededBoulder,
        golden,
      ]),
      { "boulder-co": ["seeded-boulder", "older-seeded-boulder", "boulder-co"] },
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

  it("applies only the newest durable tick when artifact fetches finish out of order", async () => {
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
    assert.equal(pending.get(tickOneUrl)?.signal?.aborted, true);
    pending.get(tickTwoUrl)?.resolve({
      notModified: false,
      data: { type: "FeatureCollection", features: [] },
      etag: '"tick-2"',
      url: `http://engine.test${tickTwoUrl}`,
    });
    await tickTwo;
    pending.get(tickOneUrl)?.resolve({
      notModified: false,
      data: { type: "FeatureCollection", features: [{ properties: { tick: 1 } }] },
      etag: '"tick-1"',
      url: `http://engine.test${tickOneUrl}`,
    });
    await tickOne;

    assert.deepEqual(applied, [
      {
        runId: "run-1",
        tick: 2,
        artifactUrl: tickTwoUrl,
        url: `http://engine.test${tickTwoUrl}`,
        collection: { type: "FeatureCollection", features: [] },
      },
    ]);
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

  it("replaces one stable wildfire map source as durable ticks grow", () => {
    const sources = new Map<string, { data: object; setData: (data: object) => void }>();
    const layers = new Map<string, object>();
    const registrations: Array<{ id: string }> = [];
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
      features: [{ type: "Feature", properties: { tick: 1 }, geometry: null }],
    };
    const second = {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: { tick: 2 }, geometry: null }],
    };
    const controller = new WildfireMapController(app);

    controller.setData(first, { runId: "run-1", tick: 1, sourceUrl: "http://engine/tick-1" });
    controller.setData(second, { runId: "run-1", tick: 2, sourceUrl: "http://engine/tick-2" });

    assert.equal(addSourceCalls, 1);
    assert.equal(layers.size, 2);
    assert.deepEqual([...sources.values()][0].data, second);
    assert.deepEqual(registrations.map(({ id }) => id), ["digital-twin-demo-wildfire"]);
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
