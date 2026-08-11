import {
  normalizeDigitalTwinApiUrl,
  resolveDigitalTwinApiUrl,
} from "./digital-twin-earth-engine";

interface DigitalTwinPointCloudDatasetBase {
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

  const response = await fetchImpl(
    resolveDigitalTwinApiUrl(
      apiUrl,
      `/api/v1/regions/${encodeURIComponent(regionId)}/point-cloud-datasets`,
    ),
    { headers: { Accept: "application/json" }, signal: options.signal },
  );
  if (!response.ok) {
    throw new Error(`Digital Twin point-cloud request failed (${response.status}).`);
  }
  const payload = (await response.json()) as unknown;
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    throw new Error("Digital Twin point-cloud response is not a dataset collection.");
  }

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
