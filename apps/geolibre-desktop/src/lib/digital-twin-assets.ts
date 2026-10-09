import {
  requestDigitalTwinResponse,
  requestDigitalTwinJson,
} from "./digital-twin-api";

export interface DigitalTwinAssetCoordinate {
  lat: number;
  lon: number;
}

export interface DigitalTwinPowerLineCoordinate
  extends DigitalTwinAssetCoordinate {
  elevationM: number;
}

export interface DigitalTwinPowerLineCoordinateInput
  extends DigitalTwinAssetCoordinate {
  elevation_m: number;
}

export interface DigitalTwinConductorOffset {
  lateral: number;
  vertical: number;
}

export interface DigitalTwinTreeAsset {
  kind: "tree";
  assetId: string;
  regionId: string;
  location: DigitalTwinAssetCoordinate;
  species: string | null;
  heightM: number | null;
  canopyRadiusM: number | null;
  sourceRef: string | null;
  segmentation?: {
    bounds: [number, number, number, number, number, number];
    pointCount: number;
  } | null;
}

export interface DigitalTwinPowerPoleAsset {
  kind: "power_pole";
  assetId: string;
  regionId: string;
  base: DigitalTwinPowerLineCoordinate;
  top: DigitalTwinPowerLineCoordinate;
  radiusM: number;
  sourceRef: string;
}

export interface DigitalTwinPowerLineAsset {
  kind: "power_line";
  assetId: string;
  regionId: string;
  coordinates: [
    DigitalTwinPowerLineCoordinate,
    DigitalTwinPowerLineCoordinate,
  ];
  name: string | null;
  conductorOffsetsM: DigitalTwinConductorOffset[];
  bounds: DigitalTwinPowerLineBounds | null;
  conductor: DigitalTwinPowerLineConductor | null;
  latestPhysics: DigitalTwinPowerLinePhysics | null;
  measuredPath?: DigitalTwinPowerLineCoordinate[] | null;
  supportIds?: [string, string] | null;
  sourceRef?: string | null;
}

export interface DigitalTwinPowerLineBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface DigitalTwinPowerLineConductor {
  massPerMeterKgM: number;
  spanLengthM: number;
  conductorDiameterM: number;
  horizontalTensionN: number;
  airDensityKgM3: number;
  dragCoefficient: number;
  staticSagM: number | null;
  elasticModulusPa: number | null;
  crossSectionalAreaM2: number | null;
}

interface DigitalTwinPowerLinePhysicsLineage {
  tick: number;
  lineSnapshot: number;
  weatherVersion: string;
  weatherSourceRef: string;
  featureContractVersion: string;
  modelVersion: string;
  modelChecksum: string;
  cachedFromTick: number | null;
  routingReason: string | null;
  solverVersion: string | null;
  surrogateConfidence: number | null;
}

export interface DigitalTwinPowerLinePhysicsFailure
  extends DigitalTwinPowerLinePhysicsLineage {
  status: "failed";
  source: "failed";
  failureKind: "non_convergent" | "solver_error";
}

export interface DigitalTwinPowerLinePhysicsResult
  extends DigitalTwinPowerLinePhysicsLineage {
  status: "succeeded";
  source: "surrogate" | "cached" | "fem";
  windSpeedMps: number;
  midspanDisplacementM: number;
  maxDisplacementM: number;
  maxDisplacementPositionM: number;
  collisionEnvelopeM: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

export type DigitalTwinPowerLinePhysics =
  | DigitalTwinPowerLinePhysicsFailure
  | DigitalTwinPowerLinePhysicsResult;

export type DigitalTwinAsset = DigitalTwinTreeAsset | DigitalTwinPowerLineAsset | DigitalTwinPowerPoleAsset;

export type DigitalTwinAssetPatch =
  | Partial<{
      location: DigitalTwinAssetCoordinate;
      species: string | null;
      height_m: number | null;
      canopy_radius_m: number | null;
    }>
  | Partial<{
      coordinates: [
        DigitalTwinPowerLineCoordinateInput,
        DigitalTwinPowerLineCoordinateInput,
      ];
      name: string | null;
    }>;

interface RequestOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${label} is required.`);
  return value.trim();
}

function optionalString(value: unknown, label: string): string | null {
  if (value === null) return null;
  return requiredString(value, label);
}

function optionalPositiveNumber(value: unknown, label: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number or null.`);
  }
  return value;
}

function requiredPositiveNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return value;
}

function requiredNumber(
  value: unknown,
  label: string,
  { minimum, maximum }: { minimum?: number; maximum?: number } = {}
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  if (minimum !== undefined && value < minimum) {
    throw new Error(`${label} must be at least ${minimum}.`);
  }
  if (maximum !== undefined && value > maximum) {
    throw new Error(`${label} must be at most ${maximum}.`);
  }
  return value;
}

function requiredInteger(value: unknown, label: string): number {
  const number = requiredNumber(value, label);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return number;
}

function coordinate(value: unknown, label: string): DigitalTwinAssetCoordinate {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  const lat = value.lat;
  const lon = value.lon;
  if (typeof lat !== "number" || !Number.isFinite(lat) || Math.abs(lat) > 90) {
    throw new Error(`${label} latitude is invalid.`);
  }
  if (typeof lon !== "number" || !Number.isFinite(lon) || Math.abs(lon) > 180) {
    throw new Error(`${label} longitude is invalid.`);
  }
  return { lat, lon };
}

function powerLineCoordinate(
  value: unknown,
  label: string
): DigitalTwinPowerLineCoordinate {
  const position = coordinate(value, label);
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  return {
    ...position,
    elevationM: requiredNumber(value.elevation_m, `${label} elevation`),
  };
}

function geometryCoordinate(
  value: unknown,
  label: string
): DigitalTwinPowerLineCoordinate {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    typeof value[0] !== "number" ||
    !Number.isFinite(value[0]) ||
    Math.abs(value[0]) > 180 ||
    typeof value[1] !== "number" ||
    !Number.isFinite(value[1]) ||
    Math.abs(value[1]) > 90
  ) {
    throw new Error(`${label} must be a 3D WGS84 coordinate.`);
  }
  return {
    lon: value[0],
    lat: value[1],
    elevationM: requiredNumber(value[2], `${label} elevation`),
  };
}

function parseBounds(value: unknown): DigitalTwinPowerLineBounds {
  if (!isRecord(value)) throw new Error("Power-line bounds must be an object.");
  const bounds = {
    west: requiredNumber(value.west, "Power-line bounds west", {
      minimum: -180,
      maximum: 180,
    }),
    south: requiredNumber(value.south, "Power-line bounds south", {
      minimum: -90,
      maximum: 90,
    }),
    east: requiredNumber(value.east, "Power-line bounds east", {
      minimum: -180,
      maximum: 180,
    }),
    north: requiredNumber(value.north, "Power-line bounds north", {
      minimum: -90,
      maximum: 90,
    }),
  };
  if (bounds.west > bounds.east || bounds.south > bounds.north) {
    throw new Error("Power-line bounds must be ordered.");
  }
  return bounds;
}

function nullablePositiveNumber(value: unknown, label: string): number | null {
  if (value === null) return null;
  return optionalPositiveNumber(value, label);
}

function parseConductor(value: unknown): DigitalTwinPowerLineConductor | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) throw new Error("Power-line conductor must be an object.");
  return {
    massPerMeterKgM: requiredPositiveNumber(
      value.mass_per_meter_kg_m,
      "Mass per meter"
    ),
    spanLengthM: requiredPositiveNumber(value.span_length_m, "Span length"),
    conductorDiameterM: requiredPositiveNumber(
      value.conductor_diameter_m,
      "Conductor diameter"
    ),
    horizontalTensionN: requiredPositiveNumber(
      value.horizontal_tension_n,
      "Horizontal tension"
    ),
    airDensityKgM3: requiredPositiveNumber(
      value.air_density_kg_m3,
      "Air density"
    ),
    dragCoefficient: requiredPositiveNumber(
      value.drag_coefficient,
      "Drag coefficient"
    ),
    staticSagM: nullablePositiveNumber(value.static_sag_m, "Static sag"),
    elasticModulusPa: nullablePositiveNumber(
      value.elastic_modulus_pa,
      "Elastic modulus"
    ),
    crossSectionalAreaM2: nullablePositiveNumber(
      value.cross_sectional_area_m2,
      "Cross-sectional area"
    ),
  };
}

