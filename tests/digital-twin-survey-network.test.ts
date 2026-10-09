import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { fetchDigitalTwinAssets } from "../apps/geolibre-desktop/src/lib/digital-twin-assets";
import { buildDigitalTwinPowerLineNetwork } from "../apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-power-line-rendering";
import { createDigitalTwinPolePropertiesAsset } from "../apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-pole-properties";
import type { DigitalTwinPowerPoleAsset, DigitalTwinPowerLineAsset } from "../apps/geolibre-desktop/src/lib/digital-twin-assets";
import { readSurveyNetwork } from "../apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-survey-network";

function pole(id: string, x: number, y = 0): DigitalTwinPowerPoleAsset {
  const position = { lon: -105 + x / (111_320 * Math.cos(40 * Math.PI / 180)), lat: 40 + y / 110_540 };
  return { kind: "power_pole", assetId: id, regionId: "region", base: { ...position, elevationM: 1700 }, top: { ...position, elevationM: 1710 }, radiusM: 0.2, sourceRef: "point-cloud:survey:version:pole:1" };
}

test("does not fabricate connections that are absent from the engine collection", () => {
  const poles = [pole("a", 0), pole("b", 40)];
  assert.deepEqual(readSurveyNetwork(poles, []), { connections: [], unconnectedPoleIds: ["a", "b"] });
});

test("Golden survey regression: covers all 31 poles with 28 canonical connections and preserves 11 measured traces", async () => {
  const json = await readFile(new URL("./fixtures/golden-survey-network.json", import.meta.url), "utf8");
  const assets = await fetchDigitalTwinAssets("http://engine.test", "golden-co", { fetchImpl: async () => new Response(json) });
  const poles = assets.filter(asset => asset.kind === "power_pole");
  const lines = assets.filter(asset => asset.kind === "power_line");
  const network = buildDigitalTwinPowerLineNetwork(lines, { measuredPoles: poles });
  const candidates = network.survey!.connections;
  assert.equal(poles.length, 31);
  assert.equal(candidates.length, 28);
  assert.equal(new Set(candidates.map(c => c.id)).size, 28);
  assert.deepEqual(network.survey?.unconnectedPoleIds, []);
  assert.equal(network.conductors.filter(c => !c.startPoleId).length, 11);
  for (const line of lines.filter(line => line.measuredPath)) {
    assert.deepEqual(network.conductors.find(c => c.id === line.assetId)?.path,
      line.measuredPath!.map(p => [p.lon, p.lat, p.elevationM]));
  }
  for (const connection of candidates) {
    const conductor = network.conductors.find(c => c.assetId === connection.id)!;
    assert.deepEqual(conductor.path, connection.line.coordinates.map(p => [p.lon, p.lat, p.elevationM]));
  }
  for (const support of network.poles) {
    const popup = createDigitalTwinPolePropertiesAsset({ network, pole: support, powerLines: lines, regionId: "golden-co" });
    assert.ok(popup.networkReview?.includes("included in physics"));
    assert.ok(popup.connectedSpans.length > 0);
    assert.ok(popup.connectedSpans.every(span => !span.reviewStatus));
  }
});
