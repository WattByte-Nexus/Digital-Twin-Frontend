const PLUGIN_ID = "digital-twin-demo";
const PLUGIN_NAME = "Digital Twin Demo";
const PLUGIN_VERSION = "0.3.0";
const PANEL_ID = "digital-twin-demo-panel";
const API_STORAGE_KEY = "geolibre.digital-twin-demo.api-url";
const DEFAULT_API_URL = "http://127.0.0.1:8000";
const ASSET_ENTRY_ID = "digital-twin-demo-assets";
const ASSET_SOURCE_ID = "digital-twin-demo-assets-source";
const TREE_LAYER_ID = "digital-twin-demo-tree-points";
export const TREE_CIRCLE_RADIUS_PX = 5;
const POWER_LINE_LAYER_ID = "digital-twin-demo-power-lines";
const POWER_LINE_POLE_LAYER_ID = "digital-twin-demo-power-line-poles";
const POWER_LINE_CONDUCTOR_LAYER_ID = "digital-twin-demo-power-line-conductors";
const POWER_LINE_MODEL_PATH = "assets/13.8kv_power_pole.glb";
// The GLB is 9.375 m tall in its authored coordinate system. A typical 40 ft
// distribution pole has 6 ft embedded, leaving 10.36 m visible above ground.
const POWER_POLE_MODEL_HEIGHT_METERS = 9.375;
const POWER_POLE_HEIGHT_AGL_METERS = 10.36;
const POWER_POLE_MODEL_SCALE = POWER_POLE_HEIGHT_AGL_METERS / POWER_POLE_MODEL_HEIGHT_METERS;
const CONDUCTOR_HEIGHT_METERS = 9.5;
const CONDUCTOR_OFFSETS_METERS = [-1.5, 1.5];
const SELECTION_SOURCE_ID = "digital-twin-demo-selection-source";
const SELECTION_LAYER_ID = "digital-twin-demo-selection-points";
const REGION_SOURCE_ID = "digital-twin-demo-region-bounds-source";
const REGION_FILL_LAYER_ID = "digital-twin-demo-region-bounds-fill";
const REGION_LINE_LAYER_ID = "digital-twin-demo-region-bounds-line";
const WILDFIRE_ENTRY_ID = "digital-twin-demo-wildfire";
const WILDFIRE_SOURCE_ID = "digital-twin-demo-wildfire-source";
const WILDFIRE_FILL_LAYER_ID = "digital-twin-demo-wildfire-fill";
const WILDFIRE_LINE_LAYER_ID = "digital-twin-demo-wildfire-line";
const TERMINAL_RUN_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELLED"]);
const RUN_PROGRESS_EVENT_NAMES = [
  "run_snapshot",
  "stream_reset",
  "run_started",
  "tick_completed",
  "cancel_requested",
  "run_cancelled",
  "run_completed",
  "run_failed",
];
const WEATHER_REFRESH_INTERVAL_MS = 30_000;

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value, label) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be a finite number.`);
  return number;
}

function nonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function asPageItems(value) {
  if (!isRecord(value) || !Array.isArray(value.items)) return [];
  return value.items;
}

function weatherDatasetTimestamp(dataset) {
  for (const value of [dataset?.version, dataset?.updated_at, dataset?.created_at]) {
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return 0;
}

export function latestReadyWeatherDataset(datasets) {
  if (!Array.isArray(datasets)) return null;
  return datasets.reduce((latest, dataset) => {
    if (!isRecord(dataset) || dataset.ready === false) return latest;
    if (!latest) return dataset;
    return weatherDatasetTimestamp(dataset) > weatherDatasetTimestamp(latest)
      ? dataset
      : latest;
  }, null);
}

function asFeatureCollection(value, label = "GeoJSON") {
  if (!isRecord(value) || value.type !== "FeatureCollection" || !Array.isArray(value.features)) {
    throw new Error(`${label} must be a GeoJSON FeatureCollection.`);
  }
  return value;
}

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

function powerLinePaths(collection) {
  const paths = [];
  for (const feature of collection.features) {
    if (feature?.properties?.kind !== "power_line") continue;
    const geometry = feature?.geometry;
    const candidates =
      geometry?.type === "LineString"
        ? [geometry.coordinates]
        : geometry?.type === "MultiLineString"
          ? geometry.coordinates
          : [];
    for (const candidate of candidates) {
      const path = candidate.map(validCoordinate).filter(Boolean);
      if (path.length >= 2) paths.push(path);
    }
  }
  return paths;
}

function coordinateKey([longitude, latitude]) {
  return `${longitude.toFixed(7)},${latitude.toFixed(7)}`;
}

function bearingBetween(start, end) {
  const averageLatitude = (start[1] + end[1]) / 2;
  const metersPerLongitude = Math.max(
    Math.abs(111_320 * Math.cos((averageLatitude * Math.PI) / 180)),
    1,
  );
  const dx = (end[0] - start[0]) * metersPerLongitude;
  const dy = (end[1] - start[1]) * 110_540;
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

function sharedPoleBearing(bearings) {
  const axes = bearings.map((bearing) => ((bearing % 180) + 180) % 180);
  const vector = axes.reduce(
    ({ x, y }, bearing) => {
      const doubledRadians = ((bearing * 2) * Math.PI) / 180;
      return {
        x: x + Math.cos(doubledRadians),
        y: y + Math.sin(doubledRadians),
      };
    },
    { x: 0, y: 0 },
  );
  if (Math.hypot(vector.x, vector.y) < 1e-8) return axes[0] ?? 0;
  return ((Math.atan2(vector.y, vector.x) * 90) / Math.PI + 180) % 180;
}

function conductorAttachment([longitude, latitude], bearing, offsetMeters) {
  const metersPerLongitude = Math.max(
    Math.abs(111_320 * Math.cos((latitude * Math.PI) / 180)),
    1,
  );
  const metersPerLatitude = 110_540;
  const radians = (bearing * Math.PI) / 180;
  return [
    longitude + (-Math.cos(radians) * offsetMeters) / metersPerLongitude,
    latitude + (Math.sin(radians) * offsetMeters) / metersPerLatitude,
    CONDUCTOR_HEIGHT_METERS,
  ];
}

export function buildPowerLineNetwork(collection) {
  const paths = powerLinePaths(asFeatureCollection(collection, "Engine assets"));
  const poleRecords = new Map();
  const recordFor = (coordinate) => {
    const key = coordinateKey(coordinate);
    let record = poleRecords.get(key);
    if (!record) {
      record = { coordinate, bearings: [] };
      poleRecords.set(key, record);
    }
    return record;
  };

  paths.forEach((path) => {
    path.slice(0, -1).forEach((start, index) => {
      const end = path[index + 1];
      const bearing = bearingBetween(start, end);
      recordFor(start).bearings.push(bearing);
      recordFor(end).bearings.push(bearing);
    });
  });

  const poles = [...poleRecords.values()].map((record, index) => {
    const [longitude, latitude] = record.coordinate;
    const bearing = sharedPoleBearing(record.bearings);
    record.bearing = bearing;
    return {
      id: `pole-${index + 1}`,
      kind: "pole",
      position: [longitude, latitude, 0],
      bearing,
      scale: [POWER_POLE_MODEL_SCALE, POWER_POLE_MODEL_SCALE, POWER_POLE_MODEL_SCALE],
      // The supplied pole model's crossarm lies on local Z once stood upright.
      modelYaw: (90 - bearing + 360) % 360,
    };
  });

  let spanIndex = 0;
  const conductors = paths.flatMap((path) =>
    path.slice(0, -1).flatMap((start, index) => {
      const end = path[index + 1];
      const startPole = poleRecords.get(coordinateKey(start));
      const endPole = poleRecords.get(coordinateKey(end));
      spanIndex += 1;
      return CONDUCTOR_OFFSETS_METERS.map((offset, sideIndex) => ({
        id: `line-${spanIndex}-${sideIndex === 0 ? "left" : "right"}`,
        kind: "conductor",
        path: [
          conductorAttachment(startPole.coordinate, startPole.bearing, offset),
          conductorAttachment(endPole.coordinate, endPole.bearing, offset),
        ],
      }));
    }),
  );
  return { poles, conductors };
}

export function selectDemoRegions(regions) {
  if (!Array.isArray(regions)) throw new Error("Regions must be an array.");
  let canonicalBoulder = null;
  let seededBoulder = null;
  let golden = null;
  for (const region of regions) {
    if (!isRecord(region) || region.status !== "published") continue;
    const name = typeof region.name === "string" ? region.name.trim().toLowerCase() : "";
    if (region.region_id === "boulder-co") canonicalBoulder = region;
    else if (name === "boulder demo") seededBoulder = region;
    if (region.region_id === "golden-co" || name === "golden") golden = region;
  }
  return [canonicalBoulder ?? seededBoulder, golden].filter(Boolean);
}

export function selectDemoAssetRegionIds(regions) {
  if (!Array.isArray(regions)) throw new Error("Regions must be an array.");
  const seededBoulderIds = [];
  let canonicalBoulderId = null;
  for (const region of regions) {
    if (!isRecord(region) || region.status !== "published") continue;
    const name = typeof region.name === "string" ? region.name.trim().toLowerCase() : "";
    if (region.region_id === "boulder-co") canonicalBoulderId = region.region_id;
    if (name === "boulder demo" && typeof region.region_id === "string") {
      seededBoulderIds.unshift(region.region_id);
    }
  }
  const candidates = [
    ...seededBoulderIds,
    ...(canonicalBoulderId ? [canonicalBoulderId] : []),
  ];
  return candidates.length ? { "boulder-co": candidates } : {};
}

function httpUrl(value, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute HTTP URL.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${label} must use HTTP or HTTPS.`);
  }
  return parsed;
}

export function normalizeApiBaseUrl(value) {
  const parsed = httpUrl(nonEmptyString(value, "API URL"), "API URL");
  parsed.hash = "";
  parsed.search = "";
  return parsed.href.replace(/\/+$/, "");
}

function defaultApiUrl() {
  const runtime =
    typeof window !== "undefined" && typeof window.__DIGITAL_TWIN_API_URL__ === "string"
      ? window.__DIGITAL_TWIN_API_URL__
      : null;
  const stored =
    typeof window !== "undefined"
      ? window.localStorage?.getItem(API_STORAGE_KEY)
      : null;
  for (const candidate of [runtime, stored, DEFAULT_API_URL]) {
    if (!candidate) continue;
    try {
      return normalizeApiBaseUrl(candidate);
    } catch {
      // Continue to the next safe default.
    }
  }
  return DEFAULT_API_URL;
}

export class ApiProblem extends Error {
  constructor(status, message, problem = null) {
    super(message);
    this.name = "ApiProblem";
    this.status = status;
    this.problem = problem;
  }
}

async function responseBody(response) {
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("json") || contentType.includes("geo+json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  try {
    return await response.text();
  } catch {
    return null;
  }
}

function problemMessage(status, body) {
  if (isRecord(body)) {
    if (typeof body.detail === "string" && body.detail.trim()) return body.detail;
    if (typeof body.title === "string" && body.title.trim()) return body.title;
  }
  if (typeof body === "string" && body.trim()) return body.trim();
  return `Engine request failed (${status}).`;
}

