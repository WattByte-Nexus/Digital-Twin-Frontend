#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const DEFAULT_API_URL = "http://127.0.0.1:8000";
const DEFAULT_REGION_NAME = "Boulder Demo";
const DEFAULT_POWER_LINE_PATH =
  "apps/geolibre-desktop/public/plugins/digital-twin-demo/assets/boulder_13_8kv_feeder_large.geojson";
const DEFAULT_TREE_SERVICE_URL =
  "https://gis.bouldercolorado.gov/ags_svr2/rest/services/parks/TreesOpenData/MapServer/0";
const DEFAULT_PADDING_DEGREES = 0.001;
const DEFAULT_CONCURRENCY = 12;
const TREE_PAGE_SIZE = 2000;
const ASSET_BATCH_SIZE = 1000;

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value, label) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be a finite number.`);
  return number;
}

function featureCollection(value, label) {
  if (!isRecord(value) || value.type !== "FeatureCollection" || !Array.isArray(value.features)) {
    throw new Error(`${label} must be a GeoJSON FeatureCollection.`);
  }
  return value;
}

function coordinatePair(value, label) {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error(`${label} must contain longitude and latitude.`);
  }
  const lon = finiteNumber(value[0], `${label} longitude`);
  const lat = finiteNumber(value[1], `${label} latitude`);
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    throw new Error(`${label} must be a valid WGS84 coordinate.`);
  }
  return [lon, lat];
}

function geometryCoordinates(geometry, label) {
  if (!isRecord(geometry)) throw new Error(`${label} must include geometry.`);
  if (geometry.type === "Point") return [coordinatePair(geometry.coordinates, label)];
  if (geometry.type === "LineString" && Array.isArray(geometry.coordinates)) {
    if (geometry.coordinates.length < 2) {
      throw new Error(`${label} line must contain at least two coordinates.`);
    }
    return geometry.coordinates.map((coordinate, index) =>
      coordinatePair(coordinate, `${label} coordinate ${index + 1}`),
    );
  }
  throw new Error(`${label} must use Point or LineString geometry.`);
}

function rounded(value) {
  return Math.round(value * 1e12) / 1e12;
}

export function boundsForGeoJson(collections, paddingDegrees = DEFAULT_PADDING_DEGREES) {
  const padding = finiteNumber(paddingDegrees, "Bounds padding");
  if (padding < 0) throw new Error("Bounds padding cannot be negative.");

  const extent = [Infinity, Infinity, -Infinity, -Infinity];
  let coordinateCount = 0;
  collections.forEach((collection, collectionIndex) => {
    featureCollection(collection, `GeoJSON ${collectionIndex + 1}`).features.forEach(
      (feature, featureIndex) => {
        const coordinates = geometryCoordinates(
          feature?.geometry,
          `GeoJSON ${collectionIndex + 1} feature ${featureIndex + 1}`,
        );
        coordinates.forEach(([lon, lat]) => {
          extent[0] = Math.min(extent[0], lon);
          extent[1] = Math.min(extent[1], lat);
          extent[2] = Math.max(extent[2], lon);
          extent[3] = Math.max(extent[3], lat);
          coordinateCount += 1;
        });
      },
    );
  });
  if (coordinateCount === 0) throw new Error("The demo GeoJSON files contain no coordinates.");

  return {
    west: rounded(extent[0] - padding),
    south: rounded(extent[1] - padding),
    east: rounded(extent[2] + padding),
    north: rounded(extent[3] + padding),
  };
}

function optionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isLakeSiteTree(feature) {
  const propertyName = optionalString(feature?.properties?.PROPNAME);
  return propertyName ? /\blake\b/i.test(propertyName) : false;
}

function treeInventoryPageUrl(serviceUrl, offset) {
  const url = new URL(`${serviceUrl.replace(/\/+$/, "")}/query`);
  url.searchParams.set("where", "1=1");
  url.searchParams.set(
    "outFields",
    [
      "OBJECTID",
      "FACILITYID",
      "COMMONNAME",
      "LATINNAME",
      "LEAFCYCLE",
      "DBHINT",
      "PROPNAME",
    ].join(","),
  );
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("returnZ", "false");
  url.searchParams.set("returnM", "false");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("orderByFields", "OBJECTID ASC");
  url.searchParams.set("resultOffset", String(offset));
  url.searchParams.set("resultRecordCount", String(TREE_PAGE_SIZE));
  url.searchParams.set("f", "geojson");
  return url;
}

/**
 * Download the complete City of Boulder public-tree inventory.
 *
 * ArcGIS caps each response at 2,000 records, so every transfer-limited page is
 * followed until the service reports completion. Trees assigned to a property
 * whose name contains the word "lake" are intentionally excluded; street names
 * such as Silver Lake Avenue remain because they are not lake-site properties.
 *
 * @param {object} options Source request options.
 * @param {typeof fetch} options.fetchImpl HTTP implementation.
 * @param {string} [options.serviceUrl] ArcGIS feature-layer URL.
 * @returns {Promise<object>} One GeoJSON FeatureCollection of non-lake public trees.
 * @throws {Error} If a source page cannot be downloaded or is not GeoJSON.
 */
export async function fetchBoulderTreeInventory({
  fetchImpl,
  serviceUrl = DEFAULT_TREE_SERVICE_URL,
}) {
  const features = [];
  for (let offset = 0; ; offset += TREE_PAGE_SIZE) {
    const url = treeInventoryPageUrl(serviceUrl, offset);
    const response = await fetchImpl(url, {
      headers: { Accept: "application/geo+json, application/json" },
      cache: "no-cache",
    });
    let page;
    try {
      page = await response.json();
    } catch {
      throw new Error(`Boulder tree inventory page ${offset / TREE_PAGE_SIZE + 1} was not JSON.`);
    }
    if (!response.ok) {
      const detail =
        isRecord(page) && typeof page.error?.message === "string"
          ? page.error.message
          : `Boulder tree inventory request failed (${response.status}).`;
      throw new Error(detail);
    }
    const collection = featureCollection(
      page,
      `Boulder tree inventory page ${offset / TREE_PAGE_SIZE + 1}`,
    );
    features.push(...collection.features.filter((feature) => !isLakeSiteTree(feature)));
    if (page.exceededTransferLimit !== true) break;
    if (collection.features.length === 0) {
      throw new Error("Boulder tree inventory pagination did not advance.");
    }
  }
  return { type: "FeatureCollection", features };
}

function estimatedTreeDimensions(properties) {
  const diameterInches = Number(properties.DBHINT ?? properties.dbh_in);
  const usableDiameter =
    Number.isFinite(diameterInches) && diameterInches > 0 ? diameterInches : 12;
  const evergreen = (properties.LEAFCYCLE ?? properties.leaf_cycle) === "Evergreen";
  return {
    heightM: Math.min(27, Math.max(5.5, 4.8 + usableDiameter * (evergreen ? 0.42 : 0.36))),
    crownRadiusM: Math.min(
      7.5,
      Math.max(1.8, 1.6 + usableDiameter * (evergreen ? 0.065 : 0.105)),
    ),
  };
}

/**
 * Convert feeder and tree GeoJSON into Digital Twin Engine asset requests.
 *
 * Mixed Boulder feeder collections contribute only individual power-line spans
 * and public-inventory vegetation hazards. Plain fixture collections retain
 * their existing LineString and Point behavior for custom seed inputs.
 *
 * @param {object} powerLineGeoJson GeoJSON FeatureCollection containing feeder geometry.
 * @param {object} treeGeoJson GeoJSON FeatureCollection containing tree locations.
 * @returns {Array<object>} Ordered power-line requests followed by tree requests.
 * @throws {Error} If either collection or a selected feature has invalid geometry.
 */
export function assetCandidates(powerLineGeoJson, treeGeoJson) {
  const powerLines = featureCollection(powerLineGeoJson, "Power-line GeoJSON");
  const trees = featureCollection(treeGeoJson, "Tree GeoJSON");

  const lineFeatures = powerLines.features.filter(
    (feature) => feature?.geometry?.type === "LineString",
  );
  const spanFeatures = lineFeatures.filter(
    (feature) => feature?.properties?.asset_type === "power_line_span",
  );
  const selectedLineFeatures = spanFeatures.length > 0 ? spanFeatures : lineFeatures;
  if (selectedLineFeatures.length === 0) {
    throw new Error("Power-line GeoJSON must contain at least one LineString feature.");
  }
  const lineCandidates = selectedLineFeatures.map((feature, index) => {
    const coordinates = geometryCoordinates(feature.geometry, `Power-line feature ${index + 1}`);
    const name =
      optionalString(feature.properties?.name) ??
      optionalString(feature.properties?.network) ??
      (selectedLineFeatures.length === 1
        ? "Boulder demo power line"
        : `Boulder demo line ${index + 1}`);
    return {
      kind: "power_line",
      coordinates: coordinates.map(([lon, lat]) => ({ lon, lat })),
      name,
    };
  });

  const publicTreeFeatures = trees.features.filter(
    (feature) => feature?.properties?.asset_type === "vegetation_hazard",
  );
  const selectedTreeFeatures =
    publicTreeFeatures.length > 0 ? publicTreeFeatures : trees.features;
  const treeCandidates = selectedTreeFeatures.map((feature, index) => {
    if (feature?.geometry?.type !== "Point") {
      throw new Error(`Tree feature ${index + 1} must use Point geometry.`);
    }
    const [[lon, lat]] = geometryCoordinates(feature.geometry, `Tree feature ${index + 1}`);
    const candidate = { kind: "tree", location: { lon, lat } };
    const species =
      optionalString(feature.properties?.species) ??
      optionalString(feature.properties?.common_name) ??
      optionalString(feature.properties?.COMMONNAME) ??
      optionalString(feature.properties?.latin_name) ??
      optionalString(feature.properties?.LATINNAME);
    const dimensions = estimatedTreeDimensions(feature.properties ?? {});
    const height = Number(
      feature.properties?.height_m ??
        feature.properties?.estimated_height_m ??
        dimensions.heightM,
    );
    const canopyRadius = Number(
      feature.properties?.canopy_radius_m ??
        feature.properties?.estimated_crown_radius_m ??
        dimensions.crownRadiusM,
    );
    const sourceRef =
      optionalString(feature.properties?.source_ref) ??
      optionalString(feature.properties?.source_facility_id) ??
      optionalString(feature.properties?.FACILITYID) ??
      (feature.properties?.OBJECTID == null
        ? undefined
        : `boulder-tree-object:${feature.properties.OBJECTID}`);
    if (species) candidate.species = species;
    if (Number.isFinite(height) && height > 0) candidate.height_m = rounded(height);
    if (Number.isFinite(canopyRadius) && canopyRadius > 0) {
      candidate.canopy_radius_m = rounded(canopyRadius);
    }
    if (sourceRef) candidate.source_ref = sourceRef;
    return candidate;
  });

  return [...lineCandidates, ...treeCandidates];
}

function normalizedBaseUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("API URL must be an absolute HTTP URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("API URL must use HTTP or HTTPS.");
  }
  parsed.hash = "";
  parsed.search = "";
  return parsed.href.replace(/\/+$/, "");
}

async function apiRequest(fetchImpl, url, body) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let result = null;
  try {
    result = await response.json();
  } catch {
    // The status still supplies a useful fallback error below.
  }
  if (!response.ok) {
    const detail =
      isRecord(result) && typeof result.detail === "string"
        ? result.detail
        : `Engine request failed (${response.status}).`;
    throw new Error(detail);
  }
  return result;
}

async function postWithConcurrency(items, concurrency, post) {
  let nextIndex = 0;
  let firstError = null;
  const workerCount = Math.min(concurrency, items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (firstError === null) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      try {
        await post(items[index], index);
      } catch (error) {
        firstError = error;
      }
    }
  });
  await Promise.all(workers);
  if (firstError) throw firstError;
}

/**
 * Create, populate, and publish one calculation-ready Boulder demo region.
 *
 * @param {object} options Seed inputs and runtime dependencies.
 * @param {string} [options.baseUrl] Digital Twin Engine API origin.
 * @param {object} options.powerLineGeoJson Feeder GeoJSON containing line spans.
 * @param {object} [options.treeGeoJson] Optional tree override; omitted downloads public trees.
 * @param {typeof fetch} [options.fetchImpl] HTTP implementation for source and Engine requests.
 * @param {string} [options.name] Public region display name.
 * @param {number} [options.concurrency] Maximum concurrent 1,000-asset batch requests.
 * @param {Function} [options.onProgress] Receives region, asset, and publication progress.
 * @returns {Promise<object>} Published region and total uploaded asset count.
 * @throws {Error} If source access, validation, upload, or publication fails.
 * @sideEffects Creates immutable state through the Engine API.
 */
export async function seedBoulderRegion({
  baseUrl = DEFAULT_API_URL,
  powerLineGeoJson,
  treeGeoJson,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  name = DEFAULT_REGION_NAME,
  concurrency = DEFAULT_CONCURRENCY,
  onProgress = () => {},
}) {
  if (typeof fetchImpl !== "function") throw new Error("This environment cannot make HTTP requests.");
  const workerCount = Math.floor(finiteNumber(concurrency, "Concurrency"));
  if (workerCount < 1) throw new Error("Concurrency must be at least one.");
  const apiBase = normalizedBaseUrl(baseUrl);
  const inventory =
    treeGeoJson ??
    (await fetchBoulderTreeInventory({
      fetchImpl,
    }));
  const candidates = assetCandidates(powerLineGeoJson, inventory);
  const bounds = boundsForGeoJson([powerLineGeoJson, inventory]);

  const draft = await apiRequest(fetchImpl, `${apiBase}/api/v1/regions`, { name, bounds });
  const regionId =
    isRecord(draft) && typeof draft.region_id === "string" ? draft.region_id.trim() : "";
  if (!regionId) throw new Error("Engine did not return a region ID.");
  onProgress({ phase: "region", regionId, completed: 0, total: candidates.length });

  let completed = 0;
  const batches = [];
  for (let index = 0; index < candidates.length; index += ASSET_BATCH_SIZE) {
    batches.push(candidates.slice(index, index + ASSET_BATCH_SIZE));
  }
  await postWithConcurrency(batches, workerCount, async (batch, index) => {
    try {
      await apiRequest(
        fetchImpl,
        `${apiBase}/api/v1/regions/${encodeURIComponent(regionId)}/assets:batch`,
        batch,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Asset batch ${index + 1}/${batches.length} failed: ${detail}`,
        { cause: error },
      );
    }
    completed += batch.length;
    onProgress({ phase: "assets", regionId, completed, total: candidates.length });
  });

  const region = await apiRequest(
    fetchImpl,
    `${apiBase}/api/v1/regions/${encodeURIComponent(regionId)}/publish`,
  );
  onProgress({
    phase: "published",
    regionId,
    completed: candidates.length,
    total: candidates.length,
  });
  return { region, assetCount: candidates.length };
}

