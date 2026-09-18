import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { fetchDigitalTwinAssets } from "../apps/geolibre-desktop/src/lib/digital-twin-assets";
import { buildDigitalTwinPowerLineNetwork } from "../apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-power-line-rendering";
import { createDigitalTwinPolePropertiesAsset } from "../apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-pole-properties";
import type { DigitalTwinPowerPoleAsset, DigitalTwinPowerLineAsset } from "../apps/geolibre-desktop/src/lib/digital-twin-assets";
import { reconstructSurveyNetwork } from "../apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-survey-network";

function pole(id: string, x: number, y = 0): DigitalTwinPowerPoleAsset {
  const position = { lon: -105 + x / (111_320 * Math.cos(40 * Math.PI / 180)), lat: 40 + y / 110_540 };
  return { kind: "power_pole", assetId: id, regionId: "region", base: { ...position, elevationM: 1700 }, top: { ...position, elevationM: 1710 }, radiusM: 0.2, sourceRef: "point-cloud:survey:version:pole:1" };
}

test("reconstructs gaps across a whole pole chain without requiring a fragment in each span", () => {
  const poles = [pole("a", 0), pole("b", 40), pole("c", 80), pole("d", 120)];
  const result = reconstructSurveyNetwork(poles, []);
  assert.deepEqual(result.connections.map(c => [c.start.assetId, c.end.assetId]), [["a", "b"], ["b", "c"], ["c", "d"]]);
  assert.equal(result.unconnectedPoleIds.length, 0);
  assert.ok(result.connections.every(c => c.evidenceAssetIds.length === 0));
  assert.deepEqual(reconstructSurveyNetwork([...poles].reverse(), []), result);
});

test("keeps distant and separate-survey poles unresolved instead of forcing full coverage", () => {
  const distant = pole("remote", 300);
  const otherSurvey = { ...pole("other", 10), sourceRef: "point-cloud:another:version:pole:1" };
  const result = reconstructSurveyNetwork([pole("a", 0), pole("b", 40), distant, otherSurvey], []);
  assert.deepEqual(result.unconnectedPoleIds, ["other", "remote"]);
  assert.equal(result.connections.length, 1);
});

test("deduplicates wire evidence into one span and retains the measured fragment unchanged", () => {
  const poles = [pole("a", 0), pole("b", 40), pole("c", 80)];
  const measuredPath = [pole("x", 10).top, pole("y", 20).top];
  const wire = { kind: "power_line", sourceRef: "point-cloud:survey:version:wire:1", assetId: "wire-1", regionId: "region", coordinates: measuredPath, measuredPath } as DigitalTwinPowerLineAsset;
  const original = structuredClone(wire);
  const result = reconstructSurveyNetwork(poles, [wire, { ...wire, assetId: "wire-2" }]);
  assert.equal(result.connections.length, 2);
  assert.deepEqual(result.connections[0].evidenceAssetIds, ["wire-1", "wire-2"]);
  assert.deepEqual(result.connections[1].evidenceAssetIds, []);
  assert.deepEqual(wire, original);
});

test("does not attach a perpendicular or vertically incompatible fragment", () => {
  const poles = [pole("a", 0), pole("b", 40)];
  const paths = [
    [pole("x", 20, -10).top, pole("y", 20, 10).top],
    [pole("x", 10).base, pole("y", 20).base],
  ];
  for (const measuredPath of paths) {
    const wire = { kind: "power_line", sourceRef: "point-cloud:survey:version:wire:1", assetId: "wire", regionId: "region", coordinates: measuredPath, measuredPath } as DigitalTwinPowerLineAsset;
    assert.deepEqual(reconstructSurveyNetwork(poles, [wire]).connections[0].evidenceAssetIds, []);
  }
});

test("Golden survey regression: covers all 31 poles with 28 distinct candidates and preserves 11 measured traces", async () => {
  const json = await readFile(new URL("./fixtures/golden-survey-network.json", import.meta.url), "utf8");
  const assets = await fetchDigitalTwinAssets("http://engine.test", "golden-co", { fetchImpl: async () => new Response(json) });
  const poles = assets.filter(asset => asset.kind === "power_pole");
  const lines = assets.filter(asset => asset.kind === "power_line");
  const network = buildDigitalTwinPowerLineNetwork(lines, { measuredPoles: poles });
  const candidates = network.conductors.filter(c => c.inferredConnection);
  assert.equal(poles.length, 31);
  assert.equal(candidates.length, 28);
  assert.equal(new Set(candidates.map(c => c.id)).size, 28);
  assert.equal(candidates.filter(c => c.evidenceAssetIds?.length).length, 3);
  assert.deepEqual(network.survey?.unconnectedPoleIds, []);
  assert.equal(network.conductors.filter(c => !c.inferredConnection).length, 11);
  for (const line of lines) {
    assert.deepEqual(network.conductors.find(c => c.id === line.assetId)?.path,
      line.measuredPath!.map(p => [p.lon, p.lat, p.elevationM]));
  }
  for (const support of network.poles) {
    const popup = createDigitalTwinPolePropertiesAsset({ network, pole: support, powerLines: lines, regionId: "golden-co" });
    assert.ok(popup.networkReview?.includes("excluded from simulation"));
    assert.ok(popup.connectedSpans.length > 0);
    assert.ok(popup.connectedSpans.every(span => span.reviewStatus && span.latestPhysics === null));
  }
});
