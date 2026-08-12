import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspaceSource = readFileSync(
  new URL(
    "../apps/geolibre-desktop/src/product-modes/digital-twin/ui/DigitalTwinMapWorkspace.tsx",
    import.meta.url,
  ),
  "utf8",
);
test("the selected region can be fitted from both map and command-palette controls", () => {
  assert.match(workspaceSource, /const zoomToSelectedRegion = \(\) => \{/);
  assert.match(
    workspaceSource,
    /<Button[\s\S]*?size="icon"[\s\S]*?aria-label="Zoom to selected region"[\s\S]*?onClick=\{zoomToSelectedRegion\}/,
  );
  assert.match(
    workspaceSource,
    /<CommandItem[\s\S]*?onSelect=\{\(\) => runCommand\(zoomToSelectedRegion\)\}[\s\S]*?Zoom to selected region/,
  );
});