export function createDigitalTwinClient(baseUrl, options = {}) {
  const base = normalizeApiBaseUrl(baseUrl);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (typeof fetchImpl !== "function") throw new Error("This environment cannot make HTTP requests.");
  const eventSourceFactory =
    options.eventSourceFactory ??
    ((url) => {
      if (typeof globalThis.EventSource !== "function") {
        throw new Error("This environment cannot open simulation event streams.");
      }
      return new globalThis.EventSource(url);
    });

  const resolveUrl = (path) => {
    if (typeof path !== "string" || path.trim().length === 0) {
      throw new Error("Engine response did not include a usable URL.");
    }
    if (/^https?:\/\//i.test(path)) return path;
    return new URL(path.replace(/^\/+/, ""), `${base}/`).href;
  };

  const request = async (path, requestOptions = {}) => {
    const headers = new Headers(requestOptions.headers);
    if (requestOptions.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const response = await fetchImpl(resolveUrl(path), {
      method: requestOptions.method ?? "GET",
      headers,
      body:
        requestOptions.body === undefined
          ? undefined
          : typeof requestOptions.body === "string"
            ? requestOptions.body
            : JSON.stringify(requestOptions.body),
      signal: requestOptions.signal,
      cache: requestOptions.cache,
    });
    if (response.status === 304) return { notModified: true };
    const body = await responseBody(response);
    if (!response.ok) {
      throw new ApiProblem(response.status, problemMessage(response.status, body), body);
    }
    return body;
  };

  const getRunArtifact = async (path, { etag, signal } = {}) => {
    const url = resolveUrl(path);
    const headers = new Headers({ Accept: "application/geo+json, application/json" });
    if (etag) headers.set("If-None-Match", etag);
    const response = await fetchImpl(url, {
      method: "GET",
      headers,
      signal,
      cache: etag ? "no-cache" : "default",
    });
    const responseEtag = response.headers.get("etag");
    if (response.status === 304) {
      return {
        notModified: true,
        data: null,
        etag: responseEtag ?? etag ?? null,
        url,
      };
    }
    const body = await responseBody(response);
    if (!response.ok) {
      throw new ApiProblem(response.status, problemMessage(response.status, body), body);
    }
    return {
      notModified: false,
      data: body,
      etag: responseEtag,
      url,
    };
  };

  const commandHeaders = ({ idempotencyKey, requestId } = {}) => {
    const headers = new Headers();
    if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
    if (requestId) headers.set("X-Request-ID", requestId);
    return headers;
  };

  const watchRun = (runId, callbacks = {}) => {
    const normalizedRunId = nonEmptyString(runId, "Run ID");
    const source = eventSourceFactory(
      resolveUrl(`/api/v1/simulation-runs/${encodeURIComponent(normalizedRunId)}/events`),
    );
    if (
      !source ||
      typeof source.addEventListener !== "function" ||
      typeof source.close !== "function"
    ) {
      throw new Error("The simulation event-stream client is invalid.");
    }

    for (const eventName of RUN_PROGRESS_EVENT_NAMES) {
      source.addEventListener(eventName, (event) => {
        try {
          const payload = parseRunProgressPayload(event.data, normalizedRunId, eventName);
          callbacks.onProgress?.(payload, event);
          // EventSource reconnects when a server closes a response, including a
          // successful terminal stream. Close locally so terminal runs stay closed.
          if (TERMINAL_RUN_STATUSES.has(payload.status)) source.close();
        } catch (error) {
          source.close();
          callbacks.onError?.(error);
        }
      });
    }
    source.addEventListener("open", (event) => callbacks.onOpen?.(event));
    source.addEventListener("error", (event) => callbacks.onError?.(event));
    return source;
  };

  return {
    baseUrl: base,
    resolveUrl,
    ready: (signal) => request("/api/v1/health/ready", { signal }),
    listDataSources: (signal) => request("/api/v1/data-sources", { signal }),
    listRegions: (signal) => request("/api/v1/regions?limit=100", { signal }),
    getRegion: (regionId, signal) =>
      request(`/api/v1/regions/${encodeURIComponent(regionId)}`, { signal }),
    getAssetsGeoJson: (regionId, signal) =>
      request(`/api/v1/regions/${encodeURIComponent(regionId)}/assets.geojson`, {
        signal,
        cache: "no-cache",
      }),
    getWeatherDatasets: (regionId, signal) =>
      request(`/api/v1/regions/${encodeURIComponent(regionId)}/weather-datasets?limit=100`, {
        signal,
      }),
    getEarthEngineMetadata: (regionId, signal) =>
      request(`/api/v1/regions/${encodeURIComponent(regionId)}/earth-engine`, { signal }),
    getWeatherMapLayers: (regionId, datasetId, signal) =>
      request(
        `/api/v1/regions/${encodeURIComponent(regionId)}/weather-datasets/${encodeURIComponent(datasetId)}/map-layers`,
        { signal },
      ),
    getEarthEngineMapLayers: (regionId, signal) =>
      request(`/api/v1/regions/${encodeURIComponent(regionId)}/earth-engine/map-layers`, {
        signal,
      }),
    createScenario: (candidate, { idempotencyKey, requestId, signal } = {}) =>
      request("/api/v1/scenarios", {
        method: "POST",
        headers: commandHeaders({ idempotencyKey, requestId }),
        body: candidate,
        signal,
      }),
    createRun: (candidate, { idempotencyKey, requestId, signal } = {}) =>
      request("/api/v1/simulation-runs", {
        method: "POST",
        headers: commandHeaders({ idempotencyKey, requestId }),
        body: candidate,
        signal,
      }),
    getRun: (runId, signal) =>
      request(`/api/v1/simulation-runs/${encodeURIComponent(runId)}`, { signal }),
    getRunArtifact,
    watchRun,
    cancelRun: (runId, signal) =>
      request(`/api/v1/simulation-runs/${encodeURIComponent(runId)}/cancel`, {
        method: "POST",
        signal,
      }),
    listRuns: (signal) => request("/api/v1/simulation-runs?limit=20", { signal }),
    getResult: (runId, signal) =>
      request(`/api/v1/simulation-runs/${encodeURIComponent(runId)}/result.geojson`, {
        signal,
        cache: "no-cache",
      }),
  };
}

function parseRunProgressPayload(data, runId, eventName) {
  let payload;
  try {
    payload = JSON.parse(data);
  } catch {
    throw new Error(`Engine sent invalid JSON in ${eventName}.`);
  }
  if (!isRecord(payload) || payload.schema_version !== 1) {
    throw new Error(`Engine sent an unsupported ${eventName} payload.`);
  }
  if (payload.run_id !== runId) {
    throw new Error(`Engine sent progress for a different simulation run.`);
  }
  const status = nonEmptyString(payload.status, "Simulation status").toUpperCase();
  const completedTicks = Number(payload.completed_ticks);
  if (!Number.isInteger(completedTicks) || completedTicks < 0) {
    throw new Error("Simulation progress has an invalid completed-tick count.");
  }
  const totalTicks = payload.total_ticks;
  if (totalTicks !== null && (!Number.isInteger(totalTicks) || totalTicks < 1)) {
    throw new Error("Simulation progress has an invalid total-tick count.");
  }
  if (totalTicks !== null && completedTicks > totalTicks) {
    throw new Error("Simulation progress exceeds its total-tick count.");
  }
  if (
    eventName === "tick_completed" &&
    (!Number.isInteger(payload.tick) || payload.tick < 1)
  ) {
    throw new Error("Simulation progress has an invalid tick.");
  }
  let artifactUrl = null;
  if (payload.artifact_url !== undefined && payload.artifact_url !== null) {
    artifactUrl = nonEmptyString(payload.artifact_url, "Simulation artifact URL");
    if (/^state:/i.test(artifactUrl)) {
      throw new Error("Simulation progress exposed an internal artifact reference.");
    }
  }
  if (eventName === "tick_completed" && !artifactUrl) {
    throw new Error("Simulation tick progress is missing its durable artifact URL.");
  }
  return {
    ...payload,
    status,
    completed_ticks: completedTicks,
    total_ticks: totalTicks,
    ...(artifactUrl ? { artifact_url: artifactUrl } : {}),
  };
}

function progressArtifact(progress) {
  if (!isRecord(progress) || progress.artifact_url === undefined) return null;
  const runId = nonEmptyString(progress.run_id, "Run ID");
  const artifactUrl = nonEmptyString(progress.artifact_url, "Simulation artifact URL");
  if (/^state:/i.test(artifactUrl)) {
    throw new Error("Simulation progress exposed an internal artifact reference.");
  }
  const tick = Number.isInteger(progress.tick) ? progress.tick : progress.completed_ticks;
  if (!Number.isInteger(tick) || tick < 1) {
    throw new Error("Simulation artifact progress has an invalid tick.");
  }
  return { runId, tick, artifactUrl };
}

export function createRunArtifactCoordinator(client, callbacks = {}) {
  if (!client || typeof client.getRunArtifact !== "function") {
    throw new Error("A simulation artifact client is required.");
  }
  let generation = 0;
  let activeAbort = null;
  let activePromise = null;
  let activeRunId = null;
  let latestRequestedTick = 0;
  let latestRequestedUrl = null;
  let latestAppliedTick = 0;
  const cache = new Map();

  const begin = (runId) => {
    const normalizedRunId = nonEmptyString(runId, "Run ID");
    if (activeRunId === normalizedRunId) return;
    generation += 1;
    activeAbort?.abort();
    activeAbort = null;
    activePromise = null;
    activeRunId = normalizedRunId;
    latestRequestedTick = 0;
    latestRequestedUrl = null;
    latestAppliedTick = 0;
  };

  const update = (progress) => {
    let artifact;
    try {
      artifact = progressArtifact(progress);
    } catch (error) {
      callbacks.onError?.(error, progress);
      return Promise.resolve(null);
    }
    if (!artifact) return Promise.resolve(null);
    begin(artifact.runId);
    if (
      artifact.tick < latestRequestedTick ||
      (artifact.tick === latestRequestedTick && artifact.artifactUrl === latestRequestedUrl)
    ) {
      return activePromise ?? Promise.resolve(null);
    }

    latestRequestedTick = artifact.tick;
    latestRequestedUrl = artifact.artifactUrl;
    generation += 1;
    const requestGeneration = generation;
    activeAbort?.abort();
    const abort = new AbortController();
    activeAbort = abort;
    const cached = cache.get(artifact.artifactUrl);
    activePromise = (async () => {
      try {
        const response = await client.getRunArtifact(artifact.artifactUrl, {
          etag: cached?.etag,
          signal: abort.signal,
        });
        if (
          abort.signal.aborted ||
          requestGeneration !== generation ||
          activeRunId !== artifact.runId ||
          artifact.tick < latestRequestedTick
        ) {
          return null;
        }
        const data = response.notModified ? cached?.collection : response.data;
        if (!data) throw new Error("Engine returned 304 without a cached simulation artifact.");
        const collection = asFeatureCollection(data, `Simulation tick ${artifact.tick}`);
        cache.set(artifact.artifactUrl, {
          etag: response.etag ?? cached?.etag ?? null,
          collection,
        });
        latestAppliedTick = artifact.tick;
        const applied = {
          runId: artifact.runId,
          tick: artifact.tick,
          artifactUrl: artifact.artifactUrl,
          url: response.url ?? client.resolveUrl?.(artifact.artifactUrl) ?? artifact.artifactUrl,
          collection,
        };
        callbacks.onArtifact?.(applied);
        return applied;
      } catch (error) {
        if (abort.signal.aborted || error?.name === "AbortError") return null;
        callbacks.onError?.(error, artifact);
        return null;
      } finally {
        if (activeAbort === abort) activeAbort = null;
      }
    })();
    return activePromise;
  };

  const stop = () => {
    generation += 1;
    activeAbort?.abort();
    activeAbort = null;
    activePromise = null;
  };

  return {
    begin,
    update,
    stop,
    get latestAppliedTick() {
      return latestAppliedTick;
    },
  };
}

function boundsFromRegion(region) {
  if (!isRecord(region) || !isRecord(region.bounds)) {
    throw new Error("A region with WGS84 bounds is required.");
  }
  const west = finiteNumber(region.bounds.west, "Region west bound");
  const south = finiteNumber(region.bounds.south, "Region south bound");
  const east = finiteNumber(region.bounds.east, "Region east bound");
  const north = finiteNumber(region.bounds.north, "Region north bound");
  if (west >= east || south >= north) throw new Error("Region bounds must have positive area.");
  return { west, south, east, north };
}

export function buildRegionBoundsGeoJson(regions, selectedRegionId) {
  if (!Array.isArray(regions)) throw new Error("Regions must be an array.");
  return {
    type: "FeatureCollection",
    features: regions.map((region) => {
      const regionId = nonEmptyString(region?.region_id, "Region");
      const { west, south, east, north } = boundsFromRegion(region);
      return {
        type: "Feature",
        properties: {
          region_id: regionId,
          name:
            typeof region.name === "string" && region.name.trim()
              ? region.name.trim()
              : regionId,
          selected: regionId === selectedRegionId,
        },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ],
          ],
        },
      };
    }),
  };
}

