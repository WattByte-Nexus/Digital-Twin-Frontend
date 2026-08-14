import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DigitalTwinPowerLineAsset } from "../apps/geolibre-desktop/src/lib/digital-twin-assets";
import {
  POWER_POLE_HEIGHT_AGL_METERS,
  buildDigitalTwinPowerLineNetwork,
  createDigitalTwinPowerLineLayers,
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
        startPoleId: "pole--105.0000000,40.0000000",
        endPoleId: "pole--105.0000000,40.0010000",
        path: [
          [-105, 40, 1_710],
          [-105, 40.001, 1_711],
        ],
      },
      {
        id: "line-2",
        startPoleId: "pole--105.0000000,40.0010000",
        endPoleId: "pole--104.9990000,40.0010000",
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

  it("moves pole models and only their connected conductor endpoints", () => {
    const baseNetwork = buildDigitalTwinPowerLineNetwork(lines);
    const movedPole = baseNetwork.poles[1];
    assert.ok(movedPole);
    const movedPosition = [-104.9985, 40.002, 1_650] as [
      number,
      number,
      number,
    ];

    const network = buildDigitalTwinPowerLineNetwork(lines, {
      polePositionOverrides: new Map([[movedPole.id, movedPosition]]),
    });

    assert.deepEqual(network.poles[1]?.position, movedPosition);
    assert.deepEqual(network.conductors[0]?.path[0], [-105, 40, 1_710]);
    assert.deepEqual(network.conductors[0]?.path[1], [
      movedPosition[0],
      movedPosition[1],
      movedPosition[2] + POWER_POLE_HEIGHT_AGL_METERS,
    ]);
    assert.deepEqual(network.conductors[1]?.path[0], [
      movedPosition[0],
      movedPosition[1],
      movedPosition[2] + POWER_POLE_HEIGHT_AGL_METERS,
    ]);
  });

  it("makes poles pickable and binds hover, click, and drag gestures", () => {
    const hovered: Array<string | null> = [];
    const selected: string[] = [];
    const dragged: string[] = [];
    const network = buildDigitalTwinPowerLineNetwork(lines);
    const [, poleLayer, polePickHaloLayer] = createDigitalTwinPowerLineLayers(network, {
      modelUrl: "https://example.com/pole.glb",
      interaction: {
        hoveredPoleId: network.poles[0]?.id ?? null,
        selectedPoleIds: new Set([network.poles[1]?.id ?? ""]),
        onHover: (pole) => hovered.push(pole?.id ?? null),
        onSelect: (pole) => selected.push(pole.id),
        onDragStart: (pole) => dragged.push(`start:${pole.id}`),
        onDrag: (pole) => dragged.push(`move:${pole.id}`),
        onDragEnd: (pole) => dragged.push(`end:${pole.id}`),
      },
    });

    assert.equal(poleLayer.props.pickable, true);
    assert.equal(poleLayer.props.autoHighlight, true);
    assert.equal(polePickHaloLayer.props.pickable, true);
    assert.equal(polePickHaloLayer.props.radiusMinPixels, 10);
    assert.equal(polePickHaloLayer.props.radiusMaxPixels, 14);
    assert.deepEqual(
      poleLayer.props.getColor(network.poles[0], { index: 0, data: network.poles }),
      [96, 210, 255, 255]
    );
    assert.deepEqual(
      poleLayer.props.getColor(network.poles[1], { index: 1, data: network.poles }),
      [245, 158, 11, 255]
    );

    const event = {
      offsetCenter: { x: 12, y: 34 },
      srcEvent: { ctrlKey: true },
    } as never;
    poleLayer.props.onHover?.(
      { picked: true, object: network.poles[0] } as never,
      event
    );
    poleLayer.props.onClick?.(
      { picked: true, object: network.poles[0] } as never,
      event
    );
    poleLayer.props.onDragStart?.(
      { picked: true, object: network.poles[0] } as never,
      event
    );
    poleLayer.props.onDrag?.(
      { picked: true, object: network.poles[0] } as never,
      event
    );
    poleLayer.props.onDragEnd?.(
      { picked: true, object: network.poles[0] } as never,
      event
    );

    assert.deepEqual(hovered, [network.poles[0]?.id]);
    assert.deepEqual(selected, [network.poles[0]?.id]);
    assert.deepEqual(dragged, [
      `start:${network.poles[0]?.id}`,
      `move:${network.poles[0]?.id}`,
      `end:${network.poles[0]?.id}`,
    ]);
  });
});
