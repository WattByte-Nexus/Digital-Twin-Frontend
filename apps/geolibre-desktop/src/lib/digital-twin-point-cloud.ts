import {
  normalizeDigitalTwinApiUrl,
  requestDigitalTwinJson,
  resolveDigitalTwinApiUrl,
} from "./digital-twin-api";

import type { components } from "./digital-twin-contract.generated";

export type DigitalTwinPointCloudBuild = components["schemas"]["PointCloudLatestBuild"];

interface DigitalTwinPointCloudDatasetBase {
  latestBuild: DigitalTwinPointCloudBuild;
  datasetId: string;
  regionId: string;
  name: string;
  format: "3d-tiles-point-cloud";
  bounds: [number, number, number, number];
  boundsCrs: "EPSG:4326";
  attributes: string[];
  version: string;
  attribution: string;
  updatedAt: string;
}

export interface DigitalTwinReadyPointCloudDataset extends DigitalTwinPointCloudDatasetBase {
  status: "ready";
  tilesetUrl: string;
  pointCount: number;
  sourcePointCount: number;
  minimumSpacingMeters: number;
  failureCode: null;
}

export interface DigitalTwinUnavailablePointCloudDataset
  extends DigitalTwinPointCloudDatasetBase {
  status: "queued" | "building" | "failed";
  tilesetUrl: null;
  pointCount: null;
  sourcePointCount: null;
  minimumSpacingMeters: null;
  failureCode: string | null;
}

export type DigitalTwinPointCloudDataset =
  | DigitalTwinReadyPointCloudDataset
  | DigitalTwinUnavailablePointCloudDataset;

export type DigitalTwinPointCloudResult =
  | { status: "none" }
  | { status: "ready"; dataset: DigitalTwinReadyPointCloudDataset }
  | {
      status: DigitalTwinUnavailablePointCloudDataset["status"];
      dataset: DigitalTwinUnavailablePointCloudDataset;
    };

type FetchLike = typeof fetch;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  throw new Error(`Digital Twin point-cloud response has an invalid ${field}.`);
}

function requiredCount(value: unknown, field: string): number {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  throw new Error(`Digital Twin point-cloud response has an invalid ${field}.`);
}

function parseBounds(value: unknown): [number, number, number, number] {
  if (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate))
  ) {
    const bounds = value as [number, number, number, number];
    const [west, south, east, north] = bounds;
    if (
      west >= -180 &&
      east <= 180 &&
      south >= -90 &&
      north <= 90 &&
      west < east &&
      south < north
    ) {
      return bounds;
    }
  }
  throw new Error("Digital Twin point-cloud response has invalid bounds.");
}

function resolveTilesetUrl(apiUrl: string, value: unknown): string {
  const resolved = resolveDigitalTwinApiUrl(
    apiUrl,
    requiredString(value, "tileset_url"),
  );
  if (["http:", "https:"].includes(new URL(resolved).protocol)) return resolved;
  throw new Error("Digital Twin point-cloud response has an invalid tileset_url.");
}

