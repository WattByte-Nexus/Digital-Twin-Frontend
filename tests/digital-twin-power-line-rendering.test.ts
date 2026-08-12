import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DigitalTwinPowerLineAsset } from "../apps/geolibre-desktop/src/lib/digital-twin-assets";
import {
  POWER_POLE_HEIGHT_AGL_METERS,
  buildDigitalTwinPowerLineNetwork,
} from "../apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-power-line-rendering";

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
});
