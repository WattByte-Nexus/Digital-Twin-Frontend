export const DIGITAL_TWIN_MAP_ASSET_SELECTION_EVENT =
  "geolibre:digital-twin-map-asset-selection";

export type DigitalTwinMapAssetKind = "tree" | "power_line" | "pole";

export function isDigitalTwinMapAssetKind(
  value: unknown
): value is DigitalTwinMapAssetKind {
  return value === "tree" || value === "power_line" || value === "pole";
}
