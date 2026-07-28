import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  assetCandidates,
  boundsForGeoJson,
  seedBoulderRegion,
} from "../scripts/seed-boulder-region.mjs";

const powerLines = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Demo feeder" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-105.21, 40.01],
          [-105.18, 40.03],
        ],
      },
    },
  ],
};

const trees = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { species: "ponderosa_pine", height_m: 8.5 },
      geometry: { type: "Point", coordinates: [-105.2, 40.02] },
    },
    {
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [-105.19, 40.025] },
    },
  ],
};

describe("Boulder Digital Twin seed", () => {
  it("uses the bundled demo files as one feeder and 864 Boulder trees", async () => {
    const [bundledPowerLines, bundledTrees] = await Promise.all(
      [
        "../apps/geolibre-desktop/public/plugins/distribution-network/assets/testpowerlines.geojson",
        "../apps/geolibre-desktop/public/plugins/distribution-network/assets/testtrees.geojson",
      ].map(async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"))),
    );

    assert.equal(assetCandidates(bundledPowerLines, bundledTrees).length, 865);
    assert.deepEqual(boundsForGeoJson([bundledPowerLines, bundledTrees]), {
      west: -105.212285,
      south: 40.000901,
      east: -105.178684,
      north: 40.034475,
    });
  });

  it("derives padded WGS84 bounds from every demo asset", () => {
    assert.deepEqual(boundsForGeoJson([powerLines, trees], 0.001), {
      west: -105.211,
      south: 40.009,
      east: -105.179,
      north: 40.031,
    });
  });

  it("maps demo GeoJSON features to the Engine asset-create contracts", () => {
    assert.deepEqual(assetCandidates(powerLines, trees), [
      {
        kind: "power_line",
        coordinates: [
          { lon: -105.21, lat: 40.01 },
          { lon: -105.18, lat: 40.03 },
        ],
        name: "Demo feeder",
      },
      {
        kind: "tree",
        location: { lon: -105.2, lat: 40.02 },
        species: "ponderosa_pine",
        height_m: 8.5,
      },
      {
        kind: "tree",
        location: { lon: -105.19, lat: 40.025 },
      },
    ]);
  });

  it("creates, populates, and publishes a Boulder region through the public endpoints", async () => {
    const calls: Array<{ path: string; method: string; body: unknown }> = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ path: url.pathname, method, body });

      if (url.pathname === "/api/v1/regions") {
        return Response.json(
          { region_id: "region-boulder", name: "Boulder Demo", status: "draft", bounds: body.bounds },
          { status: 201 },
        );
      }
      if (url.pathname.endsWith("/publish")) {
        return Response.json(
          {
            region_id: "region-boulder",
            name: "Boulder Demo",
            status: "published",
            published_revision_id: "revision-1",
            bounds: { west: -105.211, south: 40.009, east: -105.179, north: 40.031 },
          },
          { status: 201 },
        );
      }
      return Response.json({ asset_id: `asset-${calls.length}` }, { status: 201 });
    };

    const result = await seedBoulderRegion({
      baseUrl: "http://127.0.0.1:8000/",
      powerLineGeoJson: powerLines,
      treeGeoJson: trees,
      fetchImpl,
      concurrency: 2,
    });

    assert.equal(result.region.region_id, "region-boulder");
    assert.equal(result.region.status, "published");
    assert.equal(result.assetCount, 3);
    assert.deepEqual(
      calls.map(({ path, method }) => [method, path]),
      [
        ["POST", "/api/v1/regions"],
        ["POST", "/api/v1/regions/region-boulder/assets"],
        ["POST", "/api/v1/regions/region-boulder/assets"],
        ["POST", "/api/v1/regions/region-boulder/assets"],
        ["POST", "/api/v1/regions/region-boulder/publish"],
      ],
    );
    assert.deepEqual(calls[0].body, {
      name: "Boulder Demo",
      bounds: { west: -105.211, south: 40.009, east: -105.179, north: 40.031 },
    });
  });

  it("does not publish a partially populated region", async () => {
    let assetCalls = 0;
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path === "/api/v1/regions") {
        return Response.json({ region_id: "region-boulder" }, { status: 201 });
      }
      if (path.endsWith("/assets")) {
        assetCalls += 1;
        if (assetCalls === 2) {
          return Response.json({ detail: "Asset could not be created." }, { status: 400 });
        }
        return Response.json({ asset_id: "asset-1" }, { status: 201 });
      }
      assert.fail(`Unexpected request to ${path} with ${init?.method}`);
    };

    await assert.rejects(
      () =>
        seedBoulderRegion({
          baseUrl: "http://127.0.0.1:8000",
          powerLineGeoJson: powerLines,
          treeGeoJson: trees,
          fetchImpl,
          concurrency: 1,
        }),
      /Asset could not be created/,
    );
  });
});
