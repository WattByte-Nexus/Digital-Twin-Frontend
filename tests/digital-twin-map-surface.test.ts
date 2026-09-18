import assert from "node:assert/strict";
import test from "node:test";
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
import { createDigitalTwinMapSurfaceLayers } from "../apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-map-module";

const TREE = {
  kind: "tree" as const,
  assetId: "GOLDEN-TREE-001",
  regionId: "golden-co",
  location: { lat: 39.7557, lon: -105.2208 },
  species: "unclassified",
  heightM: 8,
  canopyRadiusM: 2.5,
  sourceRef: "wildfire-rec:single-lane:tree-0",
};

test("the product map module includes segmented trees on the shared surface", () => {
  const selected: unknown[] = [];
  const groups = createDigitalTwinMapSurfaceLayers({
    trees: [TREE],
    treeInteraction: {
      selectedTreeId: TREE.assetId,
      onSelect: (tree, screen) => selected.push({ tree, screen }),
    },
  });

  assert.equal(groups.length, 1);
  assert.equal(groups[0].id, "digital-twin-trees");
  assert.equal(groups[0].surface, DIGITAL_TWIN_SHARED_SURFACE);
  assert.deepEqual(
    groups[0].layers.map((layer) => layer.id),
    ["digital-twin-tree-trunks", "digital-twin-tree-crowns"]
  );
  for (const layer of groups[0].layers) {
    assert.equal(layer.props.pickable, true);
    assert.equal(layer.props.onClick?.({ object: TREE, x: 12, y: 34 } as never, {} as never), true);
    assert.equal(layer.props.onClick?.({ object: undefined } as never, {} as never), false);
  }
  assert.deepEqual(selected, [
    { tree: TREE, screen: [12, 34] },
    { tree: TREE, screen: [12, 34] },
  ]);
});

