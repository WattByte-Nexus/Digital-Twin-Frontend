import type { FeatureCollection, LineString } from "geojson";
import {
  normalizeDigitalTwinApiUrl,
  resolveDigitalTwinApiUrl,
} from "./digital-twin-earth-engine";

export interface DigitalTwinPowerLine {
  powerLineId: string;
  geometry: LineString;
}

interface FetchDigitalTwinPowerLinesOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coordinate(value: unknown, label: string): [number, number] {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    typeof value[0] !== "number" ||
    !Number.isFinite(value[0]) ||
    Math.abs(value[0]) > 180 ||
    typeof value[1] !== "number" ||
    !Number.isFinite(value[1]) ||
    Math.abs(value[1]) > 90
  ) {
    throw new Error(`${label} must be a WGS84 coordinate.`);
  }
  return [value[0], value[1]];
}

function parsePowerLine(value: unknown, index: number): DigitalTwinPowerLine {
  if (!isRecord(value)) throw new Error(`Power line ${index + 1} must be an object.`);
  if (typeof value.power_line_id !== "string" || !value.power_line_id.trim()) {
    throw new Error(`Power line ${index + 1} is missing its ID.`);
  }
  const id = value.power_line_id.trim();
  if (!isRecord(value.geometry) || value.geometry.type !== "LineString") {
    throw new Error(`Power line ${id} must include a LineString geometry.`);
  }
  if (!Array.isArray(value.geometry.coordinates) || value.geometry.coordinates.length !== 2) {
    throw new Error(`Power line ${id} geometry must include exactly two coordinates.`);
  }
  return {
    powerLineId: id,
    geometry: {
      type: "LineString",
      coordinates: value.geometry.coordinates.map((position, coordinateIndex) =>
        coordinate(position, `Power line ${id} coordinate ${coordinateIndex + 1}`),
      ),
    },
  };
}

export async function fetchDigitalTwinPowerLines(
  apiUrl: string,
  regionId: string,
  { fetchImpl = fetch, signal }: FetchDigitalTwinPowerLinesOptions = {},
): Promise<DigitalTwinPowerLine[]> {
  const normalizedRegionId = regionId.trim();
  if (!normalizedRegionId) throw new Error("A region ID is required.");
  const url = resolveDigitalTwinApiUrl(
    normalizeDigitalTwinApiUrl(apiUrl),
    `/api/v1/regions/${encodeURIComponent(normalizedRegionId)}/power-lines`,
  );
  const response = await fetchImpl(url, { signal, cache: "no-cache" });
  if (!response.ok) {
    throw new Error(`Power-line inventory failed with HTTP ${response.status}.`);
  }
  const value = (await response.json()) as unknown;
  if (!Array.isArray(value)) throw new Error("Power-line inventory must be an array.");
  const lines = value.map(parsePowerLine);
  const ids = new Set<string>();
  for (const line of lines) {
    if (ids.has(line.powerLineId)) {
      throw new Error(`Power line ID ${line.powerLineId} is duplicated.`);
    }
    ids.add(line.powerLineId);
  }
  return lines;
}

export function powerLinesFeatureCollection(
  lines: DigitalTwinPowerLine[],
): FeatureCollection<LineString, { power_line_id: string }> {
  return {
    type: "FeatureCollection",
    features: lines.map((line) => ({
      type: "Feature",
      id: line.powerLineId,
      properties: { power_line_id: line.powerLineId },
      geometry: line.geometry,
    })),
  };
}
