import type { Map as MapLibreMap } from "maplibre-gl";

export type TerrainCameraTargetMap = Pick<
  MapLibreMap,
  | "getCenterClampedToGround"
  | "getCenterElevation"
  | "setCenterClampedToGround"
  | "setCenterElevation"
>;

/**
 * Keeps MapLibre's camera target in the same vertical reference frame as a
 * streamed 3D dataset. MapLibre otherwise targets sea level until its DEM can
 * resolve the center elevation, which can clip high-altitude geometry before
 * deck.gl reaches rasterization.
 */
export function syncTerrainCameraTarget(
  map: TerrainCameraTargetMap,
  cameraTargetElevation?: number
): void {
  if (Number.isFinite(cameraTargetElevation)) {
    if (map.getCenterClampedToGround()) {
      map.setCenterClampedToGround(false);
    }
    if (Math.abs(map.getCenterElevation() - cameraTargetElevation!) > 0.01) {
      map.setCenterElevation(cameraTargetElevation!);
    }
    return;
  }

  if (!map.getCenterClampedToGround()) {
    map.setCenterClampedToGround(true);
  }
  if (Math.abs(map.getCenterElevation()) > 0.01) {
    map.setCenterElevation(0);
  }
}
