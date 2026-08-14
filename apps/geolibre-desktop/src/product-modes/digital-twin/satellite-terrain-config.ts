import {
  SATELLITE_REFERENCE_LAYER_PREFIX,
  SATELLITE_REFERENCE_SOURCE_ID,
  type SatelliteReferenceOverlay,
  type SatelliteTerrainInitialView,
  type SatelliteTerrainMapProps,
} from "@geolibre/map";
import { DEFAULT_DIGITAL_TWIN_MAP_DISPLAY_SETTINGS } from "@geolibre/ui";
import type { ExpressionSpecification } from "maplibre-gl";
import { DIGITAL_TWIN_REFERENCE_LABEL_ANCHOR_LAYER_ID } from "./digital-twin-map-ids";

const REFERENCE_NAME: ExpressionSpecification = [
  "coalesce",
  ["get", "name_en"],
  ["get", "name"],
];

/** Mapbox Streets v8 layers for the Digital Twin operational reference stack. */
const DIGITAL_TWIN_REFERENCE_LAYER_STACK = {
  layers: [
    {
      category: "water",
      layer: {
        id: `${SATELLITE_REFERENCE_LAYER_PREFIX}water`,
        type: "fill",
        source: SATELLITE_REFERENCE_SOURCE_ID,
        "source-layer": "water",
        paint: {
          "fill-color": "#38bdf8",
          "fill-opacity": 0.15,
          "fill-outline-color": "rgba(186, 230, 253, 0.72)",
        },
      },
    },
    {
      category: "water",
      layer: {
        id: `${SATELLITE_REFERENCE_LAYER_PREFIX}waterways`,
        type: "line",
        source: SATELLITE_REFERENCE_SOURCE_ID,
        "source-layer": "waterway",
        minzoom: 8,
        paint: {
          "line-color": "#7dd3fc",
          "line-opacity": 0.85,
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 18, 3],
        },
      },
    },
    {
      category: "parks",
      layer: {
        id: `${SATELLITE_REFERENCE_LAYER_PREFIX}parks`,
        type: "fill",
        source: SATELLITE_REFERENCE_SOURCE_ID,
        "source-layer": "landuse",
        minzoom: 4,
        filter: ["==", ["get", "class"], "park"],
        paint: {
          "fill-color": "#4ade80",
          "fill-opacity": 0.08,
          "fill-outline-color": "rgba(134, 239, 172, 0.55)",
        },
      },
    },
    {
      category: "boundaries",
      layer: {
        id: `${SATELLITE_REFERENCE_LAYER_PREFIX}boundaries`,
        type: "line",
        source: SATELLITE_REFERENCE_SOURCE_ID,
        "source-layer": "admin",
        filter: ["match", ["get", "worldview"], ["all", "US"], true, false],
        paint: {
          "line-color": "rgba(254, 240, 138, 0.82)",
          "line-dasharray": [3, 2],
          "line-width": 1,
        },
      },
    },
    {
      category: "buildings",
      layer: {
        id: `${SATELLITE_REFERENCE_LAYER_PREFIX}buildings`,
        type: "fill",
        source: SATELLITE_REFERENCE_SOURCE_ID,
        "source-layer": "building",
        minzoom: 14,
        paint: {
          "fill-color": "#f8fafc",
          "fill-opacity": 0.1,
          "fill-outline-color": "rgba(248, 250, 252, 0.52)",
        },
      },
    },
    {
      category: "buildings",
      layer: {
        id: `${SATELLITE_REFERENCE_LAYER_PREFIX}buildings-3d`,
        type: "fill-extrusion",
        source: SATELLITE_REFERENCE_SOURCE_ID,
        "source-layer": "building",
        minzoom: 15,
        paint: {
          "fill-extrusion-color": "#f8fafc",
          "fill-extrusion-height": ["coalesce", ["get", "height"], 3],
          "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
          "fill-extrusion-opacity": 0.16,
        },
      },
    },
    {
      category: "roads",
      layer: {
        id: `${SATELLITE_REFERENCE_LAYER_PREFIX}road-major-casing`,
        type: "line",
        source: SATELLITE_REFERENCE_SOURCE_ID,
        "source-layer": "road",
        filter: [
          "all",
          [
            "match",
            ["get", "class"],
            ["motorway", "trunk", "primary"],
            true,
            false,
          ],
        ],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#e9ac77",
          "line-opacity": 0.88,
          "line-width": [
            "interpolate",
            ["exponential", 1.2],
            ["zoom"],
            5,
            0.4,
            6,
            0.7,
            7,
            1.75,
            20,
            22,
          ],
        },
      },
    },
    {
      category: "roads",
      layer: {
        id: `${SATELLITE_REFERENCE_LAYER_PREFIX}road-motorway`,
        type: "line",
        source: SATELLITE_REFERENCE_SOURCE_ID,
        "source-layer": "road",
        filter: ["all", ["==", ["get", "class"], "motorway"]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            "hsl(26,87%,62%)",
            6,
            "#fc8",
          ],
          "line-opacity": 0.88,
          "line-width": [
            "interpolate",
            ["exponential", 1.2],
            ["zoom"],
            5,
            0,
            7,
            1,
            20,
            18,
          ],
        },
      },
    },
    {
      category: "roads",
      layer: {
        id: `${SATELLITE_REFERENCE_LAYER_PREFIX}road-trunk-primary`,
        type: "line",
        source: SATELLITE_REFERENCE_SOURCE_ID,
        "source-layer": "road",
        filter: [
          "all",
          ["match", ["get", "class"], ["primary", "trunk"], true, false],
        ],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#fea",
          "line-opacity": 0.88,
          "line-width": [
            "interpolate",
            ["exponential", 1.2],
            ["zoom"],
            5,
            0,
            7,
            1,
            20,
            18,
          ],
        },
      },
    },
    {
      category: "roads",
      layer: {
        id: `${SATELLITE_REFERENCE_LAYER_PREFIX}road-secondary-casing`,
        type: "line",
        source: SATELLITE_REFERENCE_SOURCE_ID,
        "source-layer": "road",
        filter: [
          "all",
          ["match", ["get", "class"], ["secondary", "tertiary"], true, false],
        ],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#e9ac77",
          "line-opacity": 0.88,
          "line-width": [
            "interpolate",
            ["exponential", 1.2],
            ["zoom"],
            8,
            1.5,
            20,
            17,
          ],
        },
      },
    },
    {
      category: "roads",
      layer: {
        id: `${SATELLITE_REFERENCE_LAYER_PREFIX}road-secondary`,
        type: "line",
        source: SATELLITE_REFERENCE_SOURCE_ID,
        "source-layer": "road",
        filter: [
          "all",
          ["match", ["get", "class"], ["secondary", "tertiary"], true, false],
        ],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#fea",
          "line-opacity": 0.88,
          "line-width": [
            "interpolate",
            ["exponential", 1.2],
            ["zoom"],
            6.5,
            0,
            8,
            0.5,
            20,
            13,
          ],
        },
      },
    },
    {
      category: "roads",
      layer: {
        id: `${SATELLITE_REFERENCE_LAYER_PREFIX}road-minor-casing`,
        type: "line",
        source: SATELLITE_REFERENCE_SOURCE_ID,
        "source-layer": "road",
        filter: [
          "all",
          ["match", ["get", "class"], ["street", "street_limited"], true, false],
        ],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#cfcdca",
          "line-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            12,
            0,
            12.5,
            0.88,
          ],
          "line-width": [
            "interpolate",
            ["exponential", 1.2],
            ["zoom"],
            12,
            0.5,
            13,
            1,
            14,
            4,
            20,
            20,
          ],
        },
      },
    },
    {
      category: "roads",
      layer: {
        id: `${SATELLITE_REFERENCE_LAYER_PREFIX}road-minor`,
        type: "line",
        source: SATELLITE_REFERENCE_SOURCE_ID,
        "source-layer": "road",
        filter: [
          "all",
          ["match", ["get", "class"], ["street", "street_limited"], true, false],
        ],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#fff",
          "line-opacity": 0.88,
          "line-width": [
            "interpolate",
            ["exponential", 1.2],
            ["zoom"],
            13.5,
            0,
            14,
            2.5,
            20,
            18,
          ],
        },
      },
    },
    {
      category: "roads",
      layer: {
        id: `${SATELLITE_REFERENCE_LAYER_PREFIX}road-service-casing`,
        type: "line",
        source: SATELLITE_REFERENCE_SOURCE_ID,
        "source-layer": "road",
        filter: [
          "all",
          ["match", ["get", "class"], ["service", "track"], true, false],
        ],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#cfcdca",
          "line-opacity": 0.88,
          "line-width": [
            "interpolate",
            ["exponential", 1.2],
            ["zoom"],
            15,
            1,
            16,
            4,
            20,
            11,
          ],
        },
      },
    },
    {
      category: "roads",
      layer: {
        id: `${SATELLITE_REFERENCE_LAYER_PREFIX}road-service`,
        type: "line",
        source: SATELLITE_REFERENCE_SOURCE_ID,
        "source-layer": "road",
        filter: [
          "all",
          ["match", ["get", "class"], ["service", "track"], true, false],
        ],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#fff",
          "line-opacity": 0.88,
          "line-width": [
            "interpolate",
            ["exponential", 1.2],
            ["zoom"],
            15.5,
            0,
            16,
            2,
            20,
            7.5,
          ],
        },
      },
    },
    {
      category: "roads",
      layer: {
        id: `${SATELLITE_REFERENCE_LAYER_PREFIX}road-path`,
        type: "line",
        source: SATELLITE_REFERENCE_SOURCE_ID,
        "source-layer": "road",
        minzoom: 14,
        filter: [
          "all",
          ["match", ["get", "class"], ["path", "pedestrian"], true, false],
        ],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "hsl(0,0%,100%)",
          "line-dasharray": [1, 0.7],
          "line-opacity": 0.88,
          "line-width": [
            "interpolate",
            ["exponential", 1.2],
            ["zoom"],
            14,
            1,
            20,
            10,
          ],
        },
      },
    },
    {
      category: "roadLabels",
      layer: {
        id: DIGITAL_TWIN_REFERENCE_LABEL_ANCHOR_LAYER_ID,
        type: "symbol",
        source: SATELLITE_REFERENCE_SOURCE_ID,
        "source-layer": "road",
        minzoom: 11,
        layout: {
          "symbol-placement": "line",
          "text-field": REFERENCE_NAME,
          "text-font": ["Open Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 11, 11, 18, 14],
        },
        paint: {
          "text-color": "#f8fafc",
          "text-halo-color": "rgba(15, 23, 42, 0.96)",
          "text-halo-width": 1.5,
          "text-halo-blur": 0.35,
        },
      },
    },
    {
      category: "roadLabels",
      layer: {
        id: `${SATELLITE_REFERENCE_LAYER_PREFIX}road-shields`,
        type: "symbol",
        source: SATELLITE_REFERENCE_SOURCE_ID,
        "source-layer": "road",
        minzoom: 8,
        filter: ["has", "ref"],
        layout: {
          "symbol-placement": "line-center",
          "text-field": ["get", "ref"],
          "text-font": ["Open Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 8, 9, 18, 12],
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#fef3c7",
          "text-halo-color": "rgba(15, 23, 42, 0.98)",
          "text-halo-width": 2.25,
          "text-halo-blur": 0.25,
        },
      },
    },
    {
      category: "placeLabels",
      layer: {
        id: `${SATELLITE_REFERENCE_LAYER_PREFIX}place-labels`,
        type: "symbol",
        source: SATELLITE_REFERENCE_SOURCE_ID,
        "source-layer": "place_label",
        filter: ["match", ["get", "worldview"], ["all", "US"], true, false],
        layout: {
          "text-field": REFERENCE_NAME,
          "text-font": ["Open Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 5, 12, 14, 18],
          "text-offset": [0, 0.7],
          "text-variable-anchor": ["top", "bottom", "left", "right"],
        },
        paint: {
          "text-color": "#f8fafc",
          "text-halo-color": "rgba(15, 23, 42, 0.98)",
          "text-halo-width": 2,
          "text-halo-blur": 0.4,
        },
      },
    },
    {
      category: "poiLabels",
      layer: {
        id: `${SATELLITE_REFERENCE_LAYER_PREFIX}poi-labels`,
        type: "symbol",
        source: SATELLITE_REFERENCE_SOURCE_ID,
        "source-layer": "poi_label",
        minzoom: 14,
        filter: ["has", "name"],
        layout: {
          "text-field": REFERENCE_NAME,
          "text-font": ["Open Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 14, 10, 18, 12],
          "text-offset": [0, 0.65],
          "text-variable-anchor": ["top", "bottom", "left", "right"],
          "text-optional": true,
        },
        paint: {
          "text-color": "#f8fafc",
          "text-halo-color": "rgba(15, 23, 42, 0.98)",
          "text-halo-width": 1.5,
          "text-halo-blur": 0.35,
        },
      },
    },
    {
      category: "waterLabels",
      layer: {
        id: `${SATELLITE_REFERENCE_LAYER_PREFIX}water-labels`,
        type: "symbol",
        source: SATELLITE_REFERENCE_SOURCE_ID,
        "source-layer": "natural_label",
        filter: [
          "all",
          ["has", "name"],
          [
            "match",
            ["get", "class"],
            [
              "bay",
              "canal",
              "ocean",
              "reservoir",
              "river",
              "sea",
              "stream",
              "water",
              "water_feature",
              "wetland",
            ],
            true,
            false,
          ],
          ["match", ["get", "worldview"], ["all", "US"], true, false],
        ],
        layout: {
          "symbol-placement": "point",
          "text-field": REFERENCE_NAME,
          "text-font": ["Open Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 7, 11, 18, 14],
          "text-letter-spacing": 0.08,
          "text-max-width": 9,
        },
        paint: {
          "text-color": "#bae6fd",
          "text-halo-color": "rgba(15, 23, 42, 0.98)",
          "text-halo-width": 1.5,
          "text-halo-blur": 0.35,
        },
      },
    },
  ],
} satisfies Pick<SatelliteReferenceOverlay, "layers">;

/**
 * Builds the sprite-free reference overlay with runtime-authenticated Mapbox
 * Streets TileJSON and glyph endpoints.
 */
function createDigitalTwinReferenceOverlay(
  streetsTileJsonUrl: string,
  mapboxGlyphsUrl: string
): SatelliteReferenceOverlay {
  return {
    source: {
      type: "vector",
      url: streetsTileJsonUrl,
    },
    glyphs: mapboxGlyphsUrl,
    layers: DIGITAL_TWIN_REFERENCE_LAYER_STACK.layers,
  };
}

export const DIGITAL_TWIN_INITIAL_VIEW = {
  center: [-105.2211, 39.7555],
  zoom: 17.2,
  pitch: 60,
  bearing: -18,
} satisfies SatelliteTerrainInitialView;

/** Builds the map foundation around one provider-managed imagery pyramid. */
export function createDigitalTwinSatelliteTerrainConfig(
  satelliteTileUrlTemplate: string,
  streetsTileJsonUrl: string,
  mapboxGlyphsUrl: string
): SatelliteTerrainMapProps {
  return {
    satelliteSource: {
      tiles: [satelliteTileUrlTemplate],
      tileSize: 256,
      maxzoom: 22,
    },
    referenceOverlay: createDigitalTwinReferenceOverlay(
      streetsTileJsonUrl,
      mapboxGlyphsUrl
    ),
    referenceOverlayVisibility: DEFAULT_DIGITAL_TWIN_MAP_DISPLAY_SETTINGS,
    terrainSource: {
      url: "https://tiles.mapterhorn.com/tilejson.json",
    },
    initialView: DIGITAL_TWIN_INITIAL_VIEW,
    terrainExaggeration: 1,
    ariaLabel: "Colorado Front Range satellite terrain map",
  };
}
