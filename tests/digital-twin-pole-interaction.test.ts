import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  selectDigitalTwinPoleIds,
} from "../apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-pole-interaction";

describe("Digital Twin pole interaction", () => {
  it("replaces selection on plain click and adds without duplicates with a modifier", () => {
    assert.deepEqual(selectDigitalTwinPoleIds(["pole-a"], "pole-b", "replace"), [
      "pole-b",
    ]);
    assert.deepEqual(selectDigitalTwinPoleIds(["pole-a"], "pole-b", "add"), [
      "pole-a",
      "pole-b",
    ]);
    assert.deepEqual(selectDigitalTwinPoleIds(["pole-a"], "pole-a", "add"), [
      "pole-a",
    ]);
  });

});
