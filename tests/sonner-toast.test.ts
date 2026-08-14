import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const toasterSource = readFileSync(
  new URL("../packages/ui/src/components/sonner.tsx", import.meta.url),
  "utf8",
);
const mainSource = readFileSync(
  new URL("../apps/geolibre-desktop/src/main.tsx", import.meta.url),
  "utf8",
);

test("shared Sonner toasts use rendered theme colors and the compact stack", () => {
  assert.match(toasterSource, /"--normal-bg": "hsl\(var\(--popover\)\)"/);
  assert.match(toasterSource, /"--normal-text": "hsl\(var\(--popover-foreground\)\)"/);
  assert.match(toasterSource, /"--normal-border": "hsl\(var\(--border\)\)"/);
  assert.match(mainSource, /<Toaster gap=\{16\} offset=\{24\}/);
  assert.match(mainSource, /visibleToasts=\{3\}/);
  assert.doesNotMatch(mainSource, /<Toaster[^>]*closeButton/);
});
