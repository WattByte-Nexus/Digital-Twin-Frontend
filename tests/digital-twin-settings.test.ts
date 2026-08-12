import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const settingsViewSource = readFileSync(
  new URL(
    "../apps/geolibre-desktop/src/product-modes/digital-twin/ui/views/SettingsView.tsx",
    import.meta.url,
  ),
  "utf8",
);
const settingsPagesSource = readFileSync(
  new URL(
    "../apps/geolibre-desktop/src/product-modes/digital-twin/ui/views/settings-view-pages.tsx",
    import.meta.url,
  ),
  "utf8",
);
const settingsComponentsSource = readFileSync(
  new URL(
    "../apps/geolibre-desktop/src/product-modes/digital-twin/ui/views/settings-view-components.tsx",
    import.meta.url,
  ),
  "utf8",
);
const uiIndexSource = readFileSync(
  new URL("../packages/ui/src/index.ts", import.meta.url),
  "utf8",
);
const activeWorkspaceSource = readFileSync(
  new URL(
    "../apps/geolibre-desktop/src/product-modes/digital-twin/ui/DigitalTwinMapWorkspace.tsx",
    import.meta.url,
  ),
  "utf8",
);
const digitalTwinSidebarSource = readFileSync(
  new URL("../packages/ui/src/components/digital-twin-sidebar.tsx", import.meta.url),
  "utf8",
);

describe("Digital Twin settings", () => {
  it("exposes the initial settings slices through one navigable page", () => {
    for (const section of [
      "account-preferences",
      "workspace-map",
      "workspace-simulation",
      "operations-alert-routing",
      "organization-members",
      "engine-status",
    ]) {
      assert.match(settingsViewSource, new RegExp(`id: "${section}"`));
      assert.match(settingsViewSource, new RegExp(`activeSection !== "${section}"`));
    }
  });

  it("builds settings controls from shared shadcn primitives", () => {
    assert.match(settingsPagesSource, /Checkbox,/);
    assert.match(settingsPagesSource, /DropdownMenu,/);
    assert.match(settingsPagesSource, /Table,/);
    assert.match(settingsComponentsSource, /Card,/);
    assert.match(settingsComponentsSource, /SelectMenu,/);
    assert.match(settingsComponentsSource, /Switch,/);
    assert.doesNotMatch(settingsPagesSource, /<(?:button|input|select|table)\b/);
    assert.doesNotMatch(settingsComponentsSource, /<(?:button|input|select|table)\b/);
  });

  it("uses the product sidebar rhythm and flat settings sections", () => {
    assert.match(settingsViewSource, /SidebarMenuButton/);
    assert.match(settingsViewSource, /className="h-10 gap-3 px-3 text-sm"/);
    assert.match(settingsComponentsSource, /rounded-none border-0 border-b/);
    assert.doesNotMatch(settingsComponentsSource, /surface="glass"/);
    assert.doesNotMatch(settingsComponentsSource, /UnsavedPreviewBar/);
    assert.doesNotMatch(settingsPagesSource, /Using preview defaults/);
  });

  it("keeps run inputs visible while engine startup settings remain managed", () => {
    assert.match(settingsPagesSource, /Presets are starting values, not hidden engine configuration/);
    assert.match(settingsPagesSource, /Region, ignition, time, and timestep remain visible/);
    assert.match(settingsPagesSource, /Requires restart/);
    assert.match(settingsPagesSource, /scope="Engine-managed"/);
  });

  it("exports registry-installed form primitives from the shared UI package", () => {
    assert.match(uiIndexSource, /export \{ Checkbox \} from "\.\/components\/checkbox"/);
    assert.match(uiIndexSource, /export \{ Switch \} from "\.\/components\/switch"/);
  });

  it("opens settings inside the active product shell instead of administration", () => {
    assert.match(activeWorkspaceSource, /onOpenSettings=\{\(\) => setSettingsOpen\(true\)\}/);
    assert.match(activeWorkspaceSource, /settingsActive=\{settingsOpen\}/);
    assert.match(activeWorkspaceSource, /settingsOpen \? \(/);
    assert.match(activeWorkspaceSource, /accountName=\{operator\.name\}/);
    assert.match(activeWorkspaceSource, /organizationName=\{organizationName\}/);
    assert.match(digitalTwinSidebarSource, /settingsActive\?: boolean/);
    assert.match(
      digitalTwinSidebarSource,
      /id === "settings" && settingsActive \? "page" : undefined/,
    );
  });
});
