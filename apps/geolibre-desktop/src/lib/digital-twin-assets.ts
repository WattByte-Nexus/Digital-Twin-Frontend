import {
  normalizeDigitalTwinApiUrl,
  resolveDigitalTwinApiUrl,
} from "./digital-twin-earth-engine";

export interface DigitalTwinAssetCoordinate {
  lat: number;
  lon: number;
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
}

export interface DigitalTwinPowerLineAsset {
  kind: "power_line";
  assetId: string;
  regionId: string;
  coordinates: DigitalTwinAssetCoordinate[];
  name: string | null;
}

export type DigitalTwinAsset = DigitalTwinTreeAsset | DigitalTwinPowerLineAsset;

export type DigitalTwinAssetPatch =
  | Partial<{
      location: DigitalTwinAssetCoordinate;
      species: string | null;
      height_m: number | null;
      canopy_radius_m: number | null;
    }>
  | Partial<{
      coordinates: DigitalTwinAssetCoordinate[];
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
    };
  }
  if (value.kind === "power_line") {
    if (!Array.isArray(value.coordinates) || value.coordinates.length < 2) {
      throw new Error("Power line must include at least two coordinates.");
    }
    return {
      kind: "power_line",
      assetId,
      regionId,
      coordinates: value.coordinates.map((item, index) =>
        coordinate(item, `Coordinate ${index + 1}`)
      ),
      name: optionalString(value.name, "Power-line name"),
    };
  }
  throw new Error("Asset response has an unsupported kind.");
}

async function request(
  apiUrl: string,
  path: string,
  init: RequestInit,
  fetchImpl: typeof fetch
): Promise<Response> {
  const response = await fetchImpl(
    resolveDigitalTwinApiUrl(normalizeDigitalTwinApiUrl(apiUrl), path),
    { ...init, headers: { Accept: "application/json", ...init.headers } }
  );
  if (!response.ok) {
    let detail: unknown;
    try {
      detail = ((await response.json()) as { detail?: unknown }).detail;
    } catch {
      detail = null;
    }
    throw new Error(
      typeof detail === "string"
        ? detail
        : `Asset request failed (${response.status}).`
    );
  }
  return response;
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

export async function fetchDigitalTwinAsset(
  apiUrl: string,
  assetId: string,
  { fetchImpl = fetch, signal }: RequestOptions = {}
): Promise<DigitalTwinAsset> {
  const response = await request(
    apiUrl,
    `/api/v1/assets/${encodeURIComponent(requiredString(assetId, "Asset ID"))}`,
    { signal, cache: "no-cache" },
    fetchImpl
  );
  return parseAsset((await response.json()) as unknown);
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
  assetId: string,
  patch: DigitalTwinAssetPatch,
  { fetchImpl = fetch, signal }: RequestOptions = {}
): Promise<DigitalTwinAsset> {
  const response = await request(
    apiUrl,
    `/api/v1/assets/${encodeURIComponent(requiredString(assetId, "Asset ID"))}`,
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
  assetId: string,
  { fetchImpl = fetch, signal }: RequestOptions = {}
): Promise<void> {
  await request(
    apiUrl,
    `/api/v1/assets/${encodeURIComponent(requiredString(assetId, "Asset ID"))}`,
    { method: "DELETE", signal },
    fetchImpl
  );
}
