import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SolidPolygonLayer } from "@deck.gl/layers";
import { digitalTwinSurfaceCoordinateKey } from "../packages/map/src/digital-twin-surface-state";
import type { DigitalTwinTreeAsset } from "../apps/geolibre-desktop/src/lib/digital-twin-assets";
import { createDigitalTwinTreeLayers } from "../apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-tree-rendering";

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
  it("places segmented trunks and crowns on the sampled terrain surface", () => {
    const elevations = new Map([
      [digitalTwinSurfaceCoordinateKey(TREE.location.lon, TREE.location.lat), 1_728.5],
    ]);

    const [trunks, crowns] = createDigitalTwinTreeLayers([TREE], {
      surfaceElevations: elevations,
    });

    assert.ok(trunks instanceof SolidPolygonLayer);
    assert.ok(crowns instanceof SolidPolygonLayer);
    assert.equal(trunks.id, "digital-twin-tree-trunks");
    assert.equal(crowns.id, "digital-twin-tree-crowns");
    assert.equal(trunks.props.getPolygon(TREE)[0][2], 1_728.5);
    assert.equal(crowns.props.getPolygon(TREE)[0][2], 1_732);
    assert.equal(crowns.props.getPolygon(TREE).length, 14);
    assert.equal(crowns.props.getElevation(TREE), 6.5);
  });

  it("uses compact physical defaults for incomplete draft assets", () => {
    const draft = { ...TREE, heightM: null, canopyRadiusM: null };
    const [trunks, crowns] = createDigitalTwinTreeLayers([draft]);

    assert.equal(trunks.props.getElevation(draft), 4.4);
    assert.equal(crowns.props.getPolygon(draft).length, 14);
  });
});