function parseConductorOffsets(
  value: unknown
): DigitalTwinConductorOffset[] {
  if (value === undefined) return [{ lateral: 0, vertical: 0 }];
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Power line must declare at least one conductor offset.");
  }
  return value.map((offset, index) => {
    if (!isRecord(offset)) {
      throw new Error(`Conductor offset ${index + 1} must be an object.`);
    }
    return {
      lateral: requiredNumber(
        offset.lateral,
        `Conductor offset ${index + 1} lateral position`
      ),
      vertical: requiredNumber(
        offset.vertical,
        `Conductor offset ${index + 1} vertical position`
      ),
    };
  });
}

function parsePhysicsLineage(
  value: Record<string, unknown>
): DigitalTwinPowerLinePhysicsLineage {
  const weatherVersion = requiredString(value.weather_version, "Weather version");
  if (!Number.isFinite(Date.parse(weatherVersion))) {
    throw new Error("Weather version must be an ISO date-time string.");
  }
  const modelChecksum = requiredString(value.model_checksum, "Model checksum");
  if (!/^[0-9a-f]{64}$/.test(modelChecksum)) {
    throw new Error(
      "Model checksum must contain 64 lowercase hexadecimal characters."
    );
  }
  return {
    tick: requiredInteger(value.tick, "Physics tick"),
    lineSnapshot: requiredInteger(value.line_snapshot, "Line snapshot"),
    weatherVersion,
    weatherSourceRef: requiredString(value.weather_source_ref, "Weather source"),
    featureContractVersion: requiredString(
      value.feature_contract_version,
      "Feature contract"
    ),
    modelVersion: requiredString(value.model_version, "Model version"),
    modelChecksum,
    cachedFromTick:
      value.cached_from_tick === null
        ? null
        : requiredInteger(value.cached_from_tick, "Cached tick"),
    routingReason: optionalString(value.routing_reason, "Routing reason"),
    solverVersion: optionalString(value.solver_version, "Solver version"),
    surrogateConfidence:
      value.surrogate_confidence === null
        ? null
        : requiredNumber(value.surrogate_confidence, "Surrogate confidence", {
            minimum: 0,
            maximum: 1,
          }),
  };
}

function parsePhysics(value: unknown): DigitalTwinPowerLinePhysics | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) throw new Error("Latest physics must be an object.");
  const lineage = parsePhysicsLineage(value);
  if (value.status === "failed") {
    if (value.source !== "failed") {
      throw new Error("Failed physics must use the failed source.");
    }
    if (
      value.failure_kind !== "non_convergent" &&
      value.failure_kind !== "solver_error"
    ) {
      throw new Error("Failed physics has an unsupported failure kind.");
    }
    return {
      ...lineage,
      status: "failed",
      source: "failed",
      failureKind: value.failure_kind,
    };
  }
  if (
    value.status !== "succeeded" ||
    (value.source !== "surrogate" &&
      value.source !== "cached" &&
      value.source !== "fem")
  ) {
    throw new Error("Latest physics has an unsupported result.");
  }
  if (!isRecord(value.collision_envelope_m)) {
    throw new Error("Succeeded physics must include a collision envelope.");
  }
  return {
    ...lineage,
    status: "succeeded",
    source: value.source,
    windSpeedMps: requiredNumber(value.wind_speed_mps, "Wind speed", {
      minimum: 0,
    }),
    midspanDisplacementM: requiredNumber(
      value.midspan_displacement_m,
      "Midspan displacement"
    ),
    maxDisplacementM: requiredNumber(
      value.max_displacement_m,
      "Max displacement"
    ),
    maxDisplacementPositionM: requiredNumber(
      value.max_displacement_position_m,
      "Max displacement position"
    ),
    collisionEnvelopeM: {
      minX: requiredNumber(value.collision_envelope_m.min_x, "Envelope min x"),
      maxX: requiredNumber(value.collision_envelope_m.max_x, "Envelope max x"),
      minY: requiredNumber(value.collision_envelope_m.min_y, "Envelope min y"),
      maxY: requiredNumber(value.collision_envelope_m.max_y, "Envelope max y"),
    },
  };
}

