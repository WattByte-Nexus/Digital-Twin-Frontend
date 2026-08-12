import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deleteDigitalTwinAsset,
  fetchDigitalTwinAsset,
  fetchDigitalTwinAssets,
  importDigitalTwinAssetCsv,
  updateDigitalTwinAsset,
} from "../apps/geolibre-desktop/src/lib/digital-twin-assets";

const tree = {
  kind: "tree",
  asset_id: "asset-tree-1",
  region_id: "region/1",
  location: { lat: 40.01, lon: -105.27 },
  species: "ponderosa_pine",
  height_m: 12,
  canopy_radius_m: 3.5,
  source_ref: "city-tree:1",
};

const powerLine = {
  kind: "power_line",
  asset_id: "asset-line-1",
  region_id: "region/1",
  coordinates: [
    { lat: 40.01, lon: -105.27, elevation_m: 1_710.5 },
    { lat: 40.02, lon: -105.26, elevation_m: 1_712.25 },
  ],
  name: "North feeder span",
};

const powerLineDetail = {
  kind: "power_line",
  asset_id: "asset-line-1",
  region_id: "region/1",
  name: "North feeder span",
  geometry: {
    type: "LineString",
    coordinates: [
      [-105.27, 40.01, 1_710.5],
      [-105.26, 40.02, 1_712.25],
    ],
    bounds: {
      west: -105.27,
      south: 40.01,
      east: -105.26,
      north: 40.02,
    },
  },
  conductor: null,
  latest_physics: null,
};

describe("Digital Twin asset API", () => {
  it("loads and validates region assets and asset details", async () => {
    const urls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      urls.push(String(input));
      return Response.json(urls.length === 1 ? [tree, powerLine] : powerLineDetail);
    };
    const listed = await fetchDigitalTwinAssets(
      "http://engine.test/",
      "region/1",
      { fetchImpl }
    );
    const detail = await fetchDigitalTwinAsset(
      "http://engine.test/",
      "region/1",
      "asset-line-1",
      { fetchImpl }
    );
    assert.equal(listed[0]?.kind, "tree");
    assert.equal(listed[1]?.kind, "power_line");
    assert.deepEqual(detail, {
      kind: "power_line",
      assetId: "asset-line-1",
      regionId: "region/1",
      coordinates: [
        { lat: 40.01, lon: -105.27, elevationM: 1_710.5 },
        { lat: 40.02, lon: -105.26, elevationM: 1_712.25 },
      ],
      name: "North feeder span",
      bounds: {
        west: -105.27,
        south: 40.01,
        east: -105.26,
        north: 40.02,
      },
      conductor: null,
      latestPhysics: null,
    });
    assert.deepEqual(urls, [
      "http://engine.test/api/v1/regions/region%2F1/assets",
      "http://engine.test/api/v1/regions/region%2F1/assets/asset-line-1",
    ]);
  });

  it("retains enriched conductor inputs and latest physics on asset details", async () => {
    const fetchImpl: typeof fetch = async () =>
      Response.json({
        ...powerLineDetail,
        conductor: {
          mass_per_meter_kg_m: 0.433,
          span_length_m: 45.071,
          conductor_diameter_m: 0.01431,
          horizontal_tension_n: 7_500,
          air_density_kg_m3: 1.225,
          drag_coefficient: 1,
          static_sag_m: 0.3,
          elastic_modulus_pa: 69_000_000_000,
          cross_sectional_area_m2: 0.000125,
        },
        latest_physics: {
          status: "succeeded",
          source: "fem",
          tick: 9,
          line_snapshot: 3,
          weather_version: "2026-08-12T18:00:00Z",
          weather_source_ref: "weather-1",
          feature_contract_version: "power-line-v1",
          model_version: "model-1",
          model_checksum: "a".repeat(64),
          cached_from_tick: null,
          routing_reason: "near_threshold",
          solver_version: "solver-2",
          surrogate_confidence: null,
          wind_speed_mps: 18.4,
          midspan_displacement_m: 1.2,
          max_displacement_m: 1.5,
          max_displacement_position_m: 22.5,
          collision_envelope_m: {
            min_x: 0,
            max_x: 45.071,
            min_y: -1.51,
            max_y: 1.51,
          },
        },
      });

    const detail = await fetchDigitalTwinAsset(
      "http://engine.test",
      "region/1",
      "asset-line-1",
      { fetchImpl }
    );

    assert.equal(detail.kind, "power_line");
    assert.equal(detail.conductor?.spanLengthM, 45.071);
    assert.equal(
      detail.latestPhysics?.status === "succeeded"
        ? detail.latestPhysics.maxDisplacementM
        : null,
      1.5
    );
  });

  it("uses the canonical CSV import, patch, and delete contracts", async () => {
    const requests: Array<{
      method: string;
      url: string;
      body: BodyInit | null | undefined;
    }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push({
        method: init?.method ?? "GET",
        url: String(input),
        body: init?.body,
      });
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      return Response.json(init?.method === "POST" ? [tree] : tree, {
        status: init?.method === "POST" ? 201 : 200,
      });
    };
    const csv = new File(
      [
        'type,properties,coords\ntree,"{""species"":""ponderosa_pine""}","[-105.27,40.01]"',
      ],
      "assets.csv",
      { type: "text/csv" }
    );
    await importDigitalTwinAssetCsv("http://engine.test", "region/1", csv, {
      fetchImpl,
    });
    await updateDigitalTwinAsset(
      "http://engine.test",
      "region/1",
      "asset-tree-1",
      { height_m: 14 },
      { fetchImpl }
    );
    await deleteDigitalTwinAsset(
      "http://engine.test",
      "region/1",
      "asset-tree-1",
      { fetchImpl }
    );
    assert.deepEqual(
      requests.map(({ method, url }) => [method, url]),
      [
        ["POST", "http://engine.test/api/v1/regions/region%2F1/assets:csv"],
        [
          "PATCH",
          "http://engine.test/api/v1/regions/region%2F1/assets/asset-tree-1",
        ],
        [
          "DELETE",
          "http://engine.test/api/v1/regions/region%2F1/assets/asset-tree-1",
        ],
      ]
    );
    assert.ok(requests[0]?.body instanceof FormData);
    const uploaded = requests[0].body.get("file");
    assert.ok(uploaded instanceof File);
    assert.equal(uploaded.name, "assets.csv");
    assert.equal(uploaded.type, "text/csv");
  });

  it("rejects a non-CSV file before sending it", async () => {
    await assert.rejects(
      () =>
        importDigitalTwinAssetCsv(
          "http://engine.test",
          "region-1",
          new File(["assets"], "assets.txt", { type: "text/plain" })
        ),
      /must be a CSV file/
    );
  });

  it("surfaces the Engine's safe error detail", async () => {
    const fetchImpl: typeof fetch = async () =>
      Response.json(
        { detail: "Published assets cannot be deleted." },
        { status: 409 }
      );
    await assert.rejects(
      () =>
        deleteDigitalTwinAsset(
          "http://engine.test",
          "region-1",
          "asset-tree-1",
          { fetchImpl }
        ),
      /Published assets cannot be deleted/
    );
  });
});
