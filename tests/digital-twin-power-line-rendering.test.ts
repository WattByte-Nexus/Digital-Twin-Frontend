import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  DigitalTwinPowerLineAsset,
  DigitalTwinPowerPoleAsset,
} from "../apps/geolibre-desktop/src/lib/digital-twin-assets";
import {
  POWER_POLE_HEIGHT_AGL_METERS,
  POWER_POLE_MODEL_HEIGHT_METERS,
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
    conductorOffsetsM: [
      { lateral: -1.5, vertical: 0 },
      { lateral: 1.5, vertical: 0 },
    ],
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
    conductorOffsetsM: [
      { lateral: -1.5, vertical: 0 },
      { lateral: 1.5, vertical: 0 },
    ],
    conductor: null,
    latestPhysics: null,
  },
];

describe("Digital Twin power-line rendering", () => {
  it("connects a captured wire fragment to aligned supports without changing captured points", () => {
    const measuredPath = [
      { lon: -105, lat: 40, elevationM: 1710 },
      { lon: -105, lat: 40.0001, elevationM: 1710.2 },
    ];
    const pole = (
      assetId: string,
      lat: number,
      lon = -105
    ): DigitalTwinPowerPoleAsset => ({
      kind: "power_pole",
      assetId,
      regionId: "region-1",
      base: { lon, lat, elevationM: 1700 },
      top: { lon, lat, elevationM: 1712 },
      radiusM: 0.2,
      sourceRef: "point-cloud:test",
    });
    const start = pole("start", 39.9999);
    const end = pole("end", 40.0003);
    const line = { ...lines[0], assetId: "captured-wire", sourceRef: "point-cloud:test", measuredPath };
    const canonical = { ...line, assetId: "canonical-span", measuredPath: null, coordinates: [start.top, end.top] as [typeof start.top, typeof end.top], supportIds: [start.assetId, end.assetId] as [string, string] };
    const network = buildDigitalTwinPowerLineNetwork([line, canonical], {
      measuredPoles: [start, end],
    });
    const conductor = network.conductors.find(c => c.assetId === canonical.assetId)!;
    assert.deepEqual(new Set([conductor.startPoleId, conductor.endPoleId]), new Set(["start", "end"]));
    assert.deepEqual(conductor.path, canonical.coordinates.map(p => [p.lon, p.lat, p.elevationM]));
    assert.deepEqual(network.conductors.find(c => c.assetId === line.assetId)!.path,
      measuredPath.map(p => [p.lon, p.lat, p.elevationM]));
    assert.ok(network.poles.every(support => support.assetIds.includes(conductor.assetId)));
    assert.deepEqual(measuredPath[0], { lon: -105, lat: 40, elevationM: 1710 });
  });
  it("uses the same model size for measured and catalog poles while preserving measured bases", () => {
    const network = buildDigitalTwinPowerLineNetwork([], {
      measuredPoles: [
        {
          kind: "power_pole",
          assetId: "measured-pole",
          regionId: "region-1",
          base: { lon: -105, lat: 40, elevationM: 1700 },
          top: { lon: -105, lat: 40, elevationM: 1712 },
          radiusM: 0.16,
          sourceRef: "point-cloud:capture:v1:pole:1",
        },
      ],
      surfaceElevations: new Map([
        [digitalTwinSurfaceCoordinateKey(-105, 40), 999],
      ]),
    });
    assert.equal(network.poles.length, 1);
    assert.equal(network.conductors.length, 0);
    const pole = network.poles[0];
    assert.deepEqual(pole.position, [-105, 40, 1700]);
    assert.deepEqual(
      pole.scale,
      Array(3).fill(POWER_POLE_HEIGHT_AGL_METERS / POWER_POLE_MODEL_HEIGHT_METERS)
    );
    const layers = createDigitalTwinPowerLineLayers(network, {
      modelUrl: "https://example.com/pole.glb",
    });
    assert.deepEqual(layers[1].props.data, [pole]);
    assert.deepEqual(layers[1].props.getPosition(pole), [-105, 40, 1700]);
    const shortPole: DigitalTwinPowerPoleAsset = {
      kind: "power_pole", assetId: "short-pole", regionId: "region-1",
      base: { lon: -105.002, lat: 40, elevationM: 1700 },
      top: { lon: -105.002, lat: 40, elevationM: 1703 },
      radiusM: 0.1, sourceRef: "point-cloud:capture:v1:pole:2",
    };
    const mixedNetwork = buildDigitalTwinPowerLineNetwork(lines, { measuredPoles: [shortPole] });
    assert.ok(mixedNetwork.poles.every(support =>
      support.scale.every((value, index) => value === pole.scale[index])));
    assert.equal(shortPole.top.elevationM, 1703);
  });
  it("renders exactly the segmented conductor bundle declared by the asset", () => {
    const [line] = lines;
    assert.ok(line);
    const bundledLine = {
      ...line,
      conductorOffsetsM: [
        { lateral: -1.5, vertical: 0 },
        { lateral: -0.5, vertical: 0 },
        { lateral: 0.5, vertical: 0 },
        { lateral: 1.5, vertical: 0 },
      ],
    } satisfies DigitalTwinPowerLineAsset;

    const network = buildDigitalTwinPowerLineNetwork([bundledLine]);

    assert.equal(network.conductors.length, 4);
    assert.deepEqual(
      network.conductors.map((conductor) => conductor.offsetMeters),
      [-1.5, -0.5, 0.5, 1.5]
    );
  });

  it("derives two crossarm-aligned conductors and one pole per shared support", () => {
    const network = buildDigitalTwinPowerLineNetwork(lines);

    assert.deepEqual(
      network.conductors.map(({ id, assetId, offsetMeters }) => ({
        id,
        assetId,
        offsetMeters,
      })),
      [
        { id: "line-1-conductor-1", assetId: "line-1", offsetMeters: -1.5 },
        { id: "line-1-conductor-2", assetId: "line-1", offsetMeters: 1.5 },
        { id: "line-2-conductor-1", assetId: "line-2", offsetMeters: -1.5 },
        { id: "line-2-conductor-2", assetId: "line-2", offsetMeters: 1.5 },
      ]
    );
    const [firstLeft, firstRight, secondLeft, secondRight] = network.conductors;
    assert.ok(firstLeft && firstRight && secondLeft && secondRight);
    assert.deepEqual(firstLeft.path[1], secondLeft.path[0]);
    assert.deepEqual(firstRight.path[1], secondRight.path[0]);
    assert.equal(firstLeft.startPoleId, "pole--105.0000000,40.0000000");
    assert.equal(firstLeft.endPoleId, "pole--105.0000000,40.0010000");
    assert.notEqual(firstLeft.path[0][0], -105);
    assert.notEqual(firstRight.path[0][0], -105);
    const separationMeters =
      Math.abs(firstLeft.path[0][0] - firstRight.path[0][0]) *
      111_320 *
      Math.cos((40 * Math.PI) / 180);
    assert.ok(
      Math.abs(separationMeters - 3) < 0.001,
      `expected 3 m conductor separation, received ${separationMeters} m`
    );
    assert.deepEqual(
      network.conductors.map((conductor) =>
        conductor.path.map((coordinate) => coordinate[2])
      ),
      [
        [1_710, 1_711],
        [1_710, 1_711],
        [1_711, 1_712],
        [1_711, 1_712],
      ]
    );
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

    assert.deepEqual(
      network.conductors.map((conductor) =>
        conductor.path.map((coordinate) => coordinate[2])
      ),
      [
        [
          1_642.25 + POWER_POLE_HEIGHT_AGL_METERS,
          1_643.5 + POWER_POLE_HEIGHT_AGL_METERS,
        ],
        [
          1_642.25 + POWER_POLE_HEIGHT_AGL_METERS,
          1_643.5 + POWER_POLE_HEIGHT_AGL_METERS,
        ],
        [
          1_643.5 + POWER_POLE_HEIGHT_AGL_METERS,
          1_644.75 + POWER_POLE_HEIGHT_AGL_METERS,
        ],
        [
          1_643.5 + POWER_POLE_HEIGHT_AGL_METERS,
          1_644.75 + POWER_POLE_HEIGHT_AGL_METERS,
        ],
      ]
    );
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

  it("preserves measured conductor heights when other lines follow terrain", () => {
    const measuredLine: DigitalTwinPowerLineAsset = {
      ...lines[0],
      assetId: "measured-line",
      measuredPath: [
        { lon: -105, lat: 40, elevationM: 1_711.5 },
        { lon: -105, lat: 40.0005, elevationM: 1_710.75 },
        { lon: -105, lat: 40.001, elevationM: 1_712.25 },
      ],
    };
    const network = buildDigitalTwinPowerLineNetwork([...lines, measuredLine], {
      surfaceElevations: new Map([
        [digitalTwinSurfaceCoordinateKey(-105, 40), 1_642.25],
        [digitalTwinSurfaceCoordinateKey(-105, 40.001), 1_643.5],
        [digitalTwinSurfaceCoordinateKey(-104.999, 40.001), 1_644.75],
      ]),
    });
    assert.deepEqual(
      network.conductors.find((line) => line.assetId === "measured-line")?.path,
      [
        [-105, 40, 1_711.5],
        [-105, 40.0005, 1_710.75],
        [-105, 40.001, 1_712.25],
      ]
    );
    assert.equal(network.poles[0].position[2], 1_642.25);
  });

  it("makes poles pickable and binds hover and click without consuming drag gestures", () => {
    const hovered: Array<string | null> = [];
    const selected: string[] = [];
    const network = buildDigitalTwinPowerLineNetwork(lines);
    const [, poleLayer, polePickHaloLayer] = createDigitalTwinPowerLineLayers(
      network,
      {
        modelUrl: "https://example.com/pole.glb",
        interaction: {
          hoveredPoleId: network.poles[0]?.id ?? null,
          selectedPoleIds: new Set([network.poles[1]?.id ?? ""]),
          onHover: (pole) => hovered.push(pole?.id ?? null),
          onSelect: (pole) => selected.push(pole.id),
        },
      }
    );

    assert.equal(poleLayer.props.pickable, true);
    assert.equal(poleLayer.props.autoHighlight, true);
    assert.equal(polePickHaloLayer.props.pickable, true);
    assert.equal(polePickHaloLayer.props.radiusMinPixels, 10);
    assert.equal(polePickHaloLayer.props.radiusMaxPixels, 14);
    assert.deepEqual(
      poleLayer.props.getColor(network.poles[0], {
        index: 0,
        data: network.poles,
      }),
      [96, 210, 255, 255]
    );
    assert.deepEqual(
      poleLayer.props.getColor(network.poles[1], {
        index: 1,
        data: network.poles,
      }),
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
    for (const layer of [poleLayer, polePickHaloLayer]) {
      assert.equal(layer.props.onDragStart, null);
      assert.equal(layer.props.onDrag, null);
      assert.equal(layer.props.onDragEnd, null);
    }

    assert.deepEqual(hovered, [network.poles[0]?.id]);
    assert.deepEqual(selected, [network.poles[0]?.id]);
  });
});