export function buildScenarioRequest({
  region,
  weatherVersion,
  windSpeed,
  windUnit,
  windBearing,
  durationHours,
}) {
  const regionId = nonEmptyString(region?.region_id, "Region");
  const { west, south, east, north } = boundsFromRegion(region);
  const speed = finiteNumber(windSpeed, "Wind speed");
  const bearing = finiteNumber(windBearing, "Wind bearing");
  const duration = finiteNumber(durationHours, "Duration");
  if (speed < 0) throw new Error("Wind speed cannot be negative.");
  if (windUnit !== "mph" && windUnit !== "m/s") throw new Error("Wind unit is unsupported.");
  if (bearing < 0 || bearing >= 360) throw new Error("Wind bearing must be from 0 to 359.99°.");
  if (duration <= 0) throw new Error("Duration must be greater than zero.");

  return {
    region_id: regionId,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    },
    base_weather_version: nonEmptyString(weatherVersion, "Weather version"),
    wind_speed: { value: speed, unit: windUnit },
    wind_direction: { bearing_degrees: bearing, reference: "towards" },
    duration_hours: duration,
  };
}

function treeCoordinates(feature) {
  if (!isRecord(feature) || !isRecord(feature.geometry) || feature.geometry.type !== "Point") {
    throw new Error("Every ignition tree must be a GeoJSON point.");
  }
  if (!isRecord(feature.properties) || feature.properties.kind !== "tree") {
    throw new Error("Only Engine tree assets can be ignition points.");
  }
  const coordinates = feature.geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    throw new Error("Every ignition tree must include longitude and latitude.");
  }
  const longitude = finiteNumber(coordinates[0], "Tree longitude");
  const latitude = finiteNumber(coordinates[1], "Tree latitude");
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new Error("Ignition tree coordinates must be valid WGS84.");
  }
  return [longitude, latitude];
}

function treeAssetId(feature) {
  return nonEmptyString(feature?.properties?.asset_id, "Tree asset ID");
}

export function buildRunRequest(scenarioId, selectedTrees) {
  if (!Array.isArray(selectedTrees) || selectedTrees.length === 0) {
    throw new Error("Select at least one tree ignition point.");
  }
  if (selectedTrees.length > 100) throw new Error("Select no more than 100 tree ignition points.");
  return {
    scenario_id: nonEmptyString(scenarioId, "Scenario"),
    ignition_points: selectedTrees.map((feature) => ({
      type: "Point",
      coordinates: treeCoordinates(feature),
    })),
  };
}