function parsePowerLine(value: Record<string, unknown>): DigitalTwinPowerLineAsset {
  const assetId = requiredString(value.asset_id, "Asset ID");
  const regionId = requiredString(value.region_id, "Region ID");
  let coordinates: [
    DigitalTwinPowerLineCoordinate,
    DigitalTwinPowerLineCoordinate,
  ];
  let bounds: DigitalTwinPowerLineBounds | null = null;
  if (Array.isArray(value.coordinates) && value.coordinates.length === 2) {
    coordinates = [
      powerLineCoordinate(value.coordinates[0], "Coordinate 1"),
      powerLineCoordinate(value.coordinates[1], "Coordinate 2"),
    ];
  } else if (
    isRecord(value.geometry) &&
    value.geometry.type === "LineString" &&
    Array.isArray(value.geometry.coordinates) &&
    value.geometry.coordinates.length === 2
  ) {
    coordinates = [
      geometryCoordinate(value.geometry.coordinates[0], "Coordinate 1"),
      geometryCoordinate(value.geometry.coordinates[1], "Coordinate 2"),
    ];
    bounds = parseBounds(value.geometry.bounds);
  } else {
    throw new Error("Power line must include exactly two 3D coordinates.");
  }
  return {
    kind: "power_line",
    assetId,
    regionId,
    coordinates,
    name: optionalString(value.name, "Power-line name"),
    ...(value.source_ref != null ? { sourceRef: optionalString(value.source_ref, "Power-line source") } : {}),
    conductorOffsetsM: parseConductorOffsets(value.conductor_offsets_m),
    bounds,
    conductor: parseConductor(value.conductor),
    latestPhysics: parsePhysics(value.latest_physics),
    measuredPath: value.measured_path == null ? null : parseMeasuredPath(value.measured_path),
    supportIds: value.support_ids == null ? null : parseSupportIds(value.support_ids),
  };
}

function parseSupportIds(value: unknown): [string, string] {
  if (!Array.isArray(value) || value.length !== 2) throw new Error("A span requires two support IDs.");
  return [requiredString(value[0], "Start support"), requiredString(value[1], "End support")];
}

function parseMeasuredPath(value: unknown): DigitalTwinPowerLineCoordinate[] {
  if (!Array.isArray(value) || value.length < 2) throw new Error("Measured wire path requires at least two points.");
  return value.map((point, index) => powerLineCoordinate(point, `Measured wire point ${index + 1}`));
}

function parseTreeSegmentation(value: unknown): DigitalTwinTreeAsset["segmentation"] {
  if (value == null) return null;
  if (!isRecord(value) || !Array.isArray(value.bounds) || value.bounds.length !== 6) {
    throw new Error("Tree segmentation requires six bounding coordinates.");
  }
  const bounds = value.bounds.map((v) => requiredNumber(v, "Tree bounding coordinate")) as [number, number, number, number, number, number];
  if (!(bounds[0] < bounds[3] && bounds[1] < bounds[4] && bounds[2] < bounds[5]) || Math.abs(bounds[0]) > 180 || Math.abs(bounds[3]) > 180 || Math.abs(bounds[1]) > 90 || Math.abs(bounds[4]) > 90) {
    throw new Error("Tree bounding coordinates must be ordered WGS84 and elevation metres.");
  }
  const pointCount = requiredInteger(value.point_count, "Tree point count");
  if (pointCount < 1) throw new Error("Segmented trees require native points.");
  return { bounds, pointCount };
}

function parseAsset(value: unknown): DigitalTwinAsset {
  if (!isRecord(value)) throw new Error("Asset response must be an object.");
  const assetId = requiredString(value.asset_id, "Asset ID");
  const regionId = requiredString(value.region_id, "Region ID");
  if (value.kind === "tree") {
    return {
      kind: "tree",
      assetId,
      regionId,
      location: coordinate(value.location, "Tree location"),
      species: optionalString(value.species, "Tree species"),
      heightM: optionalPositiveNumber(value.height_m, "Tree height"),
      canopyRadiusM: optionalPositiveNumber(
        value.canopy_radius_m,
        "Canopy radius"
      ),
      sourceRef: optionalString(value.source_ref, "Tree source reference"),
      segmentation: parseTreeSegmentation(value.segmentation),
    };
  }
  if (value.kind === "power_line") {
    return parsePowerLine(value);
  }
  if (value.kind === "power_pole") {
    const base = powerLineCoordinate(value.base, "Pole base");
    const top = powerLineCoordinate(value.top, "Pole top");
    if (top.elevationM <= base.elevationM) throw new Error("Pole top must be above its base.");
    return { kind: "power_pole", assetId, regionId, base, top,
      radiusM: requiredPositiveNumber(value.radius_m, "Pole radius"),
      sourceRef: requiredString(value.source_ref, "Pole source reference") };
  }
  throw new Error("Asset response has an unsupported kind.");
}

