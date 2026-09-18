import { reconstructSurveyNetwork, type SurveyNetwork } from "./digital-twin-survey-network";
import { PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import {
  ScenegraphLayer,
  type ScenegraphLayerProps,
} from "@deck.gl/mesh-layers";
import { digitalTwinSurfaceCoordinateKey } from "@geolibre/map/digital-twin-surface-state";
import type {
  DigitalTwinPowerLineAsset,
  DigitalTwinPowerPoleAsset,
} from "../../lib/digital-twin-assets";

export const POWER_POLE_MODEL_HEIGHT_METERS = 9.375;
export const POWER_POLE_HEIGHT_AGL_METERS = 8.5;
const POWER_POLE_MODEL_SCALE =
  POWER_POLE_HEIGHT_AGL_METERS / POWER_POLE_MODEL_HEIGHT_METERS;
const POWER_POLE_MODEL_PATH = "/assets/digital-twin/13.8kv_power_pole.glb";

export interface DigitalTwinConductorPath {
  id: string;
  assetId: string;
  offsetMeters: number;
  verticalOffsetMeters: number;
  startPoleId: string;
  endPoleId: string;
  path: [number, number, number][];
  inferredConnection?: boolean;
  evidenceAssetIds?: string[];
  lengthM?: number;
}

export interface DigitalTwinPowerPole {
  id: string;
  assetIds: string[];
  position: [number, number, number];
  modelYaw: number;
  scale: [number, number, number];
  measured?: boolean;
}

export interface DigitalTwinPowerLineNetwork {
  conductors: DigitalTwinConductorPath[];
  poles: DigitalTwinPowerPole[];
  survey?: SurveyNetwork;
}

interface PoleRecord {
  longitude: number;
  latitude: number;
  elevations: number[];
  bearings: number[];
  assetIds: string[];
}

interface PowerLineSpan {
  assetId: string;
  startPoleId: string;
  endPoleId: string;
  startKey: string;
  endKey: string;
  conductorOffsetsM: DigitalTwinPowerLineAsset["conductorOffsetsM"];
}

export interface DigitalTwinPowerLineSurfaceOptions {
  measuredPoles?: readonly DigitalTwinPowerPoleAsset[];
  surfaceElevations?: ReadonlyMap<string, number>;
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

function averageConductorElevation(record: PoleRecord): number {
  return (
    record.elevations.reduce((sum, elevation) => sum + elevation, 0) /
    record.elevations.length
  );
}

function conductorAttachment(
  record: PoleRecord,
  bearing: number,
  offsetMeters: number,
  verticalOffsetMeters: number
): [number, number, number] {
  const metersPerLongitude = Math.max(
    Math.abs(111_320 * Math.cos((record.latitude * Math.PI) / 180)),
    1
  );
  const radians = (bearing * Math.PI) / 180;
  return [
    record.longitude + (-Math.cos(radians) * offsetMeters) / metersPerLongitude,
    record.latitude + (Math.sin(radians) * offsetMeters) / 110_540,
    averageConductorElevation(record) + verticalOffsetMeters,
  ];
}

/** Build visible conductor and support geometry from canonical line assets. */
export function buildDigitalTwinPowerLineNetwork(
  lines: readonly DigitalTwinPowerLineAsset[],
  {
    surfaceElevations,
    measuredPoles = [],
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

  const spans = lines
    .filter((line) => !line.measuredPath)
    .map((line) => {
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
        assetId: line.assetId,
        startPoleId,
        endPoleId,
        startKey,
        endKey,
        conductorOffsetsM: line.conductorOffsetsM,
      } satisfies PowerLineSpan;
    });

  const poleBearingByKey = new Map<string, number>();
  const poles: DigitalTwinPowerPole[] = [...poleRecords.entries()].map(
    ([key, record]) => {
      const bearing = sharedPoleBearing(record.bearings);
      poleBearingByKey.set(key, bearing);
      return {
        id: `pole-${key}`,
        assetIds: record.assetIds,
        position: [
          record.longitude,
          record.latitude,
          averageConductorElevation(record) - POWER_POLE_HEIGHT_AGL_METERS,
        ],
        modelYaw: (90 - bearing + 360) % 360,
        scale: [
          POWER_POLE_MODEL_SCALE,
          POWER_POLE_MODEL_SCALE,
          POWER_POLE_MODEL_SCALE,
        ],
      } satisfies DigitalTwinPowerPole;
    }
  );

  const conductors: DigitalTwinConductorPath[] = spans.flatMap((span) => {
    const startRecord = poleRecords.get(span.startKey);
    const endRecord = poleRecords.get(span.endKey);
    const startBearing = poleBearingByKey.get(span.startKey);
    const endBearing = poleBearingByKey.get(span.endKey);
    if (
      !startRecord ||
      !endRecord ||
      startBearing === undefined ||
      endBearing === undefined
    ) {
      throw new Error(`Power-line span ${span.assetId} is missing a support.`);
    }
    return span.conductorOffsetsM.map(
      ({ lateral, vertical }, conductorIndex) =>
        ({
          id: `${span.assetId}-conductor-${conductorIndex + 1}`,
          assetId: span.assetId,
          offsetMeters: lateral,
          verticalOffsetMeters: vertical,
          startPoleId: span.startPoleId,
          endPoleId: span.endPoleId,
          path: [
            conductorAttachment(startRecord, startBearing, lateral, vertical),
            conductorAttachment(endRecord, endBearing, lateral, vertical),
          ],
        } satisfies DigitalTwinConductorPath)
    );
  });

  for (const pole of measuredPoles) {
    const height = pole.top.elevationM - pole.base.elevationM;
    const scale = height / POWER_POLE_MODEL_HEIGHT_METERS;
    poles.push({
      id: pole.assetId,
      measured: true,
      assetIds: [],
      position: [pole.base.lon, pole.base.lat, pole.base.elevationM],
      modelYaw: 0,
      scale: [scale, scale, scale],
    });
  }
  const survey = reconstructSurveyNetwork(measuredPoles, lines);
  const measuredPoleBearings = new Map<string, number[]>();
  for (const connection of survey.connections) {
    const { start, end } = connection;
    const bearing = bearingBetween(start.top, end.top);
    for (const support of [start, end]) {
      const pole = poles.find(candidate => candidate.id === support.assetId)!;
      pole.assetIds.push(connection.id);
      const bearings = measuredPoleBearings.get(pole.id) ?? [];
      bearings.push(bearing);
      measuredPoleBearings.set(pole.id, bearings);
      pole.modelYaw = (90 - sharedPoleBearing(bearings) + 360) % 360;
    }
    // Straight attachment guides do not invent a measured catenary/sag.
    conductors.push({
      id: connection.id,
      assetId: connection.id,
      startPoleId: start.assetId,
      endPoleId: end.assetId,
      offsetMeters: 0,
      verticalOffsetMeters: 0,
      inferredConnection: true,
      evidenceAssetIds: connection.evidenceAssetIds,
      lengthM: connection.lengthM,
      path: [
        [start.top.lon, start.top.lat, start.top.elevationM],
        [end.top.lon, end.top.lat, end.top.elevationM],
      ],
    });
  }
  // Keep every original measured fragment, including unresolved ones, intact.
  for (const line of lines) {
    if (!line.measuredPath) continue;
    conductors.push({
      id: line.assetId,
      assetId: line.assetId,
      offsetMeters: 0,
      verticalOffsetMeters: 0,
      startPoleId: "",
      endPoleId: "",
      path: line.measuredPath.map(point => [point.lon, point.lat, point.elevationM]),
    });
  }
  return { conductors, poles, survey };
}

export function resolveDigitalTwinPowerPoleModelUrl(
  baseUrl = document.baseURI
): string {
  return new URL(POWER_POLE_MODEL_PATH, baseUrl).href;
}

/** Render canonical conductor geometry and measured or catalog pole models. */
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
  ScatterplotLayer<DigitalTwinPowerPole>
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
    "onHover" | "onClick"
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
      getColor: [96, 210, 255, 255],
      getWidth: 3,
      widthUnits: "pixels",
      widthMinPixels: 1,
      billboard: true,
      capRounded: false,
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