export function selectedTreeSummary(feature) {
  const [longitude, latitude] = treeCoordinates(feature);
  const properties = feature.properties;
  const species =
    typeof properties.species === "string" && properties.species.trim()
      ? properties.species.trim()
      : "Tree";
  const height = Number(properties.height_m);
  return {
    assetId: treeAssetId(feature),
    title: species,
    detail: `${Number.isFinite(height) ? `${height} m · ` : ""}${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
  };
}

function makeId(prefix) {
  const uuid =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${uuid}`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

function button(label, className = "dt-button") {
  const node = el("button", className, label);
  node.type = "button";
  return node;
}

function labelledField(label, input) {
  const wrapper = el("label", "dt-field");
  wrapper.append(el("span", "dt-field-label", label), input);
  return wrapper;
}

function section(title, subtitle, options = {}) {
  const details = el("details", `dt-section${options.step ? " dt-step" : ""}`);
  details.open = options.open ?? true;
  const summary = el("summary", "dt-section-summary");
  if (options.step) {
    summary.append(el("span", "dt-step-number", options.step));
  }
  const titleWrap = el("span");
  titleWrap.append(el("span", "dt-section-title", title));
  if (subtitle) titleWrap.append(el("span", "dt-section-subtitle", subtitle));
  summary.append(titleWrap);
  const body = el("div", "dt-section-body");
  details.append(summary, body);
  return { details, body };
}

function emptyFeatureCollection(features = []) {
  return { type: "FeatureCollection", features };
}

function regionBoundsArray(region) {
  const bounds = boundsFromRegion(region);
  return [bounds.west, bounds.south, bounds.east, bounds.north];
}

function descriptorItems(value) {
  if (Array.isArray(value)) return value;
  return asPageItems(value);
}

export function groupVisualizationDescriptors(descriptors) {
  const groups = new Map();
  for (const descriptor of Array.isArray(descriptors) ? descriptors : []) {
    if (!isRecord(descriptor) || typeof descriptor.layer_id !== "string") continue;
    const key = [
      descriptor.category ?? "map",
      descriptor.band ?? descriptor.name ?? descriptor.layer_id,
      descriptor.format ?? "unknown",
    ].join("|");
    const existing = groups.get(key);
    if (existing) {
      existing.descriptors.push(descriptor);
      continue;
    }
    groups.set(key, {
      group_id: key,
      name: descriptor.name ?? descriptor.layer_id,
      category: descriptor.category,
      band: descriptor.band,
      units: descriptor.units,
      format: descriptor.format,
      descriptors: [descriptor],
    });
  }
  return [...groups.values()];
}

async function loadVisualizationCoverage(client, region, signal) {
  const [weatherResult, earthEngineResult, earthLayersResult] = await Promise.allSettled([
    client.getWeatherDatasets(region.region_id, signal),
    client.getEarthEngineMetadata(region.region_id, signal),
    client.getEarthEngineMapLayers(region.region_id, signal),
  ]);
  const weather =
    weatherResult.status === "fulfilled"
      ? latestReadyWeatherDataset(asPageItems(weatherResult.value))
      : null;
  let weatherLayers = [];
  if (weather?.dataset_id) {
    try {
      weatherLayers = descriptorItems(
        await client.getWeatherMapLayers(region.region_id, weather.dataset_id, signal),
      );
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }
  const withCoverage = (descriptor) => ({
    ...descriptor,
    coverage_region_id: region.region_id,
    coverage_region_name: region.name ?? region.region_id,
  });
  return {
    region,
    weather,
    earthEngine:
      earthEngineResult.status === "fulfilled" ? earthEngineResult.value : null,
    weatherDescriptors: weatherLayers.map(withCoverage),
    earthEngineDescriptors:
      earthLayersResult.status === "fulfilled"
        ? descriptorItems(earthLayersResult.value).map(withCoverage)
        : [],
  };
}

export async function loadPublishedVisualizationCatalogs(client, regions, signal) {
  if (!client || !Array.isArray(regions)) return [];
  return Promise.all(
    regions.map((region) => loadVisualizationCoverage(client, region, signal)),
  );
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return String(value ?? "Unknown time");
  return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function formatCompactDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return String(value ?? "Unknown");
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function bearingLabel(value) {
  const bearing = Number(value);
  if (!Number.isFinite(bearing)) return "unknown";
  const labels = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  return labels[Math.round((((bearing % 360) + 360) % 360) / 45) % labels.length];
}

function runStatusValue(run) {
  return typeof run?.status === "string" ? run.status.toUpperCase() : "UNKNOWN";
}

export function mergeRunProgress(run, progress) {
  if (!isRecord(run) || !isRecord(progress)) {
    throw new Error("A simulation run and progress payload are required.");
  }
  if (run.run_id && progress.run_id !== run.run_id) {
    throw new Error("Simulation progress does not belong to the active run.");
  }
  return {
    ...run,
    ...progress,
    status: runStatusValue(progress),
  };
}

function safeRunFailure(run) {
  const failure = run?.failure;
  if (!isRecord(failure)) return null;
  if (typeof failure.error_message === "string" && failure.error_message.trim()) {
    return failure.error_message;
  }
  return "The simulation failed.";
}

class AssetMapController {
  constructor(app, onTreeClick) {
    this.app = app;
    this.onTreeClick = onTreeClick;
    this.map = app.getMap?.() ?? null;
    this.data = emptyFeatureCollection();
    this.selection = emptyFeatureCollection();
    this.regions = emptyFeatureCollection();
    this.entryUnregister = null;
    this.stateUnsubscribe = null;
    this.bound = false;
    this.destroyed = false;
    this.deck = null;
    this.overlay = null;
    this.previousProjection = null;
    this.layerState = { visible: true, opacity: 1 };
    this.onStyleData = () => this.ensureLayers();
    this.mapContainer = this.map?.getContainer?.() ?? null;
    this.onMapContainerClick = (event) => {
      if (!this.map || !this.mapContainer || !this.layerState.visible) return;
      const bounds = this.mapContainer.getBoundingClientRect();
      const point = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      };
      let nearest = null;
      let nearestDistance = 10 ** 2;
      for (const feature of this.data.features) {
        if (feature?.properties?.kind !== "tree") continue;
        const coordinates = feature?.geometry?.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length < 2) continue;
        const projected = this.map.project(coordinates);
        const distance = (projected.x - point.x) ** 2 + (projected.y - point.y) ** 2;
        if (distance <= nearestDistance) {
          nearest = feature;
          nearestDistance = distance;
        }
      }
      if (nearest) this.onTreeClick(nearest);
    };
    this.onEnter = () => {
      if (this.map) this.map.getCanvas().style.cursor = "pointer";
    };
    this.onLeave = () => {
      if (this.map) this.map.getCanvas().style.cursor = "";
    };
    this.map?.on("styledata", this.onStyleData);
    this.mapContainer?.addEventListener("click", this.onMapContainerClick, true);
    void this.initializePowerLineOverlay();
  }

  async initializePowerLineOverlay() {
    if (!this.app.getDeckGL || !this.app.addMapControl) return;
    try {
      const deck = await this.app.getDeckGL();
      if (this.destroyed) return;
      const overlay = new deck.mapbox.MapboxOverlay({
        interleaved: true,
        pickingRadius: 8,
        layers: [],
      });
      this.previousProjection = this.app.getMapProjection?.() ?? null;
      this.app.setMapProjection?.("mercator");
      if (!this.app.addMapControl(overlay)) {
        if (this.previousProjection) this.app.setMapProjection?.(this.previousProjection);
        this.previousProjection = null;
        return;
      }
      this.deck = deck;
      this.overlay = overlay;
      try {
        if (this.map?.getLayer(POWER_LINE_LAYER_ID)) {
          this.map.removeLayer(POWER_LINE_LAYER_ID);
        }
      } catch {
        // A style transition can race overlay startup; styledata will retry.
      }
      this.renderPowerLineObjects();
    } catch (error) {
      console.error("[Digital Twin Demo] Could not initialize 3D power-line rendering.", error);
    }
  }

  poleModelUrl() {
    return (
      this.app.resolvePluginAssetUrl?.(PLUGIN_ID, POWER_LINE_MODEL_PATH) ??
      new URL(`plugins/${PLUGIN_ID}/${POWER_LINE_MODEL_PATH}`, document.baseURI).href
    );
  }

  renderPowerLineObjects() {
    if (!this.overlay || !this.deck) return;
    const network = buildPowerLineNetwork(this.data);
    const visible = this.layerState.visible;
    const opacity = this.layerState.opacity;
    this.overlay.setProps({
      layers: [
        new this.deck.layers.PathLayer({
          id: POWER_LINE_CONDUCTOR_LAYER_ID,
          data: network.conductors,
          getPath: (conductor) => conductor.path,
          getColor: [15, 15, 15, Math.round(255 * opacity)],
          getWidth: 2,
          widthUnits: "pixels",
          widthMinPixels: 1,
          visible,
          capRounded: true,
          jointRounded: true,
        }),
        new this.deck.meshLayers.ScenegraphLayer({
          id: POWER_LINE_POLE_LAYER_ID,
          data: network.poles,
          scenegraph: this.poleModelUrl(),
          _lighting: "pbr",
          visible,
          opacity,
          sizeScale: 1,
          sizeMinPixels: 0,
          sizeMaxPixels: Number.MAX_SAFE_INTEGER,
          getPosition: (pole) => pole.position,
          getOrientation: (pole) => [0, pole.modelYaw, 90],
          getScale: (pole) => pole.scale,
        }),
      ],
    });
  }

  setRegions(regions, selectedRegionId) {
    this.regions = buildRegionBoundsGeoJson(regions, selectedRegionId);
    this.ensureLayers();
    const source = this.map?.getSource(REGION_SOURCE_ID);
    if (source?.setData) source.setData(this.regions);
  }

  setData(data, regionName) {
    this.data = asFeatureCollection(data, "Engine assets");
    this.selection = emptyFeatureCollection();
    this.ensureLayers();
    this.entryUnregister?.();
    this.entryUnregister =
      this.app.registerExternalNativeLayer?.({
        id: ASSET_ENTRY_ID,
        name: `Engine assets · ${regionName}`,
        type: "geojson",
        geojson: this.data,
        nativeLayerIds: [
          POWER_LINE_LAYER_ID,
          POWER_LINE_CONDUCTOR_LAYER_ID,
          POWER_LINE_POLE_LAYER_ID,
          TREE_LAYER_ID,
        ],
        sourceIds: [ASSET_SOURCE_ID],
        opacity: 1,
        metadata: {
          provider: "Digital Twin Engine",
          description: "Canonical region tree and power-line assets. Click a tree to select it.",
          customLayerType: "digital-twin-assets",
          externalDeckLayer: true,
          identifiable: false,
        },
      }) ?? null;
    this.stateUnsubscribe?.();
    this.stateUnsubscribe =
      this.app.subscribeExternalNativeLayerState?.(ASSET_ENTRY_ID, (state) => {
        if (!state) return;
        this.layerState = state;
        this.applyLayerState();
      }) ?? null;
    this.renderPowerLineObjects();
  }

  setSelection(features) {
    this.selection = emptyFeatureCollection(features);
    this.ensureLayers();
    const source = this.map?.getSource(SELECTION_SOURCE_ID);
    if (source?.setData) source.setData(this.selection);
  }

  ensureLayers() {
    const map = this.map;
    if (!map || typeof map.isStyleLoaded === "function" && !map.isStyleLoaded()) return;
    try {
      const regionSource = map.getSource(REGION_SOURCE_ID);
      if (!regionSource) {
        map.addSource(REGION_SOURCE_ID, { type: "geojson", data: this.regions });
      } else if (regionSource.setData) {
        regionSource.setData(this.regions);
      }
      if (!map.getLayer(REGION_FILL_LAYER_ID)) {
        map.addLayer({
          id: REGION_FILL_LAYER_ID,
          type: "fill",
          source: REGION_SOURCE_ID,
          paint: {
            "fill-color": [
              "case",
              ["boolean", ["get", "selected"], false],
              "#ff6b35",
              "#1f8a5b",
            ],
            "fill-opacity": [
              "case",
              ["boolean", ["get", "selected"], false],
              0.13,
              0.04,
            ],
          },
        });
      }
      if (!map.getLayer(REGION_LINE_LAYER_ID)) {
        map.addLayer({
          id: REGION_LINE_LAYER_ID,
          type: "line",
          source: REGION_SOURCE_ID,
          paint: {
            "line-color": [
              "case",
              ["boolean", ["get", "selected"], false],
              "#ff6b35",
              "#17724f",
            ],
            "line-width": [
              "case",
              ["boolean", ["get", "selected"], false],
              3,
              1.5,
            ],
            "line-dasharray": [3, 2],
          },
        });
      }
      if (this.overlay && map.getLayer(POWER_LINE_LAYER_ID)) {
        map.removeLayer(POWER_LINE_LAYER_ID);
      }
      const assetSource = map.getSource(ASSET_SOURCE_ID);
      if (!assetSource) {
        map.addSource(ASSET_SOURCE_ID, { type: "geojson", data: this.data });
      } else if (assetSource.setData) {
        assetSource.setData(this.data);
      }
      if (!this.overlay && !map.getLayer(POWER_LINE_LAYER_ID)) {
        map.addLayer({
          id: POWER_LINE_LAYER_ID,
          type: "line",
          source: ASSET_SOURCE_ID,
          filter: ["==", ["get", "kind"], "power_line"],
          paint: {
            "line-color": "#2d3542",
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.5, 15, 4],
            "line-opacity": 0.9,
          },
        });
      }
      if (!map.getLayer(TREE_LAYER_ID)) {
        map.addLayer({
          id: TREE_LAYER_ID,
          type: "circle",
          source: ASSET_SOURCE_ID,
          filter: ["==", ["get", "kind"], "tree"],
          paint: {
            "circle-radius": TREE_CIRCLE_RADIUS_PX,
            "circle-color": "#1f8a5b",
            "circle-stroke-color": "#e8fff4",
            "circle-stroke-width": 1.5,
            "circle-opacity": 0.9,
          },
        });
      }
      const selectionSource = map.getSource(SELECTION_SOURCE_ID);
      if (!selectionSource) {
        map.addSource(SELECTION_SOURCE_ID, { type: "geojson", data: this.selection });
      } else if (selectionSource.setData) {
        selectionSource.setData(this.selection);
      }
      if (!map.getLayer(SELECTION_LAYER_ID)) {
        map.addLayer({
          id: SELECTION_LAYER_ID,
          type: "circle",
          source: SELECTION_SOURCE_ID,
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 7, 15, 12],
            "circle-color": "rgba(255,255,255,0)",
            "circle-stroke-color": "#ff6b35",
            "circle-stroke-width": 4,
          },
        });
      }
      if (!this.bound) {
        map.on("mouseenter", TREE_LAYER_ID, this.onEnter);
        map.on("mouseleave", TREE_LAYER_ID, this.onLeave);
        this.bound = true;
      }
      this.applyLayerState();
    } catch {
      // A basemap style can be between teardown and load; styledata retries.
    }
  }

  applyLayerState() {
    const map = this.map;
    if (!map) return;
    const visibility = this.layerState.visible ? "visible" : "none";
    for (const layerId of [POWER_LINE_LAYER_ID, TREE_LAYER_ID]) {
      if (!map.getLayer(layerId)) continue;
      try {
        map.setLayoutProperty(layerId, "visibility", visibility);
      } catch {
        // Ignore style transitions.
      }
    }
    if (map.getLayer(POWER_LINE_LAYER_ID)) {
      map.setPaintProperty(POWER_LINE_LAYER_ID, "line-opacity", 0.9 * this.layerState.opacity);
    }
    if (map.getLayer(TREE_LAYER_ID)) {
      map.setPaintProperty(TREE_LAYER_ID, "circle-opacity", 0.9 * this.layerState.opacity);
      map.setPaintProperty(
        TREE_LAYER_ID,
        "circle-stroke-opacity",
        this.layerState.opacity,
      );
    }
    this.renderPowerLineObjects();
  }

  destroy() {
    this.destroyed = true;
    this.stateUnsubscribe?.();
    this.entryUnregister?.();
    this.stateUnsubscribe = null;
    this.entryUnregister = null;
    this.mapContainer?.removeEventListener("click", this.onMapContainerClick, true);
    this.mapContainer = null;
    if (this.overlay) this.app.removeMapControl?.(this.overlay);
    this.overlay = null;
    this.deck = null;
    if (this.previousProjection) this.app.setMapProjection?.(this.previousProjection);
    this.previousProjection = null;
    const map = this.map;
    if (!map) return;
    map.off("styledata", this.onStyleData);
    if (this.bound) {
      map.off("mouseenter", TREE_LAYER_ID, this.onEnter);
      map.off("mouseleave", TREE_LAYER_ID, this.onLeave);
    }
    for (const layerId of [
      SELECTION_LAYER_ID,
      TREE_LAYER_ID,
      POWER_LINE_LAYER_ID,
      REGION_LINE_LAYER_ID,
      REGION_FILL_LAYER_ID,
    ]) {
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      } catch {
        // Best-effort plugin cleanup during style changes.
      }
    }
    for (const sourceId of [SELECTION_SOURCE_ID, ASSET_SOURCE_ID, REGION_SOURCE_ID]) {
      try {
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // Best-effort plugin cleanup during style changes.
      }
    }
  }
}

export class WildfireMapController {
  constructor(app) {
    this.app = app;
    this.map = app.getMap?.() ?? null;
    this.data = emptyFeatureCollection();
    this.runId = null;
    this.tick = null;
    this.sourceUrl = null;
    this.registeredRunId = null;
    this.layerState = { visible: true, opacity: 1 };
    this.stateUnsubscribe = null;
    this.onStyleData = () => this.ensureLayers();
    this.map?.on("styledata", this.onStyleData);
  }

  setData(collection, { runId, tick, sourceUrl } = {}) {
    this.data = asFeatureCollection(collection, "Wildfire simulation artifact");
    this.runId = nonEmptyString(runId, "Run ID");
    this.tick = Number.isInteger(tick) ? tick : null;
    this.sourceUrl = typeof sourceUrl === "string" ? sourceUrl : null;
    this.ensureLayers();
    if (this.registeredRunId !== this.runId) {
      this.app.registerExternalNativeLayer?.({
        id: WILDFIRE_ENTRY_ID,
        name: `Wildfire · ${this.runId}`,
        type: "geojson",
        geojson: this.data,
        nativeLayerIds: [WILDFIRE_FILL_LAYER_ID, WILDFIRE_LINE_LAYER_ID],
        sourceIds: [WILDFIRE_SOURCE_ID],
        opacity: 0.82,
        metadata: {
          provider: "Digital Twin Engine",
          description: "Live durable wildfire footprint.",
          customLayerType: "digital-twin-wildfire",
          runId: this.runId,
          identifiable: false,
        },
      });
      this.registeredRunId = this.runId;
    }
    if (!this.stateUnsubscribe) {
      this.stateUnsubscribe =
        this.app.subscribeExternalNativeLayerState?.(WILDFIRE_ENTRY_ID, (state) => {
          if (!state) return;
          this.layerState = state;
          this.applyLayerState();
        }) ?? null;
    }
  }

  clear() {
    this.data = emptyFeatureCollection();
    this.runId = null;
    this.tick = null;
    this.sourceUrl = null;
    this.registeredRunId = null;
    const source = this.map?.getSource(WILDFIRE_SOURCE_ID);
    if (source?.setData) source.setData(this.data);
    this.app.unregisterExternalNativeLayer?.(WILDFIRE_ENTRY_ID);
  }

