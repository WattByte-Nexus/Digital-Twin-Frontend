import type {
  PolePropertiesAsset,
  PolePropertiesPhysics,
} from "@geolibre/ui";
import type { DigitalTwinPowerLineAsset } from "../../lib/digital-twin-assets";
import type {
  DigitalTwinPowerLineNetwork,
  DigitalTwinPowerPole,
} from "./digital-twin-power-line-rendering";

function popupPhysics(
  line: DigitalTwinPowerLineAsset
): PolePropertiesPhysics | null {
  const physics = line.latestPhysics;
  if (!physics) return null;
  return {
    cachedFromTick: physics.cachedFromTick,
    failureKind:
      physics.status === "failed" ? physics.failureKind : undefined,
    maxDisplacementM:
      physics.status === "succeeded"
        ? physics.maxDisplacementM
        : undefined,
    modelVersion: physics.modelVersion,
    solverVersion: physics.solverVersion,
    source: physics.source,
    status: physics.status,
    surrogateConfidence: physics.surrogateConfidence,
    tick: physics.tick,
    weatherSourceRef: physics.weatherSourceRef,
    weatherVersion: physics.weatherVersion,
    windSpeedMps:
      physics.status === "succeeded" ? physics.windSpeedMps : undefined,
  };
}

export function createDigitalTwinPolePropertiesAsset({
  network,
  pole,
  powerLines,
  regionId,
}: {
  network: DigitalTwinPowerLineNetwork;
  pole: DigitalTwinPowerPole;
  powerLines: readonly DigitalTwinPowerLineAsset[];
  regionId: string;
}): PolePropertiesAsset {
  const lineById = new Map(powerLines.map((line) => [line.assetId, line]));
  const conductorById = new Map(
    network.conductors.map((conductor) => [conductor.id, conductor])
  );
  const poleNumber = network.poles.findIndex((candidate) => candidate.id === pole.id) + 1;

  return {
    assetId: pole.id,
    connectedSpans: pole.assetIds.flatMap((assetId) => {
      const line = lineById.get(assetId);
      const conductor = conductorById.get(assetId);
      if (!line || !conductor) return [];
      return [
        {
          assetId,
          endpoint: conductor.startPoleId === pole.id ? "start" : "end",
          horizontalTensionN: line.conductor?.horizontalTensionN ?? null,
          latestPhysics: popupPhysics(line),
          name: line.name,
          spanLengthM: line.conductor?.spanLengthM ?? null,
          staticSagM: line.conductor?.staticSagM ?? null,
        },
      ];
    }),
    location: {
      elevationM: pole.position[2],
      latitude: pole.position[1],
      longitude: pole.position[0],
    },
    name: `Pole ${poleNumber || pole.id}`,
    observation: null,
    poleType: "Distribution pole",
    regionId,
  };
}
