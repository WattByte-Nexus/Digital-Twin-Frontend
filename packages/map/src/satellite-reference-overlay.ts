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

export const DEFAULT_SATELLITE_REFERENCE_VISIBILITY: SatelliteReferenceVisibility = {
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

const REFERENCE_SOURCE_LAYERS = new Set([
  "aerodrome_label",
  "boundary",
  "building",
  "park",
  "place",
  "poi",
  "transportation_name",
  "water",
  "water_name",
  "waterway",
]);

const REFERENCE_ROAD_LAYER =
  /^(?:tunnel|road|bridge)_(?:motorway|motorway_link|trunk_primary|secondary_tertiary|minor|service_track|path_pedestrian)(?:_casing)?$/;

export interface SatelliteReferenceOverlay {
  source: VectorSourceSpecification;
  glyphs?: StyleSpecification["glyphs"];
  sprite?: StyleSpecification["sprite"];
  layers: SatelliteReferenceLayer[];
}

export interface SatelliteReferenceLayer {
  category: SatelliteReferenceCategory;
  layer: LayerSpecification;
}

function sourceLayer(layer: LayerSpecification): string | undefined {
  return "source-layer" in layer ? layer["source-layer"] : undefined;
}

function referenceCategory(
  layer: LayerSpecification,
  sourceId: string,
): SatelliteReferenceCategory | null {
  if (!("source" in layer) || layer.source !== sourceId) return null;
  const layerSource = sourceLayer(layer);
  if (layerSource === undefined || !REFERENCE_SOURCE_LAYERS.has(layerSource)) {
    if (layerSource === "transportation" && REFERENCE_ROAD_LAYER.test(layer.id)) return "roads";
    return null;
  }
  if (layerSource === "place") return "placeLabels";
  if (layerSource === "transportation_name") return "roadLabels";
  if (layerSource === "poi" || layerSource === "aerodrome_label") return "poiLabels";
  if (layerSource === "water_name") return "waterLabels";
  if (layerSource === "waterway") return layer.type === "symbol" ? "waterLabels" : "water";
  if (layerSource === "water") return "water";
  if (layerSource === "boundary") return "boundaries";
  if (layerSource === "building") return "buildings";
  if (layerSource === "park") return "parks";
  return null;
}

function satellitePaint(layer: LayerSpecification): LayerSpecification["paint"] {
  const layerSource = sourceLayer(layer);

  if (layer.type === "symbol") {
    return {
      ...layer.paint,
      "icon-opacity": 0.9,
      "text-color": "#f8fafc",
      "text-halo-blur": 0.35,
      "text-halo-color": "rgba(15, 23, 42, 0.96)",
      "text-halo-width": 1.5,
      "text-opacity": 0.98,
    };
  }

  if (layer.type === "fill") {
    if (layerSource === "water") {
      return {
        ...layer.paint,
        "fill-color": "#38bdf8",
        "fill-opacity": 0.14,
        "fill-outline-color": "rgba(125, 211, 252, 0.8)",
      };
    }
    if (layerSource === "park") {
      return {
        ...layer.paint,
        "fill-color": "#4ade80",
        "fill-opacity": 0.08,
        "fill-outline-color": "rgba(134, 239, 172, 0.55)",
      };
    }
    if (layerSource === "building") {
      return {
        ...layer.paint,
        "fill-color": "#f8fafc",
        "fill-opacity": 0.08,
        "fill-outline-color": "rgba(248, 250, 252, 0.45)",
      };
    }
  }

  if (layer.type === "line") {
    if (layerSource === "waterway") {
      return {
        ...layer.paint,
        "line-color": "#7dd3fc",
        "line-opacity": 0.85,
      };
    }
    if (layerSource === "boundary") {
      return {
        ...layer.paint,
        "line-color": "#fbbf24",
        "line-opacity": 0.7,
      };
    }
    return {
      ...layer.paint,
      "line-opacity": 0.88,
    };
  }

  return layer.paint;
}

function prepareLayer(
  layer: LayerSpecification,
  category: SatelliteReferenceCategory,
): SatelliteReferenceLayer {
  return {
    category,
    layer: {
      ...layer,
      id: `${SATELLITE_REFERENCE_LAYER_PREFIX}${layer.id}`,
      source: SATELLITE_REFERENCE_SOURCE_ID,
      paint: satellitePaint(layer),
    } as LayerSpecification,
  };
}

export async function loadSatelliteReferenceOverlay(
  styleUrl: string,
  signal?: AbortSignal,
): Promise<SatelliteReferenceOverlay> {
  const response = await fetch(styleUrl, { signal });
  if (!response.ok) {
    throw new Error(`Reference style request failed with HTTP ${response.status}`);
  }

  const style = (await response.json()) as StyleSpecification;
  const vectorSource = Object.entries(style.sources).find(
    (entry): entry is [string, VectorSourceSpecification] => entry[1].type === "vector",
  );
  if (!vectorSource) {
    throw new Error("Reference style has no vector source");
  }

  const [sourceId, source] = vectorSource;
  const layers = style.layers.flatMap((layer) => {
    const category = referenceCategory(layer, sourceId);
    return category ? [prepareLayer(layer, category)] : [];
  });
  if (layers.length === 0) {
    throw new Error("Reference style has no supported map-detail layers");
  }

  return {
    source,
    glyphs: style.glyphs,
    sprite: style.sprite,
    layers,
  };
}

export function setSatelliteReferenceVisibility(
  map: Pick<MapLibreMap, "getLayer" | "setLayoutProperty">,
  layers: readonly SatelliteReferenceLayer[],
  visibility: SatelliteReferenceVisibility,
): void {
  for (const { category, layer } of layers) {
    const layerId = layer.id;
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(
        layerId,
        "visibility",
        visibility[category] ? "visible" : "none",
      );
    }
  }
}
