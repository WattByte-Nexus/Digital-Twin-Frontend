import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DigitalTwinPowerLineAsset } from "../apps/geolibre-desktop/src/lib/digital-twin-assets";
import {
  POWER_POLE_HEIGHT_AGL_METERS,
  buildDigitalTwinPowerLineNetwork,
  resolveDigitalTwinPowerPoleModelUrl,
} from "../apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-power-line-rendering";
import { digitalTwinSurfaceCoordinateKey } from "../packages/map/src/digital-twin-surface-state";

const lines: DigitalTwinPowerLineAsset[] = [
  {
    kind: "power_line",
    assetId: "line-1",
    regionId: "region-1",
    name: "First span",
    coordinates: [
      { lat: 40, lon: -105, elevationM: 1_710 },
      { lat: 40.001, lon: -105, elevationM: 1_711 },
    ],
    bounds: null,
    conductor: null,
    latestPhysics: null,
  },
  {
    kind: "power_line",
    assetId: "line-2",
    regionId: "region-1",
    name: "Second span",
    coordinates: [
      { lat: 40.001, lon: -105, elevationM: 1_711 },
      { lat: 40.001, lon: -104.999, elevationM: 1_712 },
    ],
    bounds: null,
    conductor: null,
    latestPhysics: null,
  },
];

describe("Digital Twin power-line rendering", () => {
  it("derives exact 3D conductors and one pole per shared support", () => {
    const network = buildDigitalTwinPowerLineNetwork(lines);

    assert.deepEqual(network.conductors, [
      {
        id: "line-1",
        path: [
          [-105, 40, 1_710],
          [-105, 40.001, 1_711],
        ],
      },
      {
        id: "line-2",
        path: [
          [-105, 40.001, 1_711],
          [-104.999, 40.001, 1_712],
        ],
      },
    ]);
    assert.equal(network.poles.length, 3);
    assert.deepEqual(network.poles[1]?.position, [
      -105,
      40.001,
      1_711 - POWER_POLE_HEIGHT_AGL_METERS,
    ]);
    assert.deepEqual(network.poles[1]?.assetIds, ["line-1", "line-2"]);
  });

  it("plants poles on the sampled shared surface instead of trusting floating asset heights", () => {
    const surfaceElevations = new Map([
      [digitalTwinSurfaceCoordinateKey(-105, 40), 1_642.25],
      [digitalTwinSurfaceCoordinateKey(-105, 40.001), 1_643.5],
      [digitalTwinSurfaceCoordinateKey(-104.999, 40.001), 1_644.75],
    ]);

    const network = buildDigitalTwinPowerLineNetwork(lines, {
      surfaceElevations,
    });

    assert.deepEqual(network.conductors[0]?.path, [
      [-105, 40, 1_642.25 + POWER_POLE_HEIGHT_AGL_METERS],
      [-105, 40.001, 1_643.5 + POWER_POLE_HEIGHT_AGL_METERS],
    ]);
    assert.deepEqual(network.poles[0]?.position, [-105, 40, 1_642.25]);
    assert.deepEqual(network.poles[1]?.position, [-105, 40.001, 1_643.5]);
  });

  it("resolves the pole model from the application root on nested routes", () => {
    assert.equal(
      resolveDigitalTwinPowerPoleModelUrl(
        "http://localhost:5173/regions/golden-co/assets"
      ),
      "http://localhost:5173/assets/digital-twin/13.8kv_power_pole.glb"
    );
  });
});
