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
  const conductorByAssetId = new Map(
    network.conductors.map((conductor) => [conductor.assetId, conductor])
  );
  const poleNumber = network.poles.findIndex((candidate) => candidate.id === pole.id) + 1;

  return {
    assetId: pole.id,
    connectedSpans: pole.assetIds.flatMap<PolePropertiesAsset["connectedSpans"][number]>((assetId) => {
      const line = lineById.get(assetId);
      const conductor = conductorByAssetId.get(assetId);
      if (conductor?.inferredConnection) {
        const otherId = conductor.startPoleId === pole.id ? conductor.endPoleId : conductor.startPoleId;
        const otherNumber = network.poles.findIndex(candidate => candidate.id === otherId) + 1;
        return [{
          assetId,
          endpoint: conductor.startPoleId === pole.id ? "start" as const : "end" as const,
          name: `To pole ${otherNumber}`,
          spanLengthM: conductor.lengthM,
          reviewStatus: (conductor.evidenceAssetIds?.length ?? 0) > 0
            ? "Wire-aligned candidate · verify attachment"
            : "Proximity candidate · no measured wire",
          evidenceCount: conductor.evidenceAssetIds?.length ?? 0,
          latestPhysics: null,
        }];
      }
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
    poleType: pole.measured ? "Survey pole · classification unverified" : "Distribution pole",
    networkReview: pole.measured
      ? pole.assetIds.length > 0
        ? "These spans are reconstructed candidates. Attachments need review; candidates are excluded from simulation."
        : "Unresolved: no candidate support within the 100 m survey search limit. This detection may be a standalone pole."
      : undefined,
    regionId,
  };
}
