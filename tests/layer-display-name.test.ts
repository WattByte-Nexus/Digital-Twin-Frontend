import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatLayerDisplayName } from "../apps/geolibre-desktop/src/lib/layer-display-name";

describe("formatLayerDisplayName", () => {
  it("keeps a friendly processing name and compacts its generated run id", () => {
    assert.deepEqual(
      formatLayerDisplayName("Wildfire result · run-5e144ed42e774fd19070237b7aa7c6fc"),
      {
        primary: "Wildfire result",
        runLabel: "Run 5e144e…c6fc",
      },
    );
  });

  it("leaves ordinary and short names unchanged", () => {
    assert.deepEqual(formatLayerDisplayName("Engine assets · Boulder"), {
      primary: "Engine assets · Boulder",
    });
    assert.deepEqual(formatLayerDisplayName("Background"), { primary: "Background" });
  });
});
