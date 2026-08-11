import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_WEATHER_SETTINGS } from "@geolibre/ui";
import {
  DEFAULT_RUN_FILTERS,
  SIMULATION_RUNS,
  analyticsForRun,
  burnedAreaPerimeter,
  createSimulationRun,
  filterRuns,
  formatSimulationTime,
  formatWindDirection,
  ignitionBounds,
  ignitionCenter,
  ignitionPointFeatures,
  initialRunSampleIndex,
  parseLaunchedSimulationRuns,
  runIdFromLocation,
} from "../apps/geolibre-desktop/src/product-modes/digital-twin/ui/simulation-flow";

test("runIdFromLocation resolves a nested run route", () => {
  assert.equal(
    runIdFromLocation("/regions/boulder/runs/RUN-2026-08-11-0958?tab=overview"),
    "RUN-2026-08-11-0958",
  );
  assert.equal(runIdFromLocation("/regions/boulder/runs"), null);
  assert.equal(runIdFromLocation("/regions/boulder/scenarios/scenario-1"), null);
});

test("filterRuns combines text, location, and analytical filters", () => {
  const filtered = filterRuns(SIMULATION_RUNS, {
    ...DEFAULT_RUN_FILTERS,
    query: "louisville",
    location: "East County",
    minimumBurnedArea: 1_000,
    minimumSpreadRate: 2.5,
  });

  assert.deepEqual(filtered.map((run) => run.id), ["RUN-2026-08-11-0958"]);
});

test("createSimulationRun carries scenario inputs into the new run", () => {
  const run = createSimulationRun(
    {
      scenario: "West Ridge test",
      location: "Front Range",
      durationHours: 4,
      ignitionPoints: [
        { id: "point-1", longitude: -105.27, latitude: 40.02 },
        { id: "point-2", longitude: -105.25, latitude: 40.01 },
      ],
      weather: {
        ...DEFAULT_WEATHER_SETTINGS,
        events: { ...DEFAULT_WEATHER_SETTINGS.events, wind: 24 },
      },
    },
    7,
  );

  assert.match(run.id, /^RUN-\d{4}-\d{2}-\d{2}-0007$/);
  assert.equal(run.scenario, "West Ridge test");
  assert.equal(run.ignitionSources, 2);
  assert.deepEqual(run.ignitionPoints, [
    { id: "point-1", longitude: -105.27, latitude: 40.02 },
    { id: "point-2", longitude: -105.25, latitude: 40.01 },
  ]);
  assert.equal(run.windSpeed, 24);
  assert.equal(run.windDirection, DEFAULT_WEATHER_SETTINGS.events.windDirection);
  assert.equal(run.durationHours, 4);
  assert.equal(run.status, "Running");
});

test("burned area perimeter remains centered on its geographic ignition point", () => {
  const center: [number, number] = [-105.22, 39.76];
  const early = burnedAreaPerimeter(center, 120).geometry.coordinates[0];
  const late = burnedAreaPerimeter(center, 1_200).geometry.coordinates[0];
  const average = (ring: number[][], coordinate: 0 | 1) =>
    ring.slice(0, -1).reduce((sum, point) => sum + point[coordinate], 0) / (ring.length - 1);

  assert.ok(Math.abs(average(early, 0) - average(late, 0)) < 0.0001);
  assert.ok(Math.abs(average(early, 1) - average(late, 1)) < 0.0001);
  assert.ok(Math.abs(late[0][0] - center[0]) > Math.abs(early[0][0] - center[0]));
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

test("analytics stay monotonic for area and share the replay clock", () => {
  const samples = analyticsForRun(SIMULATION_RUNS[1]);
  assert.equal(samples.length, 13);
  assert.equal(samples[0].burnedArea, 0);
  assert.equal(samples.at(-1)?.burnedArea, SIMULATION_RUNS[1].burnedArea);
  assert.ok(
    samples.every((sample, index) => index === 0 || sample.burnedArea >= samples[index - 1].burnedArea),
  );
  assert.equal(formatSimulationTime(samples.at(-1)?.minute ?? 0), "04:00");
});

test("run replay honors duration, direction, progress, and persisted run shape", () => {
  const twoHourRun = { ...SIMULATION_RUNS[4], durationHours: 2, progress: 0 };
  const samples = analyticsForRun(twoHourRun);

  assert.equal(formatSimulationTime(samples.at(-1)?.minute ?? 0), "02:00");
  assert.equal(formatWindDirection(twoHourRun.windDirection), "W");
  assert.equal(initialRunSampleIndex(twoHourRun, samples.length), 0);
  assert.deepEqual(parseLaunchedSimulationRuns(JSON.stringify([twoHourRun])), [twoHourRun]);
  assert.deepEqual(
    parseLaunchedSimulationRuns(JSON.stringify([{ ...twoHourRun, ignitionPoints: undefined }])),
    [],
  );
  assert.deepEqual(parseLaunchedSimulationRuns("not-json"), []);
});
