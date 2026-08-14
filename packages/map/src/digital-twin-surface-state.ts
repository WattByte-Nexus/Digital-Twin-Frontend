import { TERRAIN_SOURCE_ID } from "./satellite-terrain-style";

export interface DigitalTwinSurfaceElevationMap {
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
 * A partial result is rejected so one network never mixes asset and terrain Z.
 */
export function sampleDigitalTwinSurfaceElevations(
  map: DigitalTwinSurfaceElevationQuery,
  coordinates: readonly DigitalTwinSurfaceCoordinate[]
): Map<string, number> | null {
  const terrain = map.getTerrain();
  if (!terrain) return null;
  const exaggeration =
    typeof terrain.exaggeration === "number" && terrain.exaggeration > 0
      ? terrain.exaggeration
      : 1;
  const elevations = new Map<string, number>();

  for (const [longitude, latitude] of coordinates) {
    const elevation = map.queryTerrainElevation([longitude, latitude]);
    if (typeof elevation !== "number" || !Number.isFinite(elevation)) {
      return null;
    }
    elevations.set(
      digitalTwinSurfaceCoordinateKey(longitude, latitude),
      elevation / exaggeration
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

  if (!state.enabled) {
    map.setTerrain(null);
    return;
  }

  map.setTerrain({
    source: TERRAIN_SOURCE_ID,
    exaggeration: state.exaggeration,
  });
}