  ensureLayers() {
    const map = this.map;
    if (!map || (typeof map.isStyleLoaded === "function" && !map.isStyleLoaded())) return;
    try {
      const source = map.getSource(WILDFIRE_SOURCE_ID);
      if (!source) {
        map.addSource(WILDFIRE_SOURCE_ID, { type: "geojson", data: this.data });
      } else if (source.setData) {
        source.setData(this.data);
      }
      if (!map.getLayer(WILDFIRE_FILL_LAYER_ID)) {
        map.addLayer({
          id: WILDFIRE_FILL_LAYER_ID,
          type: "fill",
          source: WILDFIRE_SOURCE_ID,
          paint: {
            "fill-color": [
              "interpolate",
              ["linear"],
              ["coalesce", ["to-number", ["get", "active_cell_count"]], 1],
              1,
              "#ffb347",
              100,
              "#f4511e",
              1000,
              "#b71c1c",
            ],
            "fill-opacity": 0.55,
          },
        });
      }
      if (!map.getLayer(WILDFIRE_LINE_LAYER_ID)) {
        map.addLayer({
          id: WILDFIRE_LINE_LAYER_ID,
          type: "line",
          source: WILDFIRE_SOURCE_ID,
          paint: {
            "line-color": "#7f1d1d",
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1.5, 15, 3],
            "line-opacity": 0.95,
          },
        });
      }
      this.applyLayerState();
    } catch {
      // A basemap style can be between teardown and load; styledata retries.
    }
  }

  applyLayerState() {
    const map = this.map;
    if (!map) return;
    const visibility = this.layerState.visible ? "visible" : "none";
    for (const layerId of [WILDFIRE_FILL_LAYER_ID, WILDFIRE_LINE_LAYER_ID]) {
      if (!map.getLayer(layerId)) continue;
      try {
        map.setLayoutProperty(layerId, "visibility", visibility);
      } catch {
        // Ignore style transitions.
      }
    }
    if (map.getLayer(WILDFIRE_FILL_LAYER_ID)) {
      map.setPaintProperty(
        WILDFIRE_FILL_LAYER_ID,
        "fill-opacity",
        0.55 * this.layerState.opacity,
      );
    }
    if (map.getLayer(WILDFIRE_LINE_LAYER_ID)) {
      map.setPaintProperty(
        WILDFIRE_LINE_LAYER_ID,
        "line-opacity",
        0.95 * this.layerState.opacity,
      );
    }
  }

  destroy() {
    this.stateUnsubscribe?.();
    this.stateUnsubscribe = null;
    this.app.unregisterExternalNativeLayer?.(WILDFIRE_ENTRY_ID);
    const map = this.map;
    if (!map) return;
    map.off("styledata", this.onStyleData);
    for (const layerId of [WILDFIRE_LINE_LAYER_ID, WILDFIRE_FILL_LAYER_ID]) {
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      } catch {
        // Best-effort plugin cleanup during style changes.
      }
    }
    try {
      if (map.getSource(WILDFIRE_SOURCE_ID)) map.removeSource(WILDFIRE_SOURCE_ID);
    } catch {
      // Best-effort plugin cleanup during style changes.
    }
  }
}

class DigitalTwinDemoPanel {
  constructor(app, container) {
    this.app = app;
    this.container = container;
    this.client = null;
    this.region = null;
    this.regions = [];
    this.assetRegionIds = {};
    this.weatherDatasets = [];
    this.visualizationCatalogs = [];
    this.selectedTrees = new Map();
    this.weatherDescriptors = [];
    this.earthEngineDescriptors = [];
    this.addedDescriptorIds = new Set();
    this.activeRun = null;
    this.runEventSource = null;
    this.runEventStartupTimer = null;
    this.runTerminalizing = null;
    this.runArtifactCoordinator = null;
    this.pollAbort = null;
    this.loadAbort = null;
    this.visualizationAbort = null;
    this.weatherRefreshAbort = null;
    this.weatherRefreshTimer = null;
    this.destroyed = false;
    this.submissionKeys = null;
    this.assetMap = new AssetMapController(app, (feature) => this.toggleTree(feature));
    this.wildfireMap = new WildfireMapController(app);
    this.build();
    this.connect();
  }

