const API_STORAGE_KEY = "geolibre.digital-twin-demo.api-url";
const DEFAULT_API_URL = "http://127.0.0.1:8000";
const DEV_API_PROXY_PATH = "/__digital_twin_api";

interface DigitalTwinRuntimeWindow extends Window {
  __DIGITAL_TWIN_API_URL__?: string;
}

export interface DigitalTwinEarthEngineStyle {
  colormap?: string;
  rescaleMin?: number;
  rescaleMax?: number;
  opacity?: number;
}

export interface DigitalTwinEarthEngineLayer {
  id: string;
  layerId: string;
  name: string;
  band?: string;
  units?: string;
  url: string;
  regionId: string;
  regionName: string;
  sourceReady: boolean;
  artifactReady: boolean;
  style: DigitalTwinEarthEngineStyle;
}

export interface DigitalTwinEarthEngineDataset {
  id: string;
  name: string;
  band?: string;
  units?: string;
  layers: DigitalTwinEarthEngineLayer[];
  primaryLayer: DigitalTwinEarthEngineLayer;
}

export interface DigitalTwinEarthEngineCatalog {
  apiUrl: string;
  layers: DigitalTwinEarthEngineLayer[];
  unavailableRegions: string[];
}

type FetchLike = typeof fetch;

const DEFAULT_COG_PREPARATION_TIMEOUT_MS = 90_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function pageItems(value: unknown): unknown[] {
  return isRecord(value) && Array.isArray(value.items) ? value.items : [];
}

export function normalizeDigitalTwinApiUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("API URL must be an absolute HTTP URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("API URL must use HTTP or HTTPS.");
  }
  parsed.hash = "";
  parsed.search = "";
  return parsed.href.replace(/\/+$/, "");
}

function devProxyApiUrl(runtimeWindow: DigitalTwinRuntimeWindow | undefined): string | undefined {
  const location = runtimeWindow?.location;
  if (
    !location ||
    location.port !== "5173" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)
  ) {
    return undefined;
  }
  return new URL(DEV_API_PROXY_PATH, location.origin).href.replace(/\/+$/, "");
}

export function defaultDigitalTwinApiUrl(
  runtimeWindow: DigitalTwinRuntimeWindow | undefined =
    typeof window === "undefined" ? undefined : (window as DigitalTwinRuntimeWindow),
): string {
  const stored = runtimeWindow?.localStorage?.getItem(API_STORAGE_KEY);
  const candidates = [
    runtimeWindow?.__DIGITAL_TWIN_API_URL__,
    stored === DEFAULT_API_URL ? undefined : stored,
    devProxyApiUrl(runtimeWindow),
    stored,
    DEFAULT_API_URL,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return normalizeDigitalTwinApiUrl(candidate);
    } catch {
      // Fall through to the next configured default.
    }
  }
  return DEFAULT_API_URL;
}

export function rememberDigitalTwinApiUrl(value: string): void {
  if (typeof window === "undefined") return;
  window.localStorage?.setItem(API_STORAGE_KEY, normalizeDigitalTwinApiUrl(value));
}

export function resolveDigitalTwinApiUrl(apiUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path.replace(/^\/+/, ""), `${apiUrl}/`).href;
}

async function requestJson(fetchImpl: FetchLike, url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetchImpl(url, { signal });
  if (response.ok) return response.json();
  let detail = "";
  try {
    const body = (await response.json()) as unknown;
    if (isRecord(body)) detail = nonEmptyString(body.detail) ?? nonEmptyString(body.title) ?? "";
  } catch {
    // The status text below is enough when the API did not return JSON.
  }
  throw new Error(detail || `Digital Twin API request failed (${response.status}).`);
}

function parseLayer(
  value: unknown,
  apiUrl: string,
  regionId: string,
  regionName: string,
): DigitalTwinEarthEngineLayer | null {
  if (!isRecord(value) || value.format !== "cog") return null;
  const layerId = nonEmptyString(value.layer_id);
  const sourceUrl = nonEmptyString(value.url) ?? nonEmptyString(value.tile_url);
  if (!layerId || !sourceUrl) return null;
  const defaultStyle = isRecord(value.default_style) ? value.default_style : {};
  return {
    id: `${regionId}:${layerId}`,
    layerId,
    name: nonEmptyString(value.name) ?? layerId,
    band: nonEmptyString(value.band),
    units: nonEmptyString(value.units),
    url: resolveDigitalTwinApiUrl(apiUrl, sourceUrl),
    regionId,
    regionName,
    sourceReady: value.source_ready === true,
    artifactReady: value.artifact_ready === true,
    style: {
      colormap: nonEmptyString(defaultStyle.colormap),
      rescaleMin: finiteNumber(defaultStyle.rescale_min),
      rescaleMax: finiteNumber(defaultStyle.rescale_max),
      opacity: finiteNumber(defaultStyle.opacity),
    },
  };
}

