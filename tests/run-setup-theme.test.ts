import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const scenarioBuilderSource = readFileSync(
  new URL(
    "../apps/geolibre-desktop/src/product-modes/digital-twin/ui/views/ScenarioBuilder.tsx",
    import.meta.url
  ),
  "utf8"
);
const weatherSettingsSource = readFileSync(
  new URL(
    "../packages/ui/src/components/weather/weather-settings-panel.tsx",
    import.meta.url
  ),
  "utf8"
);

describe("Run setup theme", () => {
  it("uses the same explicit surface theme as the Weather panel", () => {
    assert.match(
      scenarioBuilderSource,
      /<Card\s+className=\{`\$\{surfaceThemeClassName\(\s*theme\s*\)\} relative/
    );
    assert.match(
      scenarioBuilderSource,
      /<SelectMenuContent\s+className=\{surfaceThemeClassName\(theme\)\}\s*>/
    );
    assert.match(
      weatherSettingsSource,
      /<SelectContent className=\{surfaceThemeClassName\(theme\)\}>/
    );
  });

  it("matches the Weather panel height without painting its shadow over Run setup", () => {
    assert.match(
      scenarioBuilderSource,
      /defaultSize=\{\{ width: 416, height: 831 \}\}/
    );
    assert.match(
      scenarioBuilderSource,
      /<PopoverContent[\s\S]*?className=\{`\$\{surfaceThemeClassName\([\s\S]*?\)\} z-10/
    );
  });

  it("keeps the run action anchored below the scrollable setup fields", () => {
    assert.match(
      scenarioBuilderSource,
      /aria-label="Configuration summary"[\s\S]*?<\/section>\s*<CardFooter className="mt-auto flex-row/
    );
  });

  it("uses a focused five-step popup instead of one long setup form", () => {
    assert.match(
      scenarioBuilderSource,
      /type SetupStep = "area" \| "ignitions" \| "weather" \| "model" \| "review"/
    );
    assert.match(scenarioBuilderSource, /aria-label="Run setup steps"/);
    assert.match(scenarioBuilderSource, /activeStep === "ignitions"/);
    assert.match(scenarioBuilderSource, /Back to \$\{previousStep\.label\}/);
    assert.match(scenarioBuilderSource, /Continue to \$\{nextStep\.label\}/);
    assert.match(scenarioBuilderSource, /<ArrowLeft aria-hidden="true" \/>/);
    assert.match(scenarioBuilderSource, /<ArrowRight aria-hidden="true" \/>/);
    assert.match(scenarioBuilderSource, /aria-label="Configuration summary"/);
    assert.match(
      scenarioBuilderSource,
      /<\/ScrollArea>\s*<section\s+aria-label="Configuration summary"/
    );
    assert.doesNotMatch(scenarioBuilderSource, /aria-label="Run summary"/);
  });

  it("keeps ignition editing functional inside the focused step", () => {
    assert.match(scenarioBuilderSource, /Click the map to place points/);
    assert.match(scenarioBuilderSource, /Remove ignition source/);
    assert.match(scenarioBuilderSource, /<Redo2 aria-hidden="true" \/> Redo/);
    assert.match(scenarioBuilderSource, /<RotateCcw aria-hidden="true" \/> Clear all/);
  });

  it("gives each setup step real run information and settings", () => {
    assert.match(scenarioBuilderSource, /Selected region/);
    assert.match(scenarioBuilderSource, /Valid date/);
    assert.match(scenarioBuilderSource, /Weather observations/);
    assert.match(scenarioBuilderSource, /Fuel moisture/);
    assert.match(scenarioBuilderSource, /Ember spotting/);
    assert.match(scenarioBuilderSource, /Crown fire/);
    assert.match(scenarioBuilderSource, /Grid resolution/);
    assert.match(scenarioBuilderSource, /Output interval/);
    assert.doesNotMatch(scenarioBuilderSource, /Common durations/);
    assert.doesNotMatch(scenarioBuilderSource, /Digital Twin API/);
    assert.match(scenarioBuilderSource, /Scenario and area/);
    assert.match(scenarioBuilderSource, /Weather inputs/);
    assert.match(scenarioBuilderSource, /Model runtime/);
  });

  it("keeps the fixed overview visually separate from step content", () => {
    assert.match(
      scenarioBuilderSource,
      /aria-label="Configuration summary"\s+className="grid grid-cols-4 divide-x border-t bg-background"/
    );
    assert.doesNotMatch(scenarioBuilderSource, /aria-label="Run summary"/);
  });

  it("uses flat white surfaces throughout every setup step", () => {
    assert.doesNotMatch(scenarioBuilderSource, /bg-surface-subtle/);
    assert.doesNotMatch(scenarioBuilderSource, /bg-card/);
    assert.match(scenarioBuilderSource, /<header className="[^"]*bg-background/);
    assert.match(
      scenarioBuilderSource,
      /divide-y overflow-hidden rounded-md border border-input/,
    );
    assert.match(
      scenarioBuilderSource,
      /grid grid-cols-2 overflow-hidden rounded-md border border-input/,
    );
  });
});
