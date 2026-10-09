import { COGLayer } from "@developmentseed/deck.gl-geotiff";
import { CreateTexture } from "@developmentseed/deck.gl-raster/gpu-modules";
import type { DigitalTwinEarthEngineLayer } from "../../lib/digital-twin-earth-engine";

/** Convert scalar samples using the Engine's declared display range and nodata. */
export function colorizeDigitalTwinRaster(
  values: ArrayLike<number>,
  style: DigitalTwinEarthEngineLayer["style"],
  nodata: number | null,
  mask: Uint8Array | null | undefined,
  palette: readonly { r: number; g: number; b: number }[],
): Uint8Array {
  const { rescaleMin: min, rescaleMax: max } = style;
  if (min === undefined || max === undefined || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    throw new Error("Raster display range is missing or invalid.");
  }
  if (palette.length !== 256) throw new Error("Expected a 256-color raster palette.");
  const rgba = new Uint8Array(values.length * 4);
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    if (!Number.isFinite(value) || value === nodata || mask?.[index] === 0) continue;
    const color = palette[Math.round(Math.max(0, Math.min(1, (value - min) / (max - min))) * 255)];
    rgba.set([color.r, color.g, color.b, 255], index * 4);
  }
  return rgba;
}

async function rasterPalette(style: DigitalTwinEarthEngineLayer["style"]) {
  const { getColormap, getColorAtPosition, hexToRgb, isValidColormap } = await import("maplibre-gl-components");
  const colormap = style.colormap || "gray";
  if (!isValidColormap(colormap)) throw new Error(`Unsupported raster colormap: ${colormap}`);
  const stops = getColormap(colormap);
  return Array.from({ length: 256 }, (_, index) => {
    const color = hexToRgb(getColorAtPosition(stops, index / 255));
    if (!color) throw new Error("Raster colormap contains an invalid color.");
    return color;
  });
}

/** Join COG imagery to the native workspace's single Deck world surface. */
export function createDigitalTwinRasterLayer(descriptor: DigitalTwinEarthEngineLayer, onError: (error: Error) => void) {
  let palette: ReturnType<typeof rasterPalette> | undefined;
  return new COGLayer({
    id: `digital-twin-raster-${descriptor.id}`,
    geotiff: descriptor.url,
    opacity: descriptor.style.opacity ?? 1,
    pickable: false,
    onError: (error) => { onError(error); return true; },
    onTileError: (error) => onError(error instanceof Error ? error : new Error(String(error))),
    getTileData: async (image, { x, y, pool, signal, device }) => {
      const tile = await image.fetchTile(x, y, { boundless: false, pool, signal });
      if (tile.array.layout === "band-separate") throw new Error("Expected interleaved raster samples.");
      const { data, width, height, mask, nodata } = tile.array;
      if (data.length !== width * height) {
        throw new Error("Expected the Engine's single-band raster artifact.");
      }
      const colors = await (palette ??= rasterPalette(descriptor.style));
      const rgba = colorizeDigitalTwinRaster(data, descriptor.style, nodata, mask, colors);
      const texture = device.createTexture({
        data: rgba, format: "rgba8unorm", width, height,
        sampler: { minFilter: "linear", magFilter: "linear" },
      });
      return { texture, width, height, byteLength: rgba.byteLength };
    },
    renderTile: (tile) => ({ renderPipeline: [{ module: CreateTexture, props: { textureName: tile.texture } }] }),
    onTileUnload: (tile) => {
      const content = tile.content;
      if (content && typeof content === "object" && "texture" in content && content.texture && typeof content.texture === "object" && "destroy" in content.texture && typeof content.texture.destroy === "function") content.texture.destroy();
    },
  });
}
