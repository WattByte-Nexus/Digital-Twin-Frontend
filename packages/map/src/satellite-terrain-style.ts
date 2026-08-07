import type {
  RasterDEMSourceSpecification,
  RasterSourceSpecification,
  StyleSpecification,
} from "maplibre-gl";

export const SATELLITE_SOURCE_ID = "digital-twin-satellite";
export const SATELLITE_LAYER_ID = "digital-twin-satellite";
export const TERRAIN_SOURCE_ID = "digital-twin-terrain";

export type SatelliteRasterSource = Omit<RasterSourceSpecification, "type">;
export type TerrainRasterSource = Omit<RasterDEMSourceSpecification, "type">;

export interface SatelliteTerrainStyleOptions {
  satelliteSource: SatelliteRasterSource;
  terrainSource: TerrainRasterSource;
  terrainExaggeration?: number;
}

/**
 * Builds the deliberately small first-party Digital Twin map style: one
 * satellite raster draped over one raster DEM terrain source.
 */
export function buildSatelliteTerrainStyle({
  satelliteSource,
  terrainSource,
  terrainExaggeration = 1,
}: SatelliteTerrainStyleOptions): StyleSpecification {
  return {
    version: 8,
    sources: {
      [SATELLITE_SOURCE_ID]: {
        ...satelliteSource,
        type: "raster",
      },
      [TERRAIN_SOURCE_ID]: {
        ...terrainSource,
        type: "raster-dem",
      },
    },
    layers: [
      {
        id: SATELLITE_LAYER_ID,
        type: "raster",
        source: SATELLITE_SOURCE_ID,
      },
    ],
    terrain: {
      source: TERRAIN_SOURCE_ID,
      exaggeration: terrainExaggeration,
    },
  };
}