async function request(
  apiUrl: string,
  path: string,
  init: RequestInit,
  fetchImpl: typeof fetch
): Promise<Response> {
  return requestDigitalTwinResponse(apiUrl, path, { ...init, fetchImpl });
}

export async function fetchDigitalTwinAssets(
  apiUrl: string,
  regionId: string,
  { fetchImpl = fetch, signal }: RequestOptions = {}
): Promise<DigitalTwinAsset[]> {
  const response = await request(
    apiUrl,
    `/api/v1/regions/${encodeURIComponent(
      requiredString(regionId, "Region ID")
    )}/assets`,
    { signal, cache: "no-cache" },
    fetchImpl
  );
  const value: unknown = await response.json();
  if (!Array.isArray(value)) throw new Error("Asset catalog must be an array.");
  return value.map(parseAsset);
}

/**
 * Keep a live regional catalog current with serialized, cancellable requests.
 * @param apiUrl Engine API base URL.
 * @param regionId Region owning the geometry and latest completed physics.
 * @param onAssets Receives each successful snapshot, including empty catalogs.
 * @param onError Receives failures; polling continues so recovery needs no reload.
 * @returns Cleanup that aborts an active request and prevents late callbacks.
 */
export function observeDigitalTwinAssets(
  apiUrl: string,
  regionId: string,
  onAssets: (assets: DigitalTwinAsset[]) => void,
  onError: (error: Error) => void,
): () => void {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const refresh = async () => {
    try {
      const assets = await fetchDigitalTwinAssets(apiUrl, regionId, { signal: controller.signal });
      if (!controller.signal.aborted) onAssets(assets);
    } catch (cause) {
      if (!controller.signal.aborted) onError(cause instanceof Error ? cause : new Error("Regional asset request failed."));
    } finally {
      if (!controller.signal.aborted) timer = setTimeout(refresh, 10_000);
    }
  };
  void refresh();
  return () => {
    controller.abort();
    clearTimeout(timer);
  };
}

export async function fetchDigitalTwinAsset(
  apiUrl: string,
  regionId: string,
  assetId: string,
  { fetchImpl = fetch, signal }: RequestOptions = {}
): Promise<DigitalTwinAsset> {
  const response = await request(
    apiUrl,
    `/api/v1/regions/${encodeURIComponent(
      requiredString(regionId, "Region ID")
    )}/assets/${encodeURIComponent(requiredString(assetId, "Asset ID"))}`,
    { signal, cache: "no-cache" },
    fetchImpl
  );
  const asset = parseAsset((await response.json()) as unknown);
  if (asset.regionId !== regionId.trim() || asset.assetId !== assetId.trim()) {
    throw new Error("Asset detail does not match the requested identity.");
  }
  return asset;
}

export async function importDigitalTwinAssetCsv(
  apiUrl: string,
  regionId: string,
  file: File,
  { fetchImpl = fetch, signal }: RequestOptions = {}
): Promise<DigitalTwinAsset[]> {
  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new Error("Asset import must be a CSV file.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Asset CSV exceeds the 8 MiB upload limit.");
  }
  const upload =
    file.type === "text/csv"
      ? file
      : new File([file], file.name, { type: "text/csv" });
  const body = new FormData();
  body.append("file", upload, upload.name);
  const response = await request(
    apiUrl,
    `/api/v1/regions/${encodeURIComponent(
      requiredString(regionId, "Region ID")
    )}/assets:csv`,
    {
      method: "POST",
      body,
      signal,
    },
    fetchImpl
  );
  const value: unknown = await response.json();
  if (!Array.isArray(value))
    throw new Error("Asset import response must be an array.");
  return value.map(parseAsset);
}

