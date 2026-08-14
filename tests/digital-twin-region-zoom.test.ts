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
  assert.match(
    workspaceSource,
    /const FLOATING_MAP_ACTION_BUTTON_CLASS_NAME =\s*"size-10 border border-border/,
  );
  assert.match(
    workspaceSource,
    /className=\{`\$\{FLOATING_MAP_ACTION_BUTTON_CLASS_NAME\} border-0 disabled:opacity-100`\}[\s\S]*?aria-label="Zoom to selected region"/,
  );
  assert.match(
    workspaceSource,
    /className=\{FLOATING_MAP_ACTION_BUTTON_CLASS_NAME\}[\s\S]*?aria-label="Open weather settings"/,
  );
  assert.match(workspaceSource, /const zoomToSelectedRegion = \(\) => \{/);
  assert.match(
    workspaceSource,
    /const selectedRegionBounds = activeCatalogRegion\?\.bounds;/,
  );
  assert.match(
    workspaceSource,
    /const canZoomToSelectedRegion =\s*mapInstance !== null && selectedRegionBounds !== undefined;/,
  );
  assert.match(
    workspaceSource,
    /\[selectedRegionBounds\.west, selectedRegionBounds\.south\],[\s\S]*?\[selectedRegionBounds\.east, selectedRegionBounds\.north\]/,
  );
  assert.match(
    workspaceSource,
    /<Button[\s\S]*?size="icon"[\s\S]*?aria-label="Zoom to selected region"[\s\S]*?onClick=\{zoomToSelectedRegion\}/,
  );
  assert.match(
    workspaceSource,
    /<Maximize[\s\S]*?className="size-4 text-foreground"[\s\S]*?strokeWidth=\{2\.5\}/,
  );
  assert.match(
    workspaceSource,
    /<CommandItem[\s\S]*?onSelect=\{\(\) => runCommand\(zoomToSelectedRegion\)\}[\s\S]*?Zoom to selected region/,
  );
});

test("the map exposes matching zoom controls in its top-left corner", () => {
  assert.match(
    workspaceSource,
    /className="absolute left-4 top-4 z-10 flex flex-col gap-2"/,
  );
  assert.match(
    workspaceSource,
    /className=\{FLOATING_MAP_ACTION_BUTTON_CLASS_NAME\}[\s\S]*?aria-label="Zoom in"[\s\S]*?onClick=\{zoomIn\}/,
  );
  assert.match(
    workspaceSource,
    /className=\{FLOATING_MAP_ACTION_BUTTON_CLASS_NAME\}[\s\S]*?aria-label="Zoom out"[\s\S]*?onClick=\{zoomOut\}/,
  );
  assert.match(workspaceSource, /const zoomIn = \(\) => mapRef\.current\?\.zoomIn\(\);/);
  assert.match(workspaceSource, /const zoomOut = \(\) => mapRef\.current\?\.zoomOut\(\);/);
});
