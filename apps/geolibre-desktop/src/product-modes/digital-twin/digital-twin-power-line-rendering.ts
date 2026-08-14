import { PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import {
  ScenegraphLayer,
  type ScenegraphLayerProps,
} from "@deck.gl/mesh-layers";
import { digitalTwinSurfaceCoordinateKey } from "@geolibre/map/digital-twin-surface-state";
import type { DigitalTwinPowerLineAsset } from "../../lib/digital-twin-assets";

export const POWER_POLE_MODEL_HEIGHT_METERS = 9.375;
export const POWER_POLE_HEIGHT_AGL_METERS = 8.5;
const POWER_POLE_MODEL_SCALE =
  POWER_POLE_HEIGHT_AGL_METERS / POWER_POLE_MODEL_HEIGHT_METERS;
const POWER_POLE_MODEL_PATH = "/assets/digital-twin/13.8kv_power_pole.glb";

export interface DigitalTwinConductorPath {
  id: string;
  startPoleId: string;
  endPoleId: string;
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
  polePositionOverrides?: ReadonlyMap<
    string,
    DigitalTwinPowerPole["position"]
  >;
}

export interface DigitalTwinPoleGesture {
  additive: boolean;
  screen: [x: number, y: number];
}

export interface DigitalTwinPowerPoleInteraction {
  hoveredPoleId: string | null;
  selectedPoleIds: ReadonlySet<string>;
  onHover?: (pole: DigitalTwinPowerPole | null) => void;
  onSelect?: (
    pole: DigitalTwinPowerPole,
    gesture: DigitalTwinPoleGesture
  ) => void;
  onDragStart?: (
    pole: DigitalTwinPowerPole,
    gesture: DigitalTwinPoleGesture
  ) => void;
  onDrag?: (
    pole: DigitalTwinPowerPole,
    gesture: DigitalTwinPoleGesture
  ) => void;
  onDragEnd?: (
    pole: DigitalTwinPowerPole,
    gesture: DigitalTwinPoleGesture
  ) => void;
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
  {
    surfaceElevations,
    polePositionOverrides,
  }: DigitalTwinPowerLineSurfaceOptions = {}
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
    const startKey = digitalTwinSurfaceCoordinateKey(start.lon, start.lat);
    const endKey = digitalTwinSurfaceCoordinateKey(end.lon, end.lat);
    recordFor(start, startElevation, line.assetId).bearings.push(bearing);
    recordFor(end, endElevation, line.assetId).bearings.push(bearing);
    const startPoleId = `pole-${startKey}`;
    const endPoleId = `pole-${endKey}`;
    return {
      id: line.assetId,
      startPoleId,
      endPoleId,
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

  return applyDigitalTwinPolePositionOverrides(
    { conductors, poles },
    polePositionOverrides
  );
}

/** Apply a scenario overlay without mutating canonical line or pole geometry. */
export function applyDigitalTwinPolePositionOverrides(
  network: DigitalTwinPowerLineNetwork,
  polePositionOverrides?: ReadonlyMap<
    string,
    DigitalTwinPowerPole["position"]
  >
): DigitalTwinPowerLineNetwork {
  if (!polePositionOverrides || polePositionOverrides.size === 0) return network;

  const poles = network.poles.map((pole) => ({
    ...pole,
    position: polePositionOverrides.get(pole.id) ?? pole.position,
  }));
  const conductors = network.conductors.map((conductor) => {
    const start = polePositionOverrides.get(conductor.startPoleId);
    const end = polePositionOverrides.get(conductor.endPoleId);
    if (!start && !end) return conductor;
    return {
      ...conductor,
      path: [
        start
          ? [start[0], start[1], start[2] + POWER_POLE_HEIGHT_AGL_METERS]
          : conductor.path[0],
        end
          ? [end[0], end[1], end[2] + POWER_POLE_HEIGHT_AGL_METERS]
          : conductor.path[1],
      ],
    } satisfies DigitalTwinConductorPath;
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
  network: DigitalTwinPowerLineNetwork,
  {
    modelUrl,
    interaction,
  }: {
    modelUrl: string;
    interaction?: DigitalTwinPowerPoleInteraction;
  }
): [
  PathLayer<DigitalTwinConductorPath>,
  ScenegraphLayer<DigitalTwinPowerPole>,
  ScatterplotLayer<DigitalTwinPowerPole>,
] {
  const gestureFor = (
    info: { x?: number; y?: number },
    event: {
      offsetCenter?: { x: number; y: number };
      srcEvent?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean };
    }
  ): DigitalTwinPoleGesture => ({
    additive: Boolean(
      event.srcEvent?.ctrlKey ||
        event.srcEvent?.metaKey ||
        event.srcEvent?.shiftKey
    ),
    screen: [
      event.offsetCenter?.x ?? info.x ?? 0,
      event.offsetCenter?.y ?? info.y ?? 0,
    ],
  });
  const poleEventHandlers: Pick<
    ScenegraphLayerProps<DigitalTwinPowerPole>,
    "onHover" | "onClick" | "onDragStart" | "onDrag" | "onDragEnd"
  > = {
    onHover: (info) => {
      interaction?.onHover?.(info.picked ? info.object : null);
      return Boolean(info.picked);
    },
    onClick: (info, event) => {
      if (!info.object) return false;
      interaction?.onSelect?.(info.object, gestureFor(info, event));
      return true;
    },
    onDragStart: (info, event) => {
      if (!info.object) return false;
      interaction?.onDragStart?.(info.object, gestureFor(info, event));
      return true;
    },
    onDrag: (info, event) => {
      if (!info.object) return false;
      interaction?.onDrag?.(info.object, gestureFor(info, event));
      return true;
    },
    onDragEnd: (info, event) => {
      if (!info.object) return false;
      interaction?.onDragEnd?.(info.object, gestureFor(info, event));
      return true;
    },
  };
  const poleInteractionColor = (pole: DigitalTwinPowerPole) =>
    interaction?.selectedPoleIds.has(pole.id)
      ? ([245, 158, 11, 255] as const)
      : interaction?.hoveredPoleId === pole.id
        ? ([96, 210, 255, 255] as const)
        : ([255, 255, 255, 255] as const);
  const interactionUpdateTrigger = [
    interaction?.hoveredPoleId,
    ...(interaction?.selectedPoleIds ?? []),
  ];
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
      getColor: poleInteractionColor,
      updateTriggers: {
        getColor: interactionUpdateTrigger,
      },
      pickable: true,
      autoHighlight: true,
      highlightColor: [96, 210, 255, 96],
      ...poleEventHandlers,
    }),
    new ScatterplotLayer<DigitalTwinPowerPole>({
      id: "digital-twin-power-line-pole-pick-halos",
      data: network.poles,
      getPosition: (pole) => pole.position,
      getRadius: 10,
      radiusUnits: "pixels",
      radiusMinPixels: 10,
      radiusMaxPixels: 14,
      filled: true,
      stroked: true,
      getFillColor: (pole) => {
        const [red, green, blue] = poleInteractionColor(pole);
        return interaction?.selectedPoleIds.has(pole.id) ||
          interaction?.hoveredPoleId === pole.id
          ? [red, green, blue, 28]
          : [0, 0, 0, 0];
      },
      getLineColor: (pole) => {
        const color = poleInteractionColor(pole);
        return interaction?.selectedPoleIds.has(pole.id) ||
          interaction?.hoveredPoleId === pole.id
          ? color
          : [0, 0, 0, 0];
      },
      getLineWidth: 2,
      lineWidthUnits: "pixels",
      updateTriggers: {
        getFillColor: interactionUpdateTrigger,
        getLineColor: interactionUpdateTrigger,
      },
      pickable: true,
      ...poleEventHandlers,
    }),
  ];
}
