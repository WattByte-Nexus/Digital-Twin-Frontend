import {
  normalizeDigitalTwinApiUrl,
  resolveDigitalTwinApiUrl,
} from "./digital-twin-earth-engine";

type FetchLike = typeof fetch;

export interface DigitalTwinLiveWeather {
  observedAt: string;
  readings: DigitalTwinLiveWeatherReading[];
  temperatureC?: number;
  windDirectionDegrees?: number;
  windSpeedMph?: number;
}

export interface DigitalTwinLiveWeatherReading {
  band: string;
  label: string;
  unit?: string;
  value: number;
}

export interface DigitalTwinWeatherPoint {
  latitude: number;
  longitude: number;
}

interface WeatherDataset {
  datasetId: string;
  observedAt: string;
}

interface WeatherLayer {
  band: string;
  layerId: string;
  label: string;
  unit?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function fetchFor(options: { fetchImpl?: FetchLike }): FetchLike {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) throw new Error("This environment cannot connect to the Digital Twin API.");
  return fetchImpl;
}

function parseLatestDataset(value: unknown): WeatherDataset {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error("Digital Twin API returned an invalid weather dataset list.");
  }
  const dataset = value.items.find((item) => isRecord(item) && item.ready === true);
  if (!dataset) throw new Error("The Digital Twin Engine has no ready live weather dataset.");
  const datasetId = nonEmptyString(dataset.dataset_id);
  const observedAt = nonEmptyString(dataset.version);
  if (!datasetId || !observedAt || Number.isNaN(Date.parse(observedAt))) {
    throw new Error("The Digital Twin Engine returned an invalid live weather dataset.");
  }
  return { datasetId, observedAt };
}

function parseLayers(value: unknown): WeatherLayer[] {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error("Digital Twin API returned invalid weather map layers.");
  }
  return value.items.flatMap((item) => {
    if (!isRecord(item)) return [];
    const band = nonEmptyString(item.band);
    const layerId = nonEmptyString(item.layer_id);
    return band && layerId
      ? [{
          band,
          layerId,
          label: nonEmptyString(item.name) ?? band.replaceAll("_", " "),
          unit: nonEmptyString(item.units) ?? undefined,
        }]
      : [];
  });
}

async function sampleLayer(
  fetchImpl: FetchLike,
  apiUrl: string,
  layer: WeatherLayer,
  point: DigitalTwinWeatherPoint,
  signal?: AbortSignal,
): Promise<number> {
  const url = new URL(
    resolveDigitalTwinApiUrl(apiUrl, `/api/v1/map-layers/${encodeURIComponent(layer.layerId)}/data.json`),
  );
  url.searchParams.set("longitude", String(point.longitude));
  url.searchParams.set("latitude", String(point.latitude));
  const response = await fetchImpl(url.href, { signal, cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Live weather reading failed with HTTP ${response.status}.`);
  }
  const body = (await response.json()) as unknown;
  const reading = isRecord(body) ? finiteNumber(body.value) : null;
  if (reading === null) {
    throw new Error(`The live ${layer.band.replaceAll("_", " ")} reading is unavailable here.`);
  }
  return reading;
}

/**
 * Sample the latest ready Engine weather dataset at a map location.
 * Engine map layers are the public, versioned source of the live readings.
 */
export async function fetchDigitalTwinLiveWeather(
  value: string,
  regionId: string,
  point: DigitalTwinWeatherPoint,
  options: { fetchImpl?: FetchLike; signal?: AbortSignal } = {},
): Promise<DigitalTwinLiveWeather> {
  const apiUrl = normalizeDigitalTwinApiUrl(value);
  const normalizedRegionId = regionId.trim();
  if (!normalizedRegionId) throw new Error("A region ID is required.");
  if (
    !Number.isFinite(point.longitude) ||
    !Number.isFinite(point.latitude) ||
    point.longitude < -180 ||
    point.longitude > 180 ||
    point.latitude < -90 ||
    point.latitude > 90
  ) {
    throw new Error("A valid map location is required.");
  }
  const fetchImpl = fetchFor(options);
  const datasetsResponse = await fetchImpl(
    resolveDigitalTwinApiUrl(
      apiUrl,
      `/api/v1/regions/${encodeURIComponent(normalizedRegionId)}/weather-datasets?limit=20`,
    ),
    { signal: options.signal, cache: "no-cache" },
  );
  if (!datasetsResponse.ok) {
    throw new Error(`Weather data request failed with HTTP ${datasetsResponse.status}.`);
  }
  const dataset = parseLatestDataset((await datasetsResponse.json()) as unknown);
  const layersResponse = await fetchImpl(
    resolveDigitalTwinApiUrl(
      apiUrl,
      `/api/v1/regions/${encodeURIComponent(normalizedRegionId)}/weather-datasets/${encodeURIComponent(dataset.datasetId)}/map-layers`,
    ),
    { signal: options.signal, cache: "no-cache" },
  );
  if (!layersResponse.ok) {
    throw new Error(`Weather map-layer request failed with HTTP ${layersResponse.status}.`);
  }
  const layers = parseLayers((await layersResponse.json()) as unknown);
  if (layers.length === 0) throw new Error("The live weather dataset has no readable layers.");
  const readings = await Promise.all(
    layers.map(async (layer) => ({
      band: layer.band,
      label: layer.label,
      unit: layer.unit,
      value: await sampleLayer(fetchImpl, apiUrl, layer, point, options.signal),
    })),
  );
  const valueByBand = new Map(readings.map((reading) => [reading.band, reading.value]));
  const windSpeedMetersPerSecond = valueByBand.get("wind_velocity");
  const windDirectionDegrees =
    valueByBand.get("wind_direction") ?? valueByBand.get("wind_towards_direction");
  return {
    observedAt: dataset.observedAt,
    readings,
    temperatureC: valueByBand.get("temperature_c"),
    windDirectionDegrees:
      windDirectionDegrees === undefined
        ? undefined
        : ((windDirectionDegrees % 360) + 360) % 360,
    windSpeedMph:
      windSpeedMetersPerSecond === undefined
        ? undefined
        : windSpeedMetersPerSecond * 2.2369362920544,
  };
}
