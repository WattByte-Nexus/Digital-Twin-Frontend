import assert from "node:assert/strict";
import { test } from "node:test";
import { colorizeDigitalTwinRaster } from "../apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-raster";

test("native COG display preserves nodata/mask and Engine scaling for float samples", () => {
  const palette = Array.from({length:256}, (_, value) => ({ r:value, g:value, b:value }));
  const pixels = colorizeDigitalTwinRaster([-10, 0.5, 1, NaN, -9999, 0.3],
    { colormap: "gray", rescaleMin: 0, rescaleMax: 1 }, -9999, new Uint8Array([1, 1, 1, 1, 1, 0]), palette);
  assert.deepEqual([...pixels.slice(0, 4)], [0, 0, 0, 255]);
  assert.equal(pixels[4], 128);
  assert.deepEqual([...pixels.slice(8, 12)], [255, 255, 255, 255]);
  assert.deepEqual([...pixels.slice(12)], new Array(12).fill(0));
  assert.throws(() => colorizeDigitalTwinRaster([1], {}, null, null, palette), /range/);
});
