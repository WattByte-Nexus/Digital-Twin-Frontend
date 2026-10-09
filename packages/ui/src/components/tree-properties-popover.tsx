import { TreePine } from "lucide-react";
import {
  AssetPropertiesPopover,
  type AssetPropertiesPopoverPositionProps,
  PropertyRow,
  SectionHeading,
} from "./asset-properties-popover";
import { ScrollArea } from "./scroll-area";

export interface TreePropertiesAsset {
  assetId: string;
  regionId: string;
  location: { lat: number; lon: number };
  species: string | null;
  heightM: number | null;
  canopyRadiusM: number | null;
  sourceRef: string | null;
}

export interface TreePropertiesPopoverProps
  extends AssetPropertiesPopoverPositionProps {
  asset: TreePropertiesAsset;
}

function meters(value: number | null): string {
  return value === null ? "Not available" : `${value.toFixed(2)} m`;
}

export function TreePropertiesPopover({
  asset,
  ...props
}: TreePropertiesPopoverProps) {
  return (
    <AssetPropertiesPopover
      {...props}
      assetName={asset.assetId}
      assetKind="Tree"
      icon={TreePine}
      description="Tree properties"
    >
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 px-4 py-4">
          <section aria-labelledby="tree-identity-heading">
            <SectionHeading id="tree-identity-heading">Identity</SectionHeading>
            <dl className="mt-1 divide-y">
              <PropertyRow label="Asset ID" value={asset.assetId} />
              <PropertyRow label="Region" value={asset.regionId} />
              <PropertyRow
                label="Species"
                value={asset.species ?? "Not available"}
              />
            </dl>
          </section>
          <section aria-labelledby="tree-dimensions-heading">
            <SectionHeading id="tree-dimensions-heading">
              Dimensions
            </SectionHeading>
            <dl className="mt-1 divide-y">
              <PropertyRow label="Height" value={meters(asset.heightM)} />
              <PropertyRow
                label="Canopy radius"
                value={meters(asset.canopyRadiusM)}
              />
            </dl>
          </section>
          <section aria-labelledby="tree-position-heading">
            <SectionHeading id="tree-position-heading">Position</SectionHeading>
            <dl className="mt-1 divide-y">
              <PropertyRow
                label="Latitude"
                value={`${asset.location.lat.toFixed(6)}°`}
              />
              <PropertyRow
                label="Longitude"
                value={`${asset.location.lon.toFixed(6)}°`}
              />
            </dl>
          </section>
          <section aria-labelledby="tree-source-heading">
            <SectionHeading id="tree-source-heading">Source</SectionHeading>
            <dl className="mt-1 divide-y">
              <PropertyRow
                label="Source reference"
                value={asset.sourceRef ?? "Not available"}
              />
            </dl>
          </section>
        </div>
      </ScrollArea>
    </AssetPropertiesPopover>
  );
}
