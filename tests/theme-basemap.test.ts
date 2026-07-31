import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OPENFREEMAP_BASEMAPS } from "@geolibre/core";
import { resolveThemeBasemapStyle } from "../packages/map/src/theme-basemap";

const DARK_STYLE = "https://tiles.openfreemap.org/styles/dark";

describe("resolveThemeBasemapStyle", () => {
  it("uses the dark OpenFreeMap style for every built-in light style", () => {
    for (const basemap of OPENFREEMAP_BASEMAPS) {
      if (basemap.id === "dark") continue;
      assert.equal(resolveThemeBasemapStyle(basemap.styleUrl, "dark"), DARK_STYLE);
    }
  });

  it("restores the selected style in light mode", () => {
    const liberty = "https://tiles.openfreemap.org/styles/liberty";
    assert.equal(resolveThemeBasemapStyle(liberty, "light"), liberty);
  });

  it("keeps an explicitly selected dark style in either theme", () => {
    assert.equal(resolveThemeBasemapStyle(DARK_STYLE, "dark"), DARK_STYLE);
    assert.equal(resolveThemeBasemapStyle(DARK_STYLE, "light"), DARK_STYLE);
  });

  it("does not rewrite custom, offline, blank, or planetary basemaps", () => {
    for (const style of [
      "https://example.com/custom-style.json",
      "geolibre://offline-basemap/local/1",
      "geolibre://basemap/mars-viking",
      "",
    ]) {
      assert.equal(resolveThemeBasemapStyle(style, "dark"), style);
    }
  });
});
