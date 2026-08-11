import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { focusMapOnIgnitions } from "../apps/geolibre-desktop/src/product-modes/digital-twin/ui/run-map-focus.ts";

const runDetailSource = readFileSync(
  new URL(
    "../apps/geolibre-desktop/src/product-modes/digital-twin/ui/views/RunDetailView.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("the run camera focuses before the basemap style finishes loading", () => {
  const focusCall = runDetailSource.indexOf("focusMapOnIgnitions(map");
  const styleGate = runDetailSource.indexOf("if (!map.isStyleLoaded())");

  assert.ok(focusCall >= 0);
  assert.ok(styleGate > focusCall);
});

test("a single ignition is centered at a useful inspection zoom", () => {
  const calls: unknown[] = [];
  const focused = focusMapOnIgnitions(
    {
      fitBounds: (...args) => calls.push(["fitBounds", ...args]),
      jumpTo: (...args) => calls.push(["jumpTo", ...args]),
    },
    [{ latitude: 40.02, longitude: -105.27 }],
  );

  assert.equal(focused, true);
  assert.deepEqual(calls, [["jumpTo", { center: [-105.27, 40.02], zoom: 14 }]]);
});

test("multiple ignitions are fitted together with map-safe padding", () => {
  const calls: unknown[] = [];
  const focused = focusMapOnIgnitions(
    {
      fitBounds: (...args) => calls.push(["fitBounds", ...args]),
      jumpTo: (...args) => calls.push(["jumpTo", ...args]),
    },
    [
      { latitude: 40.02, longitude: -105.27 },
      { latitude: 40.08, longitude: -105.18 },
    ],
  );

  assert.equal(focused, true);
  assert.deepEqual(calls, [
    [
      "fitBounds",
      [
        [-105.27, 40.02],
        [-105.18, 40.08],
      ],
      { duration: 0, maxZoom: 14, padding: 96 },
    ],
  ]);
});

test("a run without ignitions leaves the current camera unchanged", () => {
  const calls: unknown[] = [];
  const focused = focusMapOnIgnitions(
    {
      fitBounds: (...args) => calls.push(["fitBounds", ...args]),
      jumpTo: (...args) => calls.push(["jumpTo", ...args]),
    },
    [],
  );

  assert.equal(focused, false);
  assert.deepEqual(calls, []);
});
