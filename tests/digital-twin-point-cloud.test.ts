import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchActiveDigitalTwinPointCloud } from "../apps/geolibre-desktop/src/lib/digital-twin-point-cloud";

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status });
}

describe("Digital Twin point-cloud catalog", () => {
  it("returns the active ready dataset with a tileset URL resolved against the Engine", async () => {
    const requests: string[] = [];
    const fetchImpl = async (input: string | URL | Request) => {
      requests.push(String(input));
      return json({
        active_dataset_id: "golden-lidar",
        items: [
          {
            dataset_id: "golden-lidar",
            region_id: "golden",
            name: "Golden USGS 3DEP LiDAR",
            status: "ready",
            format: "3d-tiles-point-cloud",
            tileset_url:
              "/point-clouds/golden/golden-lidar/sha256-a1/tileset.json",
            bounds: [-105.25, 39.72, -105.16, 39.79],
            bounds_crs: "EPSG:4326",
            point_count: 167_621_127,
            source_point_count: 167_621_127,
            minimum_spacing_m: 0.5,
            attributes: ["position"],
            version: "sha256-a1",
            attribution: "U.S. Geological Survey 3DEP",
            updated_at: "2026-08-11T18:00:00Z",
            failure_code: null,
          },
        ],
      });
    };

    const result = await fetchActiveDigitalTwinPointCloud(
      "https://engine.example.com/",
      "golden",
      { fetchImpl: fetchImpl as typeof fetch },
    );

    assert.equal(result.status, "ready");
    if (result.status !== "ready") assert.fail("Expected a ready point cloud");
    assert.deepEqual(result.dataset, {
      datasetId: "golden-lidar",
      regionId: "golden",
      name: "Golden USGS 3DEP LiDAR",
      status: "ready",
      format: "3d-tiles-point-cloud",
      tilesetUrl:
        "https://engine.example.com/point-clouds/golden/golden-lidar/sha256-a1/tileset.json",
      bounds: [-105.25, 39.72, -105.16, 39.79],
      boundsCrs: "EPSG:4326",
      pointCount: 167_621_127,
      sourcePointCount: 167_621_127,
      minimumSpacingMeters: 0.5,
      attributes: ["position"],
      version: "sha256-a1",
      attribution: "U.S. Geological Survey 3DEP",
      updatedAt: "2026-08-11T18:00:00Z",
      failureCode: null,
    });
    assert.deepEqual(requests, [
      "https://engine.example.com/api/v1/regions/golden/point-cloud-datasets",
    ]);
  });

  it("reports a building dataset without attempting to resolve a tileset", async () => {
    const result = await fetchActiveDigitalTwinPointCloud(
      "http://127.0.0.1:8000",
      "boulder",
      {
        fetchImpl: (async () =>
          json({
            active_dataset_id: null,
            items: [
              {
                dataset_id: "boulder-lidar",
                region_id: "boulder",
                name: "Boulder LiDAR",
                status: "building",
                format: "3d-tiles-point-cloud",
                tileset_url: null,
                bounds: [-105.31, 39.95, -105.18, 40.09],
                bounds_crs: "EPSG:4326",
                point_count: null,
                source_point_count: null,
                minimum_spacing_m: null,
                attributes: ["position", "rgb"],
                version: "build-42",
                attribution: "U.S. Geological Survey 3DEP",
                updated_at: "2026-08-11T18:05:00Z",
                failure_code: null,
              },
            ],
          })) as typeof fetch,
      },
    );

    assert.deepEqual(result, {
      status: "building",
      dataset: {
        datasetId: "boulder-lidar",
        regionId: "boulder",
        name: "Boulder LiDAR",
        status: "building",
        format: "3d-tiles-point-cloud",
        tilesetUrl: null,
        bounds: [-105.31, 39.95, -105.18, 40.09],
        boundsCrs: "EPSG:4326",
        pointCount: null,
        sourcePointCount: null,
        minimumSpacingMeters: null,
        attributes: ["position", "rgb"],
        version: "build-42",
        attribution: "U.S. Geological Survey 3DEP",
        updatedAt: "2026-08-11T18:05:00Z",
        failureCode: null,
      },
    });
  });

  it("reports regions without a point-cloud dataset", async () => {
    const result = await fetchActiveDigitalTwinPointCloud(
      "http://127.0.0.1:8000",
      "front-range",
      {
        fetchImpl: (async () =>
          json({ active_dataset_id: null, items: [] })) as typeof fetch,
      },
    );

    assert.deepEqual(result, { status: "none" });
  });

  it("rejects an active descriptor belonging to another region", async () => {
    await assert.rejects(
      fetchActiveDigitalTwinPointCloud("http://127.0.0.1:8000", "golden", {
        fetchImpl: (async () =>
          json({
            active_dataset_id: "boulder-lidar",
            items: [
              {
                dataset_id: "boulder-lidar",
                region_id: "boulder",
                name: "Boulder LiDAR",
                status: "ready",
                format: "3d-tiles-point-cloud",
                tileset_url: "/point-clouds/boulder/tileset.json",
                bounds: [-105.31, 39.95, -105.18, 40.09],
                bounds_crs: "EPSG:4326",
                point_count: 10,
                source_point_count: 10,
                minimum_spacing_m: 0.5,
                attributes: ["position"],
                version: "build-42",
                attribution: "U.S. Geological Survey 3DEP",
                updated_at: "2026-08-11T18:05:00Z",
                failure_code: null,
              },
            ],
          })) as typeof fetch,
      }),
      /different region/,
    );
  });

  it("rejects non-HTTP tileset URLs from the Engine contract", async () => {
    await assert.rejects(
      fetchActiveDigitalTwinPointCloud("http://127.0.0.1:8000", "golden", {
        fetchImpl: (async () =>
          json({
            active_dataset_id: "golden-lidar",
            items: [
              {
                dataset_id: "golden-lidar",
                region_id: "golden",
                name: "Golden LiDAR",
                status: "ready",
                format: "3d-tiles-point-cloud",
                tileset_url: "data:application/json,{}",
                bounds: [-105.25, 39.72, -105.16, 39.79],
                bounds_crs: "EPSG:4326",
                point_count: 10,
                source_point_count: 10,
                minimum_spacing_m: 0.5,
                attributes: ["position"],
                version: "build-42",
                attribution: "U.S. Geological Survey 3DEP",
                updated_at: "2026-08-11T18:05:00Z",
                failure_code: null,
              },
            ],
          })) as typeof fetch,
      }),
      /invalid tileset_url/,
    );
  });
});
