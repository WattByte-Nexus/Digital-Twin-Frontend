import { OPENFREEMAP_BASEMAPS } from "@geolibre/core";

export type MapThemeMode = "light" | "dark";

const OPENFREEMAP_DARK_STYLE =
  OPENFREEMAP_BASEMAPS.find((basemap) => basemap.id === "dark")?.styleUrl ??
  "https://tiles.openfreemap.org/styles/dark";

const OPENFREEMAP_LIGHT_STYLES = new Set<string>(
  OPENFREEMAP_BASEMAPS.filter((basemap) => basemap.id !== "dark").map(
    (basemap) => basemap.styleUrl,
  ),
);

/**
 * Resolves the displayed basemap for the app theme without changing the
 * project's saved basemap selection. Built-in OpenFreeMap styles have a known
 * dark equivalent; custom, offline, and planetary styles are left untouched.
 */
export function resolveThemeBasemapStyle(
  styleUrl: string,
  themeMode: MapThemeMode,
): string {
  if (themeMode === "dark" && OPENFREEMAP_LIGHT_STYLES.has(styleUrl)) {
    return OPENFREEMAP_DARK_STYLE;
  }
  return styleUrl;
}
