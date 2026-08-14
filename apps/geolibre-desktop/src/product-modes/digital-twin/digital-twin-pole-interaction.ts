export type DigitalTwinPolePosition = [
  longitude: number,
  latitude: number,
  groundElevationMeters: number,
];

export type DigitalTwinPoleSelectionMode = "replace" | "add";

export interface DigitalTwinSelectablePole {
  id: string;
  position: DigitalTwinPolePosition;
}

export interface DigitalTwinPoleDrag {
  poleIds: readonly string[];
  pointerOrigin: readonly [longitude: number, latitude: number];
  originPositions: ReadonlyMap<string, DigitalTwinPolePosition>;
}

export const DIGITAL_TWIN_POLE_MOVE_INTENT_EVENT =
  "geolibre:digital-twin-pole-move-intent";

export interface DigitalTwinPoleMoveIntentDetail {
  phase: "staged";
  changes: readonly {
    poleId: string;
    from: DigitalTwinPolePosition;
    to: DigitalTwinPolePosition;
    connectedAssetIds: readonly string[];
  }[];
}

const METERS_PER_LATITUDE_DEGREE = 110_540;

function metersPerLongitudeDegree(latitude: number): number {
  return Math.max(
    Math.abs(111_320 * Math.cos((latitude * Math.PI) / 180)),
    1
  );
}

export function selectDigitalTwinPoleIds(
  selectedPoleIds: readonly string[],
  poleId: string,
  mode: DigitalTwinPoleSelectionMode
): string[] {
  if (mode === "replace") return [poleId];
  return selectedPoleIds.includes(poleId)
    ? [...selectedPoleIds]
    : [...selectedPoleIds, poleId];
}

export function beginDigitalTwinPoleDrag({
  poles,
  selectedPoleIds,
  grabbedPoleId,
  selectionMode,
  pointerPosition,
}: {
  poles: readonly DigitalTwinSelectablePole[];
  selectedPoleIds: readonly string[];
  grabbedPoleId: string;
  selectionMode: DigitalTwinPoleSelectionMode;
  pointerPosition: readonly [longitude: number, latitude: number];
}): { selectedPoleIds: string[]; drag: DigitalTwinPoleDrag } {
  const nextSelection = selectedPoleIds.includes(grabbedPoleId)
    ? [...selectedPoleIds]
    : selectDigitalTwinPoleIds(
        selectedPoleIds,
        grabbedPoleId,
        selectionMode
      );
  const selected = new Set(nextSelection);
  const originPositions = new Map<string, DigitalTwinPolePosition>();
  for (const pole of poles) {
    if (selected.has(pole.id)) {
      originPositions.set(pole.id, [...pole.position]);
    }
  }

  return {
    selectedPoleIds: nextSelection,
    drag: {
      poleIds: nextSelection.filter((poleId) => originPositions.has(poleId)),
      pointerOrigin: pointerPosition,
      originPositions,
    },
  };
}

export function translateDigitalTwinPoleDrag(
  drag: DigitalTwinPoleDrag,
  pointerPosition: readonly [longitude: number, latitude: number],
  groundElevationAt: (
    longitude: number,
    latitude: number,
    fallbackElevation: number
  ) => number | null
): Map<string, DigitalTwinPolePosition> {
  const longitudeScale = metersPerLongitudeDegree(drag.pointerOrigin[1]);
  const eastMeters =
    (pointerPosition[0] - drag.pointerOrigin[0]) * longitudeScale;
  const northMeters =
    (pointerPosition[1] - drag.pointerOrigin[1]) *
    METERS_PER_LATITUDE_DEGREE;
  const positions = new Map<string, DigitalTwinPolePosition>();

  for (const poleId of drag.poleIds) {
    const origin = drag.originPositions.get(poleId);
    if (!origin) continue;
    const longitude = origin[0] + eastMeters / longitudeScale;
    const latitude =
      origin[1] + northMeters / METERS_PER_LATITUDE_DEGREE;
    const elevation = groundElevationAt(longitude, latitude, origin[2]);
    positions.set(poleId, [
      longitude,
      latitude,
      elevation === null || !Number.isFinite(elevation)
        ? origin[2]
        : elevation,
    ]);
  }

  return positions;
}
