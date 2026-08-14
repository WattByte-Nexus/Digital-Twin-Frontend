import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildSatelliteTerrainStyle,
  SATELLITE_LAYER_ID,
  SATELLITE_SOURCE_ID,
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
import { applyDigitalTwinSurfaceElevationState } from "../packages/map/src/digital-twin-surface-state";

const satelliteTerrainMapSource = readFileSync(
  new URL("../packages/map/src/SatelliteTerrainMap.tsx", import.meta.url),
  "utf8"
);
const satelliteTerrainConfigSource = readFileSync(
  new URL(
    "../apps/geolibre-desktop/src/product-modes/digital-twin/satellite-terrain-config.ts",
    import.meta.url
  ),
  "utf8"
);

test("satellite terrain map includes its reference overlay in the initial style", () => {
  assert.match(
    satelliteTerrainMapSource,
    /referenceOverlay:\s*options\.referenceOverlay/
  );
  assert.doesNotMatch(
    satelliteTerrainMapSource,
    /loadSatelliteReferenceOverlay\(/
  );
});

test("satellite terrain map owns one portable interleaved deck surface", () => {
  assert.match(satelliteTerrainMapSource, /new MapboxOverlay\(/);
  assert.match(satelliteTerrainMapSource, /interleaved:\s*true/);
  assert.doesNotMatch(satelliteTerrainMapSource, /\bviews:/);
  assert.match(satelliteTerrainMapSource, /surfaceLayers/);
  assert.match(satelliteTerrainMapSource, /composeDigitalTwinSurfaceLayers/);
  assert.match(satelliteTerrainMapSource, /onSurfaceClick/);
  assert.match(satelliteTerrainMapSource, /getCursor/);
  assert.match(satelliteTerrainMapSource, /isDragging \? "grabbing"/);
  assert.match(satelliteTerrainMapSource, /isHovering \? "grab"/);
  assert.match(satelliteTerrainMapSource, /map\.once\("style\.load", handleLoad\)/);
  assert.doesNotMatch(satelliteTerrainMapSource, /map\.once\("load", handleLoad\)/);
  assert.match(satelliteTerrainMapSource, /powerPreference:\s*"low-power"/);
  assert.doesNotMatch(
    satelliteTerrainMapSource,
    /powerPreference:\s*"high-performance"/
  );
});

test("terrain camera rejects a 3D tile-origin elevation offset", () => {
  let centerElevation = 1_925.696;
  let centerClampedToGround = false;
  let terrain: unknown = null;
  const map = {
    getCenterClampedToGround: () => centerClampedToGround,
    setCenterClampedToGround: (value: boolean) => {
      centerClampedToGround = value;
    },
    setTerrain: (value: unknown) => {
      terrain = value;
      centerElevation = value ? 1_642.25 : 0;
    },
  };

  applyDigitalTwinSurfaceElevationState(map, {
    enabled: true,
    exaggeration: 1,
  });
  assert.deepEqual(terrain, {
    source: TERRAIN_SOURCE_ID,
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

test("Digital Twin ships a Mapbox Streets operational reference stack in the initial style", () => {
  assert.match(
    satelliteTerrainConfigSource,
    /streetsTileJsonUrl:\s*string/
  );
  assert.match(satelliteTerrainConfigSource, /mapboxGlyphsUrl:\s*string/);
  assert.match(satelliteTerrainConfigSource, /url:\s*streetsTileJsonUrl/);
  assert.match(satelliteTerrainConfigSource, /glyphs:\s*mapboxGlyphsUrl/);
  assert.doesNotMatch(satelliteTerrainConfigSource, /tiles\.openfreemap\.org/);
  assert.match(
    satelliteTerrainConfigSource,
    /DIGITAL_TWIN_REFERENCE_LABEL_ANCHOR_LAYER_ID/
  );
  assert.match(
    satelliteTerrainConfigSource,
    /category:\s*"roads"[\s\S]*?type:\s*"line"/
  );
  assert.match(
    satelliteTerrainConfigSource,
    /category:\s*"placeLabels"[\s\S]*?type:\s*"symbol"/
  );
  assert.doesNotMatch(satelliteTerrainConfigSource, /\bsprite\s*:/);
});

test("Digital Twin reference layers use the Mapbox Streets v8 source schema", () => {
  for (const sourceLayer of [
    "admin",
    "building",
    "landuse",
    "natural_label",
    "place_label",
    "poi_label",
    "road",
    "water",
    "waterway",
  ]) {
    assert.match(
      satelliteTerrainConfigSource,
      new RegExp(`"source-layer": "${sourceLayer}"`)
    );
  }
  for (const obsoleteSourceLayer of [
    "boundary",
    "park",
    "place",
    "poi",
    "transportation",
    "transportation_name",
    "water_name",
  ]) {
    assert.doesNotMatch(
      satelliteTerrainConfigSource,
      new RegExp(`"source-layer": "${obsoleteSourceLayer}"`)
    );
  }
});

test("every reference toolbar switch owns at least one concrete map layer", () => {
  for (const category of [
    "placeLabels",
    "roads",
    "roadLabels",
    "poiLabels",
    "water",
    "waterLabels",
    "boundaries",
    "buildings",
    "parks",
  ]) {
    assert.match(
      satelliteTerrainConfigSource,
      new RegExp(`category:\\s*"${category}"`),
      `${category} must own a reference layer`
    );
  }
});

test("road hierarchy retains the previous Liberty colors and class separation", () => {
  assert.match(satelliteTerrainConfigSource, /road-major-casing/);
  assert.match(satelliteTerrainConfigSource, /road-motorway/);
  assert.match(satelliteTerrainConfigSource, /road-trunk-primary/);
  assert.match(satelliteTerrainConfigSource, /road-secondary/);
  assert.match(satelliteTerrainConfigSource, /road-minor/);
  assert.match(satelliteTerrainConfigSource, /road-service/);
  assert.match(satelliteTerrainConfigSource, /road-path/);
  assert.match(satelliteTerrainConfigSource, /"line-color": "#e9ac77"/);
  assert.match(satelliteTerrainConfigSource, /"line-color": "#fea"/);
  assert.match(satelliteTerrainConfigSource, /"line-color": "#cfcdca"/);
});

test("satellite terrain style orders imagery, terrain, and reference details", () => {
  const style = buildSatelliteTerrainStyle({
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
    SATELLITE_SOURCE_ID,
    TERRAIN_SOURCE_ID,
    SATELLITE_REFERENCE_SOURCE_ID,
  ]);
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

test("satellite terrain style uses a dark map treatment in dark mode", () => {
  const style = buildSatelliteTerrainStyle({
    satelliteSource: {
      tiles: ["https://imagery.example/{z}/{x}/{y}.jpg"],
      tileSize: 256,
    },
    terrainSource: {
      tiles: ["https://terrain.example/{z}/{x}/{y}.png"],
      tileSize: 256,
    },
    themeMode: "dark",
  });

  const rasterPaint = {
    "raster-brightness-min": 0.02,
    "raster-brightness-max": 0.42,
    "raster-saturation": -0.2,
    "raster-contrast": 0.15,
  };
  assert.deepEqual(
    style.layers.find((layer) => layer.id === TERRAIN_BACKGROUND_LAYER_ID)
      ?.paint,
    { "background-color": "#07111f" }
  );
  assert.deepEqual(
    style.layers.find((layer) => layer.id === SATELLITE_LAYER_ID)?.paint,
    rasterPaint
  );
  assert.deepEqual(style.sky, {
    "sky-color": "#07111f",
    "horizon-color": "#111827",
    "fog-color": "#111827",
    "fog-ground-blend": 0.9,
    "horizon-fog-blend": 0.8,
    "sky-horizon-blend": 0.8,
  });
});

test("dark mode preserves every reference overlay layer", () => {
  const referenceOverlay = {
    source: {
      type: "vector" as const,
      tiles: ["https://reference.example/{z}/{x}/{y}.pbf"],
    },
    layers: [
      {
        category: "roads" as const,
        layer: {
          id: "digital-twin-reference-road",
          type: "line" as const,
          source: SATELLITE_REFERENCE_SOURCE_ID,
          "source-layer": "transportation",
        },
      },
      {
        category: "buildings" as const,
        layer: {
          id: "digital-twin-reference-building",
          type: "fill" as const,
          source: SATELLITE_REFERENCE_SOURCE_ID,
          "source-layer": "building",
        },
      },
    ],
  };
  const style = buildSatelliteTerrainStyle({
    satelliteSource: {
      tiles: ["https://imagery.example/{z}/{x}/{y}.jpg"],
      tileSize: 256,
    },
    referenceOverlay,
    terrainSource: {
      tiles: ["https://terrain.example/{z}/{x}/{y}.png"],
      tileSize: 256,
    },
    themeMode: "dark",
  });

  assert.deepEqual(
    style.layers
      .filter((layer) => layer.id.startsWith("digital-twin-reference-"))
      .map((layer) => layer.id),
    referenceOverlay.layers.map(({ layer }) => layer.id)
  );
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

test("satellite terrain style renders exactly one photographic source and layer", () => {
  const style = buildSatelliteTerrainStyle({
    satelliteSource: {
      url: "https://imagery.example/tiles.json",
    },
    terrainSource: {
      tiles: ["https://terrain.example/{z}/{x}/{y}.png"],
      tileSize: 256,
    },
  });

  assert.deepEqual(
    Object.values(style.sources).filter((source) => source.type === "raster"),
    [{ type: "raster", url: "https://imagery.example/tiles.json" }]
  );
  assert.deepEqual(
    style.layers.filter((layer) => layer.type === "raster"),
    [
      {
        id: SATELLITE_LAYER_ID,
        type: "raster",
        source: SATELLITE_SOURCE_ID,
      },
    ]
  );
});

test("Digital Twin uses Mapbox Satellite without USGS or DRAPP imagery", () => {
  assert.match(
    satelliteTerrainConfigSource,
    /createDigitalTwinSatelliteTerrainConfig/
  );
  assert.doesNotMatch(satelliteTerrainConfigSource, /USGSImageryOnly/);
  assert.doesNotMatch(satelliteTerrainConfigSource, /DRCOG_Mosaics/);
  assert.doesNotMatch(satelliteTerrainMapSource, /satelliteFallbackSource/);
});

test("satellite terrain map hides vendor attribution chrome", () => {
  assert.match(satelliteTerrainMapSource, /attributionControl:\s*false/);
  assert.doesNotMatch(satelliteTerrainMapSource, /MapboxAttributionLogo/);
});

test("satellite imagery toggles independently from elevation", () => {
  const layoutCalls: Array<[string, string, string]> = [];
  const terrainCalls: unknown[] = [];
  let centerElevation = 0;
  let centerClampedToGround = true;
  const map = {
    getLayer: (id: string) =>
      id === SATELLITE_LAYER_ID ||
      id === TERRAIN_GROUND_LAYER_ID
        ? { id }
        : undefined,
    setLayoutProperty: (id: string, name: string, value: string) => {
      layoutCalls.push([id, name, value]);
    },
    setTerrain: (terrain: unknown) => {
      terrainCalls.push(terrain);
    },
    getCenterElevation: () => centerElevation,
    getCenterClampedToGround: () => centerClampedToGround,
    setCenterElevation: (value: number) => {
      centerElevation = value;
    },
    setCenterClampedToGround: (value: boolean) => {
      centerClampedToGround = value;
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
  applyDigitalTwinSurfaceElevationState(map, {
    enabled: false,
    exaggeration: 1.5,
  });
  applyDigitalTwinSurfaceElevationState(map, {
    enabled: true,
    exaggeration: 1.5,
  });
  setTerrainGroundVisibility(
    map as Parameters<typeof setTerrainGroundVisibility>[0],
    false,
    false
  );

  assert.deepEqual(layoutCalls, [
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
