import {
  normalizeDigitalTwinApiUrl,
  resolveDigitalTwinApiUrl,
} from "./digital-twin-earth-engine";

type FetchLike = typeof fetch;

export type DigitalTwinEngineHealth = "ready" | "degraded" | "offline";

export interface DigitalTwinWeatherDataset {
  datasetId: string;
  ready: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fetchFor(options: { fetchImpl?: FetchLike }): FetchLike {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) {
    throw new Error("This environment cannot connect to the Digital Twin API.");
  }
  return fetchImpl;
}

async function hasExpectedStatus(
  fetchImpl: FetchLike,
  url: string,
  expectedStatus: "live" | "ready",
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const response = await fetchImpl(url, { signal, cache: "no-cache" });
    if (!response.ok) return false;
    const body = (await response.json()) as unknown;
    return isRecord(body) && body.status === expectedStatus;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    return false;
  }
}

/**
 * Check both Engine health contracts. A live process that has not completed
 * startup is reported as degraded, while an unreachable process is offline.
 */
export async function checkDigitalTwinEngineHealth(
  value: string,
  options: { fetchImpl?: FetchLike; signal?: AbortSignal } = {},
): Promise<DigitalTwinEngineHealth> {
  const apiUrl = normalizeDigitalTwinApiUrl(value);
  const fetchImpl = fetchFor(options);
  const [live, ready] = await Promise.all([
    hasExpectedStatus(
      fetchImpl,
      resolveDigitalTwinApiUrl(apiUrl, "/api/v1/health/live"),
      "live",
      options.signal,
    ),
    hasExpectedStatus(
      fetchImpl,
      resolveDigitalTwinApiUrl(apiUrl, "/api/v1/health/ready"),
      "ready",
      options.signal,
    ),
  ]);
  if (!live) return "offline";
  return ready ? "ready" : "degraded";
}

/** Load the selected region's exact weather catalog for the map workspace. */
export async function fetchDigitalTwinWeatherDatasets(
  value: string,
  regionId: string,
  options: { fetchImpl?: FetchLike; signal?: AbortSignal } = {},
): Promise<DigitalTwinWeatherDataset[]> {
  const apiUrl = normalizeDigitalTwinApiUrl(value);
  const normalizedRegionId = regionId.trim();
  if (!normalizedRegionId) throw new Error("A region ID is required.");
  const response = await fetchFor(options)(
    resolveDigitalTwinApiUrl(
      apiUrl,
      `/api/v1/regions/${encodeURIComponent(normalizedRegionId)}/weather-datasets?limit=20`,
    ),
    { signal: options.signal, cache: "no-cache" },
  );
  if (!response.ok) {
    throw new Error(`Weather data request failed with HTTP ${response.status}.`);
  }
  const body = (await response.json()) as unknown;
  if (!isRecord(body) || !Array.isArray(body.items)) {
    throw new Error("Weather data response must contain a dataset list.");
  }
  return body.items.map((item, index) => {
    if (!isRecord(item) || typeof item.dataset_id !== "string" || !item.dataset_id.trim()) {
      throw new Error(`Weather dataset ${index + 1} is invalid.`);
    }
    if (typeof item.ready !== "boolean") {
      throw new Error(`Weather dataset ${index + 1} is missing its ready state.`);
    }
    return { datasetId: item.dataset_id, ready: item.ready };
  });
}