export async function updateDigitalTwinAsset(
  apiUrl: string,
  regionId: string,
  assetId: string,
  patch: DigitalTwinAssetPatch,
  { fetchImpl = fetch, signal }: RequestOptions = {}
): Promise<DigitalTwinAsset> {
  const response = await request(
    apiUrl,
    `/api/v1/regions/${encodeURIComponent(
      requiredString(regionId, "Region ID")
    )}/assets/${encodeURIComponent(requiredString(assetId, "Asset ID"))}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
      signal,
    },
    fetchImpl
  );
  return parseAsset((await response.json()) as unknown);
}

export async function deleteDigitalTwinAsset(
  apiUrl: string,
  regionId: string,
  assetId: string,
  { fetchImpl = fetch, signal }: RequestOptions = {}
): Promise<void> {
  await request(
    apiUrl,
    `/api/v1/regions/${encodeURIComponent(
      requiredString(regionId, "Region ID")
    )}/assets/${encodeURIComponent(requiredString(assetId, "Asset ID"))}`,
    { method: "DELETE", signal },
    fetchImpl
  );
}

export type DigitalTwinAssetCreate = import("./digital-twin-contract.generated").components["schemas"]["TreeAssetCreate"] | import("./digital-twin-contract.generated").components["schemas"]["PowerLineAssetCreate"];

/** Validate the bounded public intake, rejecting server-owned and unknown fields. */
export function previewDigitalTwinAssetBatch(text: string): DigitalTwinAssetCreate[] {
  const values: unknown = JSON.parse(text);
  if (!Array.isArray(values) || values.length < 1 || values.length > 1000) throw new Error("Import requires 1–1,000 assets.");
  return values.map((value, index) => {
    const label = `Asset ${index + 1}`;
    if (!isRecord(value)) throw new Error(`${label} must be an object.`);
    const keys = value.kind === "tree" ? ["kind", "location", "species", "height_m", "canopy_radius_m", "source_ref"] : ["kind", "coordinates", "name"];
    if (Object.keys(value).some((key) => !keys.includes(key))) throw new Error(`${label} contains unsupported or server-owned fields.`);
    if (value.kind === "tree") {
      coordinate(value.location, `${label} location`);
      for (const key of ["height_m", "canopy_radius_m"]) if (value[key] !== undefined) optionalPositiveNumber(value[key], `${label} ${key}`);
      for (const key of ["species", "source_ref"]) if (value[key] !== undefined) optionalString(value[key], `${label} ${key}`);
    } else if (value.kind === "power_line") {
      if (!Array.isArray(value.coordinates) || value.coordinates.length !== 2) throw new Error(`${label} needs exactly two coordinates.`);
      value.coordinates.forEach((point, pointIndex) => powerLineCoordinate(point, `${label} point ${pointIndex + 1}`));
      if (value.name !== undefined) optionalString(value.name, `${label} name`);
    } else throw new Error(`${label} must be a tree or power line. Pole mutation is unsupported.`);
    return value as DigitalTwinAssetCreate;
  });
}

export async function createDigitalTwinAsset(apiUrl: string, regionId: string, candidate: DigitalTwinAssetCreate, options: RequestOptions = {}): Promise<DigitalTwinAsset> {
  previewDigitalTwinAssetBatch(JSON.stringify([candidate]));
  return parseAsset(await requestDigitalTwinJson(apiUrl, `/api/v1/regions/${encodeURIComponent(regionId)}/assets`, { ...options, method: "POST", json: candidate }));
}

export async function importDigitalTwinAssetBatch(apiUrl: string, regionId: string, candidates: DigitalTwinAssetCreate[], options: RequestOptions = {}): Promise<DigitalTwinAsset[]> {
  previewDigitalTwinAssetBatch(JSON.stringify(candidates));
  const response = await requestDigitalTwinJson<unknown[]>(apiUrl, `/api/v1/regions/${encodeURIComponent(regionId)}/assets:batch`, { ...options, method: "POST", json: candidates });
  if (!Array.isArray(response)) throw new Error("Asset batch response must be an array.");
  return response.map(parseAsset);
}
