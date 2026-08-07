import type {
  LayerSpecification,
  Map as MapLibreMap,
  RasterDEMSourceSpecification,
  RasterSourceSpecification,
  StyleSpecification,
} from "maplibre-gl";
import {
  DEFAULT_SATELLITE_REFERENCE_VISIBILITY,
  SATELLITE_REFERENCE_SOURCE_ID,
  type SatelliteReferenceOverlay,
  type SatelliteReferenceVisibility,
} from "./satellite-reference-overlay";
import type { MapThemeMode } from "./theme-basemap";

export const SATELLITE_SOURCE_ID = "digital-twin-satellite";
export const SATELLITE_LAYER_ID = "digital-twin-satellite";
export const SATELLITE_FALLBACK_SOURCE_ID = "digital-twin-satellite-fallback";
export const SATELLITE_FALLBACK_LAYER_ID = "digital-twin-satellite-fallback";
export const TERRAIN_SOURCE_ID = "digital-twin-terrain";
export const TERRAIN_BACKGROUND_LAYER_ID = "digital-twin-terrain-background";
export const TERRAIN_GROUND_LAYER_ID = "digital-twin-terrain-ground";

export type SatelliteRasterSource = Omit<RasterSourceSpecification, "type">;
export type TerrainRasterSource = Omit<RasterDEMSourceSpecification, "type">;

export interface SatelliteTerrainStyleOptions {
  satelliteSource: SatelliteRasterSource;
  satelliteFallbackSource?: SatelliteRasterSource;
  referenceOverlay?: SatelliteReferenceOverlay;
  referenceOverlayVisibility?: SatelliteReferenceVisibility;
  terrainSource: TerrainRasterSource;
  terrainExaggeration?: number;
  satelliteVisible?: boolean;
  elevationEnabled?: boolean;
  themeMode?: MapThemeMode;
}

const DARK_RASTER_PAINT = {
  "raster-brightness-min": 0.02,
  "raster-brightness-max": 0.42,
  "raster-saturation": -0.2,
  "raster-contrast": 0.15,
} as const;

type SatelliteVisibilityMap = Pick<
  MapLibreMap,
  "getLayer" | "setLayoutProperty"
>;
type TerrainMap = Pick<MapLibreMap, "setTerrain">;

export function setSatelliteVisibility(
  map: SatelliteVisibilityMap,
  visible: boolean
): void {
  for (const layerId of [SATELLITE_FALLBACK_LAYER_ID, SATELLITE_LAYER_ID]) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(
        layerId,
        "visibility",
        visible ? "visible" : "none"
      );
    }
  }
}

export function setElevationEnabled(
  map: TerrainMap,
  enabled: boolean,
  exaggeration = 1
): void {
  map.setTerrain(enabled ? { source: TERRAIN_SOURCE_ID, exaggeration } : null);
}

export function setTerrainGroundVisibility(
  map: SatelliteVisibilityMap,
  satelliteVisible: boolean,
  elevationEnabled: boolean
): void {
  if (map.getLayer(TERRAIN_GROUND_LAYER_ID)) {
    map.setLayoutProperty(
      TERRAIN_GROUND_LAYER_ID,
      "visibility",
      !satelliteVisible && elevationEnabled ? "visible" : "none"
    );
  }
}

/**
 * Builds the deliberately small first-party Digital Twin map style: a primary
 * satellite raster, an optional lower-resolution fallback, and one raster DEM
 * terrain source.
 */
export function buildSatelliteTerrainStyle({
  satelliteSource,
  satelliteFallbackSource,
  referenceOverlay,
  referenceOverlayVisibility = DEFAULT_SATELLITE_REFERENCE_VISIBILITY,
  terrainSource,
  terrainExaggeration = 1,
  satelliteVisible = true,
  elevationEnabled = true,
  themeMode = "light",
}: SatelliteTerrainStyleOptions): StyleSpecification {
  const dark = themeMode === "dark";
  return {
    version: 8,
    sources: {
      ...(satelliteFallbackSource
        ? {
            [SATELLITE_FALLBACK_SOURCE_ID]: {
              ...satelliteFallbackSource,
              type: "raster" as const,
            },
          }
        : {}),
      [SATELLITE_SOURCE_ID]: {
        ...satelliteSource,
        type: "raster",
      },
      [TERRAIN_SOURCE_ID]: {
        ...terrainSource,
        type: "raster-dem",
      },
      ...(referenceOverlay
        ? { [SATELLITE_REFERENCE_SOURCE_ID]: referenceOverlay.source }
        : {}),
    },
    layers: [
      {
        id: TERRAIN_BACKGROUND_LAYER_ID,
        type: "background",
        paint: {
          "background-color": dark ? "#07111f" : "#dfe3dc",
        },
      },
      ...(satelliteFallbackSource
        ? [
            {
              id: SATELLITE_FALLBACK_LAYER_ID,
              type: "raster" as const,
              source: SATELLITE_FALLBACK_SOURCE_ID,
              ...(dark ? { paint: DARK_RASTER_PAINT } : {}),
              ...(satelliteVisible
                ? {}
                : { layout: { visibility: "none" as const } }),
            },
          ]
        : []),
      {
        id: SATELLITE_LAYER_ID,
        type: "raster",
        source: SATELLITE_SOURCE_ID,
        ...(dark ? { paint: DARK_RASTER_PAINT } : {}),
        ...(satelliteVisible
          ? {}
          : { layout: { visibility: "none" as const } }),
        ...(satelliteFallbackSource && satelliteSource.minzoom !== undefined
          ? { minzoom: satelliteSource.minzoom }
          : {}),
      },
      {
        id: TERRAIN_GROUND_LAYER_ID,
        type: "hillshade",
        source: TERRAIN_SOURCE_ID,
        layout: {
          visibility:
            !satelliteVisible && elevationEnabled ? "visible" : "none",
        },
        paint: {
          "hillshade-exaggeration": 0.45,
          "hillshade-shadow-color": dark ? "#020617" : "#667064",
          "hillshade-highlight-color": dark ? "#334155" : "#f8faf6",
          "hillshade-accent-color": dark ? "#0f172a" : "#929b8f",
        },
      },
      ...(referenceOverlay
        ? referenceOverlay.layers.map(
            ({ category, layer }): LayerSpecification => ({
              ...layer,
              layout: {
                ...layer.layout,
                visibility: referenceOverlayVisibility[category]
                  ? "visible"
                  : "none",
              },
            })
          )
        : []),
    ],
    sky: {
      "sky-color": dark ? "#07111f" : "#88c6fc",
      "horizon-color": dark ? "#111827" : "#ffffff",
      "fog-color": dark ? "#111827" : "#ffffff",
      "fog-ground-blend": 0.9,
      "horizon-fog-blend": 0.8,
      "sky-horizon-blend": 0.8,
    },
    ...(referenceOverlay?.glyphs ? { glyphs: referenceOverlay.glyphs } : {}),
    ...(referenceOverlay?.sprite ? { sprite: referenceOverlay.sprite } : {}),
    ...(elevationEnabled
      ? {
          terrain: {
            source: TERRAIN_SOURCE_ID,
            exaggeration: terrainExaggeration,
          },
        }
      : {}),
  };
}
