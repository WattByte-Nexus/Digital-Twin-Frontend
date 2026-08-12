import type { Map as MapLibreMap } from "maplibre-gl";

export type TerrainCameraTargetMap = Pick<
  MapLibreMap,
  | "getCenterClampedToGround"
  | "getCenterElevation"
  | "setCenterClampedToGround"
  | "setCenterElevation"
>;

/** Keep the camera target in the active 3D dataset's vertical reference frame. */
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
