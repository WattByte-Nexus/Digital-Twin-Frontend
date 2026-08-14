import assert from "node:assert/strict";
import test from "node:test";
import { MapView } from "@deck.gl/core";
import { PathLayer } from "@deck.gl/layers";
import {
  composeDigitalTwinSurfaceLayers,
  DIGITAL_TWIN_SHARED_SURFACE,
} from "../packages/map/src/digital-twin-surface-layers";
import {
  applyDigitalTwinSurfaceElevationState,
  digitalTwinSurfaceCoordinateKey,
  sampleDigitalTwinSurfaceElevations,
} from "../packages/map/src/digital-twin-surface-state";
import {
  createDigitalTwinSurfaceMapView,
  resolveDigitalTwinSurfaceViewElevation,
} from "../packages/map/src/digital-twin-surface-view";
import { createDigitalTwinMapSurfaceLayers } from "../apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-map-module";

test("the product map module places point clouds on the shared surface", () => {
  const groups = createDigitalTwinMapSurfaceLayers({
    powerLines: [],
    pointCloud: {
      dataset: {
        datasetId: "golden-lidar",
        regionId: "golden",
        name: "Golden LiDAR",
        status: "ready",
        format: "3d-tiles-point-cloud",
        tilesetUrl: "https://cdn.example.com/golden/tileset.json",
        bounds: [-105.25, 39.72, -105.16, 39.79],
        boundsCrs: "EPSG:4326",
        pointCount: 1_000,
        sourcePointCount: 1_000,
        minimumSpacingMeters: 0.5,
        attributes: ["position", "rgb"],
        version: "sha256-a1",
        attribution: "USGS",
        updatedAt: "2026-08-11T18:00:00Z",
        failureCode: null,
      },
      onError: () => {},
    },
  });

  assert.equal(groups.length, 1);
  assert.equal(groups[0].surface, DIGITAL_TWIN_SHARED_SURFACE);
  assert.equal(groups[0].layers[0].id, "digital-twin-point-cloud-golden-lidar");
});

test("surface layer composition preserves one declared world frame", () => {
  const conductors = new PathLayer({ id: "conductors", data: [] });
  const pointCloud = new PathLayer({ id: "point-cloud", data: [] });

  const composed = composeDigitalTwinSurfaceLayers([
    {
      id: "utility-network",
      surface: DIGITAL_TWIN_SHARED_SURFACE,
      layers: [conductors],
    },
    {
      id: "survey-point-cloud",
      surface: DIGITAL_TWIN_SHARED_SURFACE,
      layers: [pointCloud],
    },
  ]);

  assert.deepEqual(composed, { layers: [conductors, pointCloud] });
});

test("surface layer composition rejects mixed coordinate frames", () => {
  const pointCloud = new PathLayer({ id: "point-cloud", data: [] });

  assert.throws(
    () =>
      composeDigitalTwinSurfaceLayers([
        {
          id: "survey-point-cloud",
          surface: {
            ...DIGITAL_TWIN_SHARED_SURFACE,
            verticalReference: "unknown",
          } as typeof DIGITAL_TWIN_SHARED_SURFACE,
          layers: [pointCloud],
        },
      ]),
    /shared surface/
  );
});

test("terrain always owns the camera ground frame", () => {
  let centerElevation = 1_925.696;
  let centerClampedToGround = false;
  let terrain: unknown = null;
  const calls: string[] = [];
  const map = {
    getCenterClampedToGround: () => centerClampedToGround,
    setCenterClampedToGround: (value: boolean) => {
      calls.push("clamp");
      centerClampedToGround = value;
    },
    setTerrain: (value: unknown) => {
      calls.push("terrain");
      terrain = value;
      // Match MapLibre: a ground-clamped terrain change resolves the center
      // elevation from terrain instead of accepting a 3D tile origin.
      centerElevation = value ? 1_642.25 : 0;
    },
  };

  applyDigitalTwinSurfaceElevationState(map, {
    enabled: true,
    exaggeration: 1,
  });
  assert.deepEqual(calls, ["clamp", "terrain"]);
  assert.deepEqual(terrain, {
    source: "digital-twin-terrain",
    exaggeration: 1,
  });
  assert.equal(centerClampedToGround, true);
  assert.equal(centerElevation, 1_642.25);

  applyDigitalTwinSurfaceElevationState(map, {
    enabled: false,
    exaggeration: 1,
  });

  assert.equal(terrain, null);
  assert.equal(centerClampedToGround, true);
  assert.equal(centerElevation, 0);
});

