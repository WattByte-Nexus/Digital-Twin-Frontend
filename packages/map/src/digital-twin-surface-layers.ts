import type { Layer } from "@deck.gl/core";

/**
 * The only coordinate frame accepted by the Digital Twin map surface.
 * Every layer must resolve through its loader/transform to WGS84 horizontal
 * coordinates plus absolute meters; the map never guesses or applies offsets.
 */
export const DIGITAL_TWIN_SHARED_SURFACE = Object.freeze({
  id: "digital-twin-world-v1",
  horizontalCrs: "EPSG:4326",
  verticalReference: "digital-twin-absolute-meters-v1",
  elevationUnit: "meter",
  heightMode: "absolute",
} as const);

export type DigitalTwinSharedSurface = typeof DIGITAL_TWIN_SHARED_SURFACE;

export interface DigitalTwinSurfaceLayerGroup {
  /** Stable identity for one independently extensible map capability. */
  id: string;
  surface: DigitalTwinSharedSurface;
  layers: readonly Layer[];
}

export interface ComposedDigitalTwinSurfaceLayers {
  layers: Layer[];
}

function isSharedSurface(surface: DigitalTwinSharedSurface): boolean {
  return (
    surface.id === DIGITAL_TWIN_SHARED_SURFACE.id &&
    surface.horizontalCrs === DIGITAL_TWIN_SHARED_SURFACE.horizontalCrs &&
    surface.verticalReference ===
      DIGITAL_TWIN_SHARED_SURFACE.verticalReference &&
    surface.elevationUnit === DIGITAL_TWIN_SHARED_SURFACE.elevationUnit &&
    surface.heightMode === DIGITAL_TWIN_SHARED_SURFACE.heightMode
  );
}

/** Validate and flatten typed capabilities for the map's single deck surface. */
export function composeDigitalTwinSurfaceLayers(
  groups: readonly DigitalTwinSurfaceLayerGroup[]
): ComposedDigitalTwinSurfaceLayers {
  const groupIds = new Set<string>();
  const layerIds = new Set<string>();
  const layers: Layer[] = [];

  for (const group of groups) {
    if (!group.id || groupIds.has(group.id)) {
      throw new Error(`Digital Twin surface group id must be unique: ${group.id}`);
    }
    groupIds.add(group.id);

    if (!isSharedSurface(group.surface)) {
      throw new Error(
        `Digital Twin layer group ${group.id} does not use the shared surface.`
      );
    }

    for (const layer of group.layers) {
      if (!layer.id || layerIds.has(layer.id)) {
        throw new Error(`Digital Twin layer id must be unique: ${layer.id}`);
      }
      layerIds.add(layer.id);
      layers.push(layer);
    }

  }

  return { layers };
}