test("the product map module combines captured crowns with grounded tree trunks", () => {
  const survey = {
    ...TREE,
    sourceRef: "point-cloud:golden-lidar:sha256-a1:tree:1",
    segmentation: {
      bounds: [-105.221, 39.755, 1732, -105.22, 39.756, 1745] as [number, number, number, number, number, number],
      pointCount: 1000,
    },
  };
  const groups = createDigitalTwinMapSurfaceLayers({
    trees: [survey],
    treeSurfaceElevations: new Map([[digitalTwinSurfaceCoordinateKey(TREE.location.lon, TREE.location.lat), 1720]]),
    powerLineNetwork: undefined,
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

  assert.equal(groups.length, 2);
  assert.equal(groups[0].surface, DIGITAL_TWIN_SHARED_SURFACE);
  assert.deepEqual(groups[0].layers[1].props.data, []);
  assert.equal(groups[0].layers[0].props.getPolygon(survey)[0][2], 1720);
  assert.equal(groups[0].layers[0].props.getElevation(survey), 18.5);
  assert.equal(groups[1].layers[0].id, "digital-twin-point-cloud-golden-lidar");
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

  assert.deepEqual(composed.layers.map((layer) => layer.id), ["conductors", "point-cloud"]);
  assert.equal(composed.layers[0].props.data, conductors.props.data);
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

test("new capabilities share the map's render batch regardless of insertion order", () => {
  const first = new PathLayer({ id: "first", data: [] });
  const added = new PathLayer({ id: "added", data: [] });
  const group = (layer: PathLayer) => ({
    id: layer.id,
    surface: DIGITAL_TWIN_SHARED_SURFACE,
    layers: [layer],
  });
  for (const layers of [[first, added], [added, first]]) {
    const composed = composeDigitalTwinSurfaceLayers(layers.map(group), "labels");
    for (const layer of composed.layers) {
      assert.equal(Reflect.get(layer.props, "beforeId"), "labels");
    }
    const withoutLabels = composeDigitalTwinSurfaceLayers([
      { id: "recomposed", surface: DIGITAL_TWIN_SHARED_SURFACE, layers: composed.layers },
    ]);
    assert.ok(withoutLabels.layers.every((layer) => Reflect.get(layer.props, "beforeId") === undefined));
  }
});

test("ground-relative assets use zero ground when terrain is disabled", () => {
  const coordinate: [number, number] = [-105.2211, 39.7555];
  const elevations = sampleDigitalTwinSurfaceElevations({
    getTerrain: () => ({ exaggeration: 0 }),
    getSource: () => undefined,
    isSourceLoaded: () => { throw new Error("flat mode must not require DEM tiles"); },
    queryTerrainElevation: () => { throw new Error("flat mode must not query terrain"); },
  }, [coordinate], false);
  assert.equal(elevations?.get(digitalTwinSurfaceCoordinateKey(...coordinate)), 0);
});

test("terrain always owns the camera ground frame", () => {
  let centerElevation = 1_925.696;
  let centerClampedToGround = false;
  let terrain: { source: string; exaggeration: number } | null = null;
  const calls: string[] = [];
  const map = {
    getTerrain: () => terrain,
    getCenterClampedToGround: () => centerClampedToGround,
    setCenterClampedToGround: (value: boolean) => {
      calls.push("clamp");
      centerClampedToGround = value;
    },
    setTerrain: (value: { source: string; exaggeration: number } | null) => {
      calls.push("terrain");
      terrain = value;
      // Match MapLibre: a ground-clamped terrain change resolves the center
      // elevation from terrain instead of accepting a 3D tile origin.
      centerElevation = 1_642.25 * (value?.exaggeration ?? 0);
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
    enabled: true,
    exaggeration: 1,
  });
  assert.deepEqual(calls, ["clamp", "terrain"], "the active terrain must not be recreated");

  applyDigitalTwinSurfaceElevationState(map, {
    enabled: false,
    exaggeration: 1,
  });

  assert.deepEqual(terrain, { source: "digital-twin-terrain", exaggeration: 0 });
  assert.equal(centerClampedToGround, true);
  assert.equal(centerElevation, 0);
});

test("shared-surface samples match displayed terrain height and are complete", () => {
  const elevations = new Map([
    [digitalTwinSurfaceCoordinateKey(-105.2318, 39.7488), 3_544.82],
    [digitalTwinSurfaceCoordinateKey(-105.23065, 39.749), 3_553.828],
  ]);
  const map = {
    getTerrain: () => ({ exaggeration: 2 }),
    getSource: () => ({}),
    isSourceLoaded: () => true,
    queryTerrainElevation: ([longitude, latitude]: [number, number]) =>
      elevations.get(digitalTwinSurfaceCoordinateKey(longitude, latitude)) ??
      null,
  };

  assert.deepEqual(
    sampleDigitalTwinSurfaceElevations(map, [
      [-105.2318, 39.7488],
      [-105.23065, 39.749],
    ], true),
    new Map([
      [digitalTwinSurfaceCoordinateKey(-105.2318, 39.7488), 3_544.82],
      [digitalTwinSurfaceCoordinateKey(-105.23065, 39.749), 3_553.828],
    ])
  );
  assert.equal(
    sampleDigitalTwinSurfaceElevations(map, [
      [-105.2318, 39.7488],
      [-105.2295, 39.7492],
    ], true),
    null
  );
});

test("shared-surface sampling rejects provisional elevations before terrain tiles load", () => {
  const map = {
    getTerrain: () => ({ exaggeration: 1 }),
    getSource: () => ({}),
    isSourceLoaded: () => false,
    queryTerrainElevation: () => 0,
  };

  assert.equal(
    sampleDigitalTwinSurfaceElevations(map, [[-105.2211, 39.7555]], true),
    null
  );
});

test("terrain sampling waits for the source during style initialization", () => {
  assert.equal(sampleDigitalTwinSurfaceElevations({
    getTerrain: () => ({ exaggeration: 1 }),
    getSource: () => undefined,
    isSourceLoaded: () => { throw new Error("source is not mounted yet"); },
    queryTerrainElevation: () => { throw new Error("source is not mounted yet"); },
  }, [[-105.2211, 39.7555]], true), null);
});

test("terrain toggles never cache heights from the previous surface", () => {
  const coordinate: [number, number] = [-105.2211, 39.7555];
  let terrain: { exaggeration: number } | null = null;
  const map = {
    getTerrain: () => terrain,
    getSource: () => ({}),
    isSourceLoaded: () => true,
    queryTerrainElevation: () => 1_642.25,
  };
  assert.equal(sampleDigitalTwinSurfaceElevations(map, [coordinate], true), null);
  terrain = { exaggeration: 1 };
  assert.equal(
    sampleDigitalTwinSurfaceElevations(map, [coordinate], true)?.get(
      digitalTwinSurfaceCoordinateKey(...coordinate)
    ),
    1_642.25
  );
  assert.equal(sampleDigitalTwinSurfaceElevations(map, [coordinate], false), null);
  terrain = { exaggeration: 0 };
  assert.equal(
    sampleDigitalTwinSurfaceElevations(map, [coordinate], false)?.get(
      digitalTwinSurfaceCoordinateKey(...coordinate)
    ),
    0
  );
});
