import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSatelliteTerrainStyle,
  SATELLITE_LAYER_ID,
  SATELLITE_SOURCE_ID,
  TERRAIN_SOURCE_ID,
} from "../packages/map/src/satellite-terrain-style";

test("satellite terrain style contains only imagery and tiled DEM terrain", () => {
  const style = buildSatelliteTerrainStyle({
    satelliteSource: {
      tiles: ["https://imagery.example/{z}/{x}/{y}.jpg"],
      tileSize: 256,
      bounds: [-106, 39, -104, 41],
      maxzoom: 18,
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
  assert.deepEqual(style.layers, [
    {
      id: SATELLITE_LAYER_ID,
      type: "raster",
      source: SATELLITE_SOURCE_ID,
    },
  ]);
  assert.deepEqual(style.terrain, {
    source: TERRAIN_SOURCE_ID,
    exaggeration: 1.25,
  });
});