function parseReadyDataset(
  value: unknown,
  apiUrl: string,
  expectedRegionId: string,
): DigitalTwinReadyPointCloudDataset {
  if (!isRecord(value)) {
    throw new Error("Digital Twin point-cloud response contains an invalid dataset.");
  }
  if (value.status !== "ready" || value.format !== "3d-tiles-point-cloud") {
    throw new Error("Digital Twin point-cloud response has an invalid active dataset.");
  }
  const regionId = requiredString(value.region_id, "region_id");
  if (regionId !== expectedRegionId) {
    throw new Error("Digital Twin point-cloud response belongs to a different region.");
  }
  if (value.bounds_crs !== "EPSG:4326") {
    throw new Error("Digital Twin point-cloud response has an unsupported bounds_crs.");
  }
  if (!Array.isArray(value.attributes) || !value.attributes.includes("position")) {
    throw new Error("Digital Twin point-cloud response is missing position data.");
  }
  if (value.failure_code !== null) {
    throw new Error("Digital Twin point-cloud response marks an active dataset as failed.");
  }
  const minimumSpacingMeters = value.minimum_spacing_m;
  if (
    typeof minimumSpacingMeters !== "number" ||
    !Number.isFinite(minimumSpacingMeters) ||
    minimumSpacingMeters <= 0
  ) {
    throw new Error("Digital Twin point-cloud response has an invalid minimum_spacing_m.");
  }

  return {
    latestBuild: parseLatestBuild(value.latest_build),
    datasetId: requiredString(value.dataset_id, "dataset_id"),
    regionId,
    name: requiredString(value.name, "name"),
    status: "ready",
    format: "3d-tiles-point-cloud",
    tilesetUrl: resolveTilesetUrl(apiUrl, value.tileset_url),
    bounds: parseBounds(value.bounds),
    boundsCrs: "EPSG:4326",
    pointCount: requiredCount(value.point_count, "point_count"),
    sourcePointCount: requiredCount(value.source_point_count, "source_point_count"),
    minimumSpacingMeters,
    attributes: value.attributes.map((attribute) => requiredString(attribute, "attribute")),
    version: requiredString(value.version, "version"),
    attribution: requiredString(value.attribution, "attribution"),
    updatedAt: requiredString(value.updated_at, "updated_at"),
    failureCode: null,
  };
}

function parseUnavailableDataset(
  value: unknown,
  expectedRegionId: string,
): DigitalTwinUnavailablePointCloudDataset {
  if (!isRecord(value)) {
    throw new Error("Digital Twin point-cloud response contains an invalid dataset.");
  }
  if (
    !["queued", "building", "failed"].includes(String(value.status)) ||
    value.format !== "3d-tiles-point-cloud"
  ) {
    throw new Error("Digital Twin point-cloud response has an invalid unavailable dataset.");
  }
  const status = value.status as DigitalTwinUnavailablePointCloudDataset["status"];
  const regionId = requiredString(value.region_id, "region_id");
  if (regionId !== expectedRegionId) {
    throw new Error("Digital Twin point-cloud response belongs to a different region.");
  }
  if (value.bounds_crs !== "EPSG:4326") {
    throw new Error("Digital Twin point-cloud response has an unsupported bounds_crs.");
  }
  if (value.tileset_url !== null) {
    throw new Error("Digital Twin point-cloud response publishes a tileset before it is ready.");
  }
  if (
    value.point_count !== null ||
    value.source_point_count !== null ||
    value.minimum_spacing_m !== null
  ) {
    throw new Error("Digital Twin point-cloud response publishes statistics before it is ready.");
  }
  if (!Array.isArray(value.attributes) || !value.attributes.includes("position")) {
    throw new Error("Digital Twin point-cloud response is missing position data.");
  }

  return {
    latestBuild: parseLatestBuild(value.latest_build),
    datasetId: requiredString(value.dataset_id, "dataset_id"),
    regionId,
    name: requiredString(value.name, "name"),
    status,
    format: "3d-tiles-point-cloud",
    tilesetUrl: null,
    bounds: parseBounds(value.bounds),
    boundsCrs: "EPSG:4326",
    pointCount: null,
    sourcePointCount: null,
    minimumSpacingMeters: null,
    attributes: value.attributes.map((attribute) => requiredString(attribute, "attribute")),
    version: requiredString(value.version, "version"),
    attribution: requiredString(value.attribution, "attribution"),
    updatedAt: requiredString(value.updated_at, "updated_at"),
    failureCode:
      value.failure_code === null
        ? null
        : requiredString(value.failure_code, "failure_code"),
  };
}

