#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const DEFAULT_API_URL = "http://127.0.0.1:8000";
const DEFAULT_REGION_NAME = "Boulder Demo";
const DEFAULT_POWER_LINE_PATH =
  "apps/geolibre-desktop/public/plugins/digital-twin-demo/assets/testpowerlines.geojson";
const DEFAULT_TREE_PATH =
  "apps/geolibre-desktop/public/plugins/digital-twin-demo/assets/testtrees.geojson";
const DEFAULT_PADDING_DEGREES = 0.001;
const DEFAULT_CONCURRENCY = 12;

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

export function assetCandidates(powerLineGeoJson, treeGeoJson) {
  const powerLines = featureCollection(powerLineGeoJson, "Power-line GeoJSON");
  const trees = featureCollection(treeGeoJson, "Tree GeoJSON");

  const lineCandidates = powerLines.features.map((feature, index) => {
    if (feature?.geometry?.type !== "LineString") {
      throw new Error(`Power-line feature ${index + 1} must use LineString geometry.`);
    }
    const coordinates = geometryCoordinates(feature.geometry, `Power-line feature ${index + 1}`);
    const name =
      optionalString(feature.properties?.name) ??
      optionalString(feature.properties?.network) ??
      (powerLines.features.length === 1 ? "Boulder demo power line" : `Boulder demo line ${index + 1}`);
    return {
      kind: "power_line",
      coordinates: coordinates.map(([lon, lat]) => ({ lon, lat })),
      name,
    };
  });

  const treeCandidates = trees.features.map((feature, index) => {
    if (feature?.geometry?.type !== "Point") {
      throw new Error(`Tree feature ${index + 1} must use Point geometry.`);
    }
    const [[lon, lat]] = geometryCoordinates(feature.geometry, `Tree feature ${index + 1}`);
    const candidate = { kind: "tree", location: { lon, lat } };
    const species = optionalString(feature.properties?.species);
    const height = Number(feature.properties?.height_m);
    if (species) candidate.species = species;
    if (Number.isFinite(height) && height > 0) candidate.height_m = height;
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

export async function seedBoulderRegion({
  baseUrl = DEFAULT_API_URL,
  powerLineGeoJson,
  treeGeoJson,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  name = DEFAULT_REGION_NAME,
  paddingDegrees = DEFAULT_PADDING_DEGREES,
  concurrency = DEFAULT_CONCURRENCY,
  onProgress = () => {},
}) {
  if (typeof fetchImpl !== "function") throw new Error("This environment cannot make HTTP requests.");
  const workerCount = Math.floor(finiteNumber(concurrency, "Concurrency"));
  if (workerCount < 1) throw new Error("Concurrency must be at least one.");
  const apiBase = normalizedBaseUrl(baseUrl);
  const candidates = assetCandidates(powerLineGeoJson, treeGeoJson);
  const bounds = boundsForGeoJson([powerLineGeoJson, treeGeoJson], paddingDegrees);

  const draft = await apiRequest(fetchImpl, `${apiBase}/api/v1/regions`, { name, bounds });
  const regionId =
    isRecord(draft) && typeof draft.region_id === "string" ? draft.region_id.trim() : "";
  if (!regionId) throw new Error("Engine did not return a region ID.");
  onProgress({ phase: "region", regionId, completed: 0, total: candidates.length });

  let completed = 0;
  await postWithConcurrency(candidates, workerCount, async (candidate) => {
    await apiRequest(
      fetchImpl,
      `${apiBase}/api/v1/regions/${encodeURIComponent(regionId)}/assets`,
      candidate,
    );
    completed += 1;
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
  --trees <path>        Tree GeoJSON (default: ${DEFAULT_TREE_PATH})
  --concurrency <n>     Concurrent asset requests (default: ${DEFAULT_CONCURRENCY})`);
    return;
  }
  const apiUrl = argumentValue(args, "--api-url", DEFAULT_API_URL);
  const name = argumentValue(args, "--name", DEFAULT_REGION_NAME);
  const powerLinePath = argumentValue(args, "--power-lines", DEFAULT_POWER_LINE_PATH);
  const treePath = argumentValue(args, "--trees", DEFAULT_TREE_PATH);
  const concurrency = argumentValue(args, "--concurrency", String(DEFAULT_CONCURRENCY));
  const [powerLineGeoJson, treeGeoJson] = await Promise.all([
    readGeoJson(powerLinePath),
    readGeoJson(treePath),
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
