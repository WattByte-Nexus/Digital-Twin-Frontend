import { normalizeDigitalTwinApiUrl, resolveDigitalTwinApiUrl, requestDigitalTwinJson, requestDigitalTwinResponse, fetchDigitalTwinPages } from "./digital-twin-api";

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

function parseLayer(
  value: unknown,
  apiUrl: string,
  regionId: string,
  regionName: string,
): DigitalTwinEarthEngineLayer | null {
  if (!isRecord(value) || value.format !== "cog") return null;
  const layerId = nonEmptyString(value.layer_id);
  const sourceUrl = nonEmptyString(value.url);
  if (!layerId || !sourceUrl) return null;
  if (typeof value.source_ready !== "boolean" || typeof value.artifact_ready !== "boolean") throw new Error("COG descriptor is missing source or artifact readiness.");
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
    const response = await requestDigitalTwinResponse(new URL(layer.url).origin, layer.url, {
      fetchImpl,
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

  const regions = (await fetchDigitalTwinPages<{ region_id: string; name: string }>(apiUrl, "/api/v1/regions?limit=100", options)).map((region) => ({ id: region.region_id, name: region.name }));

  const results = await Promise.allSettled(
    regions.map(async (region) => {
      const response = await requestDigitalTwinJson(apiUrl, `/api/v1/regions/${encodeURIComponent(region.id)}/earth-engine/map-layers`, { fetchImpl, signal: options.signal });
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

/** Fetch one region's descriptors without searching unrelated regions. */
export async function fetchDigitalTwinRegionalEarthEngineLayers(apiUrl: string, regionId: string, regionName: string, options: { fetchImpl?: FetchLike; signal?: AbortSignal } = {}): Promise<DigitalTwinEarthEngineLayer[]> {
  const response = await requestDigitalTwinJson(apiUrl, `/api/v1/regions/${encodeURIComponent(regionId)}/earth-engine/map-layers`, options);
  return pageItems(response).map((item) => parseLayer(item, apiUrl, regionId, regionName)).filter((layer): layer is DigitalTwinEarthEngineLayer => layer !== null);
}
