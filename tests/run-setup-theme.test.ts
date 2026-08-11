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
      /<SelectMenuContent className=\{surfaceThemeClassName\(theme\)\}>/
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
});
