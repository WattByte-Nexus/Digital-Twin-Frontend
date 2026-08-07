import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSatelliteTerrainStyle,
  SATELLITE_FALLBACK_LAYER_ID,
  SATELLITE_FALLBACK_SOURCE_ID,
  SATELLITE_LAYER_ID,
  SATELLITE_SOURCE_ID,
  setElevationEnabled,
  setSatelliteVisibility,
  setTerrainGroundVisibility,
  TERRAIN_BACKGROUND_LAYER_ID,
  TERRAIN_GROUND_LAYER_ID,
  TERRAIN_SOURCE_ID,
} from "../packages/map/src/satellite-terrain-style";
import {
  DEFAULT_SATELLITE_REFERENCE_VISIBILITY,
  SATELLITE_REFERENCE_SOURCE_ID,
  setSatelliteReferenceVisibility,
} from "../packages/map/src/satellite-reference-overlay";

test("satellite terrain style orders imagery, terrain, and reference details", () => {
  const style = buildSatelliteTerrainStyle({
    satelliteFallbackSource: {
      tiles: ["https://fallback.example/{z}/{x}/{y}.jpg"],
      tileSize: 256,
      maxzoom: 16,
    },
    satelliteSource: {
      tiles: ["https://imagery.example/{z}/{x}/{y}.jpg"],
      tileSize: 256,
      bounds: [-106, 39, -104, 41],
      maxzoom: 18,
    },
    referenceOverlay: {
      source: {
        type: "vector",
        tiles: ["https://reference.example/{z}/{x}/{y}.pbf"],
      },
      glyphs: "https://reference.example/fonts/{fontstack}/{range}.pbf",
      layers: [
        {
          category: "roads",
          layer: {
            id: "digital-twin-reference-roads",
            type: "line",
            source: SATELLITE_REFERENCE_SOURCE_ID,
            "source-layer": "transportation",
          },
        },
      ],
    },
    referenceOverlayVisibility: {
      ...DEFAULT_SATELLITE_REFERENCE_VISIBILITY,
      roads: false,
    },
    terrainSource: {
      tiles: ["https://terrain.example/{z}/{x}/{y}.png"],
      tileSize: 256,
      encoding: "terrarium",
      maxzoom: 14,
    },
    terrainExaggeration: 1.25,
  });

  assert.deepEqual(Object.keys(style.sources), [
    SATELLITE_FALLBACK_SOURCE_ID,
    SATELLITE_SOURCE_ID,
    TERRAIN_SOURCE_ID,
    SATELLITE_REFERENCE_SOURCE_ID,
  ]);
  assert.deepEqual(style.sources[SATELLITE_FALLBACK_SOURCE_ID], {
    type: "raster",
    tiles: ["https://fallback.example/{z}/{x}/{y}.jpg"],
    tileSize: 256,
    maxzoom: 16,
  });
  assert.deepEqual(style.sources[SATELLITE_SOURCE_ID], {
    type: "raster",
    tiles: ["https://imagery.example/{z}/{x}/{y}.jpg"],
    tileSize: 256,
    bounds: [-106, 39, -104, 41],
    maxzoom: 18,
  });
  assert.deepEqual(style.sources[TERRAIN_SOURCE_ID], {
    type: "raster-dem",
    tiles: ["https://terrain.example/{z}/{x}/{y}.png"],
    tileSize: 256,
    encoding: "terrarium",
    maxzoom: 14,
  });
  assert.deepEqual(style.sources[SATELLITE_REFERENCE_SOURCE_ID], {
    type: "vector",
    tiles: ["https://reference.example/{z}/{x}/{y}.pbf"],
  });
  assert.deepEqual(style.layers, [
    {
      id: TERRAIN_BACKGROUND_LAYER_ID,
      type: "background",
      paint: { "background-color": "#dfe3dc" },
    },
    {
      id: SATELLITE_FALLBACK_LAYER_ID,
      type: "raster",
      source: SATELLITE_FALLBACK_SOURCE_ID,
    },
    {
      id: SATELLITE_LAYER_ID,
      type: "raster",
      source: SATELLITE_SOURCE_ID,
    },
    {
      id: TERRAIN_GROUND_LAYER_ID,
      type: "hillshade",
      source: TERRAIN_SOURCE_ID,
      layout: { visibility: "none" },
      paint: {
        "hillshade-exaggeration": 0.45,
        "hillshade-shadow-color": "#667064",
        "hillshade-highlight-color": "#f8faf6",
        "hillshade-accent-color": "#929b8f",
      },
    },
    {
      id: "digital-twin-reference-roads",
      type: "line",
      source: SATELLITE_REFERENCE_SOURCE_ID,
      "source-layer": "transportation",
      layout: { visibility: "none" },
    },
  ]);
  assert.equal(
    style.glyphs,
    "https://reference.example/fonts/{fontstack}/{range}.pbf"
  );
  assert.deepEqual(style.terrain, {
    source: TERRAIN_SOURCE_ID,
    exaggeration: 1.25,
  });
});

test("satellite terrain style renders an atmospheric sky above the horizon", () => {
  const style = buildSatelliteTerrainStyle({
    satelliteSource: {
      tiles: ["https://imagery.example/{z}/{x}/{y}.jpg"],
      tileSize: 256,
    },
    terrainSource: {
      tiles: ["https://terrain.example/{z}/{x}/{y}.png"],
      tileSize: 256,
    },
  });

  assert.deepEqual(style.sky, {
    "sky-color": "#88c6fc",
    "horizon-color": "#ffffff",
    "fog-color": "#ffffff",
    "fog-ground-blend": 0.9,
    "horizon-fog-blend": 0.8,
    "sky-horizon-blend": 0.8,
  });
});

