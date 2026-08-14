import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const appSource = readFileSync(
  new URL("../apps/geolibre-desktop/src/App.tsx", import.meta.url),
  "utf8"
);
const workspaceSource = readFileSync(
  new URL(
    "../apps/geolibre-desktop/src/product-modes/digital-twin/ui/DigitalTwinMapWorkspace.tsx",
    import.meta.url
  ),
  "utf8"
);
const assetsViewSource = readFileSync(
  new URL(
    "../apps/geolibre-desktop/src/product-modes/digital-twin/ui/assets/AssetsView.tsx",
    import.meta.url
  ),
  "utf8"
);
const lidarSource = readFileSync(
  new URL(
    "../apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-lidar.ts",
    import.meta.url
  ),
  "utf8"
);
const mapModuleSource = readFileSync(
  new URL(
    "../apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-map-module.ts",
    import.meta.url
  ),
  "utf8"
);
const scenarioBuilderSource = readFileSync(
  new URL(
    "../apps/geolibre-desktop/src/product-modes/digital-twin/ui/views/ScenarioBuilder.tsx",
    import.meta.url
  ),
  "utf8"
);
const accessBoundarySource = readFileSync(
  new URL(
    "../apps/geolibre-desktop/src/product-modes/digital-twin/DigitalTwinAccessBoundary.tsx",
    import.meta.url
  ),
  "utf8"
);
const topbarSource = readFileSync(
  new URL(
    "../packages/ui/src/components/digital-twin-topbar.tsx",
    import.meta.url
  ),
  "utf8"
);
const storySource = readFileSync(
  new URL(
    "../apps/geolibre-desktop/src/components/map/DigitalTwinMapWorkspace.stories.tsx",
    import.meta.url
  ),
  "utf8"
);
const threeDTilesPluginSource = readFileSync(
  new URL(
    "../packages/plugins/src/plugins/maplibre-3d-tiles.ts",
    import.meta.url
  ),
  "utf8"
);
const rootPackageSource = readFileSync(
  new URL("../package.json", import.meta.url),
  "utf8"
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
      /import \{ DigitalTwinMapWorkspace \} from "\.\.\/\.\.\/product-modes\/digital-twin\/ui\/DigitalTwinMapWorkspace"/
    );
    assert.doesNotMatch(storySource, /function DigitalTwinMapWorkspace/);
  });

  it("keeps localhost access independent from Engine availability", () => {
    assert.match(accessBoundarySource, /createDevelopmentAccess/);
    assert.match(accessBoundarySource, /VITE_DIGITAL_TWIN_DEV_REGION_ID/);
    assert.doesNotMatch(
      accessBoundarySource,
      /loadPublishedDigitalTwinRegions/
    );
  });

  it("places map controls in a dedicated subtoolbar below the application header", () => {
    assert.match(
      topbarSource,
      /<\/header>\s*\{mapToolbar \? \(\s*<nav\s+aria-label="Map controls"/
    );
    assert.doesNotMatch(
      topbarSource,
      /<header[\s\S]*?\{mapToolbar \? \([\s\S]*?<\/header>/
    );
    assert.equal(topbarSource.match(/border-b border-separator/g)?.length, 2);
    assert.match(topbarSource, /<nav[\s\S]*?bg-card/);
  });

  it("shows the live map controls while the scenario builder is open", () => {
    assert.match(
      workspaceSource,
      /const showLiveMapChrome =\s*!settingsOpen &&\s*\(activeDestination === "live" \|\|\s*\(activeDestination === "scenarios" && scenarioBuilderOpen\)\)/
    );
    assert.match(workspaceSource, /mapToolbar=\{\s*showLiveMapChrome \?/);
  });

  it("keeps operational asset auto-fit from overriding the run camera", () => {
    assert.match(
      workspaceSource,
      /if \(\s*!showLiveMapChrome \|\|\s*!mapInstance \|\|[\s\S]*?mapInstance\.fitBounds\([\s\S]*?regionAssets,[\s\S]*?regionalPowerLines,[\s\S]*?showLiveMapChrome,?\s*\]\);/
    );
  });

  it("keeps the scenario map interactive behind draggable floating panels", () => {
    assert.match(
      scenarioBuilderSource,
      /<FloatingMapPanel\s+aria-label="Simulation run setup"/
    );
    assert.match(scenarioBuilderSource, /<FloatingMapPanelDragHandle/);
    assert.doesNotMatch(scenarioBuilderSource, /<WeatherSettingsFloatingPanel/);
    assert.doesNotMatch(scenarioBuilderSource, /Open weather settings/);
  });

  it("populates simulation areas from API-backed workspace regions", () => {
    assert.match(workspaceSource, /<ScenariosView[\s\S]*?regions=\{regions\}/);
    assert.match(
      scenarioBuilderSource,
      /regions\.map\(\(region\) => \([\s\S]*?<SelectMenuItem key=\{region\.id\} value=\{region\.id\}/
    );
    assert.doesNotMatch(
      scenarioBuilderSource,
      /<SelectMenuItem value="Boulder Foothills">/
    );
    assert.doesNotMatch(
      scenarioBuilderSource,
      /initialRequest\?\.scenario \?\? "Boulder Foothills/
    );
  });

  it("opens scenario weather editing beside the run setup panel", () => {
    assert.match(
      scenarioBuilderSource,
      /<Popover>\s*<FloatingMapPanel[\s\S]*?<PopoverAnchor asChild>\s*<Card/
    );
    assert.match(
      scenarioBuilderSource,
      /<FloatingMapPanel[\s\S]*?onAnchorChange=\{setRunSetupAnchor\}/
    );
    assert.match(
      scenarioBuilderSource,
      /<\/FloatingMapPanel>\s*<PopoverContent[\s\S]*?avoidCollisions=\{false\}[\s\S]*?side=\{weatherEditorSide\}[\s\S]*?sideOffset=\{12\}[\s\S]*?<WeatherSettingsPanel/
    );
  });

  it("supports scenario durations up to 100 hours", () => {
    assert.match(
      scenarioBuilderSource,
      /<Slider[\s\S]*?aria-label="Simulation duration in hours"[\s\S]*?max=\{100\}[\s\S]*?min=\{1\}/
    );
    assert.doesNotMatch(
      scenarioBuilderSource,
      /<SelectMenuItem value="8">8 hours/
    );
  });

  it("owns the weather-to-map controller in the shared production component", () => {
    assert.match(workspaceSource, /createWeatherSunSimulationController/);
    assert.match(workspaceSource, /<WeatherSettingsFloatingPanel/);
    assert.match(
      workspaceSource,
      /onValueChange=\{handleWeatherSettingsChange\}/
    );
  });

  it("streams the active region point cloud from the Digital Twin Engine", () => {
    assert.match(workspaceSource, /fetchActiveDigitalTwinPointCloud/);
    assert.match(workspaceSource, /new AbortController\(\)/);
    assert.match(workspaceSource, /createDigitalTwinMapSurfaceLayers/);
    assert.match(mapModuleSource, /createDigitalTwinPointCloudLayer/);
    assert.match(mapModuleSource, /DIGITAL_TWIN_SHARED_SURFACE/);
    assert.match(workspaceSource, /Point-cloud metadata loading/);
    assert.match(workspaceSource, /aria-live="polite"/);
    assert.doesNotMatch(workspaceSource, /createGoldenUsgsLidarLayer/);
    assert.doesNotMatch(workspaceSource, /\/data\/usgs-lidar\/golden-city/);
  });

  it("renders canonical assets through one shared surface module", () => {
    assert.match(workspaceSource, /fetchDigitalTwinAssets/);
    assert.match(mapModuleSource, /createDigitalTwinPowerLineLayers/);
    assert.match(mapModuleSource, /resolveDigitalTwinPowerPoleModelUrl/);
    assert.match(workspaceSource, /surfaceLayers=\{surfaceLayers\}/);
    assert.doesNotMatch(workspaceSource, /createDigitalTwinPowerLineLayers/);
    assert.doesNotMatch(workspaceSource, /createDigitalTwinPointCloudLayer/);
    assert.doesNotMatch(workspaceSource, /fetchDigitalTwinPowerLines/);
    assert.doesNotMatch(workspaceSource, /new MapboxOverlay/);
  });

  it("opens an API-backed asset catalog from its own workspace destination", () => {
    assert.match(workspaceSource, /activeDestination === "assets"/);
    assert.match(workspaceSource, /<AssetsView/);
    assert.match(workspaceSource, /regionalPowerLines\.map\(\(asset\) =>/);
    assert.doesNotMatch(workspaceSource, /const WORKSPACE_ASSETS/);
    assert.match(assetsViewSource, /fetchDigitalTwinAssets/);
    assert.match(assetsViewSource, /importDigitalTwinAssetCsv/);
    assert.match(assetsViewSource, /type,properties,coords/);
    assert.match(assetsViewSource, /updateDigitalTwinAsset/);
    assert.match(assetsViewSource, /deleteDigitalTwinAsset/);
    assert.match(assetsViewSource, /Add assets/);
    assert.match(assetsViewSource, /Edit properties/);
    assert.match(
      assetsViewSource,
      /<TabsTrigger value="properties">Properties<\/TabsTrigger>/
    );
    assert.match(
      assetsViewSource,
      /<TabsTrigger value="environment">Environment<\/TabsTrigger>/
    );
    assert.match(
      assetsViewSource,
      /<TabsTrigger value="lineage">Lineage<\/TabsTrigger>/
    );
    assert.match(assetsViewSource, /Latest Engine result/);
    assert.match(assetsViewSource, /physics\.weatherVersion/);
    assert.match(assetsViewSource, /physics\.maxDisplacementM/);
    assert.match(assetsViewSource, /<FilterSearch/);
    assert.match(assetsViewSource, /<Table>/);
    assert.match(assetsViewSource, /sort\("region"\)/);
    assert.match(assetsViewSource, /setRegionFilter/);
    assert.match(
      assetsViewSource,
      /aria-label=\{mode === "add" \? "Add assets"/
    );
    assert.doesNotMatch(assetsViewSource, /<Dialog/);
    assert.doesNotMatch(assetsViewSource, /Total assets/);
  });

  it("contains an asset-catalog render failure without replacing the workspace", () => {
    assert.match(
      workspaceSource,
      /import \{ SectionErrorBoundary \} from "\.\.\/\.\.\/\.\.\/components\/common\/error-boundaries"/
    );
    assert.match(
      workspaceSource,
      /activeDestination === "assets" \? \(\s*<SectionErrorBoundary[\s\S]*?label="Asset catalog"[\s\S]*?resetKeys=\{\[activeRegionId, location\]\}[\s\S]*?<AssetsView/
    );
  });

  it("wires every view toolbar action to the persistent map instance", () => {
    assert.match(
      workspaceSource,
      /const changeViewMode = \(mode: "3d" \| "plan"\)[\s\S]*?mapRef\.current\?\.easeTo/
    );
    assert.match(
      workspaceSource,
      /onResetOrientation=\{\(\) => \{[\s\S]*?bearing: 0/
    );
    assert.match(
      workspaceSource,
      /referenceOverlayVisibility=\{displaySettings\}/
    );
  });

  it("refines point clouds while keeping survey-spacing coverage bounded", () => {
    assert.match(lidarSource, /maximumScreenSpaceError:\s*1/);
    assert.match(lidarSource, /maximumMemoryUsage:\s*512/);
    assert.match(lidarSource, /memoryAdjustedScreenSpaceError:\s*false/);
    assert.match(lidarSource, /pointRadiusMetersForSpacing\(dataset\.minimumSpacingMeters\)/);
    assert.match(lidarSource, /sizeUnits:\s*"meters"/);
    assert.match(lidarSource, /softCapRadiusPixels:\s*2/);
    assert.match(lidarSource, /closeRangeMaxRadiusPixels:\s*3/);
    assert.match(lidarSource, /1\.0 - exp/);
    assert.match(workspaceSource, /missing RGB is shown in cyan/);
  });

  it("does not ship the obsolete frontend-bundled Golden point cloud", () => {
    const bundledDatasetPath = ["/data", "usgs-lidar", "golden-city"].join("/");
    const buildCommand = ["build", "lidar", "golden"].join(":");

    assert.equal(
      existsSync(
        new URL(
          `../apps/geolibre-desktop/public${bundledDatasetPath}`,
          import.meta.url
        )
      ),
      false
    );
    assert.equal(threeDTilesPluginSource.includes(bundledDatasetPath), false);
    assert.equal(rootPackageSource.includes(buildCommand), false);
  });

  it("composites time-of-day lighting above every map canvas", () => {
    const mapIndex = workspaceSource.indexOf("<SatelliteTerrainMap");
    const lightingIndex = workspaceSource.indexOf(
      'data-time-of-day-lighting="true"'
    );
    const monitoringIndex = workspaceSource.indexOf(
      "<DigitalTwinMonitoringStatus"
    );

    assert.ok(mapIndex >= 0);
    assert.ok(lightingIndex > mapIndex);
    assert.ok(monitoringIndex > lightingIndex);
  });

  it("keeps the bottom-left corner of the map clear", () => {
    assert.doesNotMatch(workspaceSource, /<DigitalTwinMapStatus/);
    assert.doesNotMatch(workspaceSource, /Retry point cloud/);
    assert.doesNotMatch(workspaceSource, /Retry power lines/);
    assert.doesNotMatch(workspaceSource, /absolute bottom-\d+ left-\d+/);
  });
});