export async function fetchActiveDigitalTwinPointCloud(
  value: string,
  regionId: string,
  options: { fetchImpl?: FetchLike; signal?: AbortSignal } = {},
): Promise<DigitalTwinPointCloudResult> {
  const apiUrl = normalizeDigitalTwinApiUrl(value);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) throw new Error("This environment cannot connect to the Digital Twin API.");

  const payload = await requestDigitalTwinJson<unknown>(apiUrl, `/api/v1/regions/${encodeURIComponent(regionId)}/point-cloud-datasets`, { fetchImpl, signal: options.signal });
  if (!isRecord(payload) || !Array.isArray(payload.items)) throw new Error("Digital Twin point-cloud response is not a dataset collection.");

  if (payload.active_dataset_id === null) {
    if (payload.items.length === 0) return { status: "none" };
    const unavailable = parseUnavailableDataset(payload.items[0], regionId);
    return { status: unavailable.status, dataset: unavailable };
  }
  const activeDatasetId = requiredString(payload.active_dataset_id, "active_dataset_id");
  const active = payload.items.find(
    (item) => isRecord(item) && item.dataset_id === activeDatasetId,
  );
  if (!active) {
    throw new Error("Digital Twin point-cloud response does not contain its active dataset.");
  }
  return {
    status: "ready",
    dataset: parseReadyDataset(active, apiUrl, regionId),
  };
}

function parseLatestBuild(value: unknown): DigitalTwinPointCloudBuild {
  if (!isRecord(value) || !["queued", "building", "ready", "failed"].includes(String(value.status))) throw new Error("Dataset response is missing its latest build state.");
  return { version: requiredString(value.version, "latest_build.version"), status: value.status as DigitalTwinPointCloudBuild["status"], updated_at: requiredString(value.updated_at, "latest_build.updated_at"), failure_code: value.failure_code === null ? null : requiredString(value.failure_code, "latest_build.failure_code") };
}
function parseDataset(value: unknown, apiUrl: string, regionId: string): DigitalTwinPointCloudDataset {
  return isRecord(value) && value.status === "ready" ? parseReadyDataset(value, apiUrl, regionId) : parseUnavailableDataset(value, regionId);
}
export async function fetchDigitalTwinPointCloudDatasets(apiUrl: string, regionId: string, options: { fetchImpl?: FetchLike; signal?: AbortSignal } = {}): Promise<DigitalTwinPointCloudDataset[]> {
  const payload = await requestDigitalTwinJson<{ items: unknown[] }>(apiUrl, `/api/v1/regions/${encodeURIComponent(regionId)}/point-cloud-datasets`, options);
  if (!Array.isArray(payload.items)) throw new Error("Point-cloud catalog must contain datasets.");
  return payload.items.map((item) => parseDataset(item, apiUrl, regionId));
}
export async function fetchDigitalTwinPointCloudDataset(apiUrl: string, regionId: string, datasetId: string, options: { fetchImpl?: FetchLike; signal?: AbortSignal } = {}): Promise<DigitalTwinPointCloudDataset> {
  const dataset = parseDataset(await requestDigitalTwinJson(apiUrl, `/api/v1/regions/${encodeURIComponent(regionId)}/point-cloud-datasets/${encodeURIComponent(datasetId)}`, options), apiUrl, regionId);
  if (dataset.datasetId !== datasetId) throw new Error("Dataset response does not match the requested identity.");
  return dataset;
}

export type DigitalTwinSurveyMetadata = components["schemas"]["PointCloudSurveyUploadMetadata"];
export type DigitalTwinSurveySubmission = components["schemas"]["PointCloudSurveySubmission"];