test("satellite reference categories toggle independently", () => {
  const calls: Array<[string, string, string]> = [];
  const map = {
    getLayer: (id: string) => (id === "missing" ? undefined : { id }),
    setLayoutProperty: (id: string, name: string, value: string) => {
      calls.push([id, name, value]);
    },
  };

  setSatelliteReferenceVisibility(
    map as Parameters<typeof setSatelliteReferenceVisibility>[0],
    [
      {
        category: "roads",
        layer: {
          id: "roads",
          type: "line",
          source: SATELLITE_REFERENCE_SOURCE_ID,
        },
      },
      {
        category: "placeLabels",
        layer: {
          id: "places",
          type: "symbol",
          source: SATELLITE_REFERENCE_SOURCE_ID,
        },
      },
      {
        category: "water",
        layer: {
          id: "missing",
          type: "fill",
          source: SATELLITE_REFERENCE_SOURCE_ID,
        },
      },
    ],
    {
      ...DEFAULT_SATELLITE_REFERENCE_VISIBILITY,
      roads: false,
    }
  );

  assert.deepEqual(calls, [
    ["roads", "visibility", "none"],
    ["places", "visibility", "visible"],
  ]);
});

test("fallback imagery remains beneath the primary while detailed tiles load", () => {
  const style = buildSatelliteTerrainStyle({
    satelliteFallbackSource: {
      tiles: ["https://fallback.example/{z}/{x}/{y}.jpg"],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 16,
    },
    satelliteSource: {
      tiles: ["https://imagery.example/{z}/{x}/{y}.jpg"],
      tileSize: 256,
      minzoom: 8,
      maxzoom: 18,
    },
    terrainSource: {
      tiles: ["https://terrain.example/{z}/{x}/{y}.png"],
      tileSize: 256,
    },
  });

  assert.deepEqual(
    style.layers.filter((layer) => layer.type === "raster"),
    [
      {
        id: SATELLITE_FALLBACK_LAYER_ID,
        type: "raster",
        source: SATELLITE_FALLBACK_SOURCE_ID,
      },
      {
        id: SATELLITE_LAYER_ID,
        type: "raster",
        source: SATELLITE_SOURCE_ID,
        minzoom: 8,
      },
    ]
  );
});

test("satellite imagery toggles independently from elevation", () => {
  const layoutCalls: Array<[string, string, string]> = [];
  const terrainCalls: unknown[] = [];
  const map = {
    getLayer: (id: string) =>
      id === SATELLITE_LAYER_ID ||
      id === SATELLITE_FALLBACK_LAYER_ID ||
      id === TERRAIN_GROUND_LAYER_ID
        ? { id }
        : undefined,
    setLayoutProperty: (id: string, name: string, value: string) => {
      layoutCalls.push([id, name, value]);
    },
    setTerrain: (terrain: unknown) => {
      terrainCalls.push(terrain);
    },
  };

  setSatelliteVisibility(
    map as Parameters<typeof setSatelliteVisibility>[0],
    false
  );
  setTerrainGroundVisibility(
    map as Parameters<typeof setTerrainGroundVisibility>[0],
    false,
    true
  );
  setElevationEnabled(
    map as Parameters<typeof setElevationEnabled>[0],
    false,
    1.5
  );
  setElevationEnabled(
    map as Parameters<typeof setElevationEnabled>[0],
    true,
    1.5
  );
  setTerrainGroundVisibility(
    map as Parameters<typeof setTerrainGroundVisibility>[0],
    false,
    false
  );

  assert.deepEqual(layoutCalls, [
    [SATELLITE_FALLBACK_LAYER_ID, "visibility", "none"],
    [SATELLITE_LAYER_ID, "visibility", "none"],
    [TERRAIN_GROUND_LAYER_ID, "visibility", "visible"],
    [TERRAIN_GROUND_LAYER_ID, "visibility", "none"],
  ]);
  assert.deepEqual(terrainCalls, [
    null,
    { source: TERRAIN_SOURCE_ID, exaggeration: 1.5 },
  ]);
});

test("satellite and elevation can start disabled without removing their sources", () => {
  const style = buildSatelliteTerrainStyle({
    satelliteSource: {
      tiles: ["https://imagery.example/{z}/{x}/{y}.jpg"],
      tileSize: 256,
    },
    terrainSource: {
      tiles: ["https://terrain.example/{z}/{x}/{y}.png"],
      tileSize: 256,
    },
    satelliteVisible: false,
    elevationEnabled: false,
  });

  assert.equal(style.sources[SATELLITE_SOURCE_ID]?.type, "raster");
  assert.equal(style.sources[TERRAIN_SOURCE_ID]?.type, "raster-dem");
  assert.deepEqual(
    style.layers.find((layer) => layer.id === SATELLITE_LAYER_ID)?.layout,
    { visibility: "none" }
  );
  assert.deepEqual(
    style.layers.find((layer) => layer.id === TERRAIN_GROUND_LAYER_ID)?.layout,
    { visibility: "none" }
  );
  assert.equal(style.terrain, undefined);
});

test("elevation supplies a visible shaded ground when satellite imagery is off", () => {
  const style = buildSatelliteTerrainStyle({
    satelliteSource: {
      tiles: ["https://imagery.example/{z}/{x}/{y}.jpg"],
      tileSize: 256,
    },
    terrainSource: {
      tiles: ["https://terrain.example/{z}/{x}/{y}.png"],
      tileSize: 256,
    },
    satelliteVisible: false,
    elevationEnabled: true,
  });

  assert.equal(style.layers[0]?.type, "background");
  assert.deepEqual(
    style.layers.find((layer) => layer.id === TERRAIN_GROUND_LAYER_ID)?.layout,
    { visibility: "visible" }
  );
});
