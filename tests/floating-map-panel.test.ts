import assert from "node:assert/strict";
import test from "node:test";
import {
  anchorForPanelPosition,
  constrainPanelGeometry,
  positionForPanelAnchor,
  snapPanelToNearestEdge,
} from "../packages/ui/src/components/floating-map-panel-geometry";

test("floating map panels snap to the nearest map edge", () => {
  assert.deepEqual(
    snapPanelToNearestEdge(
      { x: 610, y: 200 },
      { width: 360, height: 500 },
      { width: 1000, height: 800 },
      16,
    ),
    { x: 624, y: 200 },
  );
});

test("a launcher and panel share the same snapped anchor", () => {
  const bounds = { width: 1000, height: 800 };
  const anchor = anchorForPanelPosition(
    { x: 16, y: 16 },
    { width: 40, height: 40 },
    bounds,
    16,
  );

  assert.deepEqual(anchor, { edge: "left", offset: 0 });
  assert.deepEqual(
    positionForPanelAnchor(anchor, { width: 380, height: 500 }, bounds, 16),
    { x: 16, y: 16 },
  );
});

test("floating map panels remain visible when their map container shrinks", () => {
  assert.deepEqual(
    constrainPanelGeometry(
      {
        position: { x: 600, y: 300 },
        size: { width: 380, height: 700 },
      },
      { width: 700, height: 520 },
      { width: 320, height: 360 },
      16,
    ),
    {
      position: { x: 304, y: 16 },
      size: { width: 380, height: 488 },
    },
  );
});