function argumentValue(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  if (index === args.length - 1 || args[index + 1].startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return args[index + 1];
}

async function readGeoJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main(args) {
  if (args.includes("--help")) {
    console.log(`Usage: npm run seed:digital-twin:boulder -- [options]

Options:
  --api-url <url>       Engine origin (default: ${DEFAULT_API_URL})
  --name <name>         Region name (default: ${DEFAULT_REGION_NAME})
  --power-lines <path>  Power-line GeoJSON (default: ${DEFAULT_POWER_LINE_PATH})
  --trees <path>        Tree GeoJSON override (default: Boulder public inventory, excluding lake sites)
  --concurrency <n>     Concurrent asset requests (default: ${DEFAULT_CONCURRENCY})`);
    return;
  }
  const apiUrl = argumentValue(args, "--api-url", DEFAULT_API_URL);
  const name = argumentValue(args, "--name", DEFAULT_REGION_NAME);
  const powerLinePath = argumentValue(args, "--power-lines", DEFAULT_POWER_LINE_PATH);
  const treePath = argumentValue(args, "--trees", null);
  const concurrency = argumentValue(args, "--concurrency", String(DEFAULT_CONCURRENCY));
  const [powerLineGeoJson, treeGeoJson] = await Promise.all([
    readGeoJson(powerLinePath),
    treePath ? readGeoJson(treePath) : Promise.resolve(undefined),
  ]);
  const result = await seedBoulderRegion({
    baseUrl: apiUrl,
    name,
    powerLineGeoJson,
    treeGeoJson,
    concurrency,
    onProgress(progress) {
      if (progress.phase === "region") {
        console.log(`Created draft ${progress.regionId}; uploading ${progress.total} assets.`);
      } else if (
        progress.phase === "assets" &&
        (progress.completed % 100 === 0 || progress.completed === progress.total)
      ) {
        console.log(`Uploaded ${progress.completed}/${progress.total} assets.`);
      }
    },
  });
  console.log(
    `Published ${result.region.name ?? name} (${result.region.region_id}) with ${result.assetCount} assets.`,
  );
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
