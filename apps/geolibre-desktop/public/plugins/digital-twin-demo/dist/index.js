const PLUGIN_ID = "digital-twin-demo";
const PLUGIN_NAME = "Digital Twin Demo";
const PLUGIN_VERSION = "0.4.0";
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
const SELECTION_HALO_LAYER_ID = "digital-twin-demo-selection-halo";
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
  const liveFrameIntervalMs = Number.isFinite(callbacks.liveFrameIntervalMs)
    ? Math.max(0, Math.min(1000, callbacks.liveFrameIntervalMs))
    : 120;
  const now =
    typeof callbacks.now === "function"
      ? callbacks.now
      : () => globalThis.performance?.now?.() ?? Date.now();
  const wait =
    typeof callbacks.wait === "function"
      ? callbacks.wait
      : (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  let generation = 0;
  const activeAborts = new Set();
  let activePromise = null;
  let applyTail = Promise.resolve(null);
  let activeRunId = null;
  let latestRequestedTick = 0;
  let latestRequestedUrl = null;
  let latestAppliedTick = 0;
  let lastAppliedAt = null;
  const cache = new Map();

  const begin = (runId) => {
    const normalizedRunId = nonEmptyString(runId, "Run ID");
    if (activeRunId === normalizedRunId) return;
    generation += 1;
    for (const abort of activeAborts) abort.abort();
    activeAborts.clear();
    activePromise = null;
    applyTail = Promise.resolve(null);
    activeRunId = normalizedRunId;
    latestRequestedTick = 0;
    latestRequestedUrl = null;
    latestAppliedTick = 0;
    lastAppliedAt = null;
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
    const requestGeneration = generation;
    const abort = new AbortController();
    activeAborts.add(abort);
    const cached = cache.get(artifact.artifactUrl);
    const fetchPromise = (async () => {
      try {
        const response = await client.getRunArtifact(artifact.artifactUrl, {
          etag: cached?.etag,
          signal: abort.signal,
        });
        return { response };
      } catch (error) {
        return { error };
      } finally {
        activeAborts.delete(abort);
      }
    })();
    activePromise = applyTail.then(async () => {
      const outcome = await fetchPromise;
      if (
        abort.signal.aborted ||
        requestGeneration !== generation ||
        activeRunId !== artifact.runId
      ) {
        return null;
      }
      if ("error" in outcome) {
        if (outcome.error?.name !== "AbortError") callbacks.onError?.(outcome.error, artifact);
        return null;
      }
      try {
        if (lastAppliedAt !== null && liveFrameIntervalMs > 0) {
          const remaining = liveFrameIntervalMs - Math.max(0, now() - lastAppliedAt);
          if (remaining > 0) await wait(remaining);
          if (
            abort.signal.aborted ||
            requestGeneration !== generation ||
            activeRunId !== artifact.runId
          ) {
            return null;
          }
        }
        const response = outcome.response;
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
        lastAppliedAt = now();
        return applied;
      } catch (error) {
        callbacks.onError?.(error, artifact);
        return null;
      }
    });
    applyTail = activePromise.catch(() => null);
    return activePromise;
  };

  const updateRun = (run) =>
    Promise.all(
      buildSimulationReplayFrames(run).map((frame) =>
        update({
          run_id: frame.runId,
          completed_ticks: frame.tick,
          tick: frame.tick,
          artifact_url: frame.artifactUrl,
        }),
      ),
    );

  const flush = () => applyTail;

  const stop = () => {
    generation += 1;
    for (const abort of activeAborts) abort.abort();
    activeAborts.clear();
    activePromise = null;
    applyTail = Promise.resolve(null);
    lastAppliedAt = null;
  };

  return {
    begin,
    update,
    updateRun,
    flush,
    stop,
    get latestAppliedTick() {
      return latestAppliedTick;
    },
  };
}

export function buildSimulationReplayFrames(run) {
  if (!isRecord(run)) throw new Error("A completed simulation run is required.");
  const runId = nonEmptyString(run.run_id, "Run ID");
  const refs = Array.isArray(run.tick_refs) ? run.tick_refs : [];
  const ticks = new Set();
  for (const ref of refs) {
    if (!isRecord(ref) || !Number.isInteger(ref.tick) || ref.tick < 1) continue;
    ticks.add(ref.tick);
  }
  const completedTicks = Number(run.completed_ticks);
  // Terminal REST runs carry the complete authoritative tick_refs lineage. Its
  // tick 0 is the initial state and has no public artifact route (the route is
  // explicitly positive-only), so replay only the positive references. Live
  // progress does not expose internal refs and instead supplies a count.
  if (refs.length === 0 && Number.isInteger(completedTicks) && completedTicks > 0) {
    for (let tick = 1; tick <= completedTicks; tick += 1) ticks.add(tick);
    if (Number.isInteger(run.tick) && run.tick > 0) ticks.add(run.tick);
  }
  const encodedRunId = encodeURIComponent(runId);
  return [...ticks]
    .sort((left, right) => left - right)
    .map((tick) => ({
      runId,
      tick,
      artifactUrl: `/api/v1/simulation-runs/${encodedRunId}/ticks/${tick}/result.geojson`,
    }));
}

export const REPLAY_CACHE_MAX_FRAMES = 48;
export const REPLAY_PREFETCH_RADIUS = 12;
export const REPLAY_PREFETCH_CONCURRENCY = 4;

