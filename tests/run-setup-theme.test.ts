import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("../apps/geolibre-desktop/src/product-modes/digital-twin/ui/views/ScenarioBuilder.tsx", import.meta.url), "utf8");

describe("Native run setup design and accepted inputs", () => {
  it("keeps the explicit surface theme for its floating card and portalled controls", () => {
    assert.match(source, /<Card className=\{`\$\{surfaceThemeClassName\(theme\)\} relative/);
    assert.match(source, /const portalClass = `\$\{surfaceThemeClassName\(theme\)\} surface-glass-overlay min-w-/);
    assert.match(source, /<SelectMenuContent className=\{portalClass\}/);
    assert.match(source, /<DialogContent className=\{`\$\{surfaceThemeClassName\(theme\)\} surface-glass-overlay`\}/);
  });
  it("preserves the native draggable panel and anchored action area", () => {
    assert.match(source, /defaultSize=\{\{ width: 416, height: 831 \}\}/);
    assert.match(source, /<FloatingMapPanelDragHandle/);
    assert.match(source, /<\/ScrollArea>\s*<section aria-label="Configuration summary"/);
    assert.match(source, /<\/section>\s*<CardFooter className="mt-auto flex-row/);
    assert.match(source, /<header className="[^"]*bg-background/);
  });
  it("keeps five focused steps with shadcn keyboard navigation", () => {
    assert.match(source, /const SETUP_STEPS = \["area", "ignitions", "weather", "time", "review"\]/);
    assert.match(source, /<Tabs value=\{activeStep\}/);
    assert.match(source, /<TabsTrigger/);
    assert.match(source, /activeStep === "ignitions"/);
    assert.match(source, /<ArrowLeft aria-hidden="true" \/>/);
    assert.match(source, /<ArrowRight aria-hidden="true" \/>/);
  });
  it("preserves real ignition placement, drag, removal and undo/redo", () => {
    assert.match(source, /map.on\("click", handleMapClick\)/);
    assert.match(source, /marker.on\("dragend"/);
    assert.match(source, /Remove ignition source/);
    assert.match(source, /<Undo2 aria-hidden="true" \/> Undo/);
    assert.match(source, /<Redo2 aria-hidden="true" \/> Redo/);
    assert.match(source, /<RotateCcw aria-hidden="true" \/> Clear all/);
    assert.match(source, /points.length >= maximumPoints/);
  });
  it("exposes accepted time/weather intent and removes unsupported numerical controls", () => {
    assert.match(source, /Base weather version/);
    assert.match(source, /Bounded UTC interval/);
    assert.match(source, /run-timestep/);
    assert.match(source, /fetchDigitalTwinRegionReadiness/);
    assert.doesNotMatch(source, /fuel-moisture|ember-spotting|crown-fire|grid-resolution|output-interval/);
    assert.doesNotMatch(source, /Draft autosaved/);
    assert.match(source, /Save scenario without running/);
    assert.match(source, /Discard local changes/);
  });
});
