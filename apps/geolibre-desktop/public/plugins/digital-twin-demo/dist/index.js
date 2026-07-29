const PLUGIN_ID = "digital-twin-demo";
const PLUGIN_NAME = "Digital Twin Demo";
const PLUGIN_VERSION = "0.3.0";
const PANEL_ID = "digital-twin-demo-panel";
const API_STORAGE_KEY = "geolibre.digital-twin-demo.api-url";
const DEFAULT_API_URL = "http://127.0.0.1:8000";
const ASSET_ENTRY_ID = "digital-twin-demo-assets";
const ASSET_SOURCE_ID = "digital-twin-demo-assets-source";
const TREE_LAYER_ID = "digital-twin-demo-tree-points";
const POWER_LINE_LAYER_ID = "digital-twin-demo-power-lines";
const POWER_LINE_POLE_LAYER_ID = "digital-twin-demo-power-line-poles";
const POWER_LINE_CONDUCTOR_LAYER_ID = "digital-twin-demo-power-line-conductors";
const POWER_LINE_MODEL_PATH = "assets/13.8kv_power_pole.glb";
const CONDUCTOR_HEIGHT_METERS = 8.2;
const CONDUCTOR_OFFSETS_METERS = [-1.5, 1.5];
const SELECTION_SOURCE_ID = "digital-twin-demo-selection-source";
const SELECTION_LAYER_ID = "digital-twin-demo-selection-points";
const REGION_SOURCE_ID = "digital-twin-demo-region-bounds-source";
const REGION_FILL_LAYER_ID = "digital-twin-demo-region-bounds-fill";
const REGION_LINE_LAYER_ID = "digital-twin-demo-region-bounds-line";
const TERMINAL_RUN_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

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
  let seededBoulder = null;
  let golden = null;
  for (const region of regions) {
    if (!isRecord(region) || region.status !== "published") continue;
    const name = typeof region.name === "string" ? region.name.trim().toLowerCase() : "";
    if (name === "boulder demo") seededBoulder = region;
    if (region.region_id === "golden-co" || name === "golden") golden = region;
  }
  return [seededBoulder, golden].filter(Boolean);
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

  const resolveUrl = (path) => {
    if (typeof path !== "string" || path.trim().length === 0) {
      throw new Error("Engine response did not include a usable URL.");
    }
    if (/^https?:\/\//i.test(path)) return path;
    return new URL(path, `${base}/`).href;
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

  const commandHeaders = ({ idempotencyKey, requestId } = {}) => {
    const headers = new Headers();
    if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
    if (requestId) headers.set("X-Request-ID", requestId);
    return headers;
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

function section(title, subtitle) {
  const details = el("details", "dt-section");
  details.open = true;
  const summary = el("summary", "dt-section-summary");
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

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return String(value ?? "Unknown time");
  return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function runStatusValue(run) {
  return typeof run?.status === "string" ? run.status.toUpperCase() : "UNKNOWN";
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
    this.onClick = (event) => {
      const feature = event?.features?.[0];
      if (!feature || feature.properties?.kind !== "tree") return;
      const sourceFeature = this.data.features.find(
        (candidate) => candidate?.properties?.asset_id === feature.properties?.asset_id,
      );
      if (sourceFeature) this.onTreeClick(sourceFeature);
    };
    this.onEnter = () => {
      if (this.map) this.map.getCanvas().style.cursor = "pointer";
    };
    this.onLeave = () => {
      if (this.map) this.map.getCanvas().style.cursor = "";
    };
    this.map?.on("styledata", this.onStyleData);
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
          getScale: [1, 1, 1],
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
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3.5, 15, 7],
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
        map.on("click", TREE_LAYER_ID, this.onClick);
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
    if (this.overlay) this.app.removeMapControl?.(this.overlay);
    this.overlay = null;
    this.deck = null;
    if (this.previousProjection) this.app.setMapProjection?.(this.previousProjection);
    this.previousProjection = null;
    const map = this.map;
    if (!map) return;
    map.off("styledata", this.onStyleData);
    if (this.bound) {
      map.off("click", TREE_LAYER_ID, this.onClick);
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

class DigitalTwinDemoPanel {
  constructor(app, container) {
    this.app = app;
    this.container = container;
    this.client = null;
    this.region = null;
    this.regions = [];
    this.weatherDatasets = [];
    this.earthEngineMetadata = null;
    this.selectedTrees = new Map();
    this.weatherDescriptors = [];
    this.earthEngineDescriptors = [];
    this.addedDescriptorIds = new Set();
    this.activeRun = null;
    this.pollAbort = null;
    this.loadAbort = null;
    this.destroyed = false;
    this.submissionKeys = null;
    this.assetMap = new AssetMapController(app, (feature) => this.toggleTree(feature));
    this.build();
    this.connect();
  }

  build() {
    this.container.replaceChildren();
    this.root = el("div", "dt-demo");

    const hero = el("div", "dt-hero");
    const eyebrow = el("div", "dt-eyebrow", "WILDFIRE OPERATIONS");
    const title = el("h2", "dt-title", "Digital Twin Demo");
    this.connectionBadge = el("span", "dt-badge dt-badge-muted", "Connecting");
    const titleRow = el("div", "dt-title-row");
    titleRow.append(title, this.connectionBadge);
    hero.append(eyebrow, titleRow, el("p", "dt-hero-copy", "Choose Engine trees, shape the weather, and watch a simulated burn footprint return to the map."));
    this.root.append(hero);

    const engine = section("Engine", "Connection and readiness");
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
    engine.body.append(labelledField("API URL", engineRow), this.engineDetail);
    this.root.append(engine.details);

    const inputs = section("Region & data", "Simulation input catalog");
    this.regionSelect = el("select", "dt-select");
    this.regionSelect.disabled = true;
    this.regionSelect.addEventListener("change", () => this.loadRegion(this.regionSelect.value));
    this.regionMeta = el("div", "dt-meta-card", "No region loaded.");
    this.weatherSelect = el("select", "dt-select");
    this.weatherSelect.disabled = true;
    this.weatherSelect.addEventListener("change", () => this.loadWeatherDescriptors());
    this.sourceStatus = el("div", "dt-source-status");
    this.weatherLayers = el("div", "dt-layer-list");
    this.earthEngineLayers = el("div", "dt-layer-list");
    inputs.body.append(
      labelledField("Published region", this.regionSelect),
      this.regionMeta,
      el(
        "div",
        "dt-hint",
        "Dashed polygons show every published region; the selected bounds are orange.",
      ),
      labelledField("Exact weather version", this.weatherSelect),
      this.sourceStatus,
      el("div", "dt-subhead", "Weather map layers"),
      this.weatherLayers,
      el("div", "dt-subhead", "Earth Engine map layers"),
      this.earthEngineLayers,
    );
    this.root.append(inputs.details);

    const ignition = section("Ignition trees", "Click green Engine trees on the map");
    const ignitionBar = el("div", "dt-selection-bar");
    this.selectionCount = el("strong", "dt-selection-count", "0 selected");
    this.clearTreesButton = button("Clear", "dt-button dt-button-quiet");
    this.clearTreesButton.disabled = true;
    this.clearTreesButton.addEventListener("click", () => this.clearTrees());
    ignitionBar.append(this.selectionCount, this.clearTreesButton);
    this.treeList = el("div", "dt-tree-list");
    ignition.body.append(ignitionBar, this.treeList);
    this.root.append(ignition.details);

    const scenario = section("Scenario", "Synthetic wind and duration");
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
    const scenarioGrid = el("div", "dt-grid");
    scenarioGrid.append(
      labelledField("Wind speed", this.windSpeedInput),
      labelledField("Unit", this.windUnitSelect),
      labelledField("Wind travels toward", this.windBearingInput),
      labelledField("Duration (hours)", this.durationInput),
    );
    scenario.body.append(
      scenarioGrid,
      el("div", "dt-hint", "The first demo uses the selected region bounds as the scenario rectangle."),
    );
    this.root.append(scenario.details);

    const run = section("Simulation run", "Queue, monitor, and recover");
    const runActions = el("div", "dt-actions");
    this.runButton = button("Run simulation", "dt-button dt-button-primary");
    this.runButton.disabled = true;
    this.runButton.addEventListener("click", () => this.startRun());
    this.cancelButton = button("Cancel run", "dt-button dt-button-danger");
    this.cancelButton.disabled = true;
    this.cancelButton.addEventListener("click", () => this.cancelRun());
    runActions.append(this.runButton, this.cancelButton);
    this.runStatus = el("div", "dt-run-card");
    this.renderRunStatus(null);
    const historyHeader = el("div", "dt-history-header");
    historyHeader.append(el("span", "dt-subhead", "Recent runs"));
    this.refreshRunsButton = button("Refresh", "dt-button dt-button-quiet");
    this.refreshRunsButton.addEventListener("click", () => this.loadHistory());
    historyHeader.append(this.refreshRunsButton);
    this.historyList = el("div", "dt-history-list");
    run.body.append(runActions, this.runStatus, historyHeader, this.historyList);
    this.root.append(run.details);

    this.toast = el("div", "dt-toast");
    this.toast.hidden = true;
    this.root.append(this.toast);
    this.container.append(this.root);
    this.renderTreeList();
    this.renderDescriptorList(this.weatherLayers, [], "Select a region to inspect weather layers.");
    this.renderDescriptorList(this.earthEngineLayers, [], "Select a region to inspect Earth Engine layers.");
  }

  setConnection(status, text, detail) {
    this.connectionBadge.className = `dt-badge dt-badge-${status}`;
    this.connectionBadge.textContent = text;
    this.engineDetail.textContent = detail;
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
    this.stopPolling();
    const abort = new AbortController();
    this.loadAbort = abort;
    this.setConnection("muted", "Connecting", "Checking Engine readiness…");
    this.runButton.disabled = true;
    try {
      const baseUrl = normalizeApiBaseUrl(this.apiInput.value);
      this.client = createDigitalTwinClient(baseUrl);
      const [readiness, regionPage, sources] = await Promise.all([
        this.client.ready(abort.signal),
        this.client.listRegions(abort.signal),
        this.client.listDataSources(abort.signal),
      ]);
      if (abort.signal.aborted || this.destroyed) return;
      this.regions = selectDemoRegions(asPageItems(regionPage));
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
      if (this.regions.length > 0) await this.loadRegion(this.regionSelect.value);
      else {
        this.regionMeta.textContent = "No published regions are available.";
        this.showMessage("The Engine is ready, but it has no published demo region.", "warning");
      }
      await this.loadHistory();
      void readiness;
    } catch (error) {
      if (abort.signal.aborted || this.destroyed) return;
      this.client = null;
      this.setConnection("error", "Offline", this.errorMessage(error));
      this.showMessage(this.errorMessage(error), "error");
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
  }

  async loadRegion(regionId) {
    if (!this.client || !regionId) return;
    this.assetMap.setRegions(this.regions, regionId);
    this.loadAbort?.abort();
    const abort = new AbortController();
    this.loadAbort = abort;
    this.regionSelect.disabled = true;
    this.weatherSelect.disabled = true;
    this.clearTrees();
    this.regionMeta.textContent = "Loading region assets and input catalog…";
    try {
      const [region, assets, weatherPage, earthEngine] = await Promise.all([
        this.client.getRegion(regionId, abort.signal),
        this.client.getAssetsGeoJson(regionId, abort.signal),
        this.client.getWeatherDatasets(regionId, abort.signal),
        this.client.getEarthEngineMetadata(regionId, abort.signal),
      ]);
      if (abort.signal.aborted || this.destroyed) return;
      this.region = region;
      this.weatherDatasets = asPageItems(weatherPage);
      this.earthEngineMetadata = earthEngine;
      this.assetMap.setData(assets, region.name ?? region.region_id);
      this.app.fitBounds?.(regionBoundsArray(region));
      this.renderRegionMeta(assets);
      this.populateWeather();
      this.renderSourceStatus();
      await Promise.all([
        this.loadWeatherDescriptors(abort.signal),
        this.loadEarthEngineDescriptors(abort.signal),
      ]);
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
  }

  populateWeather() {
    this.weatherSelect.replaceChildren();
    for (const dataset of this.weatherDatasets) {
      const bands = Array.isArray(dataset.band_names) ? dataset.band_names.length : 0;
      const option = el(
        "option",
        "",
        `${formatDateTime(dataset.version)} · ${dataset.provider ?? "weather"} · ${bands} bands${dataset.ready ? "" : " · not ready"}`,
      );
      option.value = dataset.dataset_id;
      option.disabled = dataset.ready === false;
      this.weatherSelect.append(option);
    }
    const firstReady = this.weatherDatasets.find((dataset) => dataset.ready !== false);
    if (firstReady) this.weatherSelect.value = firstReady.dataset_id;
    this.weatherSelect.disabled = !firstReady;
  }

  renderSourceStatus() {
    this.sourceStatus.replaceChildren();
    const weatherReady = this.weatherDatasets.filter((dataset) => dataset.ready).length;
    const ee = this.earthEngineMetadata;
    const datasets = Array.isArray(ee?.datasets) ? ee.datasets.join(", ") : "none";
    const weatherCard = el("div", "dt-source-card");
    weatherCard.append(
      el("span", "dt-source-icon", "W"),
      el("span", "", `${weatherReady}/${this.weatherDatasets.length} exact weather versions ready`),
    );
    const earthCard = el("div", "dt-source-card");
    earthCard.append(
      el("span", "dt-source-icon", "EE"),
      el("span", "", `${ee?.ready ? "Ready" : "Not ready"} · ${datasets} · ${ee?.crs ?? "unknown CRS"}`),
    );
    this.sourceStatus.append(weatherCard, earthCard);
  }

  selectedWeather() {
    return this.weatherDatasets.find(
      (dataset) => dataset.dataset_id === this.weatherSelect.value,
    ) ?? null;
  }

  async loadWeatherDescriptors(existingSignal) {
    if (!this.client || !this.region || !this.weatherSelect.value) {
      this.weatherDescriptors = [];
      this.renderDescriptorList(this.weatherLayers, [], "No ready weather version selected.");
      return;
    }
    const signal = existingSignal ?? this.loadAbort?.signal;
    this.weatherLayers.replaceChildren(el("div", "dt-loading", "Discovering weather layers…"));
    try {
      const response = await this.client.getWeatherMapLayers(
        this.region.region_id,
        this.weatherSelect.value,
        signal,
      );
      this.weatherDescriptors = descriptorItems(response);
      this.renderDescriptorList(
        this.weatherLayers,
        this.weatherDescriptors,
        "No renderable weather bands were published.",
      );
    } catch (error) {
      this.weatherDescriptors = [];
      const missing = error instanceof ApiProblem && [404, 405, 501].includes(error.status);
      this.renderDescriptorList(
        this.weatherLayers,
        [],
        missing
          ? "Metadata is available. The Engine map-layer endpoint is not deployed yet."
          : this.errorMessage(error),
      );
    }
  }

  async loadEarthEngineDescriptors(existingSignal) {
    if (!this.client || !this.region) return;
    const signal = existingSignal ?? this.loadAbort?.signal;
    this.earthEngineLayers.replaceChildren(el("div", "dt-loading", "Discovering Earth Engine layers…"));
    try {
      const response = await this.client.getEarthEngineMapLayers(
        this.region.region_id,
        signal,
      );
      this.earthEngineDescriptors = descriptorItems(response);
      this.renderDescriptorList(
        this.earthEngineLayers,
        this.earthEngineDescriptors,
        "No renderable Earth Engine layers were published.",
      );
    } catch (error) {
      this.earthEngineDescriptors = [];
      const missing = error instanceof ApiProblem && [404, 405, 501].includes(error.status);
      this.renderDescriptorList(
        this.earthEngineLayers,
        [],
        missing
          ? "Metadata is available. The Engine map-layer endpoint is not deployed yet."
          : this.errorMessage(error),
      );
    }
  }

  renderDescriptorList(container, descriptors, emptyMessage) {
    container.replaceChildren();
    if (!descriptors.length) {
      container.append(el("div", "dt-empty", emptyMessage));
      return;
    }
    for (const descriptor of descriptors) {
      const row = el("div", "dt-layer-row");
      const copy = el("div", "dt-layer-copy");
      copy.append(
        el("strong", "", descriptor.name ?? descriptor.layer_id ?? "Map layer"),
        el(
          "span",
          "",
          [descriptor.band, descriptor.units, descriptor.format?.toUpperCase()]
            .filter(Boolean)
            .join(" · "),
        ),
      );
      const add = button(
        this.addedDescriptorIds.has(descriptor.layer_id) ? "Added" : "Add",
        "dt-button dt-button-small",
      );
      add.disabled = this.addedDescriptorIds.has(descriptor.layer_id);
      add.addEventListener("click", () => this.addMapDescriptor(descriptor, add));
      row.append(copy, add);
      container.append(row);
    }
  }

  async addMapDescriptor(descriptor, control) {
    if (!this.client) return;
    const layerId = nonEmptyString(descriptor.layer_id, "Layer ID");
    const url = this.client.resolveUrl(descriptor.url ?? descriptor.tile_url);
    control.disabled = true;
    control.textContent = "Adding…";
    try {
      if (descriptor.format === "cog") {
        if (!this.app.addCogLayer) throw new Error("This GeoLibre build cannot add COG layers.");
        const style = descriptor.default_style ?? {};
        await this.app.addCogLayer(descriptor.name ?? layerId, url, {
          colormap: style.colormap,
          rescaleMin: style.rescale_min,
          rescaleMax: style.rescale_max,
          opacity: style.opacity ?? 0.65,
        });
      } else if (descriptor.format === "xyz") {
        if (!this.app.addTileLayer) throw new Error("This GeoLibre build cannot add XYZ layers.");
        this.app.addTileLayer(descriptor.name ?? layerId, url, {
          bounds: Array.isArray(descriptor.bounds) ? descriptor.bounds : undefined,
          attribution: descriptor.attribution,
          opacity: descriptor.default_style?.opacity ?? 0.65,
        });
      } else {
        throw new Error(`Unsupported Engine map-layer format: ${descriptor.format ?? "unknown"}.`);
      }
      this.addedDescriptorIds.add(layerId);
      control.textContent = "Added";
      this.showMessage(`${descriptor.name ?? layerId} added to the map.`, "success");
    } catch (error) {
      control.disabled = false;
      control.textContent = "Retry";
      this.showMessage(this.errorMessage(error), "error");
    }
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
    this.treeList.replaceChildren();
    if (!features.length) {
      this.treeList.append(
        el("div", "dt-empty", "Click a green tree on the map to make it an ignition point."),
      );
    } else {
      for (const feature of features) {
        const summary = selectedTreeSummary(feature);
        const row = el("div", "dt-tree-row");
        const marker = el("span", "dt-tree-marker", "●");
        const copy = el("div", "dt-tree-copy");
        copy.append(
          el("strong", "", summary.title),
          el("span", "dt-mono", summary.assetId),
          el("span", "", summary.detail),
        );
        const remove = button("×", "dt-icon-button");
        remove.title = `Remove ${summary.assetId}`;
        remove.setAttribute("aria-label", remove.title);
        remove.addEventListener("click", () => this.toggleTree(feature));
        row.append(marker, copy, remove);
        this.treeList.append(row);
      }
    }
    this.assetMap.setSelection(features);
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
      this.renderRunStatus(this.activeRun);
      this.updateRunAvailability();
      this.pollRun(accepted.run_id);
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
    this.weatherSelect.disabled = submitting;
    for (const input of [
      this.windSpeedInput,
      this.windUnitSelect,
      this.windBearingInput,
      this.durationInput,
    ]) {
      input.disabled = submitting;
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
          this.setSubmitting(false);
          if (status === "COMPLETED") await this.showResult(run.run_id, abort.signal);
          await this.loadHistory();
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
    } catch (error) {
      this.showMessage(this.errorMessage(error), "error");
      this.updateRunAvailability();
    }
  }

  renderRunStatus(run) {
    this.runStatus.replaceChildren();
    if (!run) {
      this.runStatus.className = "dt-run-card dt-run-idle";
      this.runStatus.append(
        el("span", "dt-run-orb"),
        el("div", "", "Select trees and configure a scenario to begin."),
      );
      return;
    }
    const status = runStatusValue(run);
    this.runStatus.className = `dt-run-card dt-run-${status.toLowerCase().replaceAll("_", "-")}`;
    const header = el("div", "dt-run-header");
    header.append(
      el("span", "dt-run-status", status.replaceAll("_", " ")),
      el("span", "dt-mono", run.run_id ?? run.scenario_id ?? ""),
    );
    const ticks = Array.isArray(run.tick_refs) ? run.tick_refs.length : 0;
    const detail = el("div", "dt-run-detail");
    detail.append(
      el("span", "", `${ticks} tick${ticks === 1 ? "" : "s"} produced`),
      el("span", "", run.region_id ? `Region ${run.region_id}` : ""),
    );
    const failure = safeRunFailure(run);
    this.runStatus.append(header, detail);
    if (failure) this.runStatus.append(el("div", "dt-run-failure", failure));
  }

  async showResult(runId, signal) {
    if (!this.client) return;
    try {
      const result = asFeatureCollection(
        await this.client.getResult(runId, signal),
        "Simulation result",
      );
      this.app.addGeoJsonLayer(`Wildfire result · ${runId}`, result, this.client.resolveUrl(`/api/v1/simulation-runs/${encodeURIComponent(runId)}/result.geojson`));
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
          this.pollRun(run.run_id);
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
    this.stopPolling();
    clearTimeout(this.toastTimer);
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
