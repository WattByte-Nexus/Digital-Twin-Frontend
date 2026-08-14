import {
  normalizeDigitalTwinApiUrl,
  resolveDigitalTwinApiUrl,
} from "./digital-twin-earth-engine";

type FetchLike = typeof fetch;

export interface DigitalTwinLiveWeather {
  condition?: string;
  nearestStation?: DigitalTwinLiveWeatherStation;
  observedAt: string;
  readings: DigitalTwinLiveWeatherReading[];
  unavailableReadingLabels: string[];
  temperatureC?: number;
  windDirectionDegrees?: number;
  windSpeedMph?: number;
}

export interface DigitalTwinLiveWeatherStation {
  distanceKm: number;
  elevationM?: number;
  id: string;
  observedAt: string;
  provider: string;
  qualityStatus: string;
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
  bounds?: WeatherBounds;
  datasetId: string;
  observedAt: string;
}

interface WeatherBounds {
  east: number;
  north: number;
  south: number;
  west: number;
}

interface WeatherLayer {
  band: string;
  layerId: string;
  label: string;
  unit?: string;
}

interface WeatherStationObservation {
  condition?: string;
  elevationM?: number;
  latitude: number;
  longitude: number;
  observedAt: string;
  provider: string;
  qualityStatus: string;
  stationId: string;
  values: Map<string, number>;
}

const STATION_FIELD_BANDS = {
  temperature_c: "temperature_c",
  dew_point_c: "dew_point_c",
  relative_humidity_pct: "relative_humidity_pct",
  wind_speed_m_s: "wind_velocity",
  wind_from_degrees: "wind_direction",
  wind_gust_m_s: "wind_gust_m_s",
  precipitation_last_hour_m: "precipitation_last_hour_m",
  barometric_pressure_pa: "barometric_pressure_pa",
  sea_level_pressure_pa: "sea_level_pressure_pa",
  visibility_m: "visibility_m",
} as const;

const WEATHER_BAND_PRESENTATIONS: Readonly<
  Record<string, { label: string; unit: string }>
> = {
  temperature_c: { label: "Air temperature", unit: "°C" },
  dew_point_c: { label: "Dew point", unit: "°C" },
  relative_humidity_pct: { label: "Relative humidity", unit: "%" },
  wind_velocity: { label: "Wind speed", unit: "m/s" },
  wind_direction: { label: "Wind direction", unit: "degrees" },
  wind_gust_m_s: { label: "Wind gust", unit: "m/s" },
  precipitation_last_hour_m: {
    label: "Precipitation in last hour",
    unit: "m",
  },
  barometric_pressure_pa: { label: "Barometric pressure", unit: "Pa" },
  sea_level_pressure_pa: { label: "Sea-level pressure", unit: "Pa" },
  visibility_m: { label: "Visibility", unit: "m" },
};

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
  if (!fetchImpl)
    throw new Error("This environment cannot connect to the Digital Twin API.");
  return fetchImpl;
}

function parseLatestDataset(value: unknown): WeatherDataset {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error(
      "Digital Twin API returned an invalid weather dataset list."
    );
  }
  const dataset = value.items.find(
    (item) => isRecord(item) && item.ready === true
  );
  if (!dataset)
    throw new Error(
      "The Digital Twin Engine has no ready live weather dataset."
    );
  const datasetId = nonEmptyString(dataset.dataset_id);
  const observedAt = nonEmptyString(dataset.version);
  if (!datasetId || !observedAt || Number.isNaN(Date.parse(observedAt))) {
    throw new Error(
      "The Digital Twin Engine returned an invalid live weather dataset."
    );
  }
  const rawBounds = isRecord(dataset.bounds) ? dataset.bounds : undefined;
  const west = finiteNumber(rawBounds?.west);
  const south = finiteNumber(rawBounds?.south);
  const east = finiteNumber(rawBounds?.east);
  const north = finiteNumber(rawBounds?.north);
  const bounds =
    west !== null &&
    south !== null &&
    east !== null &&
    north !== null &&
    west < east &&
    south < north
      ? { west, south, east, north }
      : undefined;
  return { bounds, datasetId, observedAt };
}

function parseLayers(value: unknown): WeatherLayer[] {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error("Digital Twin API returned invalid weather map layers.");
  }
  return value.items.flatMap((item) => {
    if (!isRecord(item)) return [];
    const band = nonEmptyString(item.band);
    const layerId = nonEmptyString(item.layer_id);
    const label =
      nonEmptyString(item.name)?.split(" · ")[0] ?? band?.replaceAll("_", " ");
    return band && layerId
      ? [
          {
            band,
            layerId,
            label: label ?? band.replaceAll("_", " "),
            unit: nonEmptyString(item.units) ?? undefined,
          },
        ]
      : [];
  });
}

