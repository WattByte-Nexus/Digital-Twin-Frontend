import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WebMercatorViewport } from "@deck.gl/core";
import { PointCloudLayer } from "@deck.gl/layers";
import {
  createDigitalTwinPointCloudTraversalViewport,
  createDigitalTwinPointCloudLayer,
  DigitalTwinPointCloudTileLayer,
  GAUSSIAN_SURFEL_FRAGMENT_INJECTION,
  GaussianSurfelPointCloudLayer,
  MISSING_POINT_RGB_VERTEX_INJECTION,
  POINT_CLOUD_SURFEL_SIZING,
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

  it("keeps point coverage tied to survey spacing without moving geometry with the camera", (context) => {
    context.mock.method(PointCloudLayer.prototype, "getShaders", () => ({
      vs: "",
      fs: "",
      modules: [],
      inject: {},
    }));
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
    assert.equal(layer.props.loadOptions?.tileset?.maximumScreenSpaceError, 1);
    assert.equal(layer.props.loadOptions?.tileset?.maximumMemoryUsage, 512);
    assert.equal(layer.props.loadOptions?.tileset?.maxRequests, 8);
    assert.equal(layer.props.loadOptions?.tileset?.debounceTime, 100);
    assert.equal(layer.props.loadOptions?.tileset?.updateTransforms, false);
    assert.equal(
      layer.props.loadOptions?.tileset?.memoryAdjustedScreenSpaceError,
      false
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
    const shaders = new VisibleRgbPointCloudLayer({ id: "coverage-test", data: [] })
      .getShaders();
    assert.match(
      shaders.inject?.["vs:DECKGL_FILTER_SIZE"] ?? "",
      /1\.0 - exp/
    );
    assert.deepEqual(POINT_CLOUD_SURFEL_SIZING, {
      radiusToSpacingRatio: 0.75,
      softCapRadiusPixels: 2,
      closeRangeMaxRadiusPixels: 3,
    });
  });

  it("scales each hierarchy tile without letting previews become giant discs", (context) => {
    context.mock.method(PointCloudLayer.prototype, "getShaders", () => ({
      vs: "",
      fs: "",
      modules: [],
      inject: {},
    }));
    const nativeLeafRadiusMeters = 0.375;
    const pointLayer = (samplingSpacingMeters: number) =>
      new VisibleRgbPointCloudLayer(
        {
          id: `spacing-${samplingSpacingMeters}`,
          data: [],
          pointSize: nativeLeafRadiusMeters,
        },
        {
          tile: { extras: { samplingSpacingMeters } },
        } as never
      );

    assert.equal(pointLayer(2).props.pointSize, 1.5);
    assert.equal(pointLayer(4).props.pointSize, 3);
    assert.equal(pointLayer(0).props.pointSize, nativeLeafRadiusMeters);
    assert.match(
      pointLayer(2).getShaders().inject?.["vs:DECKGL_FILTER_SIZE"] ?? "",
      /softCapRadiusPixels = 2\.0/
    );
    assert.match(
      pointLayer(2).getShaders().inject?.["vs:DECKGL_FILTER_SIZE"] ?? "",
      /closeRangeMaxRadiusPixels = 3\.0/
    );
  });

  it("corrects LOD traversal without moving the interleaved render viewport", () => {
    const renderViewport = new WebMercatorViewport({
      id: "mapbox",
      width: 900,
      height: 896,
      longitude: -105.2705,
      latitude: 40.015,
      zoom: 14,
      pitch: 60,
      bearing: 0,
      position: [0, 0, 0],
    });
    const renderProjection = [...renderViewport.viewProjectionMatrix];

    const traversalViewport = createDigitalTwinPointCloudTraversalViewport(
      renderViewport,
      1_617.69
    );

    assert.notEqual(traversalViewport, renderViewport);
    assert.deepEqual(renderViewport.position, [0, 0, 0]);
    assert.deepEqual(renderViewport.viewProjectionMatrix, renderProjection);
    assert.deepEqual(traversalViewport.position, [0, 0, 1_617.69]);
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

  it("reports ready only after selected points are visible", () => {
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
    assert.equal(readyCount, 0);

    const onTraversalComplete =
      layer.props.loadOptions?.tileset?.onTraversalComplete;
    assert.equal(typeof onTraversalComplete, "function");
    const emptySelection: unknown[] = [];
    assert.equal(onTraversalComplete?.(emptySelection as never), emptySelection);
    assert.equal(readyCount, 0);

    const visibleSelection = [
      { contentAvailable: true, content: { pointCount: 1_000 } },
    ];
    assert.equal(
      onTraversalComplete?.(visibleSelection as never),
      visibleSelection
    );
    onTraversalComplete?.(visibleSelection as never);
    assert.equal(readyCount, 1);
  });

  it("exposes loaders.gl scene diagnostics at tile lifecycle boundaries", () => {
    const diagnostics: unknown[] = [];
    const counters = new Map([
      ["Tiles In Memory", 12],
      ["Points/Vertices", 842_000],
    ]);
    const tileset = {
      cartographicCenter: [-105.2705, 40.015, 1_617.69],
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
    assert.ok(layer instanceof DigitalTwinPointCloudTileLayer);
    assert.equal(layer.props.getTraversalElevationMeters?.(), 1_617.69);
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