export function createSimulationReplayController(client, callbacks = {}) {
  if (!client || typeof client.getRunArtifact !== "function") {
    throw new Error("A simulation replay artifact client is required.");
  }
  const prefetchRadius = Number.isFinite(callbacks.prefetchRadius)
    ? Math.max(0, Math.min(REPLAY_CACHE_MAX_FRAMES - 1, Math.round(callbacks.prefetchRadius)))
    : REPLAY_PREFETCH_RADIUS;
  const prefetchConcurrency = Number.isFinite(callbacks.prefetchConcurrency)
    ? Math.max(1, Math.min(8, Math.round(callbacks.prefetchConcurrency)))
    : REPLAY_PREFETCH_CONCURRENCY;
  let runGeneration = 0;
  let selectionGeneration = 0;
  let runId = null;
  let frames = [];
  let frameByTick = new Map();
  let frameIndexByTick = new Map();
  let currentTick = null;
  const cache = new Map();
  const activeRequests = new Map();

  const getCachedFrame = (artifactUrl) => {
    const cached = cache.get(artifactUrl);
    if (!cached) return null;
    cache.delete(artifactUrl);
    cache.set(artifactUrl, cached);
    return cached;
  };

  const rememberFrame = (artifactUrl, value) => {
    cache.delete(artifactUrl);
    cache.set(artifactUrl, value);
    while (cache.size > REPLAY_CACHE_MAX_FRAMES) {
      cache.delete(cache.keys().next().value);
    }
  };

  const stopRequests = () => {
    runGeneration += 1;
    selectionGeneration += 1;
    for (const request of activeRequests.values()) request.abort.abort();
    activeRequests.clear();
  };

  const setRun = (run) => {
    stopRequests();
    const nextFrames = buildSimulationReplayFrames(run);
    const nextRunId = nextFrames[0]?.runId ?? nonEmptyString(run.run_id, "Run ID");
    if (nextRunId !== runId) cache.clear();
    frames = nextFrames;
    frameByTick = new Map(frames.map((frame) => [frame.tick, frame]));
    frameIndexByTick = new Map(frames.map((frame, index) => [frame.tick, index]));
    runId = nextRunId;
    currentTick = null;
    callbacks.onRunChange?.({ runId, frames: [...frames] });
    return [...frames];
  };

  const frameForTick = (tick) => {
    const frame = frameByTick.get(tick);
    if (!frame || frame.runId !== runId) {
      throw new Error(`Simulation tick ${tick} is not available for replay.`);
    }
    return frame;
  };

  const loadFrame = (frame) => {
    const cached = getCachedFrame(frame.artifactUrl);
    if (cached) return Promise.resolve({ ...frame, ...cached });
    const existing = activeRequests.get(frame.artifactUrl);
    if (existing) return existing.promise;

    const requestRunGeneration = runGeneration;
    const abort = new AbortController();
    const promise = (async () => {
      try {
        const response = await client.getRunArtifact(frame.artifactUrl, {
          signal: abort.signal,
        });
        if (
          abort.signal.aborted ||
          requestRunGeneration !== runGeneration ||
          frame.runId !== runId
        ) {
          return null;
        }
        const data = response.notModified
          ? getCachedFrame(frame.artifactUrl)?.collection
          : response.data;
        if (!data) throw new Error("Engine returned an empty simulation replay artifact.");
        const collection = asFeatureCollection(data, `Simulation replay tick ${frame.tick}`);
        const cachedFrame = {
          collection,
          etag: response.etag ?? null,
          url: response.url ?? client.resolveUrl?.(frame.artifactUrl) ?? frame.artifactUrl,
        };
        rememberFrame(frame.artifactUrl, cachedFrame);
        return { ...frame, ...cachedFrame };
      } finally {
        const active = activeRequests.get(frame.artifactUrl);
        if (active?.abort === abort) activeRequests.delete(frame.artifactUrl);
      }
    })();
    activeRequests.set(frame.artifactUrl, { abort, promise });
    return promise;
  };

  const prefetchTick = async (tick) => {
    if (prefetchRadius === 0 || frames.length === 0) return [];
    const centerIndex = frameIndexByTick.get(tick);
    if (centerIndex === undefined) return [];
    const requestRunGeneration = runGeneration;
    const targets = [frames[centerIndex]];
    for (let distance = 1; distance <= prefetchRadius; distance += 1) {
      if (frames[centerIndex - distance]) targets.push(frames[centerIndex - distance]);
      if (frames[centerIndex + distance]) targets.push(frames[centerIndex + distance]);
    }
    let cursor = 0;
    const loaded = [];
    const worker = async () => {
      while (cursor < targets.length && requestRunGeneration === runGeneration) {
        const frame = targets[cursor];
        cursor += 1;
        try {
          const result = await loadFrame(frame);
          if (result) loaded.push(result);
        } catch (error) {
          if (error?.name !== "AbortError") callbacks.onPrefetchError?.(error, frame);
        }
      }
    };
    await Promise.all(
      Array.from(
        { length: Math.min(prefetchConcurrency, targets.length) },
        () => worker(),
      ),
    );
    return loaded;
  };

  const primeFrame = (tick, collection, { etag = null, url = null } = {}) => {
    const frame = frameForTick(tick);
    const cachedFrame = {
      collection: asFeatureCollection(collection, `Simulation replay tick ${frame.tick}`),
      etag,
      url: url ?? client.resolveUrl?.(frame.artifactUrl) ?? frame.artifactUrl,
    };
    rememberFrame(frame.artifactUrl, cachedFrame);
    return { ...frame, ...cachedFrame };
  };

  const showTick = async (tick) => {
    const frame = frameForTick(tick);
    const requestSelectionGeneration = ++selectionGeneration;
    const cached = getCachedFrame(frame.artifactUrl);
    if (!cached) callbacks.onLoading?.(frame);
    try {
      const applied = cached ? { ...frame, ...cached } : await loadFrame(frame);
      if (
        !applied ||
        requestSelectionGeneration !== selectionGeneration ||
        frame.runId !== runId
      ) {
        return null;
      }
      if (currentTick !== frame.tick) {
        currentTick = frame.tick;
        callbacks.onFrame?.(applied);
      }
      void prefetchTick(frame.tick);
      return applied;
    } catch (error) {
      if (error?.name === "AbortError") return null;
      callbacks.onError?.(error, frame);
      throw error;
    }
  };

  const destroy = () => {
    stopRequests();
    frames = [];
    frameByTick = new Map();
    frameIndexByTick = new Map();
    runId = null;
    currentTick = null;
    cache.clear();
  };

  return {
    setRun,
    showTick,
    prefetchTick,
    primeFrame,
    stop: stopRequests,
    destroy,
    get frames() {
      return [...frames];
    },
    get currentTick() {
      return currentTick;
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

function ignitionPointCoordinates(feature) {
  if (!isRecord(feature) || !isRecord(feature.geometry) || feature.geometry.type !== "Point") {
    throw new Error("Every ignition point must be a GeoJSON point.");
  }
  const coordinates = feature.geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    throw new Error("Every ignition point must include longitude and latitude.");
  }
  const longitude = finiteNumber(coordinates[0], "Ignition longitude");
  const latitude = finiteNumber(coordinates[1], "Ignition latitude");
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new Error("Ignition point coordinates must be valid WGS84.");
  }
  return [longitude, latitude];
}

function treeAssetId(feature) {
  return nonEmptyString(feature?.properties?.asset_id, "Ignition point ID");
}

export function buildIgnitionPointFeature(coordinates, id = makeId("ignition")) {
  const feature = {
    type: "Feature",
    geometry: { type: "Point", coordinates },
    properties: { kind: "ignition", asset_id: id },
  };
  ignitionPointCoordinates(feature);
  return feature;
}

export function buildRunRequest(scenarioId, selectedTrees) {
  if (!Array.isArray(selectedTrees) || selectedTrees.length === 0) {
    throw new Error("Select at least one ignition point.");
  }
  if (selectedTrees.length > 100) throw new Error("Select no more than 100 ignition points.");
  return {
    scenario_id: nonEmptyString(scenarioId, "Scenario"),
    ignition_points: selectedTrees.map((feature) => ({
      type: "Point",
      coordinates: ignitionPointCoordinates(feature),
    })),
  };
}

export function selectedTreeSummary(feature) {
  const [longitude, latitude] = ignitionPointCoordinates(feature);
  const properties = isRecord(feature.properties) ? feature.properties : {};
  const species =
    typeof properties.species === "string" && properties.species.trim()
      ? properties.species.trim()
      : properties.kind === "tree"
        ? "Tree"
        : "Ignition point";
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

function labelledControl(label, control, className = "") {
  const wrapper = el("div", `dt-field${className ? ` ${className}` : ""}`);
  const labelNode = el("span", "dt-field-label", label);
  const labelId = `dt-field-${makeId("label")}`;
  labelNode.id = labelId;
  control.setAttribute("aria-labelledby", labelId);
  wrapper.append(labelNode, control);
  return wrapper;
}

function createCompassControl(input) {
  const compass = el("div", "dt-compass");
  compass.setAttribute("role", "slider");
  compass.setAttribute("aria-valuemin", "0");
  compass.setAttribute("aria-valuemax", "359");
  compass.setAttribute("aria-orientation", "horizontal");
  compass.tabIndex = 0;
  for (const [label, className] of [
    ["N", "dt-compass-n"],
    ["E", "dt-compass-e"],
    ["S", "dt-compass-s"],
    ["W", "dt-compass-w"],
  ]) {
    compass.append(el("span", `dt-compass-cardinal ${className}`, label));
  }
  const needle = el("img", "dt-compass-needle");
  needle.src = "/plugins/digital-twin-demo/assets/navigation-2.svg";
  needle.alt = "";
  needle.draggable = false;
  const readout = el("output", "dt-compass-readout");
  compass.append(needle, readout);

  const sync = () => {
    const rawValue = Number(input.value);
    const value = Number.isFinite(rawValue) ? ((rawValue % 360) + 360) % 360 : 0;
    const rounded = Math.round(value) % 360;
    const label = bearingLabel(rounded);
    needle.style.transform = `rotate(${rounded}deg)`;
    readout.value = `${rounded}° · ${label}`;
    compass.setAttribute("aria-valuenow", String(rounded));
    compass.setAttribute("aria-valuetext", `${rounded} degrees, ${label}`);
  };
  const setBearingFromPointer = (event) => {
    const bounds = compass.getBoundingClientRect();
    const dx = event.clientX - (bounds.left + bounds.width / 2);
    const dy = event.clientY - (bounds.top + bounds.height / 2);
    const bearing = (Math.atan2(dx, -dy) * 180) / Math.PI;
    input.value = String(Math.round((bearing + 360) % 360));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  let dragging = false;
  compass.addEventListener("pointerdown", (event) => {
    if (input.disabled) return;
    dragging = true;
    compass.setPointerCapture(event.pointerId);
    compass.classList.add("dt-compass-dragging");
    setBearingFromPointer(event);
  });
  compass.addEventListener("pointermove", (event) => {
    if (dragging) setBearingFromPointer(event);
  });
  const stopDragging = (event) => {
    if (!dragging) return;
    dragging = false;
    compass.classList.remove("dt-compass-dragging");
    if (compass.hasPointerCapture(event.pointerId)) compass.releasePointerCapture(event.pointerId);
    compass.focus();
  };
  compass.addEventListener("pointerup", stopDragging);
  compass.addEventListener("pointercancel", stopDragging);
  const setDisabled = (disabled) => {
    compass.classList.toggle("dt-compass-disabled", disabled);
    compass.setAttribute("aria-disabled", String(disabled));
    compass.tabIndex = disabled ? -1 : 0;
  };
  compass.addEventListener("keydown", (event) => {
    if (input.disabled) return;
    const keys = ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    if (event.key === "Home") input.value = "0";
    else if (event.key === "End") input.value = "359";
    else {
      const delta = event.key === "ArrowUp" || event.key === "ArrowRight" ? step : -step;
      input.value = String((Number(input.value || 0) + delta + 360) % 360);
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  input.addEventListener("input", sync);
  sync();
  return { element: compass, setDisabled };
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
  const currentStatus = runStatusValue(run);
  const nextStatus = runStatusValue(progress);
  const merged = {
    ...run,
    ...progress,
    status:
      TERMINAL_RUN_STATUSES.has(currentStatus) && !TERMINAL_RUN_STATUSES.has(nextStatus)
        ? currentStatus
        : nextStatus,
  };
  for (const field of ["completed_ticks", "total_ticks", "tick"]) {
    const currentValue = run[field];
    const nextValue = progress[field];
    if (
      Number.isInteger(currentValue) &&
      currentValue >= 0 &&
      (!Number.isInteger(nextValue) || nextValue < currentValue)
    ) {
      merged[field] = currentValue;
    }
  }
  return merged;
}

function safeRunFailure(run) {
  const failure = run?.failure;
  if (!isRecord(failure)) return null;
  if (typeof failure.error_message === "string" && failure.error_message.trim()) {
    return failure.error_message;
  }
  return "The simulation failed.";
}

export function buildSimulationRunStatusView(run) {
  if (!isRecord(run)) return null;
  const status = runStatusValue(run);
  const statusLabel = status.replaceAll("_", " ");
  const completedTicks = Math.max(
    0,
    Number.isInteger(run.completed_ticks)
      ? run.completed_ticks
      : Array.isArray(run.tick_refs)
        ? run.tick_refs.filter((ref) => Number.isInteger(ref?.tick) && ref.tick > 0).length
        : 0,
  );
  const totalTicks =
    Number.isInteger(run.total_ticks) && run.total_ticks > 0 ? run.total_ticks : null;
  const active = !TERMINAL_RUN_STATUSES.has(status);
  const progressRatio =
    totalTicks === null ? null : Math.min(1, Math.max(0, completedTicks / totalTicks));
  return {
    active,
    completedTicks,
    detail: totalTicks
      ? `${completedTicks} / ${totalTicks} ticks completed`
      : `${completedTicks} tick${completedTicks === 1 ? "" : "s"} produced`,
    failure: safeRunFailure(run),
    identifier: String(run.run_id ?? run.scenario_id ?? ""),
    progressRatio,
    progressText: totalTicks
      ? `${completedTicks} of ${totalTicks} simulation ticks completed`
      : `Simulation is ${statusLabel}`,
    regionText: run.region_id ? `Region ${run.region_id}` : "",
    status,
    statusLabel,
    totalTicks,
  };
}

class AssetMapController {
  constructor(app, onIgnitionClick) {
    this.app = app;
    this.onIgnitionClick = onIgnitionClick;
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
    this.treeCursorActive = false;
    this.treeNearEvent = (event) => {
      if (!this.map || !this.mapContainer || !this.layerState.visible) return null;
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
      return nearest;
    };
    this.selectionNearEvent = (event) => {
      if (!this.map || !this.mapContainer || !this.layerState.visible) return null;
      const bounds = this.mapContainer.getBoundingClientRect();
      const point = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      };
      let nearest = null;
      let nearestDistance = 10 ** 2;
      for (const feature of this.selection.features) {
        const coordinates = feature?.geometry?.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length < 2) continue;
        const projected = this.map.project(coordinates);
        const distance = (projected.x - point.x) ** 2 + (projected.y - point.y) ** 2;
        if (distance <= nearestDistance) {
          nearest = feature;
          nearestDistance = distance;
        }
      }
      return nearest;
    };
    this.setTreeCursor = (active) => {
      if (!this.map || !this.mapContainer || active === this.treeCursorActive) return;
      const cursor = active ? "pointer" : "";
      this.map.getCanvas().style.cursor = cursor;
      this.mapContainer.style.cursor = cursor;
      this.treeCursorActive = active;
    };
    this.onMapContainerClick = (event) => {
      const canvas = this.map?.getCanvas?.();
      if (!this.map || !this.mapContainer || !canvas?.contains(event.target)) return;
      const selectedPoint = this.selectionNearEvent(event);
      const nearestTree = this.treeNearEvent(event);
      const bounds = this.mapContainer.getBoundingClientRect();
      const lngLat = this.map.unproject({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
      this.onIgnitionClick(
        selectedPoint ?? nearestTree ?? buildIgnitionPointFeature([lngLat.lng, lngLat.lat]),
      );
    };
    this.onMapContainerMouseMove = (event) => {
      this.setTreeCursor(Boolean(this.selectionNearEvent(event) ?? this.treeNearEvent(event)));
    };
    this.onMapContainerMouseLeave = () => this.setTreeCursor(false);
    this.onEnter = () => {
      this.setTreeCursor(true);
    };
    this.onLeave = () => {
      this.setTreeCursor(false);
    };
    this.map?.on("styledata", this.onStyleData);
    this.mapContainer?.addEventListener("click", this.onMapContainerClick, true);
    this.mapContainer?.addEventListener("mousemove", this.onMapContainerMouseMove, true);
    this.mapContainer?.addEventListener("mouseleave", this.onMapContainerMouseLeave);
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
          description: "Canonical region tree and power-line assets. Click anywhere on the map to place an ignition point.",
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
              0,
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
      if (!map.getLayer(SELECTION_HALO_LAYER_ID)) {
        map.addLayer({
          id: SELECTION_HALO_LAYER_ID,
          type: "circle",
          source: SELECTION_SOURCE_ID,
          paint: {
            "circle-radius": TREE_CIRCLE_RADIUS_PX + 6,
            "circle-color": "#ffffff",
            "circle-stroke-color": "#111827",
            "circle-stroke-width": 2.5,
            "circle-opacity": 0.95,
          },
        });
      }
      if (!map.getLayer(SELECTION_LAYER_ID)) {
        map.addLayer({
          id: SELECTION_LAYER_ID,
          type: "circle",
          source: SELECTION_SOURCE_ID,
          paint: {
            "circle-radius": TREE_CIRCLE_RADIUS_PX + 2,
            "circle-color": "#ff6b35",
            "circle-stroke-color": "#fff7ed",
            "circle-stroke-width": 2,
          },
        });
      }
      // Raster basemaps can add their imagery layer after the plugin responds to
      // an early styledata event. Re-anchor the ignition overlay on every style
      // update so satellite imagery can never cover the selected points.
      if (map.getLayer(SELECTION_HALO_LAYER_ID)) map.moveLayer(SELECTION_HALO_LAYER_ID);
      if (map.getLayer(SELECTION_LAYER_ID)) map.moveLayer(SELECTION_LAYER_ID);
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
    if (!this.layerState.visible) this.setTreeCursor(false);
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
    this.mapContainer?.removeEventListener("mousemove", this.onMapContainerMouseMove, true);
    this.mapContainer?.removeEventListener("mouseleave", this.onMapContainerMouseLeave);
    this.setTreeCursor(false);
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
      SELECTION_HALO_LAYER_ID,
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

export class SimulationReplayControl {
  constructor(onSelectFrame, scheduling = {}) {
    this.onSelectFrame = onSelectFrame;
    this.requestFrame =
      typeof scheduling.requestFrame === "function"
        ? scheduling.requestFrame
        : typeof globalThis.requestAnimationFrame === "function"
          ? (callback) => globalThis.requestAnimationFrame(callback)
          : (callback) => setTimeout(() => callback(Date.now()), 16);
    this.cancelFrame =
      typeof scheduling.cancelFrame === "function"
        ? scheduling.cancelFrame
        : typeof globalThis.cancelAnimationFrame === "function"
          ? (request) => globalThis.cancelAnimationFrame(request)
          : (request) => clearTimeout(request);
    this.map = null;
    this.container = null;
    this.dock = null;
    this.frames = [];
    this.index = -1;
    this.expanded = false;
    this.playing = false;
    this.loop = true;
    this.speed = 800;
    this.playTimer = null;
    this.playGeneration = 0;
    this.advanceInFlight = false;
    this.selectionGeneration = 0;
    this.scrubFrameRequest = null;
    this.pendingScrubIndex = null;
    this.wrapper = null;
    this.mapContainer = null;
    this.savedContainerCss = "";
    this.resizeObserver = null;
    this.dockId = makeId("replay-timeline");
  }

  onAdd(map) {
    this.map = map;
    this.container = el(
      "div",
      "maplibregl-ctrl maplibregl-ctrl-group dt-replay-toggle",
    );
    this.toggleButton = button("↻", "dt-replay-toggle-button");
    this.toggleButton.setAttribute("aria-label", "Toggle simulation replay");
    this.toggleButton.setAttribute("aria-controls", this.dockId);
    this.toggleButton.setAttribute("aria-expanded", "false");
    this.toggleButton.title = "Toggle simulation replay";
    this.toggleButton.addEventListener("click", () => this.setExpanded(!this.expanded));
    this.container.append(this.toggleButton);
    this.buildDock();
    this.mapContainer = map.getContainer?.() ?? null;
    this.installLayout();
    this.syncAvailability();
    return this.container;
  }

  buildDock() {
    this.dock = el("div");
    this.dock.id = this.dockId;
    this.dock.className = "maplibregl-time-slider-dock dt-replay-dock";
    this.dock.setAttribute("role", "group");
    this.dock.setAttribute("aria-label", "Simulation replay timeline");

    const left = el("div", "ts-left");
    const playback = el("div", "ts-playback");
    this.previousButton = button("⏮", "time-slider-btn ts-prev");
    this.previousButton.setAttribute("aria-label", "Previous simulation tick");
    this.previousButton.title = "Previous simulation tick";
    this.previousButton.addEventListener("click", () => {
      void this.goToIndex(this.index - 1, { manual: true });
    });
    this.playButton = button("▶", "time-slider-btn ts-play");
    this.playButton.setAttribute("aria-label", "Play simulation replay");
    this.playButton.title = "Play simulation replay";
    this.playButton.addEventListener("click", () => {
      if (this.playing) this.pause();
      else void this.play();
    });
    this.nextButton = button("⏭", "time-slider-btn ts-next");
    this.nextButton.setAttribute("aria-label", "Next simulation tick");
    this.nextButton.title = "Next simulation tick";
    this.nextButton.addEventListener("click", () => {
      void this.goToIndex(this.index + 1, { manual: true });
    });
    this.loopButton = button("↻", "time-slider-btn ts-loop");
    this.loopButton.setAttribute("aria-label", "Toggle simulation replay loop");
    this.loopButton.title = "Toggle simulation replay loop";
    this.loopButton.setAttribute("aria-pressed", "true");
    this.loopButton.classList.add("ts-active");
    this.loopButton.addEventListener("click", () => {
      this.loop = !this.loop;
      this.loopButton.classList.toggle("ts-active", this.loop);
      this.loopButton.setAttribute("aria-pressed", String(this.loop));
    });
    playback.append(
      this.previousButton,
      this.playButton,
      this.nextButton,
      this.loopButton,
    );
    const speed = el("label", "ts-speed");
    this.speedInput = el("input", "ts-speed-input");
    this.speedInput.type = "number";
    this.speedInput.min = "100";
    this.speedInput.step = "100";
    this.speedInput.value = String(this.speed);
    this.speedInput.title = "Replay speed (milliseconds per tick)";
    this.speedInput.setAttribute("aria-label", "Replay speed in milliseconds per tick");
    this.speedInput.addEventListener("change", () => {
      const nextSpeed = Number.parseInt(this.speedInput.value, 10);
      if (!Number.isFinite(nextSpeed)) return;
      this.speed = Math.max(100, nextSpeed);
      this.speedInput.value = String(this.speed);
      if (this.playing && !this.advanceInFlight) this.scheduleNext();
    });
    speed.append(this.speedInput, el("span", "ts-speed-unit", "ms"));
    left.append(playback, speed);

    const axis = el("div", "dt-replay-axis");
    const axisHeader = el("div", "dt-replay-axis-header");
    this.runLabel = el("strong", "dt-replay-run", "Simulation replay");
    this.tickLabel = el("span", "dt-replay-tick", "No run selected");
    axisHeader.append(this.runLabel, this.tickLabel);
    this.scrubber = el("input", "dt-replay-scrubber");
    this.scrubber.type = "range";
    this.scrubber.min = "0";
    this.scrubber.max = "0";
    this.scrubber.step = "1";
    this.scrubber.value = "0";
    this.scrubber.setAttribute("aria-label", "Simulation replay tick");
    this.scrubber.addEventListener("input", () => {
      this.queueScrub(Number(this.scrubber.value));
    });
    this.scrubber.addEventListener("change", () => {
      this.commitScrub(Number(this.scrubber.value));
    });
    const axisFooter = el("div", "dt-replay-axis-footer");
    this.firstTickLabel = el("span", "", "Tick —");
    this.frameStatus = el("span", "dt-replay-frame-status", "Choose a completed run");
    this.frameStatus.setAttribute("role", "status");
    this.frameStatus.setAttribute("aria-live", "polite");
    this.lastTickLabel = el("span", "", "Tick —");
    axisFooter.append(this.firstTickLabel, this.frameStatus, this.lastTickLabel);
    axis.append(axisHeader, this.scrubber, axisFooter);

    const right = el("div", "ts-right");
    this.closeButton = button("▾", "time-slider-btn ts-collapse-btn");
    this.closeButton.setAttribute("aria-label", "Hide simulation replay timeline");
    this.closeButton.title = "Hide simulation replay timeline";
    this.closeButton.addEventListener("click", () => {
      this.setExpanded(false);
      this.toggleButton?.focus();
    });
    right.append(this.closeButton);
    this.dock.append(left, axis, right);
  }

  setRun(run, options = {}) {
    this.setFrames(buildSimulationReplayFrames(run), options);
  }

  setFrames(frames, { initialTick, expanded = true } = {}) {
    this.cancelQueuedScrub();
    this.pause();
    this.selectionGeneration += 1;
    this.frames = Array.isArray(frames) ? frames.map((frame) => ({ ...frame })) : [];
    const requestedIndex = this.frames.findIndex((frame) => frame.tick === initialTick);
    this.index =
      this.frames.length === 0
        ? -1
        : requestedIndex >= 0
          ? requestedIndex
          : this.frames.length - 1;
    this.expanded = this.frames.length > 0 && expanded;
    this.syncAvailability();
    this.syncFrame();
  }

  clear() {
    this.setFrames([], { expanded: false });
  }

  setExpanded(expanded) {
    this.expanded = Boolean(expanded && this.frames.length > 0);
    this.syncAvailability();
    this.map?.resize?.();
  }

  syncAvailability() {
    const available = this.frames.length > 0;
    if (this.container) this.container.style.display = available && !this.expanded ? "" : "none";
    if (this.dock) this.dock.hidden = !available || !this.expanded;
    this.toggleButton?.setAttribute("aria-expanded", String(available && this.expanded));
    const disabled = !available || this.frames.length < 2;
    for (const control of [
      this.previousButton,
      this.playButton,
      this.nextButton,
      this.loopButton,
      this.scrubber,
    ]) {
      if (control) control.disabled = disabled;
    }
  }

  syncFrame() {
    const frame = this.frames[this.index];
    if (!frame) {
      if (this.tickLabel) this.tickLabel.textContent = "No run selected";
      if (this.frameStatus) this.frameStatus.textContent = "Choose a completed run";
      return;
    }
    if (this.runLabel) this.runLabel.textContent = `Replay · ${frame.runId}`;
    if (this.tickLabel) {
      this.tickLabel.textContent = `Tick ${frame.tick} · ${this.index + 1} of ${this.frames.length}`;
    }
    if (this.scrubber) {
      this.scrubber.max = String(Math.max(0, this.frames.length - 1));
      this.scrubber.value = String(this.index);
      this.scrubber.setAttribute("aria-valuetext", `Simulation tick ${frame.tick}`);
    }
    if (this.firstTickLabel) this.firstTickLabel.textContent = `Tick ${this.frames[0].tick}`;
    if (this.lastTickLabel) {
      this.lastTickLabel.textContent = `Tick ${this.frames[this.frames.length - 1].tick}`;
    }
    if (this.frameStatus) this.frameStatus.textContent = "Ready";
    if (this.previousButton) this.previousButton.disabled = this.frames.length < 2;
    if (this.nextButton) this.nextButton.disabled = this.frames.length < 2;
  }

  setLoading(frame) {
    if (!this.frameStatus || !frame) return;
    this.frameStatus.textContent = `Loading tick ${frame.tick}…`;
  }

  setLoaded(frame, collection) {
    if (!this.frameStatus || frame?.tick !== this.frames[this.index]?.tick) return;
    const activeCells = Number(collection?.features?.[0]?.properties?.active_cell_count);
    this.frameStatus.textContent = Number.isFinite(activeCells)
      ? `${activeCells.toLocaleString()} active cells`
      : "Loaded";
  }

  setError(frame, error) {
    if (!this.frameStatus || frame?.tick !== this.frames[this.index]?.tick) return;
    this.frameStatus.textContent = error instanceof Error ? error.message : "Could not load tick";
  }

  previewIndex(index) {
    if (this.frames.length === 0 || !Number.isFinite(index)) return null;
    this.pause();
    this.selectionGeneration += 1;
    this.index = Math.max(0, Math.min(this.frames.length - 1, Math.round(index)));
    this.syncFrame();
    if (this.frameStatus) this.frameStatus.textContent = "Loading as you scrub…";
    return this.index;
  }

  queueScrub(index) {
    const previewedIndex = this.previewIndex(index);
    if (previewedIndex === null) return;
    this.pendingScrubIndex = previewedIndex;
    if (this.scrubFrameRequest !== null) return;
    this.scrubFrameRequest = this.requestFrame(() => {
      this.scrubFrameRequest = null;
      this.loadQueuedScrub();
    });
  }

  loadQueuedScrub() {
    const index = this.pendingScrubIndex;
    this.pendingScrubIndex = null;
    if (index === null) return;
    void this.goToIndex(index);
  }

  commitScrub(index) {
    this.cancelQueuedScrub();
    void this.goToIndex(index, { manual: true });
  }

  cancelQueuedScrub() {
    if (this.scrubFrameRequest !== null) this.cancelFrame(this.scrubFrameRequest);
    this.scrubFrameRequest = null;
    this.pendingScrubIndex = null;
  }

  async goToIndex(index, { manual = false } = {}) {
    if (this.frames.length === 0) return null;
    if (manual) {
      this.cancelQueuedScrub();
      this.pause();
    }
    let nextIndex = index;
    if (nextIndex < 0) nextIndex = this.loop ? this.frames.length - 1 : 0;
    if (nextIndex >= this.frames.length) nextIndex = this.loop ? 0 : this.frames.length - 1;
    this.index = nextIndex;
    const frame = this.frames[this.index];
    const selectionGeneration = ++this.selectionGeneration;
    this.syncFrame();
    this.setLoading(frame);
    try {
      const applied = await this.onSelectFrame?.(frame);
      if (selectionGeneration === this.selectionGeneration && applied) {
        this.setLoaded(frame, applied.collection);
      }
      return applied ?? null;
    } catch (error) {
      if (selectionGeneration === this.selectionGeneration) this.setError(frame, error);
      return null;
    }
  }

  async play({ fromStart = false } = {}) {
    if (this.frames.length < 2 || this.playing) return;
    this.cancelQueuedScrub();
    const playGeneration = ++this.playGeneration;
    if (fromStart || (!this.loop && this.index >= this.frames.length - 1)) {
      await this.goToIndex(0);
    }
    if (playGeneration !== this.playGeneration) return;
    this.playing = true;
    this.playButton.textContent = "⏸";
    this.playButton.setAttribute("aria-label", "Pause simulation replay");
    this.playButton.title = "Pause simulation replay";
    this.playButton.classList.add("ts-active");
    this.scheduleNext();
  }

  pause() {
    this.playGeneration += 1;
    this.playing = false;
    clearTimeout(this.playTimer);
    this.playTimer = null;
    if (!this.playButton) return;
    this.playButton.textContent = "▶";
    this.playButton.setAttribute("aria-label", "Play simulation replay");
    this.playButton.title = "Play simulation replay";
    this.playButton.classList.remove("ts-active");
  }

  scheduleNext() {
    clearTimeout(this.playTimer);
    if (!this.playing) return;
    this.playTimer = setTimeout(() => void this.advance(), this.speed);
  }

  async advance() {
    if (!this.playing || this.advanceInFlight) return;
    if (!this.loop && this.index >= this.frames.length - 1) {
      this.pause();
      return;
    }
    this.advanceInFlight = true;
    try {
      await this.goToIndex(this.index + 1);
    } finally {
      this.advanceInFlight = false;
      if (this.playing) this.scheduleNext();
    }
  }

  fillSize(element, property, computed) {
    const inline = element.style.getPropertyValue(property);
    if (inline) return inline;
    const rect = element.getBoundingClientRect();
    if (
      typeof window !== "undefined" &&
      property === "width" &&
      Math.abs(rect.width - window.innerWidth) <= 2
    ) {
      return "100%";
    }
    if (
      typeof window !== "undefined" &&
      property === "height" &&
      Math.abs(rect.height - window.innerHeight) <= 2
    ) {
      return "100vh";
    }
    return computed;
  }

  installLayout() {
    const mapContainer = this.mapContainer;
    const dock = this.dock;
    if (!mapContainer || !dock) return;
    const parent = mapContainer.parentElement;
    if (!parent || typeof getComputedStyle !== "function") {
      mapContainer.append(dock);
      return;
    }
    const wrapper = el("div", "maplibregl-time-slider-layout dt-replay-layout");
    const computed = getComputedStyle(mapContainer);
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.overflow = "hidden";
    wrapper.style.position = computed.position === "static" ? "relative" : computed.position;
    for (const side of ["top", "right", "bottom", "left"]) {
      const value =
        mapContainer.style.getPropertyValue(side) ||
        (computed.position !== "static" ? computed.getPropertyValue(side) : "");
      if (value && value !== "auto") wrapper.style.setProperty(side, value);
    }
    wrapper.style.margin = computed.margin;
    wrapper.style.zIndex = computed.zIndex !== "auto" ? computed.zIndex : "";
    wrapper.style.width = this.fillSize(mapContainer, "width", computed.width);
    const height = this.fillSize(mapContainer, "height", computed.height);
    wrapper.style.height = height === "100vh" ? "100dvh" : height;
    parent.insertBefore(wrapper, mapContainer);
    this.wrapper = wrapper;
    this.savedContainerCss = mapContainer.getAttribute("style") ?? "";
    mapContainer.style.position = "relative";
    mapContainer.style.top = "";
    mapContainer.style.right = "";
    mapContainer.style.bottom = "";
    mapContainer.style.left = "";
    mapContainer.style.margin = "0";
    mapContainer.style.width = "100%";
    mapContainer.style.height = "auto";
    mapContainer.style.flex = "1 1 auto";
    mapContainer.style.minHeight = "0";
    wrapper.append(mapContainer, dock);
    dock.classList.add("ts-docked");
    if (
      typeof ResizeObserver !== "undefined" &&
      (wrapper.style.width.endsWith("px") || wrapper.style.height.endsWith("px"))
    ) {
      this.resizeObserver = new ResizeObserver(() => {
        if (!this.wrapper) return;
        if (this.wrapper.style.width.endsWith("px") && parent.clientWidth > 0) {
          this.wrapper.style.width = `${parent.clientWidth}px`;
        }
        if (this.wrapper.style.height.endsWith("px") && parent.clientHeight > 0) {
          this.wrapper.style.height = `${parent.clientHeight}px`;
        }
        this.map?.resize?.();
      });
      this.resizeObserver.observe(parent);
    }
    this.map?.resize?.();
  }

  uninstallLayout() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.dock?.classList.remove("ts-docked");
    if (this.wrapper && this.mapContainer) {
      const parent = this.wrapper.parentElement;
      this.mapContainer.setAttribute("style", this.savedContainerCss);
      parent?.insertBefore(this.mapContainer, this.wrapper);
      this.wrapper.remove();
      this.wrapper = null;
      this.map?.resize?.();
    }
  }

  onRemove() {
    this.cancelQueuedScrub();
    this.pause();
    this.selectionGeneration += 1;
    this.uninstallLayout();
    this.dock?.remove();
    this.container?.remove();
    this.dock = null;
    this.container = null;
    this.mapContainer = null;
    this.map = null;
  }
}

export class WildfireMapController {
  constructor(app, scheduling = {}) {
    this.app = app;
    this.map = app.getMap?.() ?? null;
    this.scheduleRegistration =
      typeof scheduling.scheduleRegistration === "function"
        ? scheduling.scheduleRegistration
        : (callback) => setTimeout(callback, 160);
    this.cancelRegistration =
      typeof scheduling.cancelRegistration === "function"
        ? scheduling.cancelRegistration
        : (request) => clearTimeout(request);
    this.registrationRequest = null;
    this.data = emptyFeatureCollection();
    this.runId = null;
    this.tick = null;
    this.sourceUrl = null;
    this.layerState = { visible: true, opacity: 1 };
    this.layerRegistered = false;
    this.stateUnsubscribe = null;
    this.onStyleData = () => this.ensureLayers();
    this.map?.on("styledata", this.onStyleData);
  }

  setData(collection, { runId, tick, sourceUrl, deferRegistration = false } = {}) {
    this.data = asFeatureCollection(collection, "Wildfire simulation artifact");
    this.runId = nonEmptyString(runId, "Run ID");
    this.tick = Number.isInteger(tick) ? tick : null;
    this.sourceUrl = typeof sourceUrl === "string" ? sourceUrl : null;
    this.ensureLayers();
    if (deferRegistration) {
      this.scheduleStoreRegistration();
    } else {
      this.cancelStoreRegistration();
      this.syncRegistration();
    }
  }

  scheduleStoreRegistration() {
    this.cancelStoreRegistration();
    this.registrationRequest = this.scheduleRegistration(() => {
      this.registrationRequest = null;
      this.syncRegistration();
    });
  }

  cancelStoreRegistration() {
    if (this.registrationRequest !== null) {
      this.cancelRegistration(this.registrationRequest);
    }
    this.registrationRequest = null;
  }

  syncRegistration() {
    if (!this.runId) return;
    // Keep GeoLibre's store copy in lockstep with the control-owned MapLibre
    // source. Layer synchronization reapplies the registered GeoJSON whenever
    // app state changes, so registering only the first tick would restore a
    // stale footprint after setData updated the native source.
    const registration = {
      id: WILDFIRE_ENTRY_ID,
      name: `Wildfire · ${this.runId}`,
      type: "geojson",
      geojson: this.data,
      nativeLayerIds: [WILDFIRE_FILL_LAYER_ID, WILDFIRE_LINE_LAYER_ID],
      sourceIds: [WILDFIRE_SOURCE_ID],
      metadata: {
        provider: "Digital Twin Engine",
        description: "Live durable wildfire footprint.",
        customLayerType: "digital-twin-wildfire",
        runId: this.runId,
        identifiable: false,
      },
    };
    // Supply the default only for the first registration. Omitting opacity on
    // subsequent tick updates preserves any Layers-panel adjustment.
    if (!this.layerRegistered) registration.opacity = 0.82;
    this.app.registerExternalNativeLayer?.(registration);
    this.layerRegistered = true;
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
    this.cancelStoreRegistration();
    this.data = emptyFeatureCollection();
    this.runId = null;
    this.tick = null;
    this.sourceUrl = null;
    const source = this.map?.getSource(WILDFIRE_SOURCE_ID);
    if (source?.setData) source.setData(this.data);
    this.app.unregisterExternalNativeLayer?.(WILDFIRE_ENTRY_ID);
    this.layerRegistered = false;
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
    this.cancelStoreRegistration();
    this.stateUnsubscribe?.();
    this.stateUnsubscribe = null;
    this.app.unregisterExternalNativeLayer?.(WILDFIRE_ENTRY_ID);
    this.layerRegistered = false;
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
    this.replayController = null;
    this.replayLoadGeneration = 0;
    this.resultLoadGeneration = 0;
    this.resultAbort = null;
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
    this.replayControl = new SimulationReplayControl((frame) =>
      this.replayController?.showTick(frame.tick),
    );
    this.replayControlAdded =
      this.app.addMapControl?.(this.replayControl, "bottom-left") === true;
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
      el("h3", "", "Place ignition points on the map"),
    );
    this.selectionCount = el("strong", "dt-selection-count", "0 selected");
    const ignitionCopy = el("div", "dt-ignition-copy");
    ignitionCopy.append(
      this.selectionCount,
      el("p", "", "Click anywhere on the map to define where the fire starts."),
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
    this.windBearingInput = el("input");
    this.windBearingInput.type = "hidden";
    this.windBearingInput.min = "0";
    this.windBearingInput.max = "359.99";
    this.windBearingInput.step = "1";
    this.windBearingInput.value = "90";
    this.windCompass = createCompassControl(this.windBearingInput);
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
      labelledControl("Wind travels toward", this.windCompass.element, "dt-compass-field"),
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
      "Choose an area and ignition points to prepare the run.",
    );
    this.runStatus = el("div", "dt-run-card");
    const runHeader = el("div", "dt-run-header");
    this.runStatusLabel = el("span", "dt-run-status");
    this.runStatusLabel.setAttribute("aria-live", "polite");
    this.runStatusLabel.setAttribute("aria-atomic", "true");
    this.runIdentifier = el("span", "dt-mono");
    runHeader.append(this.runStatusLabel, this.runIdentifier);
    const runDetail = el("div", "dt-run-detail");
    this.runTicks = el("span", "dt-run-ticks");
    this.runRegion = el("span");
    runDetail.append(this.runTicks, this.runRegion);
    this.runProgress = el("div", "dt-run-progress");
    this.runProgress.setAttribute("role", "progressbar");
    this.runProgress.setAttribute("aria-label", "Simulation tick progress");
    this.runProgress.setAttribute("aria-valuemin", "0");
    this.runProgressFill = el("div", "dt-run-progress-fill");
    this.runProgress.append(this.runProgressFill);
    this.runFailure = el("div", "dt-run-failure");
    this.runStatus.append(runHeader, runDetail, this.runProgress, this.runFailure);
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
    this.replayController?.destroy();
    this.replayController = null;
    this.replayLoadGeneration += 1;
    this.replayControl?.clear();
    this.resultLoadGeneration += 1;
    this.resultAbort?.abort();
    this.resultAbort = null;
    const abort = new AbortController();
    this.loadAbort = abort;
    this.setConnection("muted", "Connecting", "Checking Engine readiness…");
    this.runButton.disabled = true;
    try {
      const baseUrl = normalizeApiBaseUrl(this.apiInput.value);
      this.client = createDigitalTwinClient(baseUrl);
      this.replayController = createSimulationReplayController(this.client, {
        onLoading: (frame) => this.replayControl?.setLoading(frame),
        onFrame: ({ runId, tick, url, collection }) => {
          if (this.destroyed) return;
          this.wildfireMap.setData(collection, {
            runId,
            tick,
            sourceUrl: url,
            deferRegistration: true,
          });
        },
        onError: (error, frame) => {
          if (this.destroyed) return;
          console.error("[Digital Twin Demo] Could not replay a simulation tick.", error);
          this.showMessage(
            `Replay tick ${frame?.tick ?? ""} could not be displayed: ${this.errorMessage(error)}`,
            "warning",
          );
        },
      });
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
      this.replayController?.destroy();
      this.replayController = null;
      this.replayLoadGeneration += 1;
      this.replayControl?.clear();
      this.resultLoadGeneration += 1;
      this.resultAbort?.abort();
      this.resultAbort = null;
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
              : "Select at least one ignition point on the map.";
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
      this.replayController?.stop();
      this.replayLoadGeneration += 1;
      this.replayControl?.clear();
      this.resultLoadGeneration += 1;
      this.resultAbort?.abort();
      this.resultAbort = null;
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
    this.windCompass?.setDisabled(submitting);
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
    this.setSubmitting(false);
    await this.runArtifactCoordinator?.flush();
    this.runArtifactCoordinator?.stop();
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
        await this.runArtifactCoordinator?.updateRun(run);
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
    const view = buildSimulationRunStatusView(run);
    if (!view) {
      this.runStatus.hidden = true;
      this.runProgress.hidden = true;
      this.runProgressFill.style.setProperty("--dt-run-progress", "0");
      this.runFailure.hidden = true;
      return;
    }
    this.runStatus.hidden = false;
    this.runStatus.className = [
      "dt-run-card",
      `dt-run-${view.status.toLowerCase().replaceAll("_", "-")}`,
      view.active ? "dt-run-live" : "",
    ]
      .filter(Boolean)
      .join(" ");
    this.runStatusLabel.textContent = view.statusLabel;
    this.runIdentifier.textContent = view.identifier;
    this.runIdentifier.hidden = !view.identifier;
    this.runTicks.textContent = view.detail;
    this.runRegion.textContent = view.regionText;
    this.runRegion.hidden = !view.regionText;

    const indeterminate = view.active && view.progressRatio === null;
    this.runProgress.hidden = !indeterminate && view.totalTicks === null;
    this.runProgress.classList.toggle("dt-run-progress-indeterminate", indeterminate);
    this.runProgress.setAttribute("aria-valuetext", view.progressText);
    if (view.totalTicks !== null) {
      this.runProgress.setAttribute("aria-valuemax", String(view.totalTicks));
      this.runProgress.setAttribute(
        "aria-valuenow",
        String(Math.min(view.completedTicks, view.totalTicks)),
      );
      this.runProgress.removeAttribute("aria-busy");
      this.runProgressFill.style.setProperty(
        "--dt-run-progress",
        String(view.progressRatio),
      );
    } else {
      this.runProgress.removeAttribute("aria-valuemax");
      this.runProgress.removeAttribute("aria-valuenow");
      this.runProgress.setAttribute("aria-busy", String(indeterminate));
      this.runProgressFill.style.setProperty("--dt-run-progress", "0.32");
    }
    this.runFailure.textContent = view.failure ?? "";
    this.runFailure.hidden = !view.failure;
  }

  async showResult(runId, signal) {
    if (!this.client) return;
    const resultLoadGeneration = ++this.resultLoadGeneration;
    this.resultAbort?.abort();
    const abort = new AbortController();
    this.resultAbort = abort;
    const abortFromCaller = () => abort.abort();
    if (signal?.aborted) abort.abort();
    else signal?.addEventListener("abort", abortFromCaller, { once: true });
    try {
      const result = asFeatureCollection(
        await this.client.getResult(runId, abort.signal),
        "Simulation result",
      );
      if (
        this.destroyed ||
        abort.signal.aborted ||
        resultLoadGeneration !== this.resultLoadGeneration
      ) {
        return;
      }
      const sourceUrl = this.client.resolveUrl(
        `/api/v1/simulation-runs/${encodeURIComponent(runId)}/result.geojson`,
      );
      const tick = Number(result.features[0]?.properties?.tick);
      this.wildfireMap.setData(result, {
        runId,
        tick: Number.isInteger(tick) ? tick : null,
        sourceUrl,
      });
      if (this.activeRun?.run_id === runId && runStatusValue(this.activeRun) === "COMPLETED") {
        this.prepareReplay(this.activeRun, {
          initialTick: Number.isInteger(tick) ? tick : undefined,
          initialFrame: Number.isInteger(tick)
            ? { collection: result, url: sourceUrl }
            : undefined,
        });
      }
      const bounds = geoJsonBounds(result);
      if (bounds) this.app.fitBounds?.(bounds);
      const properties = result.features[0]?.properties ?? {};
      this.showMessage(
        `Run completed: ${Number(properties.active_cell_count ?? 0).toLocaleString()} active cells at tick ${properties.tick ?? "final"}.`,
        "success",
      );
    } catch (error) {
      if (
        abort.signal.aborted ||
        resultLoadGeneration !== this.resultLoadGeneration
      ) {
        return;
      }
      this.showMessage(`Run completed, but the result could not be displayed: ${this.errorMessage(error)}`, "error");
    } finally {
      signal?.removeEventListener("abort", abortFromCaller);
      if (this.resultAbort === abort) this.resultAbort = null;
    }
  }

  prepareReplay(run, { initialTick, initialFrame, autoPlay = false } = {}) {
    if (!this.replayController || !this.replayControlAdded) return [];
    const frames = this.replayController.setRun(run);
    if (initialFrame && Number.isInteger(initialTick)) {
      this.replayController.primeFrame(initialTick, initialFrame.collection, {
        etag: initialFrame.etag,
        url: initialFrame.url,
      });
    }
    this.replayControl.setFrames(frames, { initialTick, expanded: frames.length > 0 });
    const warmTick = autoPlay ? frames[0]?.tick : initialTick ?? frames.at(-1)?.tick;
    if (Number.isInteger(warmTick)) void this.replayController.prefetchTick(warmTick);
    if (autoPlay && frames.length === 1) void this.replayControl.goToIndex(0);
    else if (autoPlay && frames.length > 1) {
      void this.replayControl.play({ fromStart: true });
    }
    return frames;
  }

  async replayRun(runId) {
    if (!this.client) return;
    if (this.activeRun && !TERMINAL_RUN_STATUSES.has(runStatusValue(this.activeRun))) {
      this.showMessage(
        "Wait for or cancel the active run before replaying a prior run.",
        "warning",
      );
      return;
    }
    this.resultLoadGeneration += 1;
    this.resultAbort?.abort();
    this.resultAbort = null;
    const replayLoadGeneration = ++this.replayLoadGeneration;
    try {
      const run = await this.client.getRun(runId);
      if (this.destroyed || replayLoadGeneration !== this.replayLoadGeneration) return;
      const frames = this.prepareReplay(run, { autoPlay: true });
      if (frames.length === 0) {
        this.showMessage("This completed run has no durable ticks to replay.", "warning");
        await this.showResult(runId);
        return;
      }
      this.showMessage(
        `Replaying ${frames.length} simulation tick${frames.length === 1 ? "" : "s"}.`,
        "success",
      );
    } catch (error) {
      if (replayLoadGeneration !== this.replayLoadGeneration) return;
      this.showMessage(`Run replay could not start: ${this.errorMessage(error)}`, "error");
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
    const liveRunActive =
      this.activeRun && !TERMINAL_RUN_STATUSES.has(runStatusValue(this.activeRun));
    for (const run of runs) {
      const completedTickCount = Array.isArray(run.tick_refs)
        ? run.tick_refs.filter((ref) => Number.isInteger(ref?.tick) && ref.tick > 0).length
        : 0;
      const row = el("div", "dt-history-row");
      const copy = el("div", "dt-history-copy");
      copy.append(
        el("strong", "", runStatusValue(run)),
        el("span", "dt-mono", run.run_id),
        el(
          "span",
          "",
          `${completedTickCount} ticks · ${run.region_id}`,
        ),
      );
      const action = button(
        runStatusValue(run) === "COMPLETED" ? "Replay" : "Monitor",
        "dt-button dt-button-small",
      );
      if (runStatusValue(run) === "COMPLETED" && liveRunActive) {
        action.disabled = true;
        action.title = "Replay is available after the active run finishes.";
      }
      action.addEventListener("click", () => {
        if (runStatusValue(run) === "COMPLETED") void this.replayRun(run.run_id);
        else {
          this.replayLoadGeneration += 1;
          this.replayController?.stop();
          this.replayControl?.clear();
          this.resultLoadGeneration += 1;
          this.resultAbort?.abort();
          this.resultAbort = null;
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
    this.replayController?.destroy();
    this.replayController = null;
    this.replayLoadGeneration += 1;
    this.replayControl?.clear();
    this.resultLoadGeneration += 1;
    this.resultAbort?.abort();
    this.resultAbort = null;
    if (this.replayControlAdded) this.app.removeMapControl?.(this.replayControl);
    this.replayControlAdded = false;
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