function parseStationObservations(value: unknown): WeatherStationObservation[] {
  if (!isRecord(value) || !Array.isArray(value.items)) return [];
  return value.items.flatMap((item) => {
    if (!isRecord(item)) return [];
    const stationId = nonEmptyString(item.station_id);
    const observedAt = nonEmptyString(item.observed_at);
    const provider = nonEmptyString(item.source_provider);
    const qualityStatus = nonEmptyString(item.quality_status);
    const latitude = finiteNumber(item.lat);
    const longitude = finiteNumber(item.lon);
    if (
      !stationId ||
      !observedAt ||
      !provider ||
      !qualityStatus ||
      latitude === null ||
      longitude === null
    ) {
      return [];
    }
    const values = new Map<string, number>();
    for (const [field, band] of Object.entries(STATION_FIELD_BANDS)) {
      const measurement = finiteNumber(item[field]);
      if (measurement !== null) values.set(band, measurement);
    }
    return [
      {
        condition: nonEmptyString(item.text_description) ?? undefined,
        elevationM: finiteNumber(item.elevation_m) ?? undefined,
        latitude,
        longitude,
        observedAt,
        provider,
        qualityStatus,
        stationId,
        values,
      },
    ];
  });
}

function distanceKm(
  left: DigitalTwinWeatherPoint,
  right: DigitalTwinWeatherPoint
): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (right.latitude - left.latitude) * radians;
  const longitudeDelta = (right.longitude - left.longitude) * radians;
  const leftLatitude = left.latitude * radians;
  const rightLatitude = right.latitude * radians;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) *
      Math.cos(rightLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6_371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function nearestObservation(
  observations: WeatherStationObservation[],
  point: DigitalTwinWeatherPoint
): WeatherStationObservation | undefined {
  return observations.reduce<WeatherStationObservation | undefined>(
    (nearest, candidate) => {
      if (!nearest) return candidate;
      return distanceKm(point, candidate) < distanceKm(point, nearest)
        ? candidate
        : nearest;
    },
    undefined
  );
}

function nearestObservationWithBand(
  observations: WeatherStationObservation[],
  point: DigitalTwinWeatherPoint,
  band: string
): WeatherStationObservation | undefined {
  return nearestObservation(
    observations.filter((observation) => observation.values.has(band)),
    point
  );
}

async function sampleLayer(
  fetchImpl: FetchLike,
  apiUrl: string,
  layer: WeatherLayer,
  point: DigitalTwinWeatherPoint,
  signal?: AbortSignal
): Promise<number | null> {
  const url = new URL(
    resolveDigitalTwinApiUrl(
      apiUrl,
      `/api/v1/map-layers/${encodeURIComponent(layer.layerId)}/data.json`
    )
  );
  url.searchParams.set("longitude", String(point.longitude));
  url.searchParams.set("latitude", String(point.latitude));
  const response = await fetchImpl(url.href, { signal, cache: "no-cache" });
  if (!response.ok) {
    throw new Error(
      `Live weather reading failed with HTTP ${response.status}.`
    );
  }
  const body = (await response.json()) as unknown;
  const reading = isRecord(body) ? finiteNumber(body.value) : null;
  return reading;
}

function samplePoints(
  preferred: DigitalTwinWeatherPoint,
  bounds?: WeatherBounds
): DigitalTwinWeatherPoint[] {
  if (!bounds) return [preferred];
  const center = {
    longitude: (bounds.west + bounds.east) / 2,
    latitude: (bounds.south + bounds.north) / 2,
  };
  const preferredInside =
    preferred.longitude >= bounds.west &&
    preferred.longitude <= bounds.east &&
    preferred.latitude >= bounds.south &&
    preferred.latitude <= bounds.north;
  const candidates = [...(preferredInside ? [preferred] : []), center];
  return candidates.filter(
    (candidate, index) =>
      candidates.findIndex(
        (other) =>
          other.longitude === candidate.longitude &&
          other.latitude === candidate.latitude
      ) === index
  );
}

async function sampleAvailableLayer(
  fetchImpl: FetchLike,
  apiUrl: string,
  layer: WeatherLayer,
  points: DigitalTwinWeatherPoint[],
  signal?: AbortSignal
): Promise<number | null> {
  for (const point of points) {
    const reading = await sampleLayer(fetchImpl, apiUrl, layer, point, signal);
    if (reading !== null) return reading;
  }
  return null;
}

/**
 * Sample the latest ready Engine weather dataset at a map location.
 * Engine map layers are the public, versioned source of the live readings.
 */
export async function fetchDigitalTwinLiveWeather(
  value: string,
  regionId: string,
  point: DigitalTwinWeatherPoint,
  options: { fetchImpl?: FetchLike; signal?: AbortSignal } = {}
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
      `/api/v1/regions/${encodeURIComponent(
        normalizedRegionId
      )}/weather-datasets?limit=20`
    ),
    { signal: options.signal, cache: "no-cache" }
  );
  if (!datasetsResponse.ok) {
    throw new Error(
      `Weather data request failed with HTTP ${datasetsResponse.status}.`
    );
  }
  const dataset = parseLatestDataset(
    (await datasetsResponse.json()) as unknown
  );
  const datasetPath =
    `/api/v1/regions/${encodeURIComponent(normalizedRegionId)}` +
    `/weather-datasets/${encodeURIComponent(dataset.datasetId)}`;
  const [layersResponse, stationResponse] = await Promise.all([
    fetchImpl(resolveDigitalTwinApiUrl(apiUrl, `${datasetPath}/map-layers`), {
      signal: options.signal,
      cache: "no-cache",
    }),
    fetchImpl(
      resolveDigitalTwinApiUrl(apiUrl, `${datasetPath}/station-observations`),
      {
        signal: options.signal,
        cache: "no-cache",
      }
    ).catch(() => null),
  ]);
  if (!layersResponse.ok) {
    throw new Error(
      `Weather map-layer request failed with HTTP ${layersResponse.status}.`
    );
  }
  const layers = parseLayers((await layersResponse.json()) as unknown);
  if (layers.length === 0)
    throw new Error("The live weather dataset has no readable layers.");
  const points = samplePoints(point, dataset.bounds);
  const stationObservations = stationResponse?.ok
    ? parseStationObservations((await stationResponse.json()) as unknown)
    : [];
  const stationPoint = points[0] ?? point;
  const nearestStationObservation = nearestObservation(
    stationObservations,
    stationPoint
  );
  const sampledLayers = await Promise.allSettled(
    layers.map(async (layer) => ({
      layer,
      value: await sampleAvailableLayer(
        fetchImpl,
        apiUrl,
        layer,
        points,
        options.signal
      ),
    }))
  );
  if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const griddedReadings = sampledLayers.flatMap((result) => {
    if (result.status !== "fulfilled") return [];
    const stationObservation = nearestObservationWithBand(
      stationObservations,
      stationPoint,
      result.value.layer.band
    );
    const value =
      result.value.value ??
      stationObservation?.values.get(result.value.layer.band);
    return value === undefined || value === null
      ? []
      : [
          {
            band: result.value.layer.band,
            label: result.value.layer.label,
            unit: result.value.layer.unit,
            value,
          },
        ];
  });
  const readingsByBand = new Map(
    griddedReadings.map((reading) => [reading.band, reading])
  );
  for (const [band, presentation] of Object.entries(
    WEATHER_BAND_PRESENTATIONS
  )) {
    if (readingsByBand.has(band)) continue;
    const stationObservation = nearestObservationWithBand(
      stationObservations,
      stationPoint,
      band
    );
    const value = stationObservation?.values.get(band);
    if (value === undefined) continue;
    readingsByBand.set(band, { band, value, ...presentation });
  }
  const readings = [...readingsByBand.values()];
  const availableBands = new Set(readings.map((reading) => reading.band));
  const unavailableReadingLabels = [
    ...Object.entries(WEATHER_BAND_PRESENTATIONS)
      .filter(([band]) => !availableBands.has(band))
      .map(([, presentation]) => presentation.label),
    ...layers
      .filter(
        (layer) =>
          !availableBands.has(layer.band) &&
          !(layer.band in WEATHER_BAND_PRESENTATIONS)
      )
      .map((layer) => layer.label),
  ];
  const valueByBand = new Map(
    readings.map((reading) => [reading.band, reading.value])
  );
  const windSpeedMetersPerSecond = valueByBand.get("wind_velocity");
  const windDirectionDegrees =
    valueByBand.get("wind_direction") ??
    valueByBand.get("wind_towards_direction");
  return {
    condition: nearestStationObservation?.condition,
    nearestStation: nearestStationObservation
      ? {
          distanceKm: distanceKm(stationPoint, nearestStationObservation),
          elevationM: nearestStationObservation.elevationM,
          id: nearestStationObservation.stationId,
          observedAt: nearestStationObservation.observedAt,
          provider: nearestStationObservation.provider,
          qualityStatus: nearestStationObservation.qualityStatus,
        }
      : undefined,
    observedAt: dataset.observedAt,
    readings,
    unavailableReadingLabels,
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
