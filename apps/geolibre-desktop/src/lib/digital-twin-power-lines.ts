import type { FeatureCollection, LineString } from "geojson";
import {
  normalizeDigitalTwinApiUrl,
  resolveDigitalTwinApiUrl,
} from "./digital-twin-earth-engine";

export interface DigitalTwinPowerLine {
  powerLineId: string;
  geometry: LineString;
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

export interface DigitalTwinPowerLineDetail extends DigitalTwinPowerLine {
  regionId: string;
  bounds: DigitalTwinPowerLineBounds;
  conductor: DigitalTwinPowerLineConductor;
  latestPhysics:
    | DigitalTwinPowerLinePhysicsFailure
    | DigitalTwinPowerLinePhysicsResult
    | null;
}

interface FetchDigitalTwinPowerLinesOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

interface FetchDigitalTwinPowerLineOptions extends FetchDigitalTwinPowerLinesOptions {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coordinate(value: unknown, label: string): [number, number, number] {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    typeof value[0] !== "number" ||
    !Number.isFinite(value[0]) ||
    Math.abs(value[0]) > 180 ||
    typeof value[1] !== "number" ||
    !Number.isFinite(value[1]) ||
    Math.abs(value[1]) > 90 ||
    typeof value[2] !== "number" ||
    !Number.isFinite(value[2])
  ) {
    throw new Error(`${label} must be a 3D WGS84 conductor coordinate.`);
  }
  return [value[0], value[1], value[2]];
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function requiredNumber(
  value: unknown,
  label: string,
  { minimum, maximum }: { minimum?: number; maximum?: number } = {},
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

function nullablePositiveNumber(value: unknown, label: string): number | null {
  if (value === null) return null;
  const number = requiredNumber(value, label);
  if (number <= 0) throw new Error(`${label} must be greater than zero.`);
  return number;
}

function requiredInteger(value: unknown, label: string): number {
  const number = requiredNumber(value, label);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return number;
}

function nullableString(value: unknown, label: string): string | null {
  return value === null ? null : requiredString(value, label);
}

function parseBounds(value: unknown, label: string): DigitalTwinPowerLineBounds {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  const bounds = {
    west: requiredNumber(value.west, `${label} west`, { minimum: -180, maximum: 180 }),
    south: requiredNumber(value.south, `${label} south`, { minimum: -90, maximum: 90 }),
    east: requiredNumber(value.east, `${label} east`, { minimum: -180, maximum: 180 }),
    north: requiredNumber(value.north, `${label} north`, { minimum: -90, maximum: 90 }),
  };
  if (bounds.west > bounds.east || bounds.south > bounds.north) {
    throw new Error(`${label} must be ordered WGS84 bounds.`);
  }
  return bounds;
}

function parseLineGeometry(
  value: unknown,
  label: string,
): { geometry: LineString; bounds: DigitalTwinPowerLineBounds | null } {
  if (!isRecord(value) || value.type !== "LineString") {
    throw new Error(`${label} must include a LineString geometry.`);
  }
  if (!Array.isArray(value.coordinates) || value.coordinates.length !== 2) {
    throw new Error(`${label} geometry must include exactly two coordinates.`);
  }
  return {
    geometry: {
      type: "LineString",
      coordinates: value.coordinates.map((position, coordinateIndex) =>
        coordinate(position, `${label} coordinate ${coordinateIndex + 1}`),
      ),
    },
    bounds: value.bounds === undefined ? null : parseBounds(value.bounds, `${label} bounds`),
  };
}

function parsePowerLine(value: unknown, index: number): DigitalTwinPowerLine {
  if (!isRecord(value)) throw new Error(`Power line ${index + 1} must be an object.`);
  if (typeof value.power_line_id !== "string" || !value.power_line_id.trim()) {
    throw new Error(`Power line ${index + 1} is missing its ID.`);
  }
  const id = value.power_line_id.trim();
  const { geometry } = parseLineGeometry(value.geometry, `Power line ${id}`);
  return {
    powerLineId: id,
    geometry,
  };
}

function parseConductor(value: unknown): DigitalTwinPowerLineConductor {
  if (!isRecord(value)) throw new Error("Power-line conductor details are required.");
  const positive = (field: string, label: string) => {
    const number = requiredNumber(value[field], label);
    if (number <= 0) throw new Error(`${label} must be greater than zero.`);
    return number;
  };
  return {
    massPerMeterKgM: positive("mass_per_meter_kg_m", "Mass per meter"),
    spanLengthM: positive("span_length_m", "Span length"),
    conductorDiameterM: positive("conductor_diameter_m", "Conductor diameter"),
    horizontalTensionN: positive("horizontal_tension_n", "Horizontal tension"),
    airDensityKgM3: positive("air_density_kg_m3", "Air density"),
    dragCoefficient: positive("drag_coefficient", "Drag coefficient"),
    staticSagM: nullablePositiveNumber(value.static_sag_m, "Static sag"),
    elasticModulusPa: nullablePositiveNumber(value.elastic_modulus_pa, "Elastic modulus"),
    crossSectionalAreaM2: nullablePositiveNumber(
      value.cross_sectional_area_m2,
      "Cross-sectional area",
    ),
  };
}

function parsePhysicsLineage(value: Record<string, unknown>): DigitalTwinPowerLinePhysicsLineage {
  const weatherVersion = requiredString(value.weather_version, "Weather version");
  if (!Number.isFinite(Date.parse(weatherVersion))) {
    throw new Error("Weather version must be an ISO date-time string.");
  }
  const modelChecksum = requiredString(value.model_checksum, "Model checksum");
  if (!/^[0-9a-f]{64}$/.test(modelChecksum)) {
    throw new Error("Model checksum must contain 64 lowercase hexadecimal characters.");
  }
  const confidence = value.surrogate_confidence === null
    ? null
    : requiredNumber(value.surrogate_confidence, "Surrogate confidence", {
        minimum: 0,
        maximum: 1,
      });
  return {
    tick: requiredInteger(value.tick, "Physics tick"),
    lineSnapshot: requiredInteger(value.line_snapshot, "Line snapshot"),
    weatherVersion,
    weatherSourceRef: requiredString(value.weather_source_ref, "Weather source"),
    featureContractVersion: requiredString(value.feature_contract_version, "Feature contract"),
    modelVersion: requiredString(value.model_version, "Model version"),
    modelChecksum,
    cachedFromTick:
      value.cached_from_tick === null ? null : requiredInteger(value.cached_from_tick, "Cached tick"),
    routingReason: nullableString(value.routing_reason, "Routing reason"),
    solverVersion: nullableString(value.solver_version, "Solver version"),
    surrogateConfidence: confidence,
  };
}

function parsePhysics(
  value: unknown,
): DigitalTwinPowerLineDetail["latestPhysics"] {
  if (value === null) return null;
  if (!isRecord(value)) throw new Error("Latest physics must be an object or null.");
  const lineage = parsePhysicsLineage(value);
  if (value.status === "failed") {
    if (value.source !== "failed") throw new Error("Failed physics must use the failed source.");
    if (value.failure_kind !== "non_convergent" && value.failure_kind !== "solver_error") {
      throw new Error("Failed physics has an unsupported failure kind.");
    }
    return { ...lineage, status: "failed", source: "failed", failureKind: value.failure_kind };
  }
  if (value.status !== "succeeded") {
    throw new Error("Latest physics has an unsupported status.");
  }
  if (value.source !== "surrogate" && value.source !== "cached" && value.source !== "fem") {
    throw new Error("Succeeded physics has an unsupported source.");
  }
  if (!isRecord(value.collision_envelope_m)) {
    throw new Error("Succeeded physics must include a collision envelope.");
  }
  return {
    ...lineage,
    status: "succeeded",
    source: value.source,
    windSpeedMps: requiredNumber(value.wind_speed_mps, "Wind speed", { minimum: 0 }),
    midspanDisplacementM: requiredNumber(value.midspan_displacement_m, "Midspan displacement"),
    maxDisplacementM: requiredNumber(value.max_displacement_m, "Max displacement"),
    maxDisplacementPositionM: requiredNumber(
      value.max_displacement_position_m,
      "Max displacement position",
    ),
    collisionEnvelopeM: {
      minX: requiredNumber(value.collision_envelope_m.min_x, "Envelope min x"),
      maxX: requiredNumber(value.collision_envelope_m.max_x, "Envelope max x"),
      minY: requiredNumber(value.collision_envelope_m.min_y, "Envelope min y"),
      maxY: requiredNumber(value.collision_envelope_m.max_y, "Envelope max y"),
    },
  };
}

function parsePowerLineDetail(
  value: unknown,
  regionId: string,
  powerLineId: string,
): DigitalTwinPowerLineDetail {
  if (!isRecord(value)) throw new Error("Power-line detail must be an object.");
  const responsePowerLineId = requiredString(value.power_line_id, "Power line ID");
  const responseRegionId = requiredString(value.region_id, "Region ID");
  if (responsePowerLineId !== powerLineId) {
    throw new Error("Power-line detail ID does not match the requested line.");
  }
  if (responseRegionId !== regionId) {
    throw new Error("Power-line detail region does not match the requested region.");
  }
  const { geometry, bounds } = parseLineGeometry(value.geometry, `Power line ${powerLineId}`);
  if (!bounds) throw new Error(`Power line ${powerLineId} bounds are required.`);
  return {
    powerLineId,
    regionId,
    geometry,
    bounds,
    conductor: parseConductor(value.conductor),
    latestPhysics: parsePhysics(value.latest_physics),
  };
}

export async function fetchDigitalTwinPowerLines(
  apiUrl: string,
  regionId: string,
  { fetchImpl = fetch, signal }: FetchDigitalTwinPowerLinesOptions = {},
): Promise<DigitalTwinPowerLine[]> {
  const normalizedRegionId = regionId.trim();
  if (!normalizedRegionId) throw new Error("A region ID is required.");
  const url = resolveDigitalTwinApiUrl(
    normalizeDigitalTwinApiUrl(apiUrl),
    `/api/v1/regions/${encodeURIComponent(normalizedRegionId)}/power-lines`,
  );
  const response = await fetchImpl(url, { signal, cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Power-line inventory failed with HTTP ${response.status}.`);
  }
  const value = (await response.json()) as unknown;
  if (!Array.isArray(value)) throw new Error("Power-line inventory must be an array.");
  const lines = value.map(parsePowerLine);
  const ids = new Set<string>();
  for (const line of lines) {
    if (ids.has(line.powerLineId)) {
      throw new Error(`Power line ID ${line.powerLineId} is duplicated.`);
    }
    ids.add(line.powerLineId);
  }
  return lines;
}

export async function fetchDigitalTwinPowerLine(
  apiUrl: string,
  regionId: string,
  powerLineId: string,
  { fetchImpl = fetch, signal }: FetchDigitalTwinPowerLineOptions = {},
): Promise<DigitalTwinPowerLineDetail> {
  const normalizedRegionId = requiredString(regionId, "Region ID");
  const normalizedPowerLineId = requiredString(powerLineId, "Power line ID");
  const url = resolveDigitalTwinApiUrl(
    normalizeDigitalTwinApiUrl(apiUrl),
    `/api/v1/regions/${encodeURIComponent(normalizedRegionId)}/power-lines/${encodeURIComponent(normalizedPowerLineId)}`,
  );
  const response = await fetchImpl(url, { signal, cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Power-line detail failed with HTTP ${response.status}.`);
  }
  return parsePowerLineDetail(
    (await response.json()) as unknown,
    normalizedRegionId,
    normalizedPowerLineId,
  );
}

export function powerLinesFeatureCollection(
  lines: DigitalTwinPowerLine[],
): FeatureCollection<LineString, { power_line_id: string }> {
  return {
    type: "FeatureCollection",
    features: lines.map((line) => ({
      type: "Feature",
      id: line.powerLineId,
      properties: { power_line_id: line.powerLineId },
      geometry: line.geometry,
    })),
  };
}
