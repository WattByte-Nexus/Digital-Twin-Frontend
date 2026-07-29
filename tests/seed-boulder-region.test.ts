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
  it("retains the bundled feeder-aligned vegetation fixture", async () => {
    const [bundledPowerLines, bundledTrees] = await Promise.all(
      [
        "../apps/geolibre-desktop/public/plugins/digital-twin-demo/assets/boulder_13_8kv_feeder_large.geojson",
        "../apps/geolibre-desktop/public/plugins/digital-twin-demo/assets/boulder_13_8kv_feeder_large.geojson",
      ].map(async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"))),
    );

    const candidates = assetCandidates(bundledPowerLines, bundledTrees);
    assert.equal(candidates.filter((candidate) => candidate.kind === "power_line").length, 327);
    const treeCandidates = candidates.filter((candidate) => candidate.kind === "tree");
    assert.equal(treeCandidates.length, 1297);
    assert.equal(candidates.length, 1624);
    assert.ok(treeCandidates.every((candidate) => candidate.species));
    assert.ok(treeCandidates.every((candidate) => candidate.height_m > 0));
    const feederBounds = boundsForGeoJson([bundledPowerLines]);
    for (const candidate of candidates) {
      const coordinates =
        candidate.kind === "tree" ? [candidate.location] : candidate.coordinates;
      for (const coordinate of coordinates) {
        assert.ok(coordinate.lon >= feederBounds.west);
        assert.ok(coordinate.lon <= feederBounds.east);
        assert.ok(coordinate.lat >= feederBounds.south);
        assert.ok(coordinate.lat <= feederBounds.north);
      }
    }
  });

  it("uses span features from a mixed synthetic feeder without duplicating its full route", () => {
    const mixedPowerLines = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { asset_type: "power_line_route", name: "Full route" },
          geometry: {
            type: "LineString",
            coordinates: [
              [-105.21, 40.01],
              [-105.2, 40.02],
              [-105.19, 40.03],
            ],
          },
        },
        {
          type: "Feature",
          properties: { asset_type: "power_line_span", name: "Span 1" },
          geometry: {
            type: "LineString",
            coordinates: [
              [-105.21, 40.01],
              [-105.2, 40.02],
            ],
          },
        },
        {
          type: "Feature",
          properties: { asset_type: "power_pole" },
          geometry: { type: "Point", coordinates: [-105.21, 40.01] },
        },
      ],
    };

    assert.deepEqual(assetCandidates(mixedPowerLines, { type: "FeatureCollection", features: [] }), [
      {
        kind: "power_line",
        coordinates: [
          { lon: -105.21, lat: 40.01 },
          { lon: -105.2, lat: 40.02 },
        ],
        name: "Span 1",
      },
    ]);
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
        canopy_radius_m: 2.86,
      },
      {
        kind: "tree",
        location: { lon: -105.19, lat: 40.025 },
        height_m: 9.12,
        canopy_radius_m: 2.86,
      },
    ]);
  });

  it("loads the complete public inventory by default and excludes lake-site trees", async () => {
    const feeder = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { asset_type: "power_line_span", name: "Span 1" },
          geometry: {
            type: "LineString",
            coordinates: [
              [-105.21, 40.01],
              [-105.2, 40.02],
            ],
          },
        },
        {
          type: "Feature",
          properties: {
            asset_type: "vegetation_hazard",
            species: "Ponderosa pine",
            height_m: 8.5,
            canopy_radius_m: 2.4,
          },
          geometry: { type: "Point", coordinates: [-105.205, 40.015] },
        },
      ],
    };
    const calls: Array<{ path: string; body: unknown }> = [];
    const inventoryOffsets: string[] = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.hostname === "gis.bouldercolorado.gov") {
        const offset = url.searchParams.get("resultOffset") ?? "";
        inventoryOffsets.push(offset);
        const firstPage = offset === "0";
        return Response.json({
          type: "FeatureCollection",
          features: firstPage
            ? [
                {
                  type: "Feature",
                  properties: {
                    OBJECTID: 101,
                    FACILITYID: "TREE101",
                    COMMONNAME: "Ash, Green",
                    PROPNAME: "East Boulder Community Park",
                  },
                  geometry: { type: "Point", coordinates: [-105.2, 40.02] },
                },
                {
                  type: "Feature",
                  properties: {
                    OBJECTID: 102,
                    FACILITYID: "TREE102",
                    COMMONNAME: "Willow, Peachleaf",
                    PROPNAME: "Coot Lake",
                  },
                  geometry: { type: "Point", coordinates: [-105.21, 40.085] },
                },
              ]
            : [
                {
                  type: "Feature",
                  properties: {
                    OBJECTID: 103,
                    FACILITYID: "TREE103",
                    COMMONNAME: "Pine, Ponderosa",
                    PROPNAME: null,
                  },
                  geometry: { type: "Point", coordinates: [-105.19, 40.025] },
                },
              ],
          exceededTransferLimit: firstPage,
        });
      }

      assert.equal(url.origin, "http://127.0.0.1:8000");
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ path: url.pathname, body });
      if (url.pathname === "/api/v1/regions") {
        return Response.json({ region_id: "region-boulder" }, { status: 201 });
      }
      if (url.pathname.endsWith("/publish")) {
        return Response.json(
          { region_id: "region-boulder", status: "published" },
          { status: 201 },
        );
      }
      return Response.json([{ asset_id: "asset-1" }], { status: 201 });
    };

    const result = await seedBoulderRegion({
      powerLineGeoJson: feeder,
      fetchImpl,
      concurrency: 1,
    });

    assert.equal(result.assetCount, 3);
    assert.deepEqual(inventoryOffsets, ["0", "2000"]);
    assert.deepEqual(calls[0].body, {
      name: "Boulder Demo",
      bounds: {
        west: -105.211,
        south: 40.009,
        east: -105.189,
        north: 40.026,
      },
    });
    const uploaded = calls[1].body as Array<Record<string, unknown>>;
    assert.equal(uploaded.length, 3);
    assert.deepEqual(
      uploaded.filter((candidate) => candidate.kind === "tree"),
      [
        {
          kind: "tree",
          location: { lon: -105.2, lat: 40.02 },
          species: "Ash, Green",
          height_m: 9.12,
          canopy_radius_m: 2.86,
          source_ref: "TREE101",
        },
        {
          kind: "tree",
          location: { lon: -105.19, lat: 40.025 },
          species: "Pine, Ponderosa",
          height_m: 9.12,
          canopy_radius_m: 2.86,
          source_ref: "TREE103",
        },
      ],
    );
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
            bounds: boundsForGeoJson([powerLines, trees]),
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
        ["POST", "/api/v1/regions/region-boulder/assets:batch"],
        ["POST", "/api/v1/regions/region-boulder/publish"],
      ],
    );
    assert.equal((calls[1].body as unknown[]).length, 3);
    assert.deepEqual(calls[0].body, {
      name: "Boulder Demo",
      bounds: boundsForGeoJson([powerLines, trees]),
    });
  });

  it("does not publish a partially populated region", async () => {
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path === "/api/v1/regions") {
        return Response.json({ region_id: "region-boulder" }, { status: 201 });
      }
      if (path.endsWith("/assets:batch")) {
        return Response.json(
          { detail: "Asset batch could not be created." },
          { status: 400 },
        );
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
      /Asset batch could not be created/,
    );
  });
});
