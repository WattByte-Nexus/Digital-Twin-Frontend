import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LayerManager, WebMercatorViewport } from "@deck.gl/core";
import { PointCloudLayer } from "@deck.gl/layers";
import {
  createDigitalTwinPointCloudTraversalViewport,
  createDigitalTwinPointCloudLayer,
  DigitalTwinPointCloudTileLayer,
  MISSING_POINT_RGB_VERTEX_INJECTION,
  VisibleRgbPointCloudLayer,
} from "../apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-lidar";
import type { DigitalTwinReadyPointCloudDataset } from "../apps/geolibre-desktop/src/lib/digital-twin-point-cloud";
import { DEFAULT_DIGITAL_TWIN_MAP_DISPLAY_SETTINGS } from "../packages/ui/src/components/digital-twin-map-toolbar";
import { createDigitalTwinMapSurfaceLayers } from "../apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-map-module";

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
  it("shows tree models by default and lets the toolbar enable point clouds", () => {
    assert.equal(DEFAULT_DIGITAL_TWIN_MAP_DISPLAY_SETTINGS.pointClouds, false);
    assert.equal(DEFAULT_DIGITAL_TWIN_MAP_DISPLAY_SETTINGS.pointCloudView, "full");
    assert.equal(DEFAULT_DIGITAL_TWIN_MAP_DISPLAY_SETTINGS.assetTrees, true);
  });

  it("renders compact opaque points while LOD controls visible density", (context) => {
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

    assert.equal(layer.props.id, "digital-twin-point-cloud-golden-lidar-sha256-a1-full");
    assert.equal(layer.props.data, "https://cdn.example.com/golden/sha256-a1/full/tileset.json");
    assert.equal(layer.props.pointSize, 1);
    assert.equal(layer.props.opacity, 1);
    assert.equal(layer.props.pickable, false);
    assert.equal(layer.props.operation, "draw");
    assert.equal(layer.props.loadOptions?.tileset?.maximumScreenSpaceError, 8);
    assert.equal(layer.props.loadOptions?.tileset?.maximumMemoryUsage, 256);
    assert.equal(layer.props.loadOptions?.tileset?.maxRequests, 8);
    assert.equal(layer.props.loadOptions?.tileset?.debounceTime, 16);
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
    assert.equal(layer.props._subLayerProps?.pointcloud?.sizeUnits, "pixels");
    assert.equal(layer.props._subLayerProps?.pointcloud?.material, false);
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
    assert.equal(shaders.inject?.["vs:DECKGL_FILTER_SIZE"], undefined);
  });

  it("switches representations within the same authenticated immutable dataset", () => {
    const dataset = { ...DATASET, tilesetUrl: "https://engine.example.com/api/v1/point-clouds/golden/survey/version/tileset.json" };
    const full = createDigitalTwinPointCloudLayer(dataset, { view: "full", onError: () => {} });
    const crowns = createDigitalTwinPointCloudLayer(dataset, { view: "crowns", onError: () => {} });
    assert.equal(full.props.data, "https://engine.example.com/api/v1/point-clouds/golden/survey/version/full/tileset.json");
    assert.equal(crowns.props.data, dataset.tilesetUrl);
    assert.notEqual(full.id, crowns.id);
  });

  it("shows the full scan even when no tree crowns were detected", () => {
    const pointCloud = { dataset: { ...DATASET, pointCount: 0 }, onError: () => {} };
    const full = createDigitalTwinMapSurfaceLayers({ pointCloud: { ...pointCloud, view: "full" } });
    const crowns = createDigitalTwinMapSurfaceLayers({ pointCloud: { ...pointCloud, view: "crowns" } });
    assert.equal(full.length, 1);
    assert.match(String(full[0].layers[0].props.data), /full\/tileset\.json$/);
    assert.equal(crowns.length, 0);
  });

  it("releases retained parent tiles only after their point-cloud replacement draws", (context) => {
    const tile = { tileDrawn: false };
    context.mock.method(PointCloudLayer.prototype, "draw", () => {
      assert.equal(tile.tileDrawn, false);
    });
    const layer = new VisibleRgbPointCloudLayer({ id: "first-draw", data: [], tile });
    layer.state = {};
    layer.draw({ uniforms: {} });
    assert.equal(tile.tileDrawn, false);
    layer.state = { model: {} as never };
    layer.draw({ uniforms: {} });
    assert.equal(tile.tileDrawn, true);
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

  it("reports ready only after selected points are visible", (context) => {
    let readyCount = 0;
    const errors: Error[] = [];
    const layer = createDigitalTwinPointCloudLayer(DATASET, {
      onError: (error) => errors.push(error),
      onReady: () => {
        readyCount += 1;
      },
    });

    const manager = new LayerManager(null as never, {});
    context.mock.method(layer, "_loadTileset" as never, () => {});
    manager.setLayers([layer]);
    context.after(() => manager.finalize());

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

  it("exposes loaders.gl scene diagnostics at tile lifecycle boundaries", (context) => {
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

    const manager = new LayerManager(null as never, {});
    context.mock.method(layer, "_loadTileset" as never, () => {});
    manager.setLayers([layer]);
    layer.state.tileset3d = tileset as never;
    // Tile3DLayer installs the tileset in state before invoking this callback.
    layer.props.onTilesetLoad(tileset as never);
    layer.props.onTileLoad({} as never);
    layer.props.onTileUnload({} as never);

    assert.equal(diagnostics.length, 3);
    assert.ok(layer instanceof DigitalTwinPointCloudTileLayer);
    const viewport = new WebMercatorViewport({ id: "test", width: 100, height: 100 });
    layer.activateViewport(viewport);
    assert.deepEqual((layer.state.activeViewports as Record<string, WebMercatorViewport>).test.position, [0, 0, 1_617.69]);
    layer.state.tileset3d = null;
    manager.finalize();
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

  it("reads installed state during the real initial tileset-load callback", { timeout: 3_000 }, async (context) => {
    const tilesetJson = {
      asset: { version: "1.0" },
      geometricError: 0,
      root: {
        boundingVolume: { region: [-1.9, 0.6, -1.899999, 0.600001, 1_700, 1_700] },
        geometricError: 0,
        refine: "REPLACE",
        children: [],
      },
    };
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    context.mock.method(globalThis, "fetch", async (input) => {
      assert.equal(String(input), DATASET.tilesetUrl);
      const response = new Response(JSON.stringify(tilesetJson), {
        headers: { "Content-Type": "application/json" },
      });
      Object.defineProperty(response, "url", { value: String(input) });
      return response;
    });
    const layer = createDigitalTwinPointCloudLayer(DATASET, {
      view: "crowns",
      onError: reject,
      onDiagnostics: (snapshot) => {
        try {
          assert.ok(layer.state.tileset3d);
          assert.equal(snapshot.datasetId, DATASET.datasetId);
          assert.ok(Math.abs(layer.state.tileset3d.cartographicCenter![2] - 1_700) < 0.01);
          resolve();
        } catch (error) {
          reject(error);
        }
      },
    });
    const manager = new LayerManager(null as never, {});
    context.after(() => manager.finalize());
    manager.setLayers([layer]);
    await promise;
  });

  it("retains LOD state and dispatches captured callbacks to the current layer after catalog refreshes", async (context) => {
    const oldEvents: string[] = [];
    const currentEvents: string[] = [];
    let loads = 0;
    let destroyed = 0;
    const tileset = {
      cartographicCenter: [-105, 40, 1_700],
      stats: { get: () => ({ count: 42 }) },
      selectedTiles: [],
      tiles: [],
      gpuMemoryUsageInBytes: 1_024,
      memoryAdjustedScreenSpaceError: 8,
      isLoaded: () => false,
      destroy: () => { destroyed += 1; },
    };
    const first = createDigitalTwinPointCloudLayer(DATASET, {
      onError: () => oldEvents.push("error"),
      onReady: () => oldEvents.push("ready"),
      onDiagnostics: () => oldEvents.push("diagnostics"),
    });
    context.mock.method(first, "_loadTileset" as never, () => { loads += 1; });
    const manager = new LayerManager(null as never, {});
    context.after(() => manager.finalize());
    manager.setLayers([first]);
    first.state.tileset3d = tileset as never;
    first.props.onTilesetLoad(tileset as never);
    assert.deepEqual(oldEvents, ["diagnostics"]);

    // These are the callbacks retained by the original Tileset3D instance.
    const traversal = first.props.loadOptions!.tileset.onTraversalComplete;
    const tileError = first.props.onTileError;
    const tileLoaded = Reflect.get(first, "_onTileLoad").bind(first);
    const tileUnloaded = Reflect.get(first, "_onTileUnload").bind(first);
    const replacement = createDigitalTwinPointCloudLayer({ ...DATASET }, {
      onError: () => currentEvents.push("error"),
      onReady: () => currentEvents.push("ready"),
      onDiagnostics: () => currentEvents.push("diagnostics"),
    });
    context.mock.method(replacement, "_loadTileset" as never, () => { loads += 1; });
    manager.setLayers([replacement]);
    assert.equal(replacement.state, first.state);
    assert.equal(replacement.state.tileset3d, tileset);
    assert.equal(first.getCurrentLayer(), replacement);
    assert.equal(loads, 1, "unchanged immutable URL must not reload");

    const viewport = new WebMercatorViewport({ id: "map", width: 800, height: 600, zoom: 14 });
    const projection = [...viewport.viewProjectionMatrix];
    replacement.activateViewport(viewport);
    const traversalViewport = (replacement.state.activeViewports as Record<string, WebMercatorViewport>).map;
    assert.deepEqual(traversalViewport.position, [0, 0, 1_700]);
    assert.equal(replacement.internalState?.viewport, viewport);
    assert.deepEqual(viewport.viewProjectionMatrix, projection);

    tileError({} as never, "failed", "r0.pnts");
    first.props.onError?.(new Error("initial load failed"), first);
    const tile = { id: "r0", tileDrawn: true };
    tileLoaded(tile);
    tileUnloaded(tile);
    assert.equal(tile.tileDrawn, false, "native tile-draw handshake remains intact");
    assert.deepEqual(currentEvents, ["error", "error", "diagnostics", "diagnostics"]);
    traversal([{ contentAvailable: false, content: { pointCount: 100 } }]);
    assert.equal(currentEvents.includes("ready"), false);
    traversal([{ contentAvailable: true, content: { pointCount: 100 } }]);
    assert.equal(currentEvents.filter((event) => event === "ready").length, 1);

    // A second refresh happens before queued traversal diagnostics run.
    const refreshedEvents: string[] = [];
    const refreshed = createDigitalTwinPointCloudLayer(DATASET, {
      onError: () => refreshedEvents.push("error"),
      onReady: () => refreshedEvents.push("ready"),
      onDiagnostics: () => refreshedEvents.push("diagnostics"),
    });
    context.mock.method(refreshed, "_loadTileset" as never, () => { loads += 1; });
    // The test has no live tileset selector; clear the activated viewport before
    // allowing deck's next update to advance its real selection machinery.
    replacement.state.activeViewports = {};
    manager.setLayers([refreshed]);
    traversal([{ contentAvailable: true, content: { pointCount: 100 } }]);
    tileError({} as never, "late failure", "r1.pnts");
    await Promise.resolve();
    assert.deepEqual(refreshedEvents, ["diagnostics", "diagnostics", "diagnostics"]);
    assert.deepEqual(oldEvents, ["diagnostics"]);
    assert.equal(loads, 1);
    assert.equal(destroyed, 0);
  });

  for (const change of ["version", "view"] as const) {
    it(`disposes the old tileset and resets readiness when the ${change} changes`, async (context) => {
      let oldReady = 0;
      let newReady = 0;
      let errors = 0;
      let destroyed = 0;
      let loads = 0;
      const first = createDigitalTwinPointCloudLayer(DATASET, {
        onError: () => {},
        onReady: () => { oldReady += 1; },
      });
      context.mock.method(first, "_loadTileset" as never, () => { loads += 1; });
      const manager = new LayerManager(null as never, {});
      context.after(() => manager.finalize());
      manager.setLayers([first]);
      first.state.tileset3d = {
        cartographicCenter: [-105, 40, 1_700],
        selectedTiles: [],
      tiles: [],
        destroy: () => { destroyed += 1; },
      } as never;
      const selection = [{ contentAvailable: true, content: { pointCount: 100 } }];
      const oldTraversal = first.props.loadOptions!.tileset.onTraversalComplete;
      oldTraversal(selection);
      assert.equal(oldReady, 1);
      const next = createDigitalTwinPointCloudLayer(
        change === "version"
          ? { ...DATASET, version: "sha256-b2", tilesetUrl: DATASET.tilesetUrl.replace("sha256-a1", "sha256-b2") }
          : DATASET,
        {
          view: change === "view" ? "crowns" : "full",
          onError: () => { errors += 1; },
          onReady: () => { newReady += 1; },
        }
      );
      context.mock.method(next, "_loadTileset" as never, () => { loads += 1; });
      manager.setLayers([next]);
      assert.notEqual(first.id, next.id);
      assert.notEqual(first.state, next.state);
      assert.equal(next.state.tileset3d, null);
      assert.equal(next.state.visiblePointsReported, false);
      assert.equal(destroyed, 1);
      assert.equal(loads, 2);
      next.props.onTileError({} as never, "failed", "r0.pnts");
      assert.equal(errors, 1);
      const nextTraversal = next.props.loadOptions!.tileset.onTraversalComplete;
      nextTraversal(selection);
      nextTraversal(selection);
      oldTraversal(selection);
      await Promise.resolve();
      assert.equal(newReady, 1);
      assert.equal(oldReady, 1);
      assert.equal(first.getCurrentLayer(), null);
    });
  }

});
