import booleanIntersects from "@turf/boolean-intersects";
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import { requestDigitalTwinJson } from "../../../lib/digital-twin-api";
import type { DigitalTwinWireRun } from "../../../lib/digital-twin-runs";

export type RunDetailTab = "overview" | "behavior" | "exposure" | "inputs" | "activity";
export type DigitalTwinRunRecord = DigitalTwinWireRun;
export type DigitalTwinRunTrigger = DigitalTwinRunRecord["trigger"];

export interface RunBehaviorSample {
  tick: number;
  activeCellCount: number;
  weatherVersion: string | null;
  result: FeatureCollection;
}

export type RunTabData =
  | { kind: "overview"; run: DigitalTwinRunRecord }
  | { kind: "behavior"; run: DigitalTwinRunRecord; samples: RunBehaviorSample[] }
  | {
      kind: "exposure";
      run: DigitalTwinRunRecord;
      result: FeatureCollection;
      exposedAssets: Array<Feature<Geometry, GeoJsonProperties>>;
    }
  | { kind: "inputs"; run: DigitalTwinRunRecord }
  | { kind: "activity"; run: DigitalTwinRunRecord };

interface LoadRunTabOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  /** Contiguous positive ticks announced by the authoritative progress stream. */
  completedTicks?: number;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isLandCoverBreakdownEntry(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return (
    Number.isInteger(entry.class_id) &&
    isNonNegativeFiniteNumber(entry.class_id) &&
    typeof entry.label === "string" &&
    Boolean(entry.label.trim()) &&
    isNonNegativeFiniteNumber(entry.area_hectares) &&
    isNonNegativeFiniteNumber(entry.percentage) &&
    entry.percentage <= 100
  );
}

function assertRunMetrics(
  value: unknown,
): asserts value is DigitalTwinRunRecord["metrics"] {
  if (value === null) return;
  const metrics = value as Record<string, unknown>;
  const landCoverBreakdown = metrics.land_cover_breakdown;
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    isNonNegativeFiniteNumber(metrics.final_burning_cells) &&
    isNonNegativeFiniteNumber(metrics.final_burned_cells) &&
    isNonNegativeFiniteNumber(metrics.burned_area_hectares) &&
    isNonNegativeFiniteNumber(metrics.peak_spread_rate_hectares_per_hour) &&
    Array.isArray(landCoverBreakdown) &&
    landCoverBreakdown.length > 0 &&
    landCoverBreakdown.every(isLandCoverBreakdownEntry)
  ) {
    return;
  }
  throw new Error("Digital Twin API returned invalid run metrics.");
}

async function getJson<T>(
  apiUrl: string,
  path: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<T> {
  return requestDigitalTwinJson<T>(apiUrl, path, { fetchImpl, signal, headers: { Accept: "application/json, application/geo+json" } });
}

function resultProperties(result: FeatureCollection): NonNullable<GeoJsonProperties> {
  return result.features[0]?.properties ?? {};
}

function exposedAssets(
  result: FeatureCollection,
  assets: FeatureCollection,
): Array<Feature<Geometry, GeoJsonProperties>> {
  const footprints = result.features.filter(
    (feature): feature is Feature<Geometry, GeoJsonProperties> => feature.geometry !== null,
  );
  if (footprints.length === 0) return [];
  return assets.features.filter(
    (asset): asset is Feature<Geometry, GeoJsonProperties> =>
      asset.geometry !== null &&
      footprints.some((footprint) => booleanIntersects(footprint, asset)),
  );
}

export async function loadRunTab(
  apiUrl: string,
  runId: string,
  tab: RunDetailTab,
  options: LoadRunTabOptions = {},
): Promise<RunTabData> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) throw new Error("This environment cannot make Digital Twin API requests.");
  const encodedRunId = encodeURIComponent(runId);
  const run = await getJson<DigitalTwinRunRecord>(
    apiUrl,
    `/api/v1/simulation-runs/${encodedRunId}`,
    fetchImpl,
    options.signal,
  );
  assertRunMetrics(run.metrics);

  if (tab === "overview" || tab === "inputs" || tab === "activity") {
    return { kind: tab, run };
  }

  if (tab === "behavior") {
    const ticks = [...new Set([...run.tick_refs
      .map(({ tick }) => tick)
      .filter((tick) => Number.isInteger(tick) && tick > 0),
      ...Array.from({ length: options.completedTicks ?? 0 }, (_, index) => index + 1),
    ])].sort((a, b) => a - b);
    const artifacts = await Promise.all(
      ticks.map((tick) =>
        getJson<FeatureCollection>(
          apiUrl,
          `/api/v1/simulation-runs/${encodedRunId}/ticks/${tick}/result.geojson`,
          fetchImpl,
          options.signal,
        ),
      ),
    );
    return {
      kind: "behavior",
      run,
      samples: artifacts.map((artifact, index) => {
        const properties = resultProperties(artifact);
        return {
          tick: Number(properties.tick ?? ticks[index]),
          activeCellCount: Number(properties.active_cell_count ?? 0),
          weatherVersion:
            typeof properties.weather_version === "string" ? properties.weather_version : null,
          result: artifact,
        };
      }),
    };
  }

  const latestTick = Math.max(options.completedTicks ?? 0, ...run.tick_refs
    .map(({ tick }) => tick)
    .filter((tick) => Number.isInteger(tick) && tick > 0)
  );
  const resultPath = run.final_result_ref
    ? `/api/v1/simulation-runs/${encodedRunId}/result.geojson`
    : latestTick <= 0
      ? null
      : `/api/v1/simulation-runs/${encodedRunId}/ticks/${latestTick}/result.geojson`;
  if (!resultPath) {
    return {
      kind: "exposure",
      run,
      result: { type: "FeatureCollection", features: [] },
      exposedAssets: [],
    };
  }
  const [result, assets] = await Promise.all([
    getJson<FeatureCollection>(
      apiUrl,
      resultPath,
      fetchImpl,
      options.signal,
    ),
    getJson<FeatureCollection>(
      apiUrl,
      `/api/v1/regions/${encodeURIComponent(run.region_id)}/assets.geojson`,
      fetchImpl,
      options.signal,
    ),
  ]);
  return { kind: "exposure", run, result, exposedAssets: exposedAssets(result, assets) };
}
