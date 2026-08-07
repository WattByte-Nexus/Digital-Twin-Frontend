import type { SatelliteTerrainMapProps } from "@geolibre/map";
import { DEFAULT_DIGITAL_TWIN_MAP_DISPLAY_SETTINGS } from "@geolibre/ui";

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
const DRAPP_2022_IMAGE_URL =
  `/__geolibre_raster_proxy?url=${encodeURIComponent(DRAPP_2022_UPSTREAM_IMAGE_URL)}`.replaceAll(
    "%7Bbbox-epsg-3857%7D",
    "{bbox-epsg-3857}",
  );
const DRAPP_2022_ATTRIBUTION =
  '<a href="https://drcog-data.sanborn.com/arcgis/rest/services/DRCOG_2022/DRCOG_Mosaics_2022/ImageServer" target="_blank" rel="noreferrer">DRCOG / Sanborn — DRAPP 2022</a>';
const DRAPP_2022_BOUNDS: [number, number, number, number] = [
  -105.939624, 39.104426, -103.668018, 40.321386,
];

export const DIGITAL_TWIN_SATELLITE_TERRAIN_CONFIG = {
  satelliteFallbackSource: {
    tiles: [USGS_IMAGERY_TILE_URL],
    tileSize: 256,
    minzoom: 0,
    // Keep this deliberately coarse: MapLibre overzooms a small set of cached
    // tiles beneath DRAPP instead of requesting a second dense imagery pyramid.
    maxzoom: 8,
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
  referenceOverlayStyleUrl: "https://tiles.openfreemap.org/styles/liberty",
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
