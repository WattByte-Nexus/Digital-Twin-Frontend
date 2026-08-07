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

const LIGHT_PRESENTATION_STYLES = new Set<string>([
  ...OPENFREEMAP_LIGHT_STYLES,
  "geolibre://basemap/earth-usgs-imagery",
]);

/**
 * Resolves the displayed basemap for the app theme without changing the
 * project's saved basemap selection. Built-in light presentation styles have
 * a known dark equivalent; custom, offline, and other planetary styles are
 * left untouched.
 */
export function resolveThemeBasemapStyle(
  styleUrl: string,
  themeMode: MapThemeMode,
): string {
  if (themeMode === "dark" && LIGHT_PRESENTATION_STYLES.has(styleUrl)) {
    return OPENFREEMAP_DARK_STYLE;
  }
  return styleUrl;
}
