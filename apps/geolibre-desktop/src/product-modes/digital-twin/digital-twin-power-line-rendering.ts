import { PathLayer } from "@deck.gl/layers";
import { ScenegraphLayer } from "@deck.gl/mesh-layers";
import { digitalTwinSurfaceCoordinateKey } from "@geolibre/map/digital-twin-surface-state";
import type { DigitalTwinPowerLineAsset } from "../../lib/digital-twin-assets";

export const POWER_POLE_MODEL_HEIGHT_METERS = 9.375;
export const POWER_POLE_HEIGHT_AGL_METERS = 8.5;
const POWER_POLE_MODEL_SCALE =
  POWER_POLE_HEIGHT_AGL_METERS / POWER_POLE_MODEL_HEIGHT_METERS;
const POWER_POLE_MODEL_PATH = "/assets/digital-twin/13.8kv_power_pole.glb";

export interface DigitalTwinConductorPath {
  id: string;
  path: [[number, number, number], [number, number, number]];
}

export interface DigitalTwinPowerPole {
  id: string;
  assetIds: string[];
  position: [number, number, number];
  modelYaw: number;
  scale: [number, number, number];
}

export interface DigitalTwinPowerLineNetwork {
  conductors: DigitalTwinConductorPath[];
  poles: DigitalTwinPowerPole[];
}

interface PoleRecord {
  longitude: number;
  latitude: number;
  elevations: number[];
  bearings: number[];
  assetIds: string[];
}

export interface DigitalTwinPowerLineSurfaceOptions {
  surfaceElevations?: ReadonlyMap<string, number>;
}

function conductorElevation(
  coordinate: DigitalTwinPowerLineAsset["coordinates"][number],
  surfaceElevations: ReadonlyMap<string, number> | undefined
): number {
  const surfaceElevation = surfaceElevations?.get(
    digitalTwinSurfaceCoordinateKey(coordinate.lon, coordinate.lat)
  );
  return surfaceElevation === undefined
    ? coordinate.elevationM
    : surfaceElevation + POWER_POLE_HEIGHT_AGL_METERS;
}

function bearingBetween(
  start: DigitalTwinPowerLineAsset["coordinates"][number],
  end: DigitalTwinPowerLineAsset["coordinates"][number]
): number {
  const averageLatitude = (start.lat + end.lat) / 2;
  const metersPerLongitude = Math.max(
    Math.abs(111_320 * Math.cos((averageLatitude * Math.PI) / 180)),
    1
  );
  const dx = (end.lon - start.lon) * metersPerLongitude;
  const dy = (end.lat - start.lat) * 110_540;
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

function sharedPoleBearing(bearings: number[]): number {
  const axes = bearings.map((bearing) => ((bearing % 180) + 180) % 180);
  const vector = axes.reduce(
    (total, bearing) => {
      const doubledRadians = (bearing * 2 * Math.PI) / 180;
      return {
        x: total.x + Math.cos(doubledRadians),
        y: total.y + Math.sin(doubledRadians),
      };
    },
    { x: 0, y: 0 }
  );
  if (Math.hypot(vector.x, vector.y) < 1e-8) return axes[0] ?? 0;
  return ((Math.atan2(vector.y, vector.x) * 90) / Math.PI + 180) % 180;
}

/** Build visible conductor and support geometry from canonical line assets. */
export function buildDigitalTwinPowerLineNetwork(
  lines: readonly DigitalTwinPowerLineAsset[],
  { surfaceElevations }: DigitalTwinPowerLineSurfaceOptions = {}
): DigitalTwinPowerLineNetwork {
  const poleRecords = new Map<string, PoleRecord>();
  const recordFor = (
    coordinate: DigitalTwinPowerLineAsset["coordinates"][number],
    elevation: number,
    assetId: string
  ): PoleRecord => {
    const key = digitalTwinSurfaceCoordinateKey(coordinate.lon, coordinate.lat);
    let record = poleRecords.get(key);
    if (!record) {
      record = {
        longitude: coordinate.lon,
        latitude: coordinate.lat,
        elevations: [],
        bearings: [],
        assetIds: [],
      };
      poleRecords.set(key, record);
    }
    record.elevations.push(elevation);
    if (!record.assetIds.includes(assetId)) record.assetIds.push(assetId);
    return record;
  };

  const conductors = lines.map((line) => {
    const [start, end] = line.coordinates;
    const bearing = bearingBetween(start, end);
    const startElevation = conductorElevation(start, surfaceElevations);
    const endElevation = conductorElevation(end, surfaceElevations);
    recordFor(start, startElevation, line.assetId).bearings.push(bearing);
    recordFor(end, endElevation, line.assetId).bearings.push(bearing);
    return {
      id: line.assetId,
      path: [
        [start.lon, start.lat, startElevation],
        [end.lon, end.lat, endElevation],
      ],
    } satisfies DigitalTwinConductorPath;
  });

  const poles = [...poleRecords.entries()].map(([key, record]) => {
    const bearing = sharedPoleBearing(record.bearings);
    const conductorElevation =
      record.elevations.reduce((sum, elevation) => sum + elevation, 0) /
      record.elevations.length;
    return {
      id: `pole-${key}`,
      assetIds: record.assetIds,
      position: [
        record.longitude,
        record.latitude,
        conductorElevation - POWER_POLE_HEIGHT_AGL_METERS,
      ],
      modelYaw: (90 - bearing + 360) % 360,
      scale: [
        POWER_POLE_MODEL_SCALE,
        POWER_POLE_MODEL_SCALE,
        POWER_POLE_MODEL_SCALE,
      ],
    } satisfies DigitalTwinPowerPole;
  });

  return { conductors, poles };
}

export function resolveDigitalTwinPowerPoleModelUrl(
  baseUrl = document.baseURI
): string {
  return new URL(POWER_POLE_MODEL_PATH, baseUrl).href;
}

/** Render canonical conductor geometry and a pole model at every unique support. */
export function createDigitalTwinPowerLineLayers(
  lines: readonly DigitalTwinPowerLineAsset[],
  {
    modelUrl,
    surfaceElevations,
  }: { modelUrl: string } & DigitalTwinPowerLineSurfaceOptions
): [PathLayer<DigitalTwinConductorPath>, ScenegraphLayer<DigitalTwinPowerPole>] {
  const network = buildDigitalTwinPowerLineNetwork(lines, {
    surfaceElevations,
  });
  return [
    new PathLayer<DigitalTwinConductorPath>({
      id: "digital-twin-power-line-conductors",
      data: network.conductors,
      getPath: (conductor) => conductor.path,
      getColor: [245, 158, 11, 255],
      getWidth: 3,
      widthUnits: "pixels",
      widthMinPixels: 1,
      capRounded: true,
      jointRounded: true,
      pickable: false,
    }),
    new ScenegraphLayer<DigitalTwinPowerPole>({
      id: "digital-twin-power-line-poles",
      data: network.poles,
      scenegraph: modelUrl,
      _lighting: "pbr",
      sizeScale: 1,
      sizeMinPixels: 0,
      sizeMaxPixels: Number.MAX_SAFE_INTEGER,
      getPosition: (pole) => pole.position,
      getOrientation: (pole) => [0, pole.modelYaw, 90],
      getScale: (pole) => pole.scale,
      pickable: false,
    }),
  ];
}
