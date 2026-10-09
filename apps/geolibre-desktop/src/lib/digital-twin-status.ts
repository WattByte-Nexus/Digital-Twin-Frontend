import {
  fetchDigitalTwinPages,
  requestDigitalTwinJson,
  normalizeDigitalTwinApiUrl,
  resolveDigitalTwinApiUrl,
} from "./digital-twin-api";

type FetchLike = typeof fetch;

export type DigitalTwinEngineHealth = "ready" | "degraded" | "offline";

export interface DigitalTwinWeatherDataset {
  datasetId: string;
  ready: boolean;
  observedAt: string;
  freshUntil: string;
  sourceKind: "observation" | "analysis" | "forecast";
}

export interface DigitalTwinWeatherFreshness {
  status: "current" | "stale" | "missing";
  observedAt: string | null;
}

/**
 * Assess the newest available observation/analysis against the Engine's expiry.
 * @param datasets Exact weather descriptors; forecasts never establish live freshness.
 * @param nowMs Current UTC time in milliseconds, injectable for deterministic checks.
 * @returns Missing for no usable observations, otherwise current or stale with its time.
 */
export function digitalTwinWeatherFreshness(
  datasets: readonly DigitalTwinWeatherDataset[],
  nowMs = Date.now(),
): DigitalTwinWeatherFreshness {
  const latest = datasets
    .filter((dataset) => dataset.ready && dataset.sourceKind !== "forecast" &&
      Date.parse(dataset.observedAt) <= nowMs)
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0];
  if (!latest) return { status: "missing", observedAt: null };
  return {
    status: nowMs <= Date.parse(latest.freshUntil) ? "current" : "stale",
    observedAt: latest.observedAt,
  };
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
    const body = await requestDigitalTwinJson<unknown>(url, url, { fetchImpl, signal, cache: "no-cache" });
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
  const items = await fetchDigitalTwinPages<unknown>(apiUrl,
    `/api/v1/regions/${encodeURIComponent(normalizedRegionId)}/weather-datasets`, options);
  return items.map((item, index) => {
    if (!isRecord(item) || typeof item.dataset_id !== "string" || !item.dataset_id.trim()) {
      throw new Error(`Weather dataset ${index + 1} is invalid.`);
    }
    if (typeof item.ready !== "boolean") {
      throw new Error(`Weather dataset ${index + 1} is missing its ready state.`);
    }
    if (
      typeof item.version !== "string" || !Number.isFinite(Date.parse(item.version)) ||
      typeof item.fresh_until !== "string" || !Number.isFinite(Date.parse(item.fresh_until)) ||
      Date.parse(item.fresh_until) <= Date.parse(item.version) ||
      !["observation", "analysis", "forecast"].includes(String(item.source_kind))
    ) {
      throw new Error(`Weather dataset ${index + 1} has invalid freshness metadata.`);
    }
    return {
      datasetId: item.dataset_id,
      ready: item.ready,
      observedAt: item.version,
      freshUntil: item.fresh_until,
      sourceKind: item.source_kind as DigitalTwinWeatherDataset["sourceKind"],
    };
  });
}
