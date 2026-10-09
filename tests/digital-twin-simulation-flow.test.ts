import assert from "node:assert/strict";
import test from "node:test";
import { formatSimulationTime, formatWindDirection, ignitionBounds, ignitionCenter, ignitionPointFeatures, runIdFromLocation } from "../apps/geolibre-desktop/src/product-modes/digital-twin/ui/simulation-flow";

test("runIdFromLocation resolves a nested run route", () => {
  assert.equal(
    runIdFromLocation("/regions/boulder/runs/RUN-2026-08-11-0958?tab=overview"),
    "RUN-2026-08-11-0958",
  );
  assert.equal(runIdFromLocation("/regions/boulder/runs"), null);
  assert.equal(runIdFromLocation("/regions/boulder/scenarios/scenario-1"), null);
});

test("ignition helpers preserve every point and center the run perimeter", () => {
  const points = [
    { id: "west", longitude: -105.27, latitude: 40.02 },
    { id: "east", longitude: -105.25, latitude: 40.01 },
  ];

  const center = ignitionCenter(points);
  assert.ok(Math.abs((center?.[0] ?? 0) + 105.26) < 0.000_001);
  assert.ok(Math.abs((center?.[1] ?? 0) - 40.015) < 0.000_001);
  assert.deepEqual(ignitionCenter([]), null);
  assert.deepEqual(
    ignitionPointFeatures(points).features.map((feature) => feature.geometry.coordinates),
    [
      [-105.27, 40.02],
      [-105.25, 40.01],
    ],
  );
  assert.deepEqual(ignitionBounds(points), [
    [-105.27, 40.01],
    [-105.25, 40.02],
  ]);
  assert.deepEqual(ignitionBounds([points[0]]), [
    [-105.27, 40.02],
    [-105.27, 40.02],
  ]);
  assert.deepEqual(ignitionBounds([]), null);
});

test("simulation labels preserve elapsed time and compass bearings", () => {
  assert.equal(formatSimulationTime(120), "02:00");
  assert.equal(formatWindDirection(270), "W");
  assert.equal(formatWindDirection(-90), "W");
  assert.equal(runIdFromLocation("/regions/region/runs/%invalid"), null);
});
