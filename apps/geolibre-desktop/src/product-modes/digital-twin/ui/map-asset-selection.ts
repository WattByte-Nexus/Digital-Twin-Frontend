export const DIGITAL_TWIN_MAP_ASSET_SELECTION_EVENT =
  "geolibre:digital-twin-map-asset-selection";

export type DigitalTwinMapAssetKind = "tree" | "power_line" | "pole";

export interface DigitalTwinMapAssetSelectionDetail {
  kind: DigitalTwinMapAssetKind | null;
  assetIds: readonly string[];
  primaryAssetId: string | null;
}

export function createDigitalTwinMapAssetSelectionDetail(
  kind: DigitalTwinMapAssetKind | null,
  assetIds: readonly string[]
): DigitalTwinMapAssetSelectionDetail {
  return {
    kind,
    assetIds: [...assetIds],
    primaryAssetId: assetIds.at(-1) ?? null,
  };
}

export function isDigitalTwinMapAssetKind(
  value: unknown
): value is DigitalTwinMapAssetKind {
  return value === "tree" || value === "power_line" || value === "pole";
}
