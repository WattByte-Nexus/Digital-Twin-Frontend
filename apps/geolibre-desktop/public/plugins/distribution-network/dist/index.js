const PLUGIN_ID = "distribution-network";
const PANEL_ID = "distribution-network-assets";
const MENU_ID = "distribution-network-menu";
const CONDUCTOR_HEIGHT_METERS = 8.2;
const CONDUCTOR_OFFSETS_METERS = [-1.5, 1.5];
export const PICKING_RADIUS_PIXELS = 8;
export const CONDUCTOR_HIT_WIDTH_PIXELS = 18;
export const CONDUCTOR_HIT_TARGET_PARAMETERS = Object.freeze({
  depthWriteEnabled: false,
});
export const TREE_DEFAULT_SCALE = 1;
export const BUNDLED_POLE_MODEL_PATH = "assets/13.8kv_power_pole.glb";
export const BUNDLED_POLE_GEOJSON_PATH = "assets/testpowerlines.geojson";
export const BUNDLED_TREE_MODEL_PATHS = "abcdefghij".split("").map(
  (family) => `assets/realistic_tree_billboards/realistic_tree_${family}.glb`,
);
export const BUNDLED_TREE_MODEL_PATH = BUNDLED_TREE_MODEL_PATHS[0];
export const BUNDLED_TREE_GEOJSON_PATH = "assets/testtrees.geojson";
export const BOULDER_TREE_SERVICE_URL =
  "https://gis.bouldercolorado.gov/ags_svr2/rest/services/parks/TreesOpenData/MapServer/0/query";
export const BOULDER_TREE_PAGE_SIZE = 2000;
export const BOULDER_TREE_MAX_FEATURES = Number.POSITIVE_INFINITY;
export const TREE_COLLISION_ESTIMATOR_VERSION = "usfs-itree-crown-width-v1";
export const TREE_COLLISION_SAFETY_FACTOR = 1.2;
export const TREE_POSITION_BUFFER_METERS = 0.5;

const FEET_TO_METERS = 0.3048;
const CROWN_WIDTH_MODELS = {
  // USDA i-Tree Appendix 13 genus models. Inputs are DBH inches; outputs are feet.
  acer: { min: 1, max: 39, type: "quadratic", b0: 6.3661, b1: 2.102, b2: -0.0267 },
  betula: { min: 1, max: 30, type: "linear", b0: 6.2408, b1: 1.5854 },
  fraxinus: { min: 1, max: 32, type: "quadratic", b0: 4.5348, b1: 2.3021, b2: -0.0356 },
  gleditsia: { min: 1.3, max: 46.2, type: "log", b0: 1.3613, b1: 11.2361 },
  juniperus: { min: 1, max: 23.4, type: "quadratic", b0: 2.3613, b1: 1.764, b2: -0.0299 },
  malus: { min: 1, max: 29, type: "power", b0: 1.9915, b1: 0.4699 },
  picea: { min: 1, max: 27.1, type: "quadratic", b0: 2.8875, b1: 1.4568, b2: -0.0125 },
  pinus: { min: 1, max: 62.7, type: "power", b0: 1.3312, b1: 0.6651 },
  populus: { min: 1, max: 41.8, type: "linear", b0: 2.4739, b1: 1.5565 },
  prunus: { min: 1, max: 30, type: "quadratic", b0: 5.9632, b1: 1.9593, b2: -0.0327 },
  quercus: { min: 1, max: 67, type: "quadratic", b0: 5.6153, b1: 1.9184, b2: -0.0148 },
  salix: { min: 1, max: 41.3, type: "power", b0: 1.6602, b1: 0.5908 },
  tilia: { min: 1, max: 40, type: "quadratic", b0: 4.8669, b1: 1.7481, b2: -0.0148 },
  ulmus: { min: 1, max: 38, type: "quadratic", b0: 5.66, b1: 1.9969, b2: -0.0177 },
};

const BOULDER_TREE_FIELDS = [
  "OBJECTID",
  "FACILITYID",
  "COMMONNAME",
  "LATINNAME",
  "GENUS",
  "LEAFCYCLE",
  "LEAFTYPE",
  "DBHINT",
  "LOCTYPE",
  "OWNEDBY",
  "MAINTBY",
  "CONFIDENCE",
];
const BOULDER_TREE_SOURCE_NAME = "City of Boulder public tree inventory";

let overlay = null;
let deck = null;
let currentApp = null;
let previousProjection = null;
let unregisterPanel = null;
let unregisterMenu = null;
let nextDatasetId = 1;
let datasets = [];
let bundledTreeDatasets = [];
let bundledTreeCount = 0;
let latestTreeGeojson = null;
let assetPopup = null;
const objectUrls = new Set();

function validCoordinate(coordinate) {
  const longitude = Number(coordinate?.[0]);
  const latitude = Number(coordinate?.[1]);
  return Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    Math.abs(longitude) <= 180 &&
    Math.abs(latitude) <= 90
    ? [longitude, latitude]
    : null;
}

function lineCoordinates(geojson) {
  const features = geojson?.type === "FeatureCollection" ? geojson.features : [];
  for (const feature of features) {
    if (feature?.geometry?.type === "LineString" && feature.geometry.coordinates.length >= 2) {
      return feature.geometry.coordinates;
    }
    if (feature?.geometry?.type === "MultiLineString") {
      const coordinates = feature.geometry.coordinates.find((line) => line.length >= 2);
      if (coordinates) return coordinates;
    }
  }
  return [];
}

function collectGeometryCoordinates(geometry, coordinates) {
  if (!geometry) return;
  if (geometry.type === "GeometryCollection") {
    for (const child of geometry.geometries ?? []) collectGeometryCoordinates(child, coordinates);
    return;
  }

  const add = (coordinate) => {
    const valid = validCoordinate(coordinate);
    if (valid) coordinates.push(valid);
  };

  if (geometry.type === "Point") add(geometry.coordinates);
  else if (geometry.type === "MultiPoint" || geometry.type === "LineString") {
    geometry.coordinates.forEach(add);
  } else if (geometry.type === "MultiLineString" || geometry.type === "Polygon") {
    geometry.coordinates.forEach((line) => line.forEach(add));
  } else if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach((polygon) => polygon.forEach((ring) => ring.forEach(add)));
  }
}

export function placementCoordinates(geojson) {
  return treePlacements(geojson).map((placement) => placement.position);
}

