import {
  SATELLITE_REFERENCE_LAYER_PREFIX,
  SATELLITE_REFERENCE_SOURCE_ID,
  type SatelliteReferenceOverlay,
  type SatelliteTerrainMapProps,
} from "@geolibre/map";
import { DEFAULT_DIGITAL_TWIN_MAP_DISPLAY_SETTINGS } from "@geolibre/ui";
import type { ExpressionSpecification } from "maplibre-gl";

const USGS_IMAGERY_TILE_URL =
  "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}";
const USGS_IMAGERY_ATTRIBUTION =
  '<a href="https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer" target="_blank" rel="noreferrer">USGS The National Map</a>';

const DRAPP_2022_UPSTREAM_IMAGE_URL =
  "https://drcog-data.sanborn.com/arcgis/rest/services/DRCOG_2022/DRCOG_Mosaics_2022/ImageServer/exportImage" +
  "?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=jpgpng&f=image";

// Sanborn currently returns conflicting CORS headers. GeoLibre's existing
// development raster proxy keeps this demo usable; production should point at
// our licensed, versioned tile CDN instead.
const DRAPP_2022_IMAGE_URL = `/__geolibre_raster_proxy?url=${encodeURIComponent(
  DRAPP_2022_UPSTREAM_IMAGE_URL
)}`.replaceAll("%7Bbbox-epsg-3857%7D", "{bbox-epsg-3857}");
const DRAPP_2022_ATTRIBUTION =
  '<a href="https://drcog-data.sanborn.com/arcgis/rest/services/DRCOG_2022/DRCOG_Mosaics_2022/ImageServer" target="_blank" rel="noreferrer">DRCOG / Sanborn — DRAPP 2022</a>';
const DRAPP_2022_BOUNDS: [number, number, number, number] = [
  -105.939624, 39.104426, -103.668018, 40.321386,
];

export const DIGITAL_TWIN_REFERENCE_LABEL_ANCHOR_LAYER_ID = `${SATELLITE_REFERENCE_LAYER_PREFIX}road-labels`;

const REFERENCE_NAME: ExpressionSpecification = [
  "coalesce",
  ["get", "name_en"],
  ["get", "name"],
];

/**
 * A bounded, sprite-free operational reference stack. It is part of the
 * initial MapLibre style so a remote style or icon failure cannot remove road
 * and place context after the world has already mounted.
 *
 * Production deployments can proxy the TileJSON and glyph endpoints through
 * the same origin without changing the layer contract.
 */
const DIGITAL_TWIN_REFERENCE_OVERLAY = {
  source: {
    type: "vector",
    url: "https://tiles.openfreemap.org/planet",
  },
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
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
        "source-layer": "park",
        minzoom: 4,
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
        "source-layer": "boundary",
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
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], 3],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
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
        "source-layer": "transportation",
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
        "source-layer": "transportation",
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
        "source-layer": "transportation",
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
        "source-layer": "transportation",
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
        "source-layer": "transportation",
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
        "source-layer": "transportation",
        filter: ["all", ["==", ["get", "class"], "minor"]],
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
        "source-layer": "transportation",
        filter: ["all", ["==", ["get", "class"], "minor"]],
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
        "source-layer": "transportation",
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
        "source-layer": "transportation",
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
        "source-layer": "transportation",
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
        "source-layer": "transportation_name",
        minzoom: 11,
        layout: {
          "symbol-placement": "line",
          "text-field": REFERENCE_NAME,
          "text-font": ["Noto Sans Regular"],
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
        "source-layer": "transportation_name",
        minzoom: 8,
        filter: ["has", "ref"],
        layout: {
          "symbol-placement": "line-center",
          "text-field": ["get", "ref"],
          "text-font": ["Noto Sans Regular"],
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
        "source-layer": "place",
        layout: {
          "text-field": REFERENCE_NAME,
          "text-font": ["Noto Sans Regular"],
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
        "source-layer": "poi",
        minzoom: 14,
        filter: ["has", "name"],
        layout: {
          "text-field": REFERENCE_NAME,
          "text-font": ["Noto Sans Regular"],
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
        "source-layer": "water_name",
        filter: ["has", "name"],
        layout: {
          "symbol-placement": "point",
          "text-field": REFERENCE_NAME,
          "text-font": ["Noto Sans Regular"],
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
} satisfies SatelliteReferenceOverlay;

export const DIGITAL_TWIN_SATELLITE_TERRAIN_CONFIG = {
  satelliteFallbackSource: {
    tiles: [USGS_IMAGERY_TILE_URL],
    tileSize: 256,
    minzoom: 0,
    // Keep a fast standard-tile pyramid visible while the detailed DRAPP
    // ImageServer export tiles arrive. One zoom of overdraw stays crisp without
    // competing with the primary source at its maximum detail.
    maxzoom: 16,
    attribution: USGS_IMAGERY_ATTRIBUTION,
  },
  satelliteSource: {
    tiles: [DRAPP_2022_IMAGE_URL],
    tileSize: 256,
    minzoom: 8,
    maxzoom: 21,
    bounds: DRAPP_2022_BOUNDS,
    attribution: DRAPP_2022_ATTRIBUTION,
  },
  referenceOverlay: DIGITAL_TWIN_REFERENCE_OVERLAY,
  referenceOverlayVisibility: DEFAULT_DIGITAL_TWIN_MAP_DISPLAY_SETTINGS,
  terrainSource: {
    url: "https://tiles.mapterhorn.com/tilejson.json",
  },
  initialView: {
    center: [-105.2211, 39.7555],
    zoom: 17.2,
    pitch: 60,
    bearing: -18,
  },
  terrainExaggeration: 1,
  ariaLabel: "Colorado Front Range satellite terrain map",
} satisfies SatelliteTerrainMapProps;
