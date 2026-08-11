import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createDigitalTwinPointCloudLayer,
  DIGITAL_TWIN_LIDAR_OVERLAY_PROPS,
  GAUSSIAN_SURFEL_FRAGMENT_INJECTION,
  GAUSSIAN_SURFEL_VERTEX_INJECTION,
  GaussianSurfelPointCloudLayer,
  POINT_CLOUD_TILESET_LOAD_OPTIONS,
} from "../apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-lidar";
import type { DigitalTwinReadyPointCloudDataset } from "../apps/geolibre-desktop/src/lib/digital-twin-point-cloud";
import { DEFAULT_DIGITAL_TWIN_MAP_DISPLAY_SETTINGS } from "../packages/ui/src/components/digital-twin-map-toolbar";

const DATASET: DigitalTwinReadyPointCloudDataset = {
  datasetId: "golden-lidar",
  regionId: "golden",
  name: "Golden USGS 3DEP LiDAR",
  status: "ready",
  format: "3d-tiles-point-cloud",
  tilesetUrl: "https://cdn.example.com/golden/sha256-a1/tileset.json",
  bounds: [-105.25, 39.72, -105.16, 39.79],
  boundsCrs: "EPSG:4326",
  pointCount: 125_000_000,
  sourcePointCount: 167_621_255,
  minimumSpacingMeters: 0.5,
  attributes: ["position", "rgb"],
  version: "sha256-a1",
  attribution: "U.S. Geological Survey 3DEP",
  updatedAt: "2026-08-11T18:00:00Z",
  failureCode: null,
};

describe("Digital Twin LiDAR fusion layer", () => {
  it("shows point clouds by default so the toolbar can explicitly disable them", () => {
    assert.equal(DEFAULT_DIGITAL_TWIN_MAP_DISPLAY_SETTINGS.pointClouds, true);
  });

  it("streams an Engine dataset with high-detail LOD and bounded memory", () => {
    const layer = createDigitalTwinPointCloudLayer(DATASET, {
      onError: () => {},
      onReady: () => {},
    });

    assert.equal(DIGITAL_TWIN_LIDAR_OVERLAY_PROPS.interleaved, true);
    assert.equal(layer.props.id, "digital-twin-point-cloud-golden-lidar");
    assert.equal(layer.props.data, DATASET.tilesetUrl);
    assert.equal(layer.props.pointSize, 0.75);
    assert.equal(layer.props.pickable, false);
    assert.equal(layer.props.operation, "draw");
    assert.equal(layer.props.loadOptions, POINT_CLOUD_TILESET_LOAD_OPTIONS);
    assert.equal(
      layer.props.loadOptions?.tileset?.maximumScreenSpaceError,
      1,
    );
    assert.equal(layer.props.loadOptions?.tileset?.maximumMemoryUsage, 512);
    assert.equal(layer.props.loadOptions?.tileset?.memoryAdjustedScreenSpaceError, true);
    assert.equal(layer.props.loadOptions?.tileset?.throttleRequests, true);
    assert.equal(layer.props.loadOptions?.core?.worker, false);
    assert.equal(
      layer.props._subLayerProps?.pointcloud?.type,
      GaussianSurfelPointCloudLayer,
    );
    assert.equal(layer.props._subLayerProps?.pointcloud?.sizeUnits, "meters");
    assert.match(GAUSSIAN_SURFEL_VERTEX_INJECTION, /clamp\(/);
    assert.match(GAUSSIAN_SURFEL_VERTEX_INJECTION, /1\.5/);
    assert.match(GAUSSIAN_SURFEL_VERTEX_INJECTION, /18\.0/);
    assert.match(GAUSSIAN_SURFEL_FRAGMENT_INJECTION, /exp\(/);
    assert.match(GAUSSIAN_SURFEL_FRAGMENT_INJECTION, /geometry\.uv/);
  });

  it("reports ready after the first spatial tile and reports pre-ready failures", () => {
    let readyCount = 0;
    const errors: Error[] = [];
    const layer = createDigitalTwinPointCloudLayer(DATASET, {
      onError: (error) => errors.push(error),
      onReady: () => {
        readyCount += 1;
      },
    });

    layer.props.onTileError({} as never, "request failed", "/points/r0.pnts");
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /Golden USGS 3DEP LiDAR/);
    assert.match(errors[0].message, /request failed/);
    assert.match(errors[0].message, /r0\.pnts/);

    layer.props.onTileLoad({} as never);
    layer.props.onTileLoad({} as never);
    assert.equal(readyCount, 1);
  });
});
