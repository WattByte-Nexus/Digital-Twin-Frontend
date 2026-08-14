import { MapView, type MapViewState } from "@deck.gl/core";

export interface DigitalTwinSurfaceViewElevationSource {
  getMapCenterElevation: () => number;
  getSurfaceReferenceElevation: () => number | undefined;
}

/**
 * Select the absolute elevation deck.gl should use as its camera target.
 * MapLibre's loaded terrain is authoritative; a 3D dataset origin keeps LOD
 * traversal correct while terrain is unavailable or still loading.
 */
export function resolveDigitalTwinSurfaceViewElevation({
  getMapCenterElevation,
  getSurfaceReferenceElevation,
}: DigitalTwinSurfaceViewElevationSource): number {
  const mapElevation = getMapCenterElevation();
  if (Number.isFinite(mapElevation) && Math.abs(mapElevation) > 0.01) {
    return mapElevation;
  }

  const surfaceReferenceElevation = getSurfaceReferenceElevation();
  return Number.isFinite(surfaceReferenceElevation)
    ? (surfaceReferenceElevation as number)
    : 0;
}

/**
 * deck.gl's Mapbox adapter mistakes MapLibre's free-camera API for Mapbox GL
 * terrain and leaves its viewport target at sea level. At high elevations that
 * makes 3D Tiles traversal think the camera remains kilometres away as the map
 * zooms. This view replaces only the vertical target while retaining the live
 * MapLibre longitude, latitude, zoom, bearing, pitch, and projection state.
 */
export function createDigitalTwinSurfaceMapView(
  elevationSource: DigitalTwinSurfaceViewElevationSource
): MapView {
  return new (class extends MapView {
    override filterViewState(viewState: MapViewState): MapViewState {
      return {
        ...viewState,
        position: [
          0,
          0,
          resolveDigitalTwinSurfaceViewElevation(elevationSource),
        ],
      };
    }
  })({ id: "mapbox" });
}
