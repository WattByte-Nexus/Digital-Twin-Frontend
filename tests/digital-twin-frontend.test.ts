import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const appSource = readFileSync(
  new URL("../apps/geolibre-desktop/src/App.tsx", import.meta.url),
  "utf8",
);
const workspaceSource = readFileSync(
  new URL(
    "../apps/geolibre-desktop/src/product-modes/digital-twin/ui/DigitalTwinMapWorkspace.tsx",
    import.meta.url,
  ),
  "utf8",
);
const storySource = readFileSync(
  new URL(
    "../apps/geolibre-desktop/src/components/map/DigitalTwinMapWorkspace.stories.tsx",
    import.meta.url,
  ),
  "utf8",
);
const threeDTilesPluginSource = readFileSync(
  new URL(
    "../packages/plugins/src/plugins/maplibre-3d-tiles.ts",
    import.meta.url,
  ),
  "utf8",
);
const rootPackageSource = readFileSync(
  new URL("../package.json", import.meta.url),
  "utf8",
);

describe("Digital Twin frontend composition", () => {
  it("uses the Map Workspace component for the production Digital Twin route", () => {
    assert.match(appSource, /route\.mode === "digital-twin"/);
    assert.match(appSource, /<DigitalTwinMapWorkspace/);
    assert.match(appSource, /showWeather/);
  });

  it("keeps Storybook and production on the same workspace implementation", () => {
    assert.match(
      storySource,
      /import \{ DigitalTwinMapWorkspace \} from "\.\.\/\.\.\/product-modes\/digital-twin\/ui\/DigitalTwinMapWorkspace"/,
    );
    assert.doesNotMatch(storySource, /function DigitalTwinMapWorkspace/);
  });

  it("owns the weather-to-map controller in the shared production component", () => {
    assert.match(workspaceSource, /createWeatherSunSimulationController/);
    assert.match(workspaceSource, /<WeatherSettingsFloatingPanel/);
    assert.match(workspaceSource, /onValueChange=\{handleWeatherSettingsChange\}/);
  });

  it("streams the active region point cloud from the Digital Twin Engine", () => {
    assert.match(workspaceSource, /fetchActiveDigitalTwinPointCloud/);
    assert.match(workspaceSource, /new AbortController\(\)/);
    assert.match(workspaceSource, /createDigitalTwinPointCloudLayer/);
    assert.match(workspaceSource, /Point-cloud metadata loading/);
    assert.match(workspaceSource, /Retry point cloud/);
    assert.match(workspaceSource, /aria-live="polite"/);
    assert.doesNotMatch(workspaceSource, /createGoldenUsgsLidarLayer/);
    assert.doesNotMatch(workspaceSource, /\/data\/usgs-lidar\/golden-city/);
  });

  it("does not ship the obsolete frontend-bundled Golden point cloud", () => {
    const bundledDatasetPath = ["/data", "usgs-lidar", "golden-city"].join("/");
    const buildCommand = ["build", "lidar", "golden"].join(":");

    assert.equal(
      existsSync(
        new URL(
          `../apps/geolibre-desktop/public${bundledDatasetPath}`,
          import.meta.url,
        ),
      ),
      false,
    );
    assert.equal(threeDTilesPluginSource.includes(bundledDatasetPath), false);
    assert.equal(rootPackageSource.includes(buildCommand), false);
  });

  it("composites time-of-day lighting above every map canvas", () => {
    const mapIndex = workspaceSource.indexOf("<SatelliteTerrainMap");
    const lightingIndex = workspaceSource.indexOf('data-time-of-day-lighting="true"');
    const statusIndex = workspaceSource.indexOf("<DigitalTwinMapStatus");

    assert.ok(mapIndex >= 0);
    assert.ok(lightingIndex > mapIndex);
    assert.ok(statusIndex > lightingIndex);
  });
});
