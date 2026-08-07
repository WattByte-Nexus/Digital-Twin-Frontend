import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DIGITAL_TWIN_MAP_ASSET_SELECTION_EVENT as PLUGIN_SELECTION_EVENT,
  selectableMapAssetKind,
} from "../apps/geolibre-desktop/public/plugins/digital-twin-demo/dist/index.js";
import {
  DIGITAL_TWIN_MAP_ASSET_SELECTION_EVENT,
  isDigitalTwinMapAssetKind,
} from "../apps/geolibre-desktop/src/product-modes/digital-twin/ui/map-asset-selection";

describe("digital twin map asset selection", () => {
  it("shares one event contract between the map plugin and live workspace", () => {
    assert.equal(PLUGIN_SELECTION_EVENT, DIGITAL_TWIN_MAP_ASSET_SELECTION_EVENT);
  });

  it("accepts only trees, power lines, and poles for the risk callout", () => {
    assert.equal(selectableMapAssetKind({ properties: { kind: "tree" } }), "tree");
    assert.equal(selectableMapAssetKind({ properties: { kind: "power_line" } }), "power_line");
    assert.equal(
      selectableMapAssetKind({ properties: { kind: "operational_power_line" } }),
      "power_line",
    );
    assert.equal(selectableMapAssetKind({ properties: { kind: "pole" } }), "pole");
    assert.equal(selectableMapAssetKind({ properties: { kind: "ignition" } }), null);
    assert.equal(selectableMapAssetKind(null), null);

    assert.equal(isDigitalTwinMapAssetKind("tree"), true);
    assert.equal(isDigitalTwinMapAssetKind("power_line"), true);
    assert.equal(isDigitalTwinMapAssetKind("pole"), true);
    assert.equal(isDigitalTwinMapAssetKind(null), false);
  });
});
