import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createDigitalTwinMapAssetSelectionDetail,
  isDigitalTwinMapAssetKind,
} from "../apps/geolibre-desktop/src/product-modes/digital-twin/ui/map-asset-selection";

describe("digital twin map asset selection", () => {
  it("accepts only trees, canonical power lines, and poles for the risk callout", () => {
    assert.equal(isDigitalTwinMapAssetKind("tree"), true);
    assert.equal(isDigitalTwinMapAssetKind("power_line"), true);
    assert.equal(isDigitalTwinMapAssetKind("pole"), true);
    assert.equal(isDigitalTwinMapAssetKind(null), false);
  });

  it("carries stable selected IDs and one primary ID for every map consumer", () => {
    assert.deepEqual(
      createDigitalTwinMapAssetSelectionDetail("pole", ["pole-a", "pole-b"]),
      {
        kind: "pole",
        assetIds: ["pole-a", "pole-b"],
        primaryAssetId: "pole-b",
      }
    );
    assert.deepEqual(createDigitalTwinMapAssetSelectionDetail(null, []), {
      kind: null,
      assetIds: [],
      primaryAssetId: null,
    });
  });
});