/** Validate reviewed placement metadata before uploading private survey bytes. */
export function parseDigitalTwinSurveyMetadata(text: string): DigitalTwinSurveyMetadata {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value)) throw new Error("Survey metadata must be a JSON object.");
  const keys = ["patch_id", "acquired_at", "target_crs", "vertical_datum", "meters_per_source_unit", "local_to_target_matrix", "replacement_footprint_wkt", "replacement_z_range", "registration_method", "registration_rmse_m"];
  if (Object.keys(value).some((key) => !keys.includes(key)) || keys.some((key) => value[key] === undefined)) throw new Error("Survey metadata contains missing or unsupported fields.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(requiredString(value.patch_id, "patch_id"))) throw new Error("Patch identity must use lower kebab case.");
  if (!Number.isFinite(Date.parse(requiredString(value.acquired_at, "acquired_at"))) || !/(Z|\+00:00)$/.test(String(value.acquired_at))) throw new Error("Acquisition time must explicitly use UTC.");
  for (const key of ["target_crs", "vertical_datum", "replacement_footprint_wkt"]) requiredString(value[key], key);
  if (typeof value.meters_per_source_unit !== "number" || !Number.isFinite(value.meters_per_source_unit) || value.meters_per_source_unit <= 0) throw new Error("Source units must have a positive metric scale.");
  if (!Array.isArray(value.local_to_target_matrix) || value.local_to_target_matrix.length !== 16 || !value.local_to_target_matrix.every((n) => typeof n === "number" && Number.isFinite(n))) throw new Error("Placement requires a finite row-major 4×4 matrix.");
  const m = value.local_to_target_matrix as number[];
  if (m[12] !== 0 || m[13] !== 0 || m[14] !== 0 || m[15] !== 1) throw new Error("Placement matrix must be affine.");
  const scale = value.meters_per_source_unit;
  const columns = [[m[0], m[4], m[8]], [m[1], m[5], m[9]], [m[2], m[6], m[10]]];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(Math.hypot(...columns[i]) - scale) > scale * 1e-6) throw new Error("Placement matrix scale must match source units.");
    for (let j = i + 1; j < 3; j++) if (Math.abs(columns[i].reduce((sum, n, k) => sum + n * columns[j][k], 0)) > scale * scale * 1e-6) throw new Error("Placement matrix must not shear geometry.");
  }
  if (!Array.isArray(value.replacement_z_range) || value.replacement_z_range.length !== 2 || !value.replacement_z_range.every((n) => typeof n === "number" && Number.isFinite(n)) || value.replacement_z_range[0] >= value.replacement_z_range[1]) throw new Error("Replacement Z range must increase.");
  if (!["rtk_trajectory", "ground_control_points", "point_pair_icp"].includes(String(value.registration_method)) || typeof value.registration_rmse_m !== "number" || !Number.isFinite(value.registration_rmse_m) || value.registration_rmse_m < 0) throw new Error("Registration method and measured RMSE are required.");
  return value as unknown as DigitalTwinSurveyMetadata;
}
export async function submitDigitalTwinSurvey(apiUrl: string, regionId: string, datasetId: string, file: File, metadata: DigitalTwinSurveyMetadata, options: { fetchImpl?: FetchLike; signal?: AbortSignal } = {}): Promise<DigitalTwinSurveySubmission> {
  if (!file.name.toLowerCase().endsWith(".ply")) throw new Error("Survey upload requires a .ply file.");
  if (file.size === 0 || file.size > 2 * 1024 ** 3) throw new Error("Survey must contain data and fit the 2 GiB upload limit.");
  parseDigitalTwinSurveyMetadata(JSON.stringify(metadata));
  const body = new FormData(); body.append("file", file, file.name); body.append("metadata", JSON.stringify(metadata));
  return requestDigitalTwinJson<DigitalTwinSurveySubmission>(apiUrl, `/api/v1/regions/${encodeURIComponent(regionId)}/point-cloud-datasets/${encodeURIComponent(datasetId)}/surveys`, { ...options, method: "POST", body });
}
/** An old ready descriptor can never complete a newly accepted version. */
export function digitalTwinSurveyBuild(dataset: DigitalTwinPointCloudDataset, acceptedVersion: string): DigitalTwinPointCloudBuild | null {
  return dataset.latestBuild.version === acceptedVersion ? dataset.latestBuild : null;
}