  build() {
    this.container.replaceChildren();
    this.root = el("div", "dt-demo");

    const main = el("div", "dt-console-main");
    const header = el("header", "dt-console-header");
    const title = el("h2", "dt-title", "Wildfire run");
    this.connectionBadge = el("span", "dt-status dt-status-muted", "Connecting");
    header.append(title, this.connectionBadge);

    const summary = el("div", "dt-scenario-summary");
    const areaSummary = el("div", "dt-summary-item");
    areaSummary.append(
      el("span", "dt-kicker", "Area"),
      (this.areaValue = el("strong", "dt-summary-value", "Not selected")),
    );
    const weatherSummary = el("div", "dt-summary-item");
    weatherSummary.append(
      el("span", "dt-kicker", "Weather"),
      (this.weatherValue = el("strong", "dt-summary-value", "Not available")),
    );
    this.editAreaButton = button("Edit", "dt-text-button dt-summary-edit");
    summary.append(areaSummary, weatherSummary, this.editAreaButton);

    this.connectionNotice = el("div", "dt-connection-alert");
    const noticeCopy = el("div", "dt-connection-copy");
    this.connectionNoticeTitle = el("strong", "", "Connecting to the Engine");
    this.connectionNoticeDetail = el("span", "", "Checking readiness…");
    noticeCopy.append(this.connectionNoticeTitle, this.connectionNoticeDetail);
    this.openEngineButton = button("Open settings", "dt-text-button");
    this.connectionNotice.append(noticeCopy, this.openEngineButton);

    const inputs = el("details", "dt-drawer dt-area-drawer");
    inputs.append(el("summary", "", "Wildfire area and map data"));
    this.editAreaButton.addEventListener("click", () => {
      inputs.open = !inputs.open;
      if (inputs.open) inputs.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    this.apiInput = el("input", "dt-input");
    this.apiInput.type = "url";
    this.apiInput.value = defaultApiUrl();
    this.apiInput.autocomplete = "off";
    this.apiInput.spellcheck = false;
    this.connectButton = button("Reconnect");
    this.connectButton.addEventListener("click", () => this.connect());
    const engineRow = el("div", "dt-inline");
    engineRow.append(this.apiInput, this.connectButton);
    this.engineDetail = el("div", "dt-hint", "Checking Engine readiness…");
    this.engineSection = el("details", "dt-drawer dt-secondary-drawer");
    this.engineSection.append(el("summary", "", "Connection settings"));
    const engineBody = el("div", "dt-drawer-body");
    engineBody.append(labelledField("API URL", engineRow), this.engineDetail);
    this.engineSection.append(engineBody);
    this.openEngineButton.addEventListener("click", () => {
      this.engineSection.open = true;
      this.engineSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    this.regionSelect = el("select", "dt-select");
    this.regionSelect.disabled = true;
    this.regionSelect.addEventListener("change", () => this.loadRegion(this.regionSelect.value));
    this.regionMeta = el("div", "dt-meta-card", "No region loaded.");
    this.weatherAutoHint = el(
      "div",
      "dt-hint",
      "The newest ready weather dataset is used automatically and refreshed in the background.",
    );
    this.sourceStatus = el("div", "dt-source-status");
    this.weatherLayers = el("div", "dt-layer-list");
    this.earthEngineLayers = el("div", "dt-layer-list");
    const inputsBody = el("div", "dt-drawer-body");
    inputsBody.append(
      labelledField("Wildfire simulation region", this.regionSelect),
      this.weatherAutoHint,
      this.regionMeta,
      el(
        "div",
        "dt-hint",
        "The orange boundary limits wildfire inputs and results only. Map data is loaded across every published coverage.",
      ),
    );
    const optionalData = el("details", "dt-nested-details");
    const optionalSummary = el("summary", "", "Map data · all published coverage");
    const optionalBody = el("div", "dt-nested-body");
    optionalBody.append(
      this.sourceStatus,
      el("div", "dt-subhead", "Weather map layers"),
      this.weatherLayers,
      el("div", "dt-subhead", "Earth Engine map layers"),
      this.earthEngineLayers,
    );
    optionalData.append(optionalSummary, optionalBody);
    inputsBody.append(optionalData);
    inputs.append(inputsBody);

    const ignition = el("section", "dt-ignition");
    const ignitionHeading = el("div", "dt-ignition-heading");
    ignitionHeading.append(
      el("span", "dt-ignition-label", "Ignition"),
      el("h3", "", "Pick ignition trees on the map"),
    );
    this.selectionCount = el("strong", "dt-selection-count", "0 selected");
    const ignitionCopy = el("div", "dt-ignition-copy");
    ignitionCopy.append(
      this.selectionCount,
      el("p", "", "Select green tree assets to define where the fire starts."),
    );
    const ignitionBar = el("div", "dt-selection-bar");
    this.clearTreesButton = button("Clear selection", "dt-text-button");
    this.clearTreesButton.disabled = true;
    this.clearTreesButton.addEventListener("click", () => this.clearTrees());
    ignitionBar.append(this.clearTreesButton);
    this.treeList = el("div", "dt-tree-list");
    ignition.append(ignitionHeading, ignitionCopy, ignitionBar, this.treeList);

    const conditions = el("section", "dt-conditions");
    const conditionsHeading = el("div", "dt-section-line");
    conditionsHeading.append(el("span", "dt-kicker", "Conditions"));
    this.editConditionsButton = button("Edit", "dt-text-button");
    conditionsHeading.append(this.editConditionsButton);
    const conditionRows = el("div", "dt-condition-rows");
    const windRow = el("div", "dt-condition-row");
    windRow.append(
      el("span", "dt-condition-label", "Wind"),
      (this.windValue = el("strong", "dt-condition-value", "15 mph east")),
    );
    const durationRow = el("div", "dt-condition-row");
    durationRow.append(
      el("span", "dt-condition-label", "Duration"),
      (this.durationValue = el("strong", "dt-condition-value", "4 h")),
    );
    conditionRows.append(windRow, durationRow);

    this.conditionsDrawer = el("details", "dt-drawer dt-conditions-drawer");
    this.conditionsDrawer.append(el("summary", "", "Edit simulation conditions"));
    this.editConditionsButton.addEventListener("click", () => {
      this.conditionsDrawer.open = !this.conditionsDrawer.open;
    });
    this.windSpeedInput = el("input", "dt-input");
    this.windSpeedInput.type = "number";
    this.windSpeedInput.min = "0";
    this.windSpeedInput.step = "0.5";
    this.windSpeedInput.value = "15";
    this.windUnitSelect = el("select", "dt-select");
    for (const unit of ["mph", "m/s"]) {
      const option = el("option", "", unit);
      option.value = unit;
      this.windUnitSelect.append(option);
    }
    this.windBearingInput = el("input", "dt-input");
    this.windBearingInput.type = "number";
    this.windBearingInput.min = "0";
    this.windBearingInput.max = "359.99";
    this.windBearingInput.step = "1";
    this.windBearingInput.value = "90";
    this.durationInput = el("input", "dt-input");
    this.durationInput.type = "number";
    this.durationInput.min = "0.25";
    this.durationInput.step = "0.25";
    this.durationInput.value = "4";
    for (const control of [
      this.windSpeedInput,
      this.windUnitSelect,
      this.windBearingInput,
      this.durationInput,
    ]) {
      control.addEventListener("input", () => this.updateScenarioSummary());
      control.addEventListener("change", () => this.updateScenarioSummary());
    }
    const scenarioGrid = el("div", "dt-grid");
    scenarioGrid.append(
      labelledField("Wind speed", this.windSpeedInput),
      labelledField("Unit", this.windUnitSelect),
      labelledField("Wind travels toward", this.windBearingInput),
      labelledField("Duration (hours)", this.durationInput),
    );
    const conditionsBody = el("div", "dt-drawer-body");
    conditionsBody.append(
      scenarioGrid,
      el("div", "dt-hint", "Wind direction is the direction the fire travels toward."),
    );
    this.conditionsDrawer.append(conditionsBody);
    conditions.append(conditionsHeading, conditionRows, this.conditionsDrawer);

    const launch = el("div", "dt-launch");
    this.readinessText = el(
      "div",
      "dt-readiness",
      "Choose an area and ignition trees to prepare the run.",
    );
    this.runStatus = el("div", "dt-run-card");
    this.renderRunStatus(null);
    const runActions = el("div", "dt-actions");
    this.runButton = button("Run simulation", "dt-button dt-button-primary");
    this.runButton.disabled = true;
    this.runButton.addEventListener("click", () => this.startRun());
    this.cancelButton = button("Cancel run", "dt-button dt-button-danger");
    this.cancelButton.disabled = true;
    this.cancelButton.addEventListener("click", () => this.cancelRun());
    runActions.append(this.runButton, this.cancelButton);
    launch.append(this.runStatus, this.readinessText, runActions);

    const historyHeader = el("div", "dt-history-header");
    this.refreshRunsButton = button("Refresh", "dt-button dt-button-quiet");
    this.refreshRunsButton.addEventListener("click", () => this.loadHistory());
    historyHeader.append(this.refreshRunsButton);
    this.historyList = el("div", "dt-history-list");
    const history = el("details", "dt-drawer dt-secondary-drawer");
    const historySummary = el("summary", "", "Prior runs");
    const historyBody = el("div", "dt-drawer-body");
    historyBody.append(historyHeader, this.historyList);
    history.append(historySummary, historyBody);

    const secondary = el("div", "dt-secondary-actions");
    secondary.append(this.engineSection, history);

    main.append(
      header,
      summary,
      this.connectionNotice,
      inputs,
      ignition,
      conditions,
    );
    this.root.append(main, launch, secondary);

    this.toast = el("div", "dt-toast");
    this.toast.hidden = true;
    this.root.append(this.toast);
    this.container.append(this.root);
    this.renderTreeList();
    this.renderDescriptorList(this.weatherLayers, [], "Connect to discover weather layers.");
    this.renderDescriptorList(this.earthEngineLayers, [], "Connect to discover Earth Engine layers.");
  }

  setConnection(status, text, detail) {
    this.connectionBadge.className = `dt-status dt-status-${status}`;
    this.connectionBadge.textContent = text;
    this.engineDetail.textContent = detail;
    this.connectionNotice.className = `dt-connection-alert dt-connection-alert-${status}`;
    this.connectionNoticeTitle.textContent =
      status === "ready"
        ? "Engine connected"
        : status === "error"
          ? "Engine unavailable"
          : "Connecting to the Engine";
    this.connectionNoticeDetail.textContent = detail;
    this.connectionNotice.hidden = status === "ready";
    this.updateScenarioSummary();
  }

  showMessage(message, tone = "info") {
    this.toast.hidden = false;
    this.toast.className = `dt-toast dt-toast-${tone}`;
    this.toast.textContent = message;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast.hidden = true;
    }, 6000);
  }

  async connect() {
    this.loadAbort?.abort();
    this.visualizationAbort?.abort();
    this.stopPolling();
    this.runArtifactCoordinator?.stop();
    this.runArtifactCoordinator = null;
    const abort = new AbortController();
    this.loadAbort = abort;
    this.setConnection("muted", "Connecting", "Checking Engine readiness…");
    this.runButton.disabled = true;
    try {
      const baseUrl = normalizeApiBaseUrl(this.apiInput.value);
      this.client = createDigitalTwinClient(baseUrl);
      this.runArtifactCoordinator = createRunArtifactCoordinator(this.client, {
        onArtifact: ({ runId, tick, url, collection }) => {
          if (this.destroyed || this.activeRun?.run_id !== runId) return;
          this.wildfireMap.setData(collection, { runId, tick, sourceUrl: url });
        },
        onError: (error, artifact) => {
          if (this.destroyed || this.activeRun?.run_id !== artifact?.runId) return;
          console.error(
            "[Digital Twin Demo] Could not display a durable simulation tick.",
            error,
          );
          this.showMessage(
            `Tick ${artifact?.tick ?? "artifact"} could not be displayed: ${this.errorMessage(error)}`,
            "warning",
          );
        },
      });
      const [readiness, regionPage, sources] = await Promise.all([
        this.client.ready(abort.signal),
        this.client.listRegions(abort.signal),
        this.client.listDataSources(abort.signal),
      ]);
      if (abort.signal.aborted || this.destroyed) return;
      const catalogRegions = asPageItems(regionPage);
      this.regions = selectDemoRegions(catalogRegions);
      this.assetRegionIds = selectDemoAssetRegionIds(catalogRegions);
      this.populateRegions();
      const readySources = Array.isArray(sources)
        ? sources.filter((source) => source?.ready).length
        : 0;
      this.setConnection(
        "ready",
        "Ready",
        `${this.regions.length} published region${this.regions.length === 1 ? "" : "s"} · ${readySources} ready data source${readySources === 1 ? "" : "s"}`,
      );
      if (typeof window !== "undefined") window.localStorage?.setItem(API_STORAGE_KEY, baseUrl);
      if (this.regions.length > 0) {
        await Promise.all([
          this.loadRegion(this.regionSelect.value),
          this.loadVisualizationDescriptors(),
        ]);
      }
      else {
        this.regionMeta.textContent = "No published regions are available.";
        this.showMessage("The Engine is ready, but it has no published demo region.", "warning");
      }
      await this.loadHistory();
      void readiness;
    } catch (error) {
      if (abort.signal.aborted || this.destroyed) return;
      this.runArtifactCoordinator?.stop();
      this.runArtifactCoordinator = null;
      this.client = null;
      this.setConnection("error", "Offline", this.errorMessage(error));
    }
  }

  populateRegions() {
    this.regionSelect.replaceChildren();
    for (const region of this.regions) {
      const option = el("option", "", region.name ?? region.region_id);
      option.value = region.region_id;
      this.regionSelect.append(option);
    }
    this.regionSelect.disabled = this.regions.length === 0;
    this.assetMap.setRegions(this.regions, this.regionSelect.value);
    this.updateScenarioSummary();
  }

  async loadRegion(regionId) {
    if (!this.client || !regionId) return;
    const assetRegionIds = this.assetRegionIds[regionId] ?? [regionId];
    this.assetMap.setRegions(this.regions, regionId);
    clearInterval(this.weatherRefreshTimer);
    this.weatherRefreshTimer = null;
    this.weatherRefreshAbort?.abort();
    this.weatherRefreshAbort = null;
    this.loadAbort?.abort();
    const abort = new AbortController();
    this.loadAbort = abort;
    this.regionSelect.disabled = true;
    this.clearTrees();
    this.regionMeta.textContent = "Loading region assets and input catalog…";
    try {
      const [region, assets, weatherPage] = await Promise.all([
        this.client.getRegion(regionId, abort.signal),
        this.loadFirstPopulatedAssets(assetRegionIds, abort.signal),
        this.client.getWeatherDatasets(regionId, abort.signal),
      ]);
      if (abort.signal.aborted || this.destroyed) return;
      this.region = region;
      this.weatherDatasets = asPageItems(weatherPage);
      this.assetMap.setData(assets, region.name ?? region.region_id);
      this.app.fitBounds?.(regionBoundsArray(region));
      this.renderRegionMeta(assets);
      this.populateWeather();
      this.startWeatherRefresh();
      this.updateRunAvailability();
    } catch (error) {
      if (abort.signal.aborted || this.destroyed) return;
      this.region = null;
      this.regionMeta.textContent = this.errorMessage(error);
      this.showMessage(this.errorMessage(error), "error");
    } finally {
      if (!this.destroyed) this.regionSelect.disabled = this.regions.length === 0;
    }
  }

  async loadFirstPopulatedAssets(regionIds, signal) {
    let fallback = emptyFeatureCollection();
    for (const regionId of regionIds) {
      const assets = await this.client.getAssetsGeoJson(regionId, signal);
      fallback = assets;
      if (asFeatureCollection(assets).features.length > 0) return assets;
    }
    return fallback;
  }

  renderRegionMeta(assets) {
    const features = asFeatureCollection(assets).features;
    const trees = features.filter((feature) => feature?.properties?.kind === "tree").length;
    const lines = features.filter((feature) => feature?.properties?.kind === "power_line").length;
    const bounds = boundsFromRegion(this.region);
    this.regionMeta.replaceChildren(
      el("strong", "", this.region.name ?? this.region.region_id),
      el("span", "", `${trees.toLocaleString()} trees · ${lines.toLocaleString()} power lines`),
      el(
        "span",
        "dt-mono",
        `${bounds.south.toFixed(3)}, ${bounds.west.toFixed(3)} → ${bounds.north.toFixed(3)}, ${bounds.east.toFixed(3)}`,
      ),
    );
    this.updateScenarioSummary();
  }

  populateWeather() {
    const latest = this.selectedWeather();
    this.weatherAutoHint.textContent = latest
      ? `Using the newest ready dataset from ${formatDateTime(latest.version)}. Updates are checked automatically.`
      : "Waiting for the first ready weather dataset. Updates are checked automatically.";
    this.updateScenarioSummary();
  }

  startWeatherRefresh() {
    clearInterval(this.weatherRefreshTimer);
    this.weatherRefreshTimer = setInterval(
      () => void this.refreshWeatherDatasets(),
      WEATHER_REFRESH_INTERVAL_MS,
    );
  }

  async refreshWeatherDatasets() {
    if (!this.client || !this.region || this.destroyed) return;
    this.weatherRefreshAbort?.abort();
    const abort = new AbortController();
    this.weatherRefreshAbort = abort;
    const regionId = this.region.region_id;
    const previous = this.selectedWeather();
    const previousKey = previous
      ? `${previous.dataset_id}|${previous.version}|${previous.updated_at ?? ""}`
      : "";
    try {
      const weatherPage = await this.client.getWeatherDatasets(regionId, abort.signal);
      if (abort.signal.aborted || this.destroyed || this.region?.region_id !== regionId) return;
      this.weatherDatasets = asPageItems(weatherPage);
      const latest = this.selectedWeather();
      const latestKey = latest
        ? `${latest.dataset_id}|${latest.version}|${latest.updated_at ?? ""}`
        : "";
      this.populateWeather();
      this.updateRunAvailability();
      if (latestKey !== previousKey) await this.loadVisualizationDescriptors();
    } catch (error) {
      if (!abort.signal.aborted && !this.destroyed) {
        console.warn("[Digital Twin Demo] Could not refresh the weather catalog.", error);
      }
    } finally {
      if (this.weatherRefreshAbort === abort) this.weatherRefreshAbort = null;
    }
  }

  updateScenarioSummary() {
    if (!this.areaValue || !this.weatherValue) return;
    const selectedRegion = this.region ??
      this.regions.find((candidate) => candidate?.region_id === this.regionSelect?.value);
    this.areaValue.textContent =
      selectedRegion?.name ?? selectedRegion?.region_id ?? "Not selected";
    const weather = this.selectedWeather?.();
    this.weatherValue.textContent = weather
      ? `${String(weather.provider ?? "Weather").toUpperCase()} · ${formatCompactDate(weather.version)}`
      : "Not available";

    if (this.windValue) {
      this.windValue.textContent =
        `${this.windSpeedInput?.value || "—"} ${this.windUnitSelect?.value || "mph"} ${bearingLabel(this.windBearingInput?.value)}`;
    }
    if (this.durationValue) {
      this.durationValue.textContent = `${this.durationInput?.value || "—"} h`;
    }
  }

  renderSourceStatus() {
    this.sourceStatus.replaceChildren();
    const weatherReady = this.visualizationCatalogs.filter((catalog) => catalog.weather).length;
    const earthReady = this.visualizationCatalogs.filter(
      (catalog) => catalog.earthEngine?.ready,
    ).length;
    const datasets = [
      ...new Set(
        this.visualizationCatalogs.flatMap((catalog) =>
          Array.isArray(catalog.earthEngine?.datasets) ? catalog.earthEngine.datasets : [],
        ),
      ),
    ].join(", ");
    const weatherCard = el("div", "dt-source-card");
    weatherCard.append(
      el("span", "dt-source-icon", "W"),
      el(
        "span",
        "",
        `${weatherReady}/${this.regions.length} published coverages with ready weather · newest per coverage`,
      ),
    );
    const earthCard = el("div", "dt-source-card");
    earthCard.append(
      el("span", "dt-source-icon", "EE"),
      el(
        "span",
        "",
        `${earthReady}/${this.regions.length} Earth Engine coverages ready · ${datasets || "none"}`,
      ),
    );
    this.sourceStatus.append(weatherCard, earthCard);
  }

  selectedWeather() {
    return latestReadyWeatherDataset(this.weatherDatasets);
  }

  async loadVisualizationDescriptors() {
    if (!this.client || this.regions.length === 0) return;
    this.visualizationAbort?.abort();
    const abort = new AbortController();
    this.visualizationAbort = abort;
    this.weatherLayers.replaceChildren(
      el("div", "dt-loading", "Discovering weather across published coverage…"),
    );
    this.earthEngineLayers.replaceChildren(
      el("div", "dt-loading", "Discovering Earth Engine coverage…"),
    );
    try {
      const catalogs = await loadPublishedVisualizationCatalogs(
        this.client,
        this.regions,
        abort.signal,
      );
      if (abort.signal.aborted || this.destroyed) return;
      this.visualizationCatalogs = catalogs;
      this.weatherDescriptors = catalogs.flatMap((catalog) => catalog.weatherDescriptors);
      this.earthEngineDescriptors = catalogs.flatMap(
        (catalog) => catalog.earthEngineDescriptors,
      );
      this.renderSourceStatus();
      this.renderDescriptorList(
        this.weatherLayers,
        this.weatherDescriptors,
        "No renderable weather bands were published.",
      );
      this.renderDescriptorList(
        this.earthEngineLayers,
        this.earthEngineDescriptors,
        "No renderable Earth Engine layers were published.",
      );
    } catch (error) {
      if (abort.signal.aborted || this.destroyed) return;
      this.weatherDescriptors = [];
      this.earthEngineDescriptors = [];
      this.renderDescriptorList(this.weatherLayers, [], this.errorMessage(error));
      this.renderDescriptorList(this.earthEngineLayers, [], this.errorMessage(error));
    } finally {
      if (this.visualizationAbort === abort) this.visualizationAbort = null;
    }
  }

  renderDescriptorList(container, descriptors, emptyMessage) {
    container.replaceChildren();
    const groups = groupVisualizationDescriptors(descriptors);
    if (!groups.length) {
      container.append(el("div", "dt-empty", emptyMessage));
      return;
    }
    for (const group of groups) {
      const row = el("div", "dt-layer-row");
      const copy = el("div", "dt-layer-copy");
      const coverageCount = new Set(
        group.descriptors.map((descriptor) => descriptor.coverage_region_id),
      ).size;
      copy.append(
        el("strong", "", group.name ?? "Map layer"),
        el(
          "span",
          "",
          [
            group.band,
            group.units,
            group.format?.toUpperCase(),
            `${coverageCount} coverage${coverageCount === 1 ? "" : "s"}`,
          ]
            .filter(Boolean)
            .join(" · "),
        ),
      );
      const allAdded = group.descriptors.every((descriptor) =>
        this.addedDescriptorIds.has(descriptor.layer_id),
      );
      const add = button(
        allAdded ? "Added" : "Add all",
        "dt-button dt-button-small",
      );
      add.disabled = allAdded;
      add.addEventListener("click", () => this.addMapDescriptorGroup(group, add));
      row.append(copy, add);
      container.append(row);
    }
  }

  async addMapDescriptorGroup(group, control) {
    if (!this.client) return;
    control.disabled = true;
    control.textContent = "Adding…";
    const failures = [];
    for (const descriptor of group.descriptors) {
      if (this.addedDescriptorIds.has(descriptor.layer_id)) continue;
      try {
        await this.addMapDescriptor(descriptor, group.descriptors.length > 1);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length === 0) {
      control.textContent = "Added";
      this.showMessage(
        `${group.name} added across ${group.descriptors.length} published coverage${group.descriptors.length === 1 ? "" : "s"}.`,
        "success",
      );
      return;
    }
    const addedCount = group.descriptors.filter((descriptor) =>
      this.addedDescriptorIds.has(descriptor.layer_id),
    ).length;
    control.disabled = false;
    control.textContent = addedCount > 0 ? "Retry missing" : "Retry";
    this.showMessage(
      addedCount > 0
        ? `${group.name} added across ${addedCount}/${group.descriptors.length} coverages. Retry to load the missing coverage.`
        : this.errorMessage(failures[0]),
      addedCount > 0 ? "warning" : "error",
    );
  }

  async addMapDescriptor(descriptor, includeCoverageName = false) {
    const layerId = nonEmptyString(descriptor.layer_id, "Layer ID");
    const url = this.client.resolveUrl(descriptor.url ?? descriptor.tile_url);
    const layerName = includeCoverageName
      ? `${descriptor.name ?? layerId} · ${descriptor.coverage_region_name}`
      : descriptor.name ?? layerId;
    if (descriptor.format === "cog") {
      if (!this.app.addCogLayer) throw new Error("This GeoLibre build cannot add COG layers.");
      const style = descriptor.default_style ?? {};
      await this.app.addCogLayer(layerName, url, {
        colormap: style.colormap,
        rescaleMin: style.rescale_min,
        rescaleMax: style.rescale_max,
        opacity: style.opacity ?? 0.65,
      });
    } else if (descriptor.format === "xyz") {
      if (!this.app.addTileLayer) throw new Error("This GeoLibre build cannot add XYZ layers.");
      this.app.addTileLayer(layerName, url, {
        bounds: Array.isArray(descriptor.bounds) ? descriptor.bounds : undefined,
        attribution: descriptor.attribution,
        opacity: descriptor.default_style?.opacity ?? 0.65,
      });
    } else {
      throw new Error(`Unsupported Engine map-layer format: ${descriptor.format ?? "unknown"}.`);
    }
    this.addedDescriptorIds.add(layerId);
  }

  toggleTree(feature) {
    if (this.activeRun && !TERMINAL_RUN_STATUSES.has(runStatusValue(this.activeRun))) return;
    const id = treeAssetId(feature);
    if (this.selectedTrees.has(id)) {
      this.selectedTrees.delete(id);
    } else {
      if (this.selectedTrees.size >= 100) {
        this.showMessage("The Engine accepts at most 100 ignition points.", "warning");
        return;
      }
      this.selectedTrees.set(id, feature);
    }
    this.submissionKeys = null;
    this.renderTreeList();
  }

  clearTrees() {
    this.selectedTrees.clear();
    this.submissionKeys = null;
    this.renderTreeList();
  }

  renderTreeList() {
    if (!this.treeList) return;
    const features = [...this.selectedTrees.values()];
    this.selectionCount.textContent = `${features.length} selected`;
    this.clearTreesButton.disabled = features.length === 0;
    this.clearTreesButton.hidden = features.length === 0;
    this.treeList.replaceChildren();
    this.treeList.hidden = features.length === 0;
    if (features.length) {
      for (const feature of features) {
        const summary = selectedTreeSummary(feature);
        const row = el("div", "dt-tree-row");
        const copy = el("div", "dt-tree-copy");
        copy.append(
          el("strong", "", summary.title),
          el("span", "dt-mono", summary.assetId),
          el("span", "", summary.detail),
        );
        const remove = button("Remove", "dt-button dt-button-small dt-button-danger");
        remove.title = `Remove ${summary.assetId}`;
        remove.setAttribute("aria-label", remove.title);
        remove.addEventListener("click", () => this.toggleTree(feature));
        row.append(copy, remove);
        this.treeList.append(row);
      }
    }
    this.assetMap.setSelection(features);
    this.updateScenarioSummary();
    this.updateRunAvailability();
  }

  updateRunAvailability() {
    if (!this.runButton) return;
    const active = this.activeRun && !TERMINAL_RUN_STATUSES.has(runStatusValue(this.activeRun));
    this.runButton.disabled =
      !this.client ||
      !this.region ||
      !this.selectedWeather() ||
      this.selectedTrees.size === 0 ||
      Boolean(active);
    this.cancelButton.disabled = !active;
    const regionReady = Boolean(this.client && this.region && this.selectedWeather());
    const ignitionReady = regionReady && this.selectedTrees.size > 0;
    if (this.readinessText) {
      this.readinessText.className = `dt-readiness${ignitionReady ? " dt-readiness-ready" : ""}`;
      this.readinessText.textContent = active
        ? "Simulation in progress. You can monitor or cancel this run."
        : ignitionReady
          ? "All set. Review conditions and run the simulation."
          : !this.client
            ? "Connect to the Engine to prepare a simulation."
            : !regionReady
              ? "Choose an area and wait for the latest weather dataset."
              : "Select at least one ignition tree on the map.";
    }
  }

  submissionKeySet(candidate) {
    const signature = JSON.stringify(candidate);
    if (!this.submissionKeys || this.submissionKeys.signature !== signature) {
      this.submissionKeys = {
        signature,
        scenario: makeId("scenario"),
        run: makeId("run"),
        request: makeId("request"),
      };
    }
    return this.submissionKeys;
  }

  async startRun() {
    if (!this.client || !this.region) return;
    try {
      const weather = this.selectedWeather();
      const selected = [...this.selectedTrees.values()];
      const scenarioCandidate = buildScenarioRequest({
        region: this.region,
        weatherVersion: weather?.version,
        windSpeed: this.windSpeedInput.value,
        windUnit: this.windUnitSelect.value,
        windBearing: this.windBearingInput.value,
        durationHours: this.durationInput.value,
      });
      buildRunRequest("pending-scenario", selected);
      const keys = this.submissionKeySet({ scenarioCandidate, selected: selected.map(treeAssetId) });
      this.setSubmitting(true);
      this.renderRunStatus({
        status: "CREATING_SCENARIO",
        region_id: this.region.region_id,
        tick_refs: [],
      });
      const scenario = await this.client.createScenario(scenarioCandidate, {
        idempotencyKey: keys.scenario,
        requestId: keys.request,
      });
      const runCandidate = buildRunRequest(scenario.scenario_id, selected);
      this.renderRunStatus({
        status: "SUBMITTING",
        region_id: this.region.region_id,
        scenario_id: scenario.scenario_id,
        tick_refs: [],
      });
      const accepted = await this.client.createRun(runCandidate, {
        idempotencyKey: keys.run,
        requestId: keys.request,
      });
      this.activeRun = {
        ...accepted,
        status: accepted.status?.toUpperCase?.() ?? "QUEUED",
        region_id: this.region.region_id,
        tick_refs: [],
      };
      this.runArtifactCoordinator?.begin(accepted.run_id);
      this.wildfireMap.clear();
      this.renderRunStatus(this.activeRun);
      this.updateRunAvailability();
      this.monitorRun(accepted.run_id);
      await this.loadHistory();
    } catch (error) {
      this.setSubmitting(false);
      this.renderRunStatus({
        status: "SUBMISSION_FAILED",
        failure: { error_message: this.errorMessage(error) },
        tick_refs: [],
      });
      this.showMessage(this.errorMessage(error), "error");
    }
  }

  setSubmitting(submitting) {
    this.runButton.disabled = submitting;
    this.regionSelect.disabled = submitting;
    for (const input of [
      this.windSpeedInput,
      this.windUnitSelect,
      this.windBearingInput,
      this.durationInput,
    ]) {
      input.disabled = submitting;
    }
  }

  monitorRun(runId) {
    this.stopRunMonitoring();
    this.runArtifactCoordinator?.begin(runId);
    let receivedProgress = false;
    let pollingFallbackStarted = false;
    const startPollingFallback = () => {
      if (
        pollingFallbackStarted ||
        this.destroyed ||
        this.activeRun?.run_id !== runId ||
        TERMINAL_RUN_STATUSES.has(runStatusValue(this.activeRun))
      ) {
        return;
      }
      pollingFallbackStarted = true;
      clearTimeout(this.runEventStartupTimer);
      this.runEventStartupTimer = null;
      this.runEventSource?.close();
      this.runEventSource = null;
      this.showMessage("Live progress unavailable; monitoring this run by status polling.", "warning");
      void this.pollRun(runId);
    };

    try {
      this.runEventSource = this.client.watchRun(runId, {
        onProgress: (progress) => {
          if (
            this.destroyed ||
            this.activeRun?.run_id !== runId ||
            pollingFallbackStarted
          ) {
            return;
          }
          receivedProgress = true;
          clearTimeout(this.runEventStartupTimer);
          this.runEventStartupTimer = null;
          this.activeRun = mergeRunProgress(this.activeRun, progress);
          this.renderRunStatus(this.activeRun);
          this.updateRunAvailability();
          void this.runArtifactCoordinator?.update(progress);
          if (TERMINAL_RUN_STATUSES.has(runStatusValue(this.activeRun))) {
            void this.finishRun(runId);
          }
        },
        onError: (error) => {
          if (this.destroyed || pollingFallbackStarted) return;
          if (error instanceof Error) {
            this.showMessage(`Live progress stopped: ${this.errorMessage(error)}`, "error");
            startPollingFallback();
            return;
          }
          // EventSource resumes transient drops with its last received SSE id.
          // Before the first event, or after a permanent close, REST is the
          // compatibility recovery path.
          if (!receivedProgress || this.runEventSource?.readyState === 2) {
            startPollingFallback();
          }
        },
      });
      this.runEventStartupTimer = setTimeout(startPollingFallback, 10_000);
    } catch {
      startPollingFallback();
    }
  }

  async finishRun(runId) {
    if (this.runTerminalizing === runId) return;
    this.runTerminalizing = runId;
    const streamedStatus = runStatusValue(this.activeRun);
    const streamedCompletedTicks = this.activeRun?.completed_ticks;
    const streamedTotalTicks = this.activeRun?.total_ticks;
    this.stopRunMonitoring();
    this.runArtifactCoordinator?.stop();
    this.setSubmitting(false);
    try {
      try {
        const run = await this.client.getRun(runId);
        if (this.destroyed || this.activeRun?.run_id !== runId) return;
        this.activeRun = {
          ...run,
          ...(Number.isInteger(streamedCompletedTicks)
            ? { completed_ticks: streamedCompletedTicks }
            : {}),
          ...(Number.isInteger(streamedTotalTicks) ? { total_ticks: streamedTotalTicks } : {}),
        };
        this.renderRunStatus(this.activeRun);
        this.updateRunAvailability();
      } catch (error) {
        if (!this.destroyed) {
          this.showMessage(
            `Run finished, but its final status could not be refreshed: ${this.errorMessage(error)}`,
            "warning",
          );
        }
      }
      if (!this.destroyed && streamedStatus === "COMPLETED") {
        await this.showResult(runId);
      }
      if (!this.destroyed) await this.loadHistory();
    } finally {
      if (this.runTerminalizing === runId) this.runTerminalizing = null;
    }
  }

  async pollRun(runId) {
    this.stopPolling();
    const abort = new AbortController();
    this.pollAbort = abort;
    const startedAt = Date.now();
    try {
      while (!abort.signal.aborted && !this.destroyed) {
        const run = await this.client.getRun(runId, abort.signal);
        this.activeRun = run;
        this.renderRunStatus(run);
        this.updateRunAvailability();
        const status = runStatusValue(run);
        if (TERMINAL_RUN_STATUSES.has(status)) {
          await this.finishRun(run.run_id);
          return;
        }
        const delay = Date.now() - startedAt > 30_000 ? 2000 : 1000;
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, delay);
          abort.signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              reject(new DOMException("Aborted", "AbortError"));
            },
            { once: true },
          );
        });
      }
    } catch (error) {
      if (abort.signal.aborted || this.destroyed) return;
      this.setSubmitting(false);
      this.showMessage(`Run monitoring stopped: ${this.errorMessage(error)}`, "error");
    }
  }

  stopRunMonitoring() {
    clearTimeout(this.runEventStartupTimer);
    this.runEventStartupTimer = null;
    this.runEventSource?.close();
    this.runEventSource = null;
    this.stopPolling();
  }

  stopPolling() {
    this.pollAbort?.abort();
    this.pollAbort = null;
  }

  async cancelRun() {
    if (!this.client || !this.activeRun?.run_id) return;
    this.cancelButton.disabled = true;
    try {
      const run = await this.client.cancelRun(this.activeRun.run_id);
      this.activeRun = run;
      this.renderRunStatus(run);
      this.updateRunAvailability();
      if (TERMINAL_RUN_STATUSES.has(runStatusValue(run))) {
        await this.finishRun(run.run_id);
      }
    } catch (error) {
      this.showMessage(this.errorMessage(error), "error");
      this.updateRunAvailability();
    }
  }

  renderRunStatus(run) {
    this.runStatus.replaceChildren();
    if (!run) {
      this.runStatus.hidden = true;
      return;
    }
    this.runStatus.hidden = false;
    const status = runStatusValue(run);
    this.runStatus.className = `dt-run-card dt-run-${status.toLowerCase().replaceAll("_", "-")}`;
    const header = el("div", "dt-run-header");
    header.append(
      el("span", "dt-run-status", status.replaceAll("_", " ")),
      el("span", "dt-mono", run.run_id ?? run.scenario_id ?? ""),
    );
    const completedTicks = Number.isInteger(run.completed_ticks)
      ? run.completed_ticks
      : Array.isArray(run.tick_refs)
        ? run.tick_refs.length
        : 0;
    const totalTicks = Number.isInteger(run.total_ticks) ? run.total_ticks : null;
    const detail = el("div", "dt-run-detail");
    detail.append(
      el(
        "span",
        "",
        totalTicks
          ? `${completedTicks} / ${totalTicks} ticks completed`
          : `${completedTicks} tick${completedTicks === 1 ? "" : "s"} produced`,
      ),
      el("span", "", run.region_id ? `Region ${run.region_id}` : ""),
    );
    const failure = safeRunFailure(run);
    this.runStatus.append(header, detail);
    if (totalTicks) {
      const progress = el("progress", "dt-run-progress");
      progress.max = totalTicks;
      progress.value = Math.min(completedTicks, totalTicks);
      progress.setAttribute("aria-label", "Simulation tick progress");
      this.runStatus.append(progress);
    }
    if (failure) this.runStatus.append(el("div", "dt-run-failure", failure));
  }

  async showResult(runId, signal) {
    if (!this.client) return;
    try {
      const result = asFeatureCollection(
        await this.client.getResult(runId, signal),
        "Simulation result",
      );
      const sourceUrl = this.client.resolveUrl(
        `/api/v1/simulation-runs/${encodeURIComponent(runId)}/result.geojson`,
      );
      const tick = Number(result.features[0]?.properties?.tick);
      this.wildfireMap.setData(result, {
        runId,
        tick: Number.isInteger(tick) ? tick : null,
        sourceUrl,
      });
      const bounds = geoJsonBounds(result);
      if (bounds) this.app.fitBounds?.(bounds);
      const properties = result.features[0]?.properties ?? {};
      this.showMessage(
        `Run completed: ${Number(properties.active_cell_count ?? 0).toLocaleString()} active cells at tick ${properties.tick ?? "final"}.`,
        "success",
      );
    } catch (error) {
      if (signal?.aborted) return;
      this.showMessage(`Run completed, but the result could not be displayed: ${this.errorMessage(error)}`, "error");
    }
  }

  async loadHistory() {
    if (!this.client || this.destroyed) return;
    this.refreshRunsButton.disabled = true;
    try {
      const page = await this.client.listRuns();
      this.renderHistory(asPageItems(page));
    } catch (error) {
      this.historyList.replaceChildren(el("div", "dt-empty", this.errorMessage(error)));
    } finally {
      if (!this.destroyed) this.refreshRunsButton.disabled = false;
    }
  }

  renderHistory(runs) {
    this.historyList.replaceChildren();
    if (!runs.length) {
      this.historyList.append(el("div", "dt-empty", "No simulation runs yet."));
      return;
    }
    for (const run of runs) {
      const row = el("div", "dt-history-row");
      const copy = el("div", "dt-history-copy");
      copy.append(
        el("strong", "", runStatusValue(run)),
        el("span", "dt-mono", run.run_id),
        el(
          "span",
          "",
          `${Array.isArray(run.tick_refs) ? run.tick_refs.length : 0} ticks · ${run.region_id}`,
        ),
      );
      const action = button(
        runStatusValue(run) === "COMPLETED" ? "Show" : "Monitor",
        "dt-button dt-button-small",
      );
      action.addEventListener("click", () => {
        if (runStatusValue(run) === "COMPLETED") void this.showResult(run.run_id);
        else {
          this.activeRun = run;
          this.renderRunStatus(run);
          this.monitorRun(run.run_id);
        }
      });
      row.append(copy, action);
      this.historyList.append(row);
    }
  }

  errorMessage(error) {
    if (error instanceof ApiProblem || error instanceof Error) return error.message;
    return "The Engine request could not be completed.";
  }

  destroy() {
    this.destroyed = true;
    this.loadAbort?.abort();
    this.visualizationAbort?.abort();
    this.weatherRefreshAbort?.abort();
    clearInterval(this.weatherRefreshTimer);
    this.stopRunMonitoring();
    this.runArtifactCoordinator?.stop();
    this.runArtifactCoordinator = null;
    clearTimeout(this.toastTimer);
    this.wildfireMap.destroy();
    this.assetMap.destroy();
    this.container.replaceChildren();
  }
}

