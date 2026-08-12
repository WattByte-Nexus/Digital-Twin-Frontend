import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADAPTIVE_SURFEL_VERTEX_INJECTION,
  createDigitalTwinPointCloudLayer,
  GAUSSIAN_SURFEL_FRAGMENT_INJECTION,
  GaussianSurfelPointCloudLayer,
  MISSING_POINT_RGB_VERTEX_INJECTION,
  POINT_CLOUD_TILESET_LOAD_OPTIONS,
  VisibleRgbPointCloudLayer,
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
  pointCount: 167_621_127,
  sourcePointCount: 167_621_127,
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

  it("streams the full-resolution RGB dataset within the interactive scene budget", () => {
    const layer = createDigitalTwinPointCloudLayer(DATASET, {
      beforeId: "digital-twin-reference-road-labels",
      onError: () => {},
      onReady: () => {},
    });

    assert.equal(layer.props.id, "digital-twin-point-cloud-golden-lidar");
    assert.equal(layer.props.data, DATASET.tilesetUrl);
    assert.equal(layer.props.pointSize, 0.375);
    assert.equal(layer.props.pickable, false);
    assert.equal(layer.props.operation, "draw");
    assert.equal(layer.props.loadOptions, POINT_CLOUD_TILESET_LOAD_OPTIONS);
    assert.equal(layer.props.loadOptions?.tileset?.maximumScreenSpaceError, 2);
    assert.equal(layer.props.loadOptions?.tileset?.maximumMemoryUsage, 512);
    assert.equal(layer.props.loadOptions?.tileset?.maxRequests, 12);
    assert.equal(layer.props.loadOptions?.tileset?.debounceTime, 100);
    assert.equal(layer.props.loadOptions?.tileset?.updateTransforms, false);
    assert.equal(
      layer.props.loadOptions?.tileset?.memoryAdjustedScreenSpaceError,
      true
    );
    assert.equal(layer.props.loadOptions?.tileset?.throttleRequests, true);
    assert.equal(
      layer.props._subLayerProps?.pointcloud?.type,
      VisibleRgbPointCloudLayer
    );
    assert.equal(layer.props._subLayerProps?.pointcloud?.sizeUnits, "meters");
    assert.equal(layer.props.beforeId, "digital-twin-reference-road-labels");
    assert.match(
      MISSING_POINT_RGB_VERTEX_INJECTION,
      /color\.r \+ color\.g \+ color\.b/
    );
    assert.match(
      MISSING_POINT_RGB_VERTEX_INJECTION,
      /vec4\(0\.22, 0\.74, 0\.97, 0\.90\)/
    );
    assert.match(ADAPTIVE_SURFEL_VERTEX_INJECTION, /clamp\(/);
    assert.match(ADAPTIVE_SURFEL_VERTEX_INJECTION, /2\.0/);
    assert.match(ADAPTIVE_SURFEL_VERTEX_INJECTION, /10\.0/);
  });

  it("enables Gaussian surfels only when the quality mode is requested", () => {
    const layer = createDigitalTwinPointCloudLayer(DATASET, {
      onError: () => {},
      renderMode: "gaussian",
    });

    assert.equal(
      layer.props._subLayerProps?.pointcloud?.type,
      GaussianSurfelPointCloudLayer
    );
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

  it("reports the root tileset elevation for the shared terrain camera", () => {
    const elevations: number[] = [];
    const layer = createDigitalTwinPointCloudLayer(DATASET, {
      onError: () => {},
      onCameraTargetElevation: (elevationMeters) => {
        elevations.push(elevationMeters);
      },
    });

    layer.props.onTileLoad({
      content: { cartographicOrigin: [-105.201, 39.744, 1_925.696] },
    } as never);
    layer.props.onTileLoad({
      parent: {},
      content: { cartographicOrigin: [-105.2, 39.745, 2_100] },
    } as never);
    layer.props.onTileLoad({
      content: { cartographicOrigin: [-105.201, 39.744, 1_925.696] },
    } as never);

    assert.deepEqual(elevations, [1_925.696]);
  });

  it("exposes loaders.gl scene diagnostics at tile lifecycle boundaries", () => {
    const diagnostics: unknown[] = [];
    const counters = new Map([
      ["Tiles In Memory", 12],
      ["Points/Vertices", 842_000],
    ]);
    const tileset = {
      stats: {
        get: (name: string) => ({ count: counters.get(name) ?? 0 }),
      },
      gpuMemoryUsageInBytes: 96 * 1024 * 1024,
      memoryAdjustedScreenSpaceError: 5.25,
      selectedTiles: [{}, {}, {}],
      isLoaded: () => false,
    };
    const layer = createDigitalTwinPointCloudLayer(DATASET, {
      onError: () => {},
      onDiagnostics: (snapshot) => diagnostics.push(snapshot),
    });

    layer.props.onTilesetLoad(tileset as never);
    layer.props.onTileLoad({} as never);
    layer.props.onTileUnload({} as never);

    assert.equal(diagnostics.length, 3);
    assert.deepEqual(diagnostics.at(-1), {
      datasetId: "golden-lidar",
      residentTileCount: 12,
      selectedTileCount: 3,
      visiblePointCount: 842_000,
      gpuMemoryUsageBytes: 96 * 1024 * 1024,
      screenSpaceError: 5.25,
      settled: false,
    });
  });
});
