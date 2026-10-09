import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SolidPolygonLayer } from "@deck.gl/layers";
import { SimpleMeshLayer } from "@deck.gl/mesh-layers";
import { digitalTwinSurfaceCoordinateKey } from "../packages/map/src/digital-twin-surface-state";
import type { DigitalTwinTreeAsset } from "../apps/geolibre-desktop/src/lib/digital-twin-assets";
import {
  createDigitalTwinTreeLayers,
} from "../apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-tree-rendering";

const TREE: DigitalTwinTreeAsset = {
  kind: "tree",
  assetId: "GOLDEN-TREE-001",
  regionId: "golden-co",
  location: { lat: 39.7557, lon: -105.2208 },
  species: "unclassified",
  heightM: 10,
  canopyRadiusM: 3,
  sourceRef: "wildfire-rec:single-lane:tree-0",
};

describe("Digital Twin tree rendering", () => {
  it("connects captured canopies to terrain instead of drawing a second lower crown", () => {
    const survey: DigitalTwinTreeAsset = {
      ...TREE,
      sourceRef: "point-cloud:golden-loop-route:version-1:tree:153",
      heightM: 11.635,
      segmentation: {
        bounds: [-105.216, 39.751, 1740.638, -105.215, 39.752, 1752.273],
        pointCount: 16734,
      },
    };
    const elevations = new Map([[digitalTwinSurfaceCoordinateKey(TREE.location.lon, TREE.location.lat), 1738.614]]);
    const [trunks, crowns] = createDigitalTwinTreeLayers([survey, TREE], {
      surfaceElevations: elevations,
      pointCloud: { datasetId: "golden-loop-route", version: "version-1" },
    });
    const ground = trunks.props.getPolygon(survey)[0][2];
    assert.equal(ground, 1738.614);
    assert.equal(ground + trunks.props.getElevation(survey), (1740.638 + 1752.273) / 2);
    assert.deepEqual(crowns.props.data, [TREE]);
    assert.equal(trunks.props.updateTriggers.getElevation[0], elevations);
    const [, unmatchedCrowns] = createDigitalTwinTreeLayers([survey], {
      surfaceElevations: elevations,
      pointCloud: { datasetId: "golden-loop-route", version: "version-2" },
    });
    assert.deepEqual(unmatchedCrowns.props.data, [survey]);
    assert.deepEqual(survey.segmentation?.bounds, [-105.216, 39.751, 1740.638, -105.215, 39.752, 1752.273]);
  });
  it("uses opaque terrain-anchored models for both survey and inventory trees", () => {
    const survey = { ...TREE, assetId: "survey-tree", segmentation: { bounds: [-105.221, 39.755, 1732, -105.22, 39.756, 1745] as [number, number, number, number, number, number], pointCount: 5000 } };
    const selected: unknown[] = [];
    const elevation = 1720;
    const layers = createDigitalTwinTreeLayers([TREE, survey], {
      surfaceElevations: new Map([[digitalTwinSurfaceCoordinateKey(TREE.location.lon, TREE.location.lat), elevation]]),
      interaction: { selectedTreeId: null, onSelect: asset => selected.push(asset) },
    });
    const [trunks, crowns] = layers;
    assert.equal(layers.length, 2);
    assert.deepEqual(crowns.props.data, [TREE, survey]);
    assert.deepEqual(trunks.props.data, [TREE, survey]);
    assert.equal(trunks.props.getPolygon(survey)[0][2], elevation);
    assert.equal(crowns.props.getPosition(survey)[2], elevation + 7);
    assert.equal(crowns.props.getPosition(survey)[2] - crowns.props.getScale(survey)[2], elevation + 4);
    assert.equal(crowns.props.getColor(survey)[3], 255);
    crowns.props.onClick?.({ object: survey, x: 10, y: 20 } as never, {} as never);
    assert.deepEqual(selected, [survey]);
    assert.equal(survey.segmentation.bounds[2], 1732);
  });
  it("places segmented trunks and crowns on the sampled terrain surface", () => {
    const elevations = new Map([
      [
        digitalTwinSurfaceCoordinateKey(TREE.location.lon, TREE.location.lat),
        1_728.5,
      ],
    ]);

    const [trunks, crowns] = createDigitalTwinTreeLayers([TREE], {
      surfaceElevations: elevations,
    });

    assert.ok(trunks instanceof SolidPolygonLayer);
    assert.ok(crowns instanceof SimpleMeshLayer);
    assert.equal(trunks.id, "digital-twin-tree-trunks");
    assert.equal(crowns.id, "digital-twin-tree-crowns");
    assert.equal(trunks.props.getPolygon(TREE)[0][2], 1_728.5);
    assert.deepEqual(crowns.props.getPosition(TREE), [
      TREE.location.lon,
      TREE.location.lat,
      1_735.5,
    ]);
    assert.deepEqual(crowns.props.getScale(TREE), [3, 3, 3]);
    assert.equal(trunks.props.updateTriggers.getPolygon, elevations);
    assert.equal(crowns.props.updateTriggers.getPosition, elevations);
  });

  it("uses compact physical defaults for incomplete draft assets", () => {
    const draft = { ...TREE, heightM: null, canopyRadiusM: null };
    const [trunks, crowns] = createDigitalTwinTreeLayers([draft]);

    assert.equal(trunks.props.getElevation(draft), 4.4);
    assert.deepEqual(crowns.props.getScale(draft), [2.5, 2.5, 2.4]);
  });
});