function geoJsonBounds(collection) {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  const visit = (coordinates) => {
    if (
      Array.isArray(coordinates) &&
      coordinates.length >= 2 &&
      typeof coordinates[0] === "number" &&
      typeof coordinates[1] === "number"
    ) {
      west = Math.min(west, coordinates[0]);
      east = Math.max(east, coordinates[0]);
      south = Math.min(south, coordinates[1]);
      north = Math.max(north, coordinates[1]);
      return;
    }
    if (Array.isArray(coordinates)) coordinates.forEach(visit);
  };
  for (const feature of collection.features) visit(feature?.geometry?.coordinates);
  return [west, south, east, north].every(Number.isFinite)
    ? [west, south, east, north]
    : null;
}

let unregisterPanel = null;
let panelInstance = null;

export const plugin = {
  id: PLUGIN_ID,
  name: PLUGIN_NAME,
  version: PLUGIN_VERSION,
  activate(app) {
    if (!app.registerRightPanel) return false;
    unregisterPanel =
      app.registerRightPanel({
        id: PANEL_ID,
        title: PLUGIN_NAME,
        dock: "right-of-style",
        defaultWidth: 380,
        render(container) {
          panelInstance = new DigitalTwinDemoPanel(app, container);
          return () => {
            panelInstance?.destroy();
            panelInstance = null;
          };
        },
      }) ?? null;
    app.openRightPanel?.(PANEL_ID);
    return true;
  },
  deactivate(app) {
    panelInstance?.destroy();
    panelInstance = null;
    app.closeRightPanel?.(PANEL_ID);
    unregisterPanel?.();
    unregisterPanel = null;
  },
};

export default plugin;