function semanticDatasetId(layer: DigitalTwinEarthEngineLayer): string {
  const band = layer.band?.trim().toLocaleLowerCase();
  if (band) return band;
  return [layer.name, layer.units]
    .filter(Boolean)
    .join(":")
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function comparePrimaryLayers(
  left: DigitalTwinEarthEngineLayer,
  right: DigitalTwinEarthEngineLayer,
): number {
  return (
    Number(right.artifactReady) - Number(left.artifactReady) ||
    Number(right.sourceReady) - Number(left.sourceReady) ||
    left.regionName.localeCompare(right.regionName)
  );
}

export function groupDigitalTwinEarthEngineLayers(
  layers: DigitalTwinEarthEngineLayer[],
): DigitalTwinEarthEngineDataset[] {
  const groups = new Map<
    string,
    { dataset: DigitalTwinEarthEngineDataset; layerIds: Set<string> }
  >();

  for (const layer of layers) {
    const datasetId = semanticDatasetId(layer);
    const existing = groups.get(datasetId);
    if (existing) {
      if (!existing.layerIds.has(layer.id)) {
        existing.dataset.layers.push(layer);
        existing.layerIds.add(layer.id);
      }
      continue;
    }
    groups.set(datasetId, {
      dataset: {
        id: datasetId,
        name: layer.name,
        band: layer.band,
        units: layer.units,
        layers: [layer],
        primaryLayer: layer,
      },
      layerIds: new Set([layer.id]),
    });
  }

  return [...groups.values()]
    .map(({ dataset }) => {
      const groupedLayers = [...dataset.layers].sort(comparePrimaryLayers);
      const primaryLayer = groupedLayers[0] ?? dataset.primaryLayer;
      return {
        ...dataset,
        layers: [...groupedLayers].sort((left, right) =>
          left.regionName.localeCompare(right.regionName),
        ),
        primaryLayer,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function prepareDigitalTwinEarthEngineCog(
  layer: DigitalTwinEarthEngineLayer,
  options: { fetchImpl?: FetchLike; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<void> {
  if (layer.artifactReady) return;
  if (!layer.sourceReady) {
    throw new Error(`${layer.name} is listed by the API, but its source data is not ready.`);
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) throw new Error("This environment cannot prepare the Earth Engine COG.");
  const timeoutMs = options.timeoutMs ?? DEFAULT_COG_PREPARATION_TIMEOUT_MS;
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abortFromCaller();
  else options.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(layer.url, {
      method: "HEAD",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(
        `The Digital Twin API could not prepare ${layer.name} (${response.status}).`,
      );
    }
    const contentType = response.headers.get("content-type");
    if (contentType && !contentType.toLocaleLowerCase().includes("tiff")) {
      throw new Error(`The Digital Twin API did not return a GeoTIFF for ${layer.name}.`);
    }
    const acceptRanges = response.headers.get("accept-ranges");
    if (acceptRanges && !acceptRanges.toLocaleLowerCase().includes("bytes")) {
      throw new Error(`The Digital Twin API COG endpoint does not support byte ranges.`);
    }
  } catch (error) {
    if (timedOut) {
      const timeoutLabel =
        timeoutMs < 1_000 ? `${timeoutMs} ms` : `${Math.ceil(timeoutMs / 1_000)} seconds`;
      throw new Error(
        `The Digital Twin API did not prepare this COG within ${timeoutLabel}. Check the API logs, then retry.`,
        { cause: error },
      );
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}

export async function fetchDigitalTwinEarthEngineCatalog(
  value: string,
  options: { fetchImpl?: FetchLike; signal?: AbortSignal } = {},
): Promise<DigitalTwinEarthEngineCatalog> {
  const apiUrl = normalizeDigitalTwinApiUrl(value);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) throw new Error("This environment cannot connect to the Digital Twin API.");

  const regionPage = await requestJson(
    fetchImpl,
    resolveDigitalTwinApiUrl(apiUrl, "/api/v1/regions?limit=100"),
    options.signal,
  );
  const regions = pageItems(regionPage).flatMap((value) => {
    if (!isRecord(value)) return [];
    const id = nonEmptyString(value.region_id);
    if (!id) return [];
    return [{ id, name: nonEmptyString(value.name) }];
  });

  const results = await Promise.allSettled(
    regions.map(async (region) => {
      const response = await requestJson(
        fetchImpl,
        resolveDigitalTwinApiUrl(
          apiUrl,
          `/api/v1/regions/${encodeURIComponent(region.id)}/earth-engine/map-layers`,
        ),
        options.signal,
      );
      return pageItems(response)
        .map((item) => parseLayer(item, apiUrl, region.id, region.name ?? region.id))
        .filter((layer): layer is DigitalTwinEarthEngineLayer => layer !== null);
    }),
  );

  if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const layers = results
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .sort((left, right) =>
      left.name.localeCompare(right.name) || left.regionName.localeCompare(right.regionName),
    );
  const unavailableRegions = results.flatMap((result, index) =>
    result.status === "rejected" ? [regions[index]?.name ?? regions[index]?.id ?? "Unknown"] : [],
  );
  return { apiUrl, layers, unavailableRegions };
}
