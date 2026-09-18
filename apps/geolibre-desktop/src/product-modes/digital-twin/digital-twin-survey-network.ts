import type {
  DigitalTwinPowerLineAsset,
  DigitalTwinPowerPoleAsset,
} from "../../lib/digital-twin-assets";

type Coordinate = DigitalTwinPowerPoleAsset["top"];

export interface SurveyConnection {
  id: string;
  start: DigitalTwinPowerPoleAsset;
  end: DigitalTwinPowerPoleAsset;
  lengthM: number;
  evidenceAssetIds: string[];
}

export interface SurveyNetwork {
  connections: SurveyConnection[];
  unconnectedPoleIds: string[];
}

function displacement(start: Coordinate, end: Coordinate): [number, number] {
  return [
    (end.lon - start.lon) * 111_320 * Math.cos(start.lat * Math.PI / 180),
    (end.lat - start.lat) * 110_540,
  ];
}

/** Project an absolute survey point onto a candidate span, in metres. */
function projection(start: Coordinate, end: Coordinate, point: Coordinate) {
  const [dx, dy] = displacement(start, end);
  const length = Math.hypot(dx, dy);
  const [x, y] = displacement(start, point);
  return { along: (x * dx + y * dy) / length, across: Math.abs(x * dy - y * dx) / length };
}

function wireSupportsConnection(connection: SurveyConnection, line: DigitalTwinPowerLineAsset): boolean {
  if (!line.sourceRef || line.sourceRef.replace(/:wire:[^:]+$/, "") !== connection.start.sourceRef.replace(/:pole:[^:]+$/, "")) return false;
  const path = line.measuredPath;
  if (!path || line.regionId !== connection.start.regionId) return false;
  const first = path[0];
  const last = path.at(-1);
  if (!first || !last) return false;
  const { start, end, lengthM } = connection;
  const [wx, wy] = displacement(first, last);
  const [dx, dy] = displacement(start.top, end.top);
  const alignment = Math.abs(wx * dx + wy * dy) / (Math.hypot(wx, wy) * lengthM);
  if (alignment < Math.cos(12 * Math.PI / 180)) return false;
  return path.some(point => {
    const { along, across } = projection(start.top, end.top, point);
    const height = start.top.elevationM + (end.top.elevationM - start.top.elevationM) * along / lengthM;
    return along >= 0 && along <= lengthM && across <= 5
      && point.elevationM >= height - 6 && point.elevationM <= height + 2;
  });
}

/**
 * Reconstruct a display-only candidate forest from measured supports and wires.
 *
 * Inputs are immutable regional assets in WGS84 and absolute elevation metres.
 * Pairs must belong to the same survey version, be 3–100 m apart, and not skip
 * an intervening support within a 5 m corridor. Aligned wire evidence ranks
 * first, then shorter edges; Kruskal selection avoids redundant loops. No
 * confidence probability or actual electrical connectivity is asserted.
 * Returns stable candidate identities and every pole left unresolved. Callers
 * must label all candidates as unverified and never submit them as physics assets.
 */
export function reconstructSurveyNetwork(
  measuredPoles: readonly DigitalTwinPowerPoleAsset[],
  measuredLines: readonly DigitalTwinPowerLineAsset[]
): SurveyNetwork {
  const poles = [...measuredPoles].sort((a, b) => a.assetId.localeCompare(b.assetId));
  const surveyKey = (pole: DigitalTwinPowerPoleAsset) =>
    `${pole.regionId}:${pole.sourceRef.replace(/:pole:[^:]+$/, "")}`;
  const candidates: SurveyConnection[] = [];
  for (const [index, start] of poles.entries()) {
    for (const end of poles.slice(index + 1)) {
      if (surveyKey(start) !== surveyKey(end)) continue;
      const lengthM = Math.hypot(...displacement(start.top, end.top));
      if (lengthM < 3 || lengthM > 100) continue;
      const skipsSupport = poles.some(pole => {
        if (pole === start || pole === end || surveyKey(pole) !== surveyKey(start)) return false;
        const { along, across } = projection(start.top, end.top, pole.top);
        return along > 2 && along < lengthM - 2 && across <= 5;
      });
      if (skipsSupport) continue;
      const connection: SurveyConnection = {
        id: `survey-connection:${start.assetId}:${end.assetId}`,
        start, end, lengthM, evidenceAssetIds: [],
      };
      connection.evidenceAssetIds = measuredLines
        .filter(line => wireSupportsConnection(connection, line))
        .map(line => line.assetId).sort();
      candidates.push(connection);
    }
  }
  candidates.sort((a, b) =>
    Number(b.evidenceAssetIds.length > 0) - Number(a.evidenceAssetIds.length > 0)
    || Math.round(a.lengthM * 1000) - Math.round(b.lengthM * 1000)
    || a.id.localeCompare(b.id));
  const parent = new Map(poles.map(pole => [pole.assetId, pole.assetId]));
  const root = (id: string): string => {
    let current = id;
    while (parent.get(current) !== current) current = parent.get(current)!;
    return current;
  };
  const connections: SurveyConnection[] = [];
  const connected = new Set<string>();
  for (const candidate of candidates) {
    const a = root(candidate.start.assetId);
    const b = root(candidate.end.assetId);
    if (a === b) continue;
    parent.set(a, b);
    connections.push(candidate);
    connected.add(candidate.start.assetId);
    connected.add(candidate.end.assetId);
  }
  return {
    connections,
    unconnectedPoleIds: poles.filter(pole => !connected.has(pole.assetId)).map(pole => pole.assetId),
  };
}
