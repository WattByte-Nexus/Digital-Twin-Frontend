import type {
  LayerSpecification,
  Map as MapLibreMap,
  StyleSpecification,
  VectorSourceSpecification,
} from "maplibre-gl";

export const SATELLITE_REFERENCE_SOURCE_ID = "digital-twin-reference";
export const SATELLITE_REFERENCE_LAYER_PREFIX = "digital-twin-reference-";

export interface SatelliteReferenceVisibility {
  placeLabels: boolean;
  roads: boolean;
  roadLabels: boolean;
  poiLabels: boolean;
  water: boolean;
  waterLabels: boolean;
  boundaries: boolean;
  buildings: boolean;
  parks: boolean;
}

export type SatelliteReferenceCategory = keyof SatelliteReferenceVisibility;

export const DEFAULT_SATELLITE_REFERENCE_VISIBILITY: SatelliteReferenceVisibility =
  {
    placeLabels: true,
    roads: true,
    roadLabels: true,
    poiLabels: false,
    water: true,
    waterLabels: true,
    boundaries: true,
    buildings: true,
    parks: true,
  };

export interface SatelliteReferenceOverlay {
  source: VectorSourceSpecification;
  glyphs?: StyleSpecification["glyphs"];
  layers: SatelliteReferenceLayer[];
}

export interface SatelliteReferenceLayer {
  category: SatelliteReferenceCategory;
  layer: LayerSpecification;
}

export function setSatelliteReferenceVisibility(
  map: Pick<MapLibreMap, "getLayer" | "setLayoutProperty">,
  layers: readonly SatelliteReferenceLayer[],
  visibility: SatelliteReferenceVisibility
): void {
  for (const { category, layer } of layers) {
    const layerId = layer.id;
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(
        layerId,
        "visibility",
        visibility[category] ? "visible" : "none"
      );
    }
  }
}
