import type { WeatherSettingsValue } from "@geolibre/ui";
import type { DigitalTwinRegionBounds } from "../../../lib/digital-twin-runs";

export interface IgnitionPoint {
  id: string;
  longitude: number;
  latitude: number;
}

interface RunRequestBase {
  regionId: string;
  location: string;
  ignitionPoints: IgnitionPoint[];
  /** Appearance only. Numerical weather intent is explicit below. */
  weather: WeatherSettingsValue;
}

export type ScenarioRunRequest = RunRequestBase & (
  | { mode: "synthetic"; scenario: string; scenarioId?: string; durationHours: number;
      baseWeatherVersion: string; bounds: DigitalTwinRegionBounds;
      windSpeedMph: number; windDirectionDegrees: number }
  | { mode: "present_forecast"; durationHours: number; deltaTHours: number }
  | { mode: "bounded"; startAt: string; endAt: string; deltaTHours: number }
);

export function runIdFromLocation(location: string): string | null {
  const pathname = location.split(/[?#]/, 1)[0] ?? "";
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0]?.toLowerCase() !== "regions") return null;
  if (parts[2]?.toLowerCase() !== "runs" || parts.length !== 4) return null;
  try {
    return decodeURIComponent(parts[3] ?? "") || null;
  } catch {
    return null;
  }
}

export function ignitionCenter(
  points: IgnitionPoint[],
): [longitude: number, latitude: number] | null {
  if (points.length === 0) return null;
  return points.reduce<[number, number]>(
    (center, point) => [
      center[0] + point.longitude / points.length,
      center[1] + point.latitude / points.length,
    ],
    [0, 0],
  );
}

export function ignitionPointFeatures(
  points: IgnitionPoint[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      properties: { id: point.id },
      geometry: {
        type: "Point",
        coordinates: [point.longitude, point.latitude],
      },
    })),
  };
}

export function ignitionBounds(
  points: IgnitionPoint[],
): [[west: number, south: number], [east: number, north: number]] | null {
  const firstPoint = points[0];
  if (!firstPoint) return null;
  return points.reduce<[[number, number], [number, number]]>(
    (bounds, point) => [
      [Math.min(bounds[0][0], point.longitude), Math.min(bounds[0][1], point.latitude)],
      [Math.max(bounds[1][0], point.longitude), Math.max(bounds[1][1], point.latitude)],
    ],
    [
      [firstPoint.longitude, firstPoint.latitude],
      [firstPoint.longitude, firstPoint.latitude],
    ],
  );
}

export function formatSimulationTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainingMinutes).padStart(2, "0")}`;
}

export function formatWindDirection(degrees: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const normalized = ((degrees % 360) + 360) % 360;
  return directions[Math.round(normalized / 45) % directions.length] ?? "N";
}
