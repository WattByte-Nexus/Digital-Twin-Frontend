import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  beginDigitalTwinPoleDrag,
  selectDigitalTwinPoleIds,
  translateDigitalTwinPoleDrag,
} from "../apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-pole-interaction";

const poles = [
  {
    id: "pole-a",
    assetIds: ["span-a"],
    position: [-105, 40, 1_642] as [number, number, number],
  },
  {
    id: "pole-b",
    assetIds: ["span-a", "span-b"],
    position: [-104.999, 40.001, 1_643] as [number, number, number],
  },
];

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

  it("drags the full selection when the grabbed pole is already selected", () => {
    const result = beginDigitalTwinPoleDrag({
      poles,
      selectedPoleIds: ["pole-a", "pole-b"],
      grabbedPoleId: "pole-a",
      selectionMode: "replace",
      pointerPosition: [-105, 40],
    });

    assert.deepEqual(result.selectedPoleIds, ["pole-a", "pole-b"]);
    assert.deepEqual([...result.drag.originPositions], [
      ["pole-a", [-105, 40, 1_642]],
      ["pole-b", [-104.999, 40.001, 1_643]],
    ]);
  });

  it("selects an unselected pole before dragging it", () => {
    const result = beginDigitalTwinPoleDrag({
      poles,
      selectedPoleIds: ["pole-a"],
      grabbedPoleId: "pole-b",
      selectionMode: "replace",
      pointerPosition: [-104.999, 40.001],
    });

    assert.deepEqual(result.selectedPoleIds, ["pole-b"]);
    assert.deepEqual([...result.drag.originPositions.keys()], ["pole-b"]);
  });

  it("translates a group in a local tangent frame and replants every pole", () => {
    const { drag } = beginDigitalTwinPoleDrag({
      poles,
      selectedPoleIds: ["pole-a", "pole-b"],
      grabbedPoleId: "pole-a",
      selectionMode: "replace",
      pointerPosition: [-105, 40],
    });

    const preview = translateDigitalTwinPoleDrag(
      drag,
      [-104.999, 40.001],
      (_longitude, latitude) => 1_600 + latitude
    );

    const poleA = preview.get("pole-a");
    const poleB = preview.get("pole-b");
    assert.ok(poleA);
    assert.ok(poleB);
    assert.ok(Math.abs(poleA[0] - -104.999) < 1e-8);
    assert.ok(Math.abs(poleA[1] - 40.001) < 1e-8);
    assert.ok(Math.abs(poleB[0] - -104.998) < 1e-8);
    assert.ok(Math.abs(poleB[1] - 40.002) < 1e-8);
    assert.equal(poleA[2], 1_640.001);
    assert.equal(poleB[2], 1_640.002);
  });
});