export function treePlacements(geojson) {
  const placements = [];
  const features = geojson?.type === "FeatureCollection" ? geojson.features : [];
  for (const feature of features) {
    const coordinates = [];
    collectGeometryCoordinates(feature?.geometry, coordinates);
    for (const position of coordinates) {
      placements.push({
        featureId: feature?.id ?? null,
        position,
        properties:
          feature?.properties && typeof feature.properties === "object"
            ? { ...feature.properties }
            : {},
      });
    }
  }

  const seen = new Set();
  return placements.filter((placement) => {
    const key = placement.position.join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stableTreeHash(value) {
  const text = String(value ?? "tree");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function treeModelIndex(properties = {}, fallbackIndex = 0, modelCount = 10) {
  if (modelCount <= 1) return 0;
  const species = [
    properties.COMMONNAME,
    properties.LATINNAME,
    properties.GENUS,
    properties.common_name,
    properties.latin_name,
    properties.species,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const identity =
    properties.FACILITYID ?? properties.tree_id ?? properties.id ?? `${species}-${fallbackIndex}`;
  const choose = (indices) => indices[stableTreeHash(identity) % indices.length] % modelCount;

  if (/dead|snag|stump|winter/.test(species)) return choose([8, 9]);
  if (/birch|betula|aspen|populus tremuloides/.test(species)) return choose([6, 7]);
  if (/pine|pinus|spruce|picea|fir|abies|cedar|juniper|conifer/.test(species)) {
    return choose([0, 1, 2]);
  }
  return choose([3, 4, 5, 6, 7]);
}

export function treeRenderDimensions(properties = {}) {
  const reportedHeight = Number(properties.height_m ?? properties.height);
  const dbhInches = Number(properties.DBHINT ?? properties.dbh_in ?? properties.dbh);
  const heightMeters = Number.isFinite(reportedHeight) && reportedHeight > 0
    ? Math.min(35, Math.max(3, reportedHeight))
    : Number.isFinite(dbhInches) && dbhInches > 0
      ? Math.min(28, Math.max(5, 6 + dbhInches * 0.35))
      : 12;
  const reportedCanopy = Number(
    properties.canopy_diameter_m ?? properties.canopy_m ?? properties.crown_diameter_m,
  );
  const canopyMeters = Number.isFinite(reportedCanopy) && reportedCanopy > 0
    ? Math.min(24, Math.max(2, reportedCanopy))
    : Math.min(18, Math.max(3, heightMeters * 0.55));
  return { heightMeters, canopyMeters };
}

function treeGenus(properties = {}) {
  return String(
    properties.GENUS ??
      properties.genus ??
      String(properties.LATINNAME ?? properties.latin_name ?? "").trim().split(/\s+/)[0] ??
      "",
  )
    .trim()
    .toLowerCase();
}

function evaluateCrownWidthModel(model, dbhInches) {
  if (model.type === "power") return Math.exp(model.b0 + Math.log(dbhInches) * model.b1);
  if (model.type === "log") return model.b0 + Math.log(dbhInches) * model.b1;
  if (model.type === "quadratic") {
    return model.b0 + dbhInches * model.b1 + dbhInches ** 2 * model.b2;
  }
  return model.b0 + dbhInches * model.b1;
}

function roundedMeters(value) {
  return Math.round(value * 1000) / 1000;
}

/**
 * Estimate the engine's 2D, axis-aligned tree envelope around an inventory point.
 * This is deliberately an estimated canopy footprint, not measured 3D geometry.
 */
export function estimateTreeCollisionEnvelope(properties = {}, options = {}) {
  const safetyFactor = Number.isFinite(Number(options.safetyFactor))
    ? Math.max(1, Number(options.safetyFactor))
    : TREE_COLLISION_SAFETY_FACTOR;
  const positionBufferMeters = Number.isFinite(Number(options.positionBufferMeters))
    ? Math.max(0, Number(options.positionBufferMeters))
    : TREE_POSITION_BUFFER_METERS;
  const explicitCanopy = Number(
    properties.canopy_diameter_m ?? properties.canopy_m ?? properties.crown_diameter_m,
  );
  const dbhInches = Number(properties.DBHINT ?? properties.dbh_in ?? properties.dbh);
  const genus = treeGenus(properties);
  const model = CROWN_WIDTH_MODELS[genus];
  let canopyDiameterMeters;
  let method;
  let confidence;
  let modelDbhInches = null;

  if (Number.isFinite(explicitCanopy) && explicitCanopy > 0) {
    canopyDiameterMeters = explicitCanopy;
    method = "reported_canopy_diameter";
    confidence = "reported";
  } else if (Number.isFinite(dbhInches) && dbhInches > 0 && model) {
    modelDbhInches = Math.min(model.max, Math.max(model.min, dbhInches));
    canopyDiameterMeters = evaluateCrownWidthModel(model, modelDbhInches) * FEET_TO_METERS;
    method = `usfs_itree_genus_${genus}`;
    confidence = modelDbhInches === dbhInches ? "modeled" : "modeled_extrapolation_clamped";
  } else {
    canopyDiameterMeters = treeRenderDimensions(properties).canopyMeters;
    method = Number.isFinite(dbhInches) && dbhInches > 0
      ? "generic_dbh_fallback"
      : "generic_mature_tree_fallback";
    confidence = "low";
  }

  canopyDiameterMeters = Math.min(30, Math.max(2, canopyDiameterMeters));
  const collisionHalfExtentMeters = canopyDiameterMeters * 0.5 * safetyFactor + positionBufferMeters;
  const halfExtent = roundedMeters(collisionHalfExtentMeters);
  return {
    collisionBox: {
      min_x_m: -halfExtent,
      max_x_m: halfExtent,
      min_y_m: -halfExtent,
      max_y_m: halfExtent,
    },
    canopyDiameterMeters: roundedMeters(canopyDiameterMeters),
    collisionHalfExtentMeters: halfExtent,
    estimatedHeightMeters: roundedMeters(treeRenderDimensions(properties).heightMeters),
    method,
    confidence,
    genus: genus || null,
    dbhInches: Number.isFinite(dbhInches) && dbhInches > 0 ? dbhInches : null,
    modelDbhInches,
    safetyFactor,
    positionBufferMeters,
    estimatorVersion: TREE_COLLISION_ESTIMATOR_VERSION,
  };
}

function treeClassification(properties = {}) {
  const value =
    properties.LATINNAME ??
    properties.latin_name ??
    properties.COMMONNAME ??
    properties.common_name ??
    properties.GENUS ??
    properties.genus ??
    "unknown_tree";
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") ||
    "unknown_tree";
}

/** Convert point GeoJSON into the Digital Twin Engine's TreeAssetSnapshot JSON contract. */
export function buildEngineTreeAssetSnapshot(geojson, options = {}) {
  const regionId = String(options.regionId ?? "boulder-co").trim();
  const assetVersion = String(options.assetVersion ?? "boulder-public-trees-v1").trim();
  const crs = String(options.crs ?? "EPSG:26913").trim();
  if (!regionId || !assetVersion || !crs) {
    throw new Error("Engine tree exports require a region ID, asset version, and projected CRS.");
  }

  const usedIds = new Map();
  const assets = treePlacements(geojson).map(({ featureId, position, properties }, index) => {
    const baseId = String(
      properties.FACILITYID ?? properties.tree_id ?? properties.OBJECTID ?? featureId ?? `tree-${index + 1}`,
    ).trim() || `tree-${index + 1}`;
    const occurrence = (usedIds.get(baseId) ?? 0) + 1;
    usedIds.set(baseId, occurrence);
    const treeId = occurrence === 1 ? baseId : `${baseId}-${occurrence}`;
    const estimate = estimateTreeCollisionEnvelope(properties, options);
    const [lon, lat] = position;
    return {
      tree_id: treeId,
      region_id: regionId,
      location: { lat, lon },
      collision_box: estimate.collisionBox,
      classification: treeClassification(properties),
      source_ref: `boulder-tree-inventory://${encodeURIComponent(baseId)}`,
      metadata: {
        geometry_source: "estimated",
        geometry_semantics: "buffered_axis_aligned_canopy_envelope",
        estimator_version: estimate.estimatorVersion,
        estimation_method: estimate.method,
        estimation_confidence: estimate.confidence,
        dbh_in: estimate.dbhInches,
        model_dbh_in: estimate.modelDbhInches,
        estimated_height_m: estimate.estimatedHeightMeters,
        estimated_canopy_diameter_m: estimate.canopyDiameterMeters,
        collision_half_extent_m: estimate.collisionHalfExtentMeters,
        safety_factor: estimate.safetyFactor,
        position_buffer_m: estimate.positionBufferMeters,
        inventory_confidence: properties.CONFIDENCE ?? properties.confidence ?? null,
        source_properties: { ...properties },
      },
    };
  });

  return { region_id: regionId, asset_version: assetVersion, crs, assets };
}

export function treePointsByModel(geojson, modelNames) {
  const placements = treePlacements(geojson);
  const names = modelNames.length ? modelNames : ["tree.glb"];
  const pointsByModel = names.map(() => []);
  const sourceName = geojson?.metadata?.source ?? null;

  placements.forEach(({ featureId, position, properties }, index) => {
    const [longitude, latitude] = position;
    const dbhInches = Number(properties.DBHINT ?? properties.dbh_in ?? properties.dbh);
    const reportedHeight = Number(properties.height_m ?? properties.height);
    const { heightMeters, canopyMeters } = treeRenderDimensions(properties);
    const modelIndex = treeModelIndex(properties, index, names.length);
    pointsByModel[modelIndex].push({
      id:
        properties.FACILITYID ??
        properties.tree_id ??
        properties.id ??
        featureId ??
        `tree-${index + 1}`,
      kind: "tree",
      modelName: names[modelIndex],
      sourceName: sourceName ?? properties.source ?? null,
      commonName: properties.COMMONNAME ?? properties.common_name ?? properties.species ?? null,
      latinName: properties.LATINNAME ?? properties.latin_name ?? null,
      dbhInches: Number.isFinite(dbhInches) && dbhInches > 0 ? dbhInches : null,
      heightMeters: Number.isFinite(reportedHeight) && reportedHeight > 0 ? reportedHeight : null,
      renderedHeightMeters: heightMeters,
      canopyMeters,
      modelScale: [canopyMeters, heightMeters, canopyMeters],
      locationType: properties.LOCTYPE ?? properties.location_type ?? null,
      properties,
      position: [longitude, latitude, 0],
    });
  });

  return pointsByModel;
}

function normalizedBounds(bounds) {
  if (!Array.isArray(bounds) || bounds.length !== 4) {
    throw new Error("A west, south, east, north map extent is required.");
  }
  const values = bounds.map(Number);
  const [west, south, east, north] = values;
  if (
    values.some((value) => !Number.isFinite(value)) ||
    west < -180 ||
    east > 180 ||
    south < -90 ||
    north > 90 ||
    west >= east ||
    south >= north
  ) {
    throw new Error("The map extent is not a valid WGS84 bounding box.");
  }
  return values;
}

export function buildBoulderTreeQueryUrl(
  bounds,
  resultOffset = 0,
  resultRecordCount = BOULDER_TREE_PAGE_SIZE,
) {
  const queryBounds = normalizedBounds(bounds);
  const parameters = new URLSearchParams({
    where: "1=1",
    geometry: queryBounds.join(","),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: BOULDER_TREE_FIELDS.join(","),
    returnGeometry: "true",
    outSR: "4326",
    orderByFields: "OBJECTID ASC",
    resultOffset: String(Math.max(0, Math.floor(Number(resultOffset) || 0))),
    resultRecordCount: String(
      Math.max(1, Math.min(BOULDER_TREE_PAGE_SIZE, Math.floor(Number(resultRecordCount) || 1))),
    ),
    f: "geojson",
  });
  return `${BOULDER_TREE_SERVICE_URL}?${parameters}`;
}

export async function fetchBoulderTreeGeoJson(
  bounds,
  fetchImpl = globalThis.fetch,
  options = {},
) {
  if (typeof fetchImpl !== "function") {
    throw new Error("This environment cannot request the Boulder tree inventory.");
  }
  const queryBounds = normalizedBounds(bounds);
  const pageSize = Math.max(
    1,
    Math.min(BOULDER_TREE_PAGE_SIZE, Math.floor(Number(options.pageSize) || BOULDER_TREE_PAGE_SIZE)),
  );
  const requestedMaxFeatures = Number(options.maxFeatures);
  const maxFeatures = Number.isFinite(requestedMaxFeatures) && requestedMaxFeatures > 0
    ? Math.max(1, Math.floor(requestedMaxFeatures))
    : BOULDER_TREE_MAX_FEATURES;
  const features = [];
  let resultOffset = 0;
  let truncated = false;

  while (features.length < maxFeatures) {
    const remaining = maxFeatures - features.length;
    const recordCount = Math.min(pageSize, remaining);
    const response = await fetchImpl(
      buildBoulderTreeQueryUrl(queryBounds, resultOffset, recordCount),
    );
    if (!response?.ok) {
      throw new Error(
        `Could not load the Boulder tree inventory (HTTP ${response?.status ?? "unknown"}).`,
      );
    }
    const page = await response.json();
    if (page?.error) {
      throw new Error(page.error.message || "The Boulder tree service rejected the query.");
    }
    if (page?.type !== "FeatureCollection" || !Array.isArray(page.features)) {
      throw new Error("The Boulder tree service returned an unexpected response.");
    }

    features.push(...page.features.slice(0, remaining));
    const exceededTransferLimit = Boolean(
      page.exceededTransferLimit || page.properties?.exceededTransferLimit,
    );
    if (page.features.length === 0) break;
    resultOffset += page.features.length;
    if (!exceededTransferLimit && page.features.length < recordCount) break;
    if (Number.isFinite(maxFeatures) && features.length >= maxFeatures) {
      truncated = exceededTransferLimit || page.features.length >= recordCount;
      break;
    }
  }

  return {
    type: "FeatureCollection",
    features,
    metadata: {
      source: BOULDER_TREE_SOURCE_NAME,
      serviceUrl: BOULDER_TREE_SERVICE_URL,
      license: "CC0 1.0",
      queryBounds,
      truncated,
    },
  };
}

function offsetPath(coordinates, offsetMeters, height) {
  const averageLatitude =
    coordinates.reduce((sum, coordinate) => sum + coordinate[1], 0) / coordinates.length;
  const metersPerLongitude = Math.max(
    Math.abs(111_320 * Math.cos((averageLatitude * Math.PI) / 180)),
    1,
  );
  const metersPerLatitude = 110_540;

  return coordinates.map(([longitude, latitude], index) => {
    const previous = coordinates[Math.max(0, index - 1)];
    const next = coordinates[Math.min(coordinates.length - 1, index + 1)];
    const dx = (next[0] - previous[0]) * metersPerLongitude;
    const dy = (next[1] - previous[1]) * metersPerLatitude;
    const length = Math.hypot(dx, dy) || 1;
    const normalX = -dy / length;
    const normalY = dx / length;
    return [
      longitude + (normalX * offsetMeters) / metersPerLongitude,
      latitude + (normalY * offsetMeters) / metersPerLatitude,
      height,
    ];
  });
}

function lineBearing(coordinates, index) {
  const previous = coordinates[Math.max(0, index - 1)];
  const next = coordinates[Math.min(coordinates.length - 1, index + 1)];
  const averageLatitude = (previous[1] + next[1]) / 2;
  const metersPerLongitude = Math.max(
    Math.abs(111_320 * Math.cos((averageLatitude * Math.PI) / 180)),
    1,
  );
  const dx = (next[0] - previous[0]) * metersPerLongitude;
  const dy = (next[1] - previous[1]) * 110_540;
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

function pathLengthMeters(path) {
  const earthRadiusMeters = 6_371_008.8;
  let length = 0;
  for (let index = 1; index < path.length; index += 1) {
    const [previousLongitude, previousLatitude] = path[index - 1];
    const [longitude, latitude] = path[index];
    const latitudeDelta = ((latitude - previousLatitude) * Math.PI) / 180;
    const longitudeDelta = ((longitude - previousLongitude) * Math.PI) / 180;
    const previousLatitudeRadians = (previousLatitude * Math.PI) / 180;
    const latitudeRadians = (latitude * Math.PI) / 180;
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(previousLatitudeRadians) *
        Math.cos(latitudeRadians) *
        Math.sin(longitudeDelta / 2) ** 2;
    length += 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(haversine)));
  }
  return length;
}

function formatLength(lengthMeters) {
  return lengthMeters >= 1000
    ? `${(lengthMeters / 1000).toFixed(2)} km`
    : `${Math.round(lengthMeters)} m`;
}

export function pickedFeatureDetails(object) {
  if (object?.kind === "pole") {
    return {
      title: "Distribution pole",
      rows: [{ label: "Pole ID", value: object.id }],
    };
  }
  if (object?.kind === "conductor") {
    return {
      title: "Distribution line",
      rows: [
        { label: "Line ID", value: object.id },
        { label: "Length", value: formatLength(object.lengthMeters) },
      ],
    };
  }
  if (object?.kind === "tree") {
    return {
      title: "Tree",
      rows: [
        { label: "Tree ID", value: object.id },
        ...(object.commonName ? [{ label: "Species", value: object.commonName }] : []),
        ...(object.latinName
          ? [{ label: "Scientific name", value: object.latinName }]
          : []),
        ...(Number.isFinite(object.dbhInches)
          ? [{ label: "DBH", value: `${object.dbhInches} in` }]
          : []),
        ...(Number.isFinite(object.heightMeters)
          ? [{ label: "Height", value: `${object.heightMeters} m` }]
          : []),
        ...(object.locationType ? [{ label: "Location", value: object.locationType }] : []),
        ...(object.sourceName ? [{ label: "Source", value: object.sourceName }] : []),
        ...(object.modelName ? [{ label: "Model", value: object.modelName }] : []),
      ],
    };
  }
  return null;
}

export function buildNetwork(geojson, height = CONDUCTOR_HEIGHT_METERS, maxCoordinates = 3) {
  const sourceCoordinates = lineCoordinates(geojson);
  const coordinates = (sourceCoordinates.length >= 2 ? sourceCoordinates : placementCoordinates(geojson))
    .slice(0, maxCoordinates)
    .map(validCoordinate)
    .filter(Boolean);

  if (coordinates.length < 2) {
    throw new Error("The pole GeoJSON needs a line with at least two valid coordinates.");
  }

  return {
    poles: coordinates.map(([longitude, latitude], index) => {
      const bearing = lineBearing(coordinates, index);
      return {
        id: `pole-${index + 1}`,
        kind: "pole",
        position: [longitude, latitude, 0],
        bearing,
        // This GLB's crossarm lies on its local Z axis after it is stood upright.
        modelYaw: (90 - bearing + 360) % 360,
      };
    }),
    conductors: CONDUCTOR_OFFSETS_METERS.flatMap((offset, sideIndex) => {
      const side = sideIndex === 0 ? "left" : "right";
      const path = offsetPath(coordinates, offset, height);
      return path.slice(0, -1).map((start, spanIndex) => {
        const spanPath = [start, path[spanIndex + 1]];
        return {
          id: `line-${spanIndex + 1}-${side}`,
          kind: "conductor",
          path: spanPath,
          lengthMeters: pathLengthMeters(spanPath),
        };
      });
    }),
    bounds: coordinates.reduce(
      ([west, south, east, north], [longitude, latitude]) => [
        Math.min(west, longitude),
        Math.min(south, latitude),
        Math.max(east, longitude),
        Math.max(north, latitude),
      ],
      [Infinity, Infinity, -Infinity, -Infinity],
    ),
  };
}

function boundsForCoordinates(coordinates) {
  return coordinates.reduce(
    ([west, south, east, north], [longitude, latitude]) => [
      Math.min(west, longitude),
      Math.min(south, latitude),
      Math.max(east, longitude),
      Math.max(north, latitude),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
}

function assetUrl(app, relativePath) {
  return (
    app.resolvePluginAssetUrl?.(PLUGIN_ID, relativePath) ??
    new URL(`plugins/${PLUGIN_ID}/${relativePath}`, document.baseURI).href
  );
}

function popupCoordinate(object, pickedCoordinate) {
  const coordinate = validCoordinate(object?.position) ?? validCoordinate(pickedCoordinate);
  if (coordinate) return coordinate;
  if (object?.path?.length) {
    return validCoordinate(object.path[Math.floor(object.path.length / 2)]);
  }
  return null;
}

function featureAsGeoJson(object) {
  const geometry = object?.path
    ? { type: "LineString", coordinates: object.path.map((coordinate) => coordinate.slice(0, 2)) }
    : { type: "Point", coordinates: object.position.slice(0, 2) };
  return {
    type: "Feature",
    properties: {
      ...(object.properties ?? {}),
      id: object.id,
      assetType: object.kind,
      ...(object.sourceName ? { source: object.sourceName } : {}),
      ...(Number.isFinite(object.bearing) ? { bearing: object.bearing } : {}),
      ...(Number.isFinite(object.lengthMeters) ? { lengthMeters: object.lengthMeters } : {}),
    },
    geometry,
  };
}

function createPopupAction(iconText, label, onSelect) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "distribution-network-popup-action";
  const icon = document.createElement("span");
  icon.className = "distribution-network-popup-action-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = iconText;
  const text = document.createElement("span");
  text.textContent = label;
  button.append(icon, text);
  button.addEventListener("click", onSelect);
  return button;
}

function showAssetPopup(object, coordinate) {
  const details = pickedFeatureDetails(object);
  const map = currentApp?.getMap?.();
  if (!details || !map || !coordinate) return false;
  assetPopup?.();
  assetPopup = null;

  const element = document.createElement("section");
  element.className = "distribution-network-popup-content";

  const coordinateBar = document.createElement("div");
  coordinateBar.className = "distribution-network-popup-coordinate";
  const pin = document.createElement("span");
  pin.setAttribute("aria-hidden", "true");
  pin.textContent = "⌖";
  const coordinateText = document.createElement("code");
  coordinateText.textContent = `${coordinate[1].toFixed(6)}, ${coordinate[0].toFixed(6)}`;
  coordinateBar.append(pin, coordinateText);

  const info = document.createElement("div");
  info.className = "distribution-network-popup-info";
  const title = document.createElement("h3");
  title.textContent = details.title;
  const rows = document.createElement("dl");
  for (const row of details.rows) {
    const term = document.createElement("dt");
    term.textContent = row.label;
    const value = document.createElement("dd");
    value.textContent = row.value;
    rows.append(term, value);
  }
  info.append(title, rows);

  const quickActions = document.createElement("div");
  quickActions.className = "distribution-network-popup-actions";
  const actionsLabel = document.createElement("p");
  actionsLabel.textContent = "Quick actions";
  quickActions.append(
    actionsLabel,
    createPopupAction("▤", "Open asset loader", () => currentApp?.openRightPanel?.(PANEL_ID)),
    createPopupAction("{}", "Copy as GeoJSON", (event) => {
      const button = event.currentTarget;
      const writeText = navigator.clipboard?.writeText?.bind(navigator.clipboard);
      if (!writeText) {
        button.lastElementChild.textContent = "Clipboard unavailable";
        return;
      }
      void writeText(JSON.stringify(featureAsGeoJson(object), null, 2))
        .then(() => {
          button.lastElementChild.textContent = "Copied GeoJSON";
        })
        .catch(() => {
          button.lastElementChild.textContent = "Could not copy";
        });
    }),
    createPopupAction("◎", "Center map here", () => {
      map.easeTo({ center: coordinate, duration: 350 });
    }),
    createPopupAction("＋", "Zoom to asset", () => {
      map.easeTo({ center: coordinate, zoom: Math.max(map.getZoom(), 18), duration: 450 });
    }),
  );

  element.append(coordinateBar, info, quickActions);
  assetPopup =
    currentApp?.openMapPopup?.({
      coordinates: coordinate,
      content: element,
      className: "distribution-network-asset-popup",
      closeOnClick: false,
      maxWidth: "300px",
    }) ?? null;
  if (!assetPopup) {
    currentApp?.openRightPanel?.(PANEL_ID);
  }
  return true;
}

function selectFeature(object, pickedCoordinate) {
  const details = pickedFeatureDetails(object);
  if (!details) return false;
  return showAssetPopup(object, popupCoordinate(object, pickedCoordinate));
}

export function scenegraphSizingProps(sizeScale) {
  return {
    sizeScale,
    sizeMinPixels: 0,
    sizeMaxPixels: Number.MAX_SAFE_INTEGER,
  };
}

function modelLayer(dataset) {
  return new deck.meshLayers.ScenegraphLayer({
    id: `${PLUGIN_ID}-${dataset.id}-models`,
    data: dataset.points,
    scenegraph: dataset.modelUrl,
    _lighting: "pbr",
    ...scenegraphSizingProps(dataset.sizeScale),
    getPosition: (point) => point.position,
    getOrientation: (point) => [0, point.modelYaw ?? 0, 90],
    getScale: (point) => point.modelScale ?? [1, 1, 1],
    pickable: true,
    autoHighlight: true,
    highlightColor: [37, 99, 235, 180],
    onClick: ({ object, coordinate }) => selectFeature(object, coordinate),
  });
}

function renderLayers() {
  if (!overlay || !deck) return;
  const layers = [];
  for (const dataset of datasets) {
    if (dataset.conductors?.length) {
      layers.push(
        new deck.layers.PathLayer({
          id: `${PLUGIN_ID}-${dataset.id}-conductor-hit-targets`,
          data: dataset.conductors,
          getPath: (conductor) => conductor.path,
          getColor: [0, 0, 0, 0],
          getWidth: CONDUCTOR_HIT_WIDTH_PIXELS,
          widthUnits: "pixels",
          parameters: CONDUCTOR_HIT_TARGET_PARAMETERS,
          pickable: true,
          onClick: ({ object, coordinate }) => selectFeature(object, coordinate),
        }),
        new deck.layers.PathLayer({
          id: `${PLUGIN_ID}-${dataset.id}-conductors`,
          data: dataset.conductors,
          getPath: (conductor) => conductor.path,
          getColor: [15, 15, 15, 255],
          getWidth: 2,
          widthUnits: "pixels",
          widthMinPixels: 1,
          capRounded: true,
          jointRounded: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: [37, 99, 235, 180],
          onClick: ({ object, coordinate }) => selectFeature(object, coordinate),
        }),
      );
    }
    layers.push(modelLayer(dataset));
  }
  overlay.setProps({ layers });
}

function fitDataset(bounds) {
  const map = currentApp?.getMap?.();
  map?.fitBounds(
    [
      [bounds[0], bounds[1]],
      [bounds[2], bounds[3]],
    ],
    { padding: 100, duration: 0 },
  );
  map?.easeTo({ bearing: -12, pitch: 62, duration: 0 });
}

function rememberObjectUrl(file) {
  const url = URL.createObjectURL(file);
  objectUrls.add(url);
  return url;
}

async function readGeoJson(file) {
  const parsed = JSON.parse(await file.text());
  if (parsed?.type !== "FeatureCollection") {
    throw new Error("Choose a GeoJSON FeatureCollection.");
  }
  return parsed;
}

async function bundledAssetFile(relativePath) {
  const response = await fetch(assetUrl(currentApp, relativePath));
  if (!response.ok) {
    throw new Error(`Could not load bundled asset ${relativePath} (HTTP ${response.status}).`);
  }
  const blob = await response.blob();
  const name = decodeURIComponent(relativePath.split("/").pop() ?? "asset");
  return new File([blob], name, { type: blob.type });
}

function currentMapBounds() {
  const bounds = currentApp?.getMap?.()?.getBounds?.();
  if (!bounds) throw new Error("The current map extent is unavailable.");
  return normalizedBounds([
    bounds.getWest(),
    bounds.getSouth(),
    bounds.getEast(),
    bounds.getNorth(),
  ]);
}

function geoJsonFile(data, name) {
  return new File([JSON.stringify(data)], name, { type: "application/geo+json" });
}

async function addPoleDataset(modelFile, geojsonFile, sizeScale) {
  const geojson = await readGeoJson(geojsonFile);
  const network = buildNetwork(geojson, CONDUCTOR_HEIGHT_METERS, Infinity);
  const modelUrl = rememberObjectUrl(modelFile);
  datasets.push({
    id: `poles-${nextDatasetId++}`,
    kind: "poles",
    modelUrl,
    points: network.poles,
    conductors: network.conductors,
    sizeScale,
  });
  renderLayers();
  fitDataset(network.bounds);
  return `Added ${network.poles.length} aligned poles and ${network.conductors.length} selectable line spans.`;
}

function treeDatasetsForModels(geojson, models, sizeScale, options = {}) {
  const pointsByModel = treePointsByModel(
    geojson,
    models.map((model) => model.name),
  );
  const groupId = options.groupId ?? `trees-${nextDatasetId++}`;
  return models.flatMap((model, modelIndex) => {
    const points = pointsByModel[modelIndex];
    return points.length
      ? [{
          id: `${groupId}-${modelIndex + 1}`,
          treeGroupId: groupId,
          kind: "trees",
          bundled: Boolean(options.bundled),
          modelUrl: model.url,
          points,
          sizeScale,
        }]
      : [];
  });
}

async function addTreeDataset(modelFileOrFiles, geojsonFile, sizeScale) {
  const geojson = await readGeoJson(geojsonFile);
  const placements = treePlacements(geojson);
  if (placements.length === 0) {
    const sourceName = geojson.metadata?.source;
    throw new Error(
      sourceName
        ? `No trees from ${sourceName} were found in the current map view.`
        : "The tree GeoJSON has no valid coordinates.",
    );
  }
  const modelFiles = Array.isArray(modelFileOrFiles) ? modelFileOrFiles : [modelFileOrFiles];
  const models = modelFiles.map((modelFile) => ({
    name: modelFile.name,
    url: rememberObjectUrl(modelFile),
  }));
  const sourceName = geojson.metadata?.source ?? null;
  latestTreeGeojson = geojson;
  const treeDatasets = treeDatasetsForModels(geojson, models, sizeScale);
  const replacedTreeUrls = datasets
    .filter((dataset) => dataset.kind === "trees" && !dataset.bundled)
    .map((dataset) => dataset.modelUrl);
  datasets = replaceImportedTreeDatasets(datasets, treeDatasets);
  for (const url of new Set(replacedTreeUrls)) {
    if (objectUrls.delete(url)) URL.revokeObjectURL(url);
  }
  renderLayers();
  fitDataset(boundsForCoordinates(placements.map((placement) => placement.position)));
  const truncatedMessage = geojson.metadata?.truncated
    ? ` Showing the first ${placements.length.toLocaleString()} trees for performance.`
    : "";
  return sourceName
    ? `Loaded ${placements.length.toLocaleString()} trees from ${sourceName} using ${models.length} realistic model${models.length === 1 ? "" : "s"}.${truncatedMessage}`
    : `Loaded ${placements.length.toLocaleString()} trees using ${models.length} realistic model${models.length === 1 ? "" : "s"}.`;
}

export function replaceImportedTreeDatasets(currentDatasets, replacement) {
  const replacements = Array.isArray(replacement) ? replacement : [replacement];
  return [
    ...currentDatasets.filter((dataset) => dataset.kind !== "trees"),
    ...replacements,
  ];
}

function clearImportedDatasets() {
  const importedUrls = datasets.filter((dataset) => !dataset.bundled).map((dataset) => dataset.modelUrl);
  datasets = [
    ...datasets.filter((dataset) => dataset.bundled && dataset.kind !== "trees"),
    ...bundledTreeDatasets,
  ];
  for (const url of new Set(importedUrls)) {
    if (objectUrls.delete(url)) URL.revokeObjectURL(url);
  }
  renderLayers();
}

function createFileField(labelText, accept, fileType, defaultPath, defaultLabel) {
  const label = document.createElement("label");
  label.className = "distribution-network-field";
  const text = document.createElement("span");
  text.className = "distribution-network-field-label";
  text.textContent = labelText;

  const picker = document.createElement("span");
  picker.className = "distribution-network-file-picker";
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.setAttribute("aria-label", labelText);

  const icon = document.createElement("span");
  icon.className = "distribution-network-file-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "↑";
  const details = document.createElement("span");
  details.className = "distribution-network-file-details";
  const filename = document.createElement("span");
  filename.className = "distribution-network-file-name";
  const defaultFileName = defaultLabel ?? (defaultPath ? defaultPath.split("/").pop() : null);
  filename.textContent = defaultFileName ?? "No file selected";
  const hint = document.createElement("span");
  hint.className = "distribution-network-file-hint";
  hint.textContent = defaultFileName ? `Bundled default · ${fileType}` : fileType;
  details.append(filename, hint);
  const browse = document.createElement("span");
  browse.className = "distribution-network-file-action";
  browse.textContent = "Browse";

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    filename.textContent = file?.name ?? defaultFileName ?? "No file selected";
    picker.dataset.selected = file || defaultFileName ? "true" : "false";
  });

  picker.dataset.selected = defaultFileName ? "true" : "false";

  picker.append(input, icon, details, browse);
  label.append(text, picker);
  return { label, input };
}

function createSelectField(labelText, choices, defaultValue) {
  const label = document.createElement("label");
  label.className = "distribution-network-field";
  const text = document.createElement("span");
  text.className = "distribution-network-field-label";
  text.textContent = labelText;
  const select = document.createElement("select");
  select.className = "distribution-network-select";
  select.setAttribute("aria-label", labelText);
  for (const choice of choices) {
    const option = document.createElement("option");
    option.value = choice.value;
    option.textContent = choice.label;
    select.append(option);
  }
  select.value = defaultValue;
  label.append(text, select);
  return { label, input: select };
}

function createScaleField(defaultValue) {
  const label = document.createElement("label");
  label.className = "distribution-network-field distribution-network-scale";
  const text = document.createElement("span");
  text.className = "distribution-network-field-label";
  text.textContent = "Model scale";
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0.01";
  input.step = "0.1";
  input.value = String(defaultValue);
  label.append(text, input);
  return { label, input };
}

function createImporterSection(options, status) {
  const section = document.createElement("section");
  section.className = "distribution-network-section";
  const headingGroup = document.createElement("div");
  headingGroup.className = "distribution-network-section-heading";
  const kicker = document.createElement("span");
  kicker.className = "distribution-network-kicker";
  kicker.textContent = options.kicker;
  const heading = document.createElement("h3");
  heading.textContent = options.title;
  headingGroup.append(kicker, heading);
  const description = document.createElement("p");
  description.textContent = options.description;
  const model = createFileField(
    options.modelLabel,
    ".glb,model/gltf-binary",
    "GLB model · max size depends on your browser",
    options.defaultModelPath,
    options.defaultModelLabel,
  );
  const geojson = createFileField(
    options.geojsonLabel,
    ".geojson,.json,application/geo+json,application/json",
    "GeoJSON or JSON FeatureCollection",
    options.defaultGeojsonPath,
  );
  const locationSource = options.locationSources
    ? createSelectField(
        options.locationSourceLabel ?? "Location source",
        options.locationSources,
        options.defaultLocationSource ?? options.locationSources[0].value,
      )
    : null;
  const scale = createScaleField(options.defaultScale ?? 1);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "distribution-network-primary";
  button.textContent = options.buttonLabel;
  const selectedLocationSource = () => locationSource?.input.value ?? "default";
  const updateLocationSource = () => {
    if (locationSource) {
      geojson.label.hidden = selectedLocationSource() !== "file";
    }
  };
  const updateReadyState = () => {
    const hasModel = Boolean(
      model.input.files?.[0] || options.defaultModelPath || options.defaultModelPaths?.length,
    );
    const source = selectedLocationSource();
    const hasGeojson =
      source === "boulder" ||
      (source === "file"
        ? Boolean(geojson.input.files?.[0])
        : Boolean(geojson.input.files?.[0] || options.defaultGeojsonPath));
    button.disabled = !(hasModel && hasGeojson);
  };
  model.input.addEventListener("change", updateReadyState);
  geojson.input.addEventListener("change", () => {
    if (locationSource && geojson.input.files?.[0]) locationSource.input.value = "file";
    updateLocationSource();
    updateReadyState();
  });
  locationSource?.input.addEventListener("change", () => {
    updateLocationSource();
    updateReadyState();
  });
  updateLocationSource();
  updateReadyState();
  button.addEventListener("click", () => {
    const selectedModelFile = model.input.files?.[0];
    const selectedGeojsonFile = geojson.input.files?.[0];
    const source = selectedLocationSource();
    const defaultModelPaths =
      options.defaultModelPaths ?? (options.defaultModelPath ? [options.defaultModelPath] : []);
    if ((!selectedModelFile && defaultModelPaths.length === 0) ||
        (source === "file" && !selectedGeojsonFile) ||
        (source !== "file" && source !== "boulder" &&
          !selectedGeojsonFile && !options.defaultGeojsonPath)) {
      status.textContent = "Choose both a GLB model and a GeoJSON file first.";
      status.dataset.state = "error";
      return;
    }
    const sizeScale = Number(scale.input.value);
    if (!Number.isFinite(sizeScale) || sizeScale <= 0) {
      status.textContent = "Model scale must be greater than zero.";
      status.dataset.state = "error";
      return;
    }
    button.disabled = true;
    status.textContent = "Loading assets…";
    status.dataset.state = "loading";
    const modelFilePromise = selectedModelFile
      ? Promise.resolve(selectedModelFile)
      : defaultModelPaths.length === 1
        ? bundledAssetFile(defaultModelPaths[0])
        : Promise.all(defaultModelPaths.map(bundledAssetFile));
    let geojsonFilePromise;
    if (source === "boulder") {
      geojsonFilePromise = fetchBoulderTreeGeoJson(currentMapBounds()).then((geojsonData) =>
        geoJsonFile(geojsonData, "boulder-public-trees.geojson"),
      );
    } else if (source === "file" || (!locationSource && selectedGeojsonFile)) {
      geojsonFilePromise = Promise.resolve(selectedGeojsonFile);
    } else {
      geojsonFilePromise = bundledAssetFile(options.defaultGeojsonPath);
    }
    void Promise.all([modelFilePromise, geojsonFilePromise])
      .then(([modelFile, geojsonFile]) => options.add(modelFile, geojsonFile, sizeScale))
      .then((message) => {
        status.textContent = message;
        status.dataset.state = "success";
      })
      .catch((error) => {
        status.textContent = error instanceof Error ? error.message : "Could not add assets.";
        status.dataset.state = "error";
      })
      .finally(() => {
        updateReadyState();
      });
  });
  section.append(headingGroup, description);
  if (locationSource) section.append(locationSource.label);
  section.append(model.label, geojson.label, scale.label, button);
  return section;
}

function renderAssetPanel(container) {
  container.classList.add("distribution-network-panel");
  const intro = document.createElement("p");
  intro.className = "distribution-network-intro";
  intro.textContent = "Choose a model and placement data, then add it to the live map.";
  const status = document.createElement("p");
  status.className = "distribution-network-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.dataset.state = "success";
  status.textContent = `${bundledTreeCount.toLocaleString()} bundled trees and the three-pole demo are loaded.`;

  const poles = createImporterSection(
    {
      title: "Distribution poles",
      kicker: "Network assets",
      description: "Line vertices place aligned poles; one conductor follows each side.",
      modelLabel: "Pole model (GLB)",
      geojsonLabel: "Pole line or positions (GeoJSON)",
      buttonLabel: "Add poles and lines",
      defaultModelPath: BUNDLED_POLE_MODEL_PATH,
      defaultGeojsonPath: BUNDLED_POLE_GEOJSON_PATH,
      add: addPoleDataset,
    },
    status,
  );
  const trees = createImporterSection(
    {
      title: "Trees",
      kicker: "Vegetation",
      description:
        "The full bundled inventory is already visible with species-aware realistic models. Replace its locations with uploaded GeoJSON or the live Boulder inventory.",
      locationSourceLabel: "Tree location source",
      locationSources: [
        { value: "bundled", label: "Bundled synthetic trees" },
        { value: "boulder", label: "Boulder public trees · current view" },
        { value: "file", label: "Upload a GeoJSON file" },
      ],
      defaultLocationSource: "bundled",
      modelLabel: "Tree model (GLB)",
      geojsonLabel: "Tree locations (GeoJSON)",
      buttonLabel: "Add trees",
      defaultScale: TREE_DEFAULT_SCALE,
      defaultModelPath: BUNDLED_TREE_MODEL_PATH,
      defaultModelPaths: BUNDLED_TREE_MODEL_PATHS,
      defaultModelLabel: `${BUNDLED_TREE_MODEL_PATHS.length}-model realistic collection`,
      defaultGeojsonPath: BUNDLED_TREE_GEOJSON_PATH,
      add: addTreeDataset,
    },
    status,
  );
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "distribution-network-secondary";
  clear.textContent = "Clear imported assets";
  clear.addEventListener("click", () => {
    clearImportedDatasets();
    status.textContent = "Imported assets cleared; bundled demo retained.";
    status.dataset.state = "success";
  });

  const exportHeading = document.createElement("h3");
  exportHeading.textContent = "Digital Twin Engine";
  const exportDescription = document.createElement("p");
  exportDescription.textContent =
    "Export the active tree locations as engine Tree Assets with conservative estimated canopy collision envelopes.";
  const region = document.createElement("input");
  region.type = "text";
  region.value = "boulder-co";
  region.setAttribute("aria-label", "Engine region ID");
  region.placeholder = "Engine region ID";
  const exportButton = document.createElement("button");
  exportButton.type = "button";
  exportButton.className = "distribution-network-secondary";
  exportButton.textContent = "Export engine tree assets";
  exportButton.addEventListener("click", () => {
    try {
      if (!latestTreeGeojson) throw new Error("Load a tree inventory before exporting it.");
      const snapshot = buildEngineTreeAssetSnapshot(latestTreeGeojson, {
        regionId: region.value,
        assetVersion: `boulder-public-trees-${new Date().toISOString().slice(0, 10)}`,
      });
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${snapshot.asset_version}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      status.textContent = `Exported ${snapshot.assets.length.toLocaleString()} engine Tree Assets.`;
      status.dataset.state = "success";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Could not export tree assets.";
      status.dataset.state = "error";
    }
  });

  container.append(
    intro,
    poles,
    trees,
    exportHeading,
    exportDescription,
    region,
    exportButton,
    clear,
    status,
  );
  return () => container.replaceChildren();
}

function registerAssetUi(app) {
  unregisterPanel = app.registerRightPanel?.({
    id: PANEL_ID,
    title: "Distribution Assets",
    defaultWidth: 380,
    render: renderAssetPanel,
  });
  unregisterMenu = app.registerToolbarMenu?.({
    id: MENU_ID,
    label: "Distribution",
    items: [
      {
        id: "open-assets",
        label: "Open Distribution Assets…",
        onSelect: () => app.openRightPanel?.(PANEL_ID),
      },
      {
        id: "clear-assets",
        label: "Remove imported assets",
        onSelect: clearImportedDatasets,
      },
    ],
  });
  app.openRightPanel?.(PANEL_ID);
}

const plugin = {
  id: PLUGIN_ID,
  name: "Distribution Network Demo",
  version: "0.8.0",

  async activate(app) {
    if (!app.getDeckGL) {
      console.error("[Distribution Network] This GeoLibre host does not provide deck.gl.");
      return false;
    }

    const [poleResponse, treeResponse] = await Promise.all([
      fetch(assetUrl(app, BUNDLED_POLE_GEOJSON_PATH)),
      fetch(assetUrl(app, BUNDLED_TREE_GEOJSON_PATH)),
    ]);
    if (!poleResponse.ok) {
      throw new Error(`Could not load the bundled power-line GeoJSON (HTTP ${poleResponse.status}).`);
    }
    if (!treeResponse.ok) {
      throw new Error(`Could not load the bundled tree GeoJSON (HTTP ${treeResponse.status}).`);
    }

    const network = buildNetwork(await poleResponse.json());
    const treeGeojson = await treeResponse.json();
    latestTreeGeojson = treeGeojson;
    const treePlacementsForView = treePlacements(treeGeojson);
    const treeModels = BUNDLED_TREE_MODEL_PATHS.map((path) => ({
      name: path.split("/").pop(),
      url: assetUrl(app, path),
    }));
    bundledTreeDatasets = treeDatasetsForModels(
      treeGeojson,
      treeModels,
      TREE_DEFAULT_SCALE,
      { bundled: true, groupId: "bundled-trees" },
    );
    bundledTreeCount = treePlacementsForView.length;
    deck = await app.getDeckGL();
    overlay = new deck.mapbox.MapboxOverlay({
      interleaved: true,
      pickingRadius: PICKING_RADIUS_PIXELS,
      layers: [],
    });
    currentApp = app;
    previousProjection = app.getMapProjection?.() ?? null;
    app.setMapProjection?.("mercator");
    if (!app.addMapControl(overlay)) {
      overlay = null;
      deck = null;
      currentApp = null;
      if (previousProjection) app.setMapProjection?.(previousProjection);
      previousProjection = null;
      return false;
    }

    datasets = [
      {
        id: "bundled-poles",
        kind: "poles",
        bundled: true,
        modelUrl: assetUrl(app, BUNDLED_POLE_MODEL_PATH),
        points: network.poles,
        conductors: network.conductors,
        sizeScale: 1,
      },
      ...bundledTreeDatasets,
    ];
    renderLayers();
    registerAssetUi(app);
    fitDataset(boundsForCoordinates(treePlacementsForView.map((placement) => placement.position)));
    return true;
  },

  deactivate(app) {
    assetPopup?.();
    assetPopup = null;
    app.closeRightPanel?.(PANEL_ID);
    unregisterPanel?.();
    unregisterMenu?.();
    unregisterPanel = null;
    unregisterMenu = null;
    if (overlay) app.removeMapControl(overlay);
    overlay = null;
    deck = null;
    currentApp = null;
    datasets = [];
    bundledTreeDatasets = [];
    bundledTreeCount = 0;
    latestTreeGeojson = null;
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls.clear();
    if (previousProjection) app.setMapProjection?.(previousProjection);
    previousProjection = null;
  },
};

export { plugin };
export default plugin;
