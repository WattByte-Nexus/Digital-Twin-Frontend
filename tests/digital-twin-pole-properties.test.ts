import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DigitalTwinPowerLineAsset } from "../apps/geolibre-desktop/src/lib/digital-twin-assets";
import { createDigitalTwinPolePropertiesAsset } from "../apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-pole-properties";
import { buildDigitalTwinPowerLineNetwork } from "../apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-power-line-rendering";

const lines: DigitalTwinPowerLineAsset[] = [
  {
    kind: "power_line",
    assetId: "span-west",
    regionId: "golden-co",
    name: "Canyon feeder · west span",
    coordinates: [
      { lat: 39.75, lon: -105.23, elevationM: 1_840 },
      { lat: 39.751, lon: -105.229, elevationM: 1_842 },
    ],
    bounds: null,
    conductor: {
      massPerMeterKgM: 1.1,
      spanLengthM: 45.5,
      conductorDiameterM: 0.02,
      horizontalTensionN: 18_420,
      airDensityKgM3: 1.2,
      dragCoefficient: 1,
      staticSagM: 2.86,
      elasticModulusPa: null,
      crossSectionalAreaM2: null,
    },
    latestPhysics: null,
  },
  {
    kind: "power_line",
    assetId: "span-east",
    regionId: "golden-co",
    name: "Canyon feeder · east span",
    coordinates: [
      { lat: 39.751, lon: -105.229, elevationM: 1_842 },
      { lat: 39.752, lon: -105.228, elevationM: 1_841 },
    ],
    bounds: null,
    conductor: null,
    latestPhysics: null,
  },
];

describe("Digital Twin pole properties", () => {
  it("projects the selected support and its connected spans into the popup asset", () => {
    const network = buildDigitalTwinPowerLineNetwork(lines);
    const pole = network.poles.find((candidate) => candidate.assetIds.length === 2);
    assert.ok(pole);

    assert.deepEqual(
      createDigitalTwinPolePropertiesAsset({
        pole,
        network,
        powerLines: lines,
        regionId: "golden-co",
      }),
      {
        assetId: "pole--105.2290000,39.7510000",
        connectedSpans: [
          {
            assetId: "span-west",
            endpoint: "end",
            horizontalTensionN: 18_420,
            latestPhysics: null,
            name: "Canyon feeder · west span",
            spanLengthM: 45.5,
            staticSagM: 2.86,
          },
          {
            assetId: "span-east",
            endpoint: "start",
            horizontalTensionN: null,
            latestPhysics: null,
            name: "Canyon feeder · east span",
            spanLengthM: null,
            staticSagM: null,
          },
        ],
        location: {
          elevationM: 1_833.5,
          latitude: 39.751,
          longitude: -105.229,
        },
        name: "Pole 2",
        observation: null,
        poleType: "Distribution pole",
        regionId: "golden-co",
      }
    );
  });
});
