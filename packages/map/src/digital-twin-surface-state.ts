import { TERRAIN_SOURCE_ID } from "./satellite-terrain-style";

export interface DigitalTwinSurfaceElevationMap {
  getTerrain: () => { source: string; exaggeration?: number } | null;
  getCenterClampedToGround: () => boolean;
  setCenterClampedToGround: (value: boolean) => void;
  setTerrain: (
    terrain: { source: string; exaggeration: number } | null
  ) => void;
}

export interface DigitalTwinSurfaceElevationState {
  enabled: boolean;
  exaggeration: number;
}

export type DigitalTwinSurfaceCoordinate = [
  longitude: number,
  latitude: number,
];

export interface DigitalTwinSurfaceElevationQuery {
  getTerrain: () => { exaggeration?: number } | null | undefined;
  getSource: (sourceId: string) => unknown;
  isSourceLoaded: (sourceId: string) => boolean;
  queryTerrainElevation: (
    coordinate: DigitalTwinSurfaceCoordinate
  ) => number | null;
}

export function digitalTwinSurfaceCoordinateKey(
  longitude: number,
  latitude: number
): string {
  return `${longitude.toFixed(7)},${latitude.toFixed(7)}`;
}

/**
 * Resolve an entire coordinate set against MapLibre's authoritative terrain.
 * Returns displayed ground meters, including exaggeration. A partial result
 * or an unfinished terrain toggle is rejected so one network never mixes
 * asset and terrain Z.
 */
export function sampleDigitalTwinSurfaceElevations(
  map: DigitalTwinSurfaceElevationQuery,
  coordinates: readonly DigitalTwinSurfaceCoordinate[],
  elevationEnabled: boolean
): Map<string, number> | null {
  const terrain = map.getTerrain();
  if (!terrain || ((terrain.exaggeration ?? 1) !== 0) !== elevationEnabled) return null;
  if (!elevationEnabled) {
    return new Map(coordinates.map(([longitude, latitude]) => [
      digitalTwinSurfaceCoordinateKey(longitude, latitude),
      0,
    ]));
  }
  if (!map.getSource(TERRAIN_SOURCE_ID) || !map.isSourceLoaded(TERRAIN_SOURCE_ID)) {
    return null;
  }
  const elevations = new Map<string, number>();

  for (const [longitude, latitude] of coordinates) {
    const elevation = map.queryTerrainElevation([longitude, latitude]);
    if (typeof elevation !== "number" || !Number.isFinite(elevation)) {
      return null;
    }
    elevations.set(
      digitalTwinSurfaceCoordinateKey(longitude, latitude),
      elevation
    );
  }

  return elevations;
}

function claimTerrainCamera(map: DigitalTwinSurfaceElevationMap): void {
  if (!map.getCenterClampedToGround()) {
    map.setCenterClampedToGround(true);
  }
}

/** Apply terrain and its camera reference as one indivisible surface state. */
export function applyDigitalTwinSurfaceElevationState(
  map: DigitalTwinSurfaceElevationMap,
  state: DigitalTwinSurfaceElevationState
): void {
  claimTerrainCamera(map);
  const current = map.getTerrain();
  const exaggeration = state.enabled ? state.exaggeration : 0;
  if (
    current?.source === TERRAIN_SOURCE_ID &&
    (current.exaggeration ?? 1) === exaggeration
  ) return;

  // Keep one ground surface and its DEM tiles alive in flat mode. Removing
  // terrain discards its tile coverage and can re-enable with a zero-height
  // camera before ground data is available.
  map.setTerrain({
    source: TERRAIN_SOURCE_ID,
    exaggeration,
  });
}
