import type {
  DigitalTwinPowerLineAsset,
  DigitalTwinPowerPoleAsset,
} from "../../lib/digital-twin-assets";

export interface SurveyConnection {
  id: string;
  start: DigitalTwinPowerPoleAsset;
  end: DigitalTwinPowerPoleAsset;
  line: DigitalTwinPowerLineAsset;
}

export interface SurveyNetwork {
  connections: SurveyConnection[];
  unconnectedPoleIds: string[];
}

/** Read published conductor topology shared by rendering and engine calculations. */
export function readSurveyNetwork(
  poles: readonly DigitalTwinPowerPoleAsset[],
  lines: readonly DigitalTwinPowerLineAsset[]
): SurveyNetwork {
  const byId = new Map(poles.map(pole => [pole.assetId, pole]));
  const connected = new Set<string>();
  const connections: SurveyConnection[] = [];
  for (const line of lines) {
    if (!line.supportIds) continue;
    const [startId, endId] = line.supportIds;
    const start = byId.get(startId);
    const end = byId.get(endId);
    if (!start || !end) throw new Error(`Span ${line.assetId} references missing supports.`);
    connections.push({ id: line.assetId, start, end, line });
    connected.add(startId);
    connected.add(endId);
  }
  return { connections, unconnectedPoleIds: poles.filter(pole => !connected.has(pole.assetId)).map(pole => pole.assetId) };
}