test("shared-surface samples are unexaggerated and complete", () => {
  const elevations = new Map([
    [digitalTwinSurfaceCoordinateKey(-105.2318, 39.7488), 3_544.82],
    [digitalTwinSurfaceCoordinateKey(-105.23065, 39.749), 3_553.828],
  ]);
  const map = {
    getTerrain: () => ({ exaggeration: 2 }),
    queryTerrainElevation: ([longitude, latitude]: [number, number]) =>
      elevations.get(digitalTwinSurfaceCoordinateKey(longitude, latitude)) ??
      null,
  };

  assert.deepEqual(
    sampleDigitalTwinSurfaceElevations(map, [
      [-105.2318, 39.7488],
      [-105.23065, 39.749],
    ]),
    new Map([
      [digitalTwinSurfaceCoordinateKey(-105.2318, 39.7488), 1_772.41],
      [digitalTwinSurfaceCoordinateKey(-105.23065, 39.749), 1_776.914],
    ])
  );
  assert.equal(
    sampleDigitalTwinSurfaceElevations(map, [
      [-105.2318, 39.7488],
      [-105.2295, 39.7492],
    ]),
    null
  );
});

test("deck traversal uses terrain elevation and falls back to the dataset", () => {
  let mapElevation = 0;
  const elevationSource = {
    getMapCenterElevation: () => mapElevation,
    getSurfaceReferenceElevation: () => 1_617.69,
  };

  assert.equal(resolveDigitalTwinSurfaceViewElevation(elevationSource), 1_617.69);

  const view = createDigitalTwinSurfaceMapView(elevationSource);
  const baseViewState = {
    longitude: -105.2705,
    latitude: 40.015,
    zoom: 21.5,
    pitch: 60,
  };
  assert.deepEqual(view.filterViewState(baseViewState).position, [
    0,
    0,
    1_617.69,
  ]);

  mapElevation = 1_642.25;
  const terrainViewState = view.filterViewState(baseViewState);
  assert.equal(terrainViewState.zoom, 21.5);
  assert.deepEqual(terrainViewState.position, [0, 0, 1_642.25]);
});

test("the corrected deck camera approaches elevated point-cloud leaves", () => {
  const viewState = {
    longitude: -105.2705,
    latitude: 40.015,
    zoom: 21.5,
    pitch: 60,
    bearing: 0,
  };
  const dataPosition = [-105.2705, 40.015, 1_617.69];
  const seaLevelViewport = new MapView({ id: "mapbox" }).makeViewport({
    width: 900,
    height: 896,
    viewState,
  });
  const surfaceViewport = createDigitalTwinSurfaceMapView({
    getMapCenterElevation: () => 0,
    getSurfaceReferenceElevation: () => 1_617.69,
  }).makeViewport({ width: 900, height: 896, viewState });

  assert.ok(seaLevelViewport);
  assert.ok(surfaceViewport);
  const seaLevelPoint = seaLevelViewport.projectPosition(dataPosition);
  const surfacePoint = surfaceViewport.projectPosition(dataPosition);
  const distance = (camera: number[], point: number[]) =>
    Math.hypot(...camera.map((value, index) => value - point[index]));

  const incorrectDistance = distance(
    seaLevelViewport.cameraPosition,
    seaLevelPoint
  );
  const correctedDistance = distance(
    surfaceViewport.cameraPosition,
    surfacePoint
  );
  assert.ok(correctedDistance * 50 < incorrectDistance);
});
