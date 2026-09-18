import type { Layer } from "@deck.gl/core";
import {
  SolidPolygonLayer,
  type SolidPolygonLayerProps,
} from "@deck.gl/layers";
import { SimpleMeshLayer } from "@deck.gl/mesh-layers";
import { digitalTwinSurfaceCoordinateKey } from "@geolibre/map/digital-twin-surface-state";
import { SphereGeometry } from "@luma.gl/engine";
import type { DigitalTwinTreeAsset } from "../../lib/digital-twin-assets";

const DEFAULT_TREE_HEIGHT_METERS = 8;
const DEFAULT_CANOPY_RADIUS_METERS = 2.5;
const TRUNK_HEIGHT_FRACTION = 0.55;
const CANOPY_CENTER_FRACTION = 0.7;
const CANOPY_VERTICAL_RADIUS_FRACTION = 0.3;
const TREE_CROWN_MESH = new SphereGeometry({
  id: "digital-twin-tree-crown",
  radius: 1,
  nlat: 6,
  nlong: 10,
});

export interface DigitalTwinTreeSurfaceOptions {
  surfaceElevations?: ReadonlyMap<string, number>;
  interaction?: DigitalTwinTreeInteraction;
}

export interface DigitalTwinTreeInteraction {
  selectedTreeId: string | null;
  onSelect: (tree: DigitalTwinTreeAsset, screen: [number, number]) => void;
}

function treeHeight(tree: DigitalTwinTreeAsset): number {
  return tree.heightM ?? DEFAULT_TREE_HEIGHT_METERS;
}

function canopyRadius(tree: DigitalTwinTreeAsset): number {
  return tree.canopyRadiusM ?? DEFAULT_CANOPY_RADIUS_METERS;
}

function surfaceElevation(
  tree: DigitalTwinTreeAsset,
  elevations: ReadonlyMap<string, number> | undefined
): number {
  return (
    elevations?.get(
      digitalTwinSurfaceCoordinateKey(tree.location.lon, tree.location.lat)
    ) ?? 0
  );
}

function circlePolygon(
  tree: DigitalTwinTreeAsset,
  radiusMeters: number,
  elevationMeters: number,
  segments: number
): [number, number, number][] {
  const metersPerLongitude = Math.max(
    Math.abs(111_320 * Math.cos((tree.location.lat * Math.PI) / 180)),
    1
  );
  return Array.from({ length: segments }, (_, index) => {
    const angle = (index / segments) * Math.PI * 2;
    return [
      tree.location.lon + (Math.cos(angle) * radiusMeters) / metersPerLongitude,
      tree.location.lat + (Math.sin(angle) * radiusMeters) / 110_540,
      elevationMeters,
    ];
  });
}

/** Render all trees as opaque, pickable models rooted on the displayed terrain. */
export function createDigitalTwinTreeLayers(
  trees: readonly DigitalTwinTreeAsset[],
  { surfaceElevations, interaction }: DigitalTwinTreeSurfaceOptions = {}
): Layer[] {
  const onClick: SolidPolygonLayerProps<DigitalTwinTreeAsset>["onClick"] = (
    info
  ) => {
    if (!info.object || !interaction) return false;
    interaction.onSelect(info.object, [info.x, info.y]);
    return true;
  };
  const layers: Layer[] = [
    new SolidPolygonLayer<DigitalTwinTreeAsset>({
      id: "digital-twin-tree-trunks",
      data: trees,
      positionFormat: "XYZ",
      getPolygon: (tree) =>
        circlePolygon(
          tree,
          Math.min(Math.max(canopyRadius(tree) * 0.12, 0.12), 0.45),
          surfaceElevation(tree, surfaceElevations),
          10
        ),
      getElevation: (tree) => treeHeight(tree) * TRUNK_HEIGHT_FRACTION,
      updateTriggers: { getPolygon: surfaceElevations },
      getFillColor: [108, 78, 52, 255],
      extruded: true,
      pickable: true,
      autoHighlight: true,
      onClick,
    }),
    new SimpleMeshLayer<DigitalTwinTreeAsset>({
      id: "digital-twin-tree-crowns",
      data: trees,
      mesh: TREE_CROWN_MESH,
      sizeScale: 1,
      getPosition: (tree) => [
        tree.location.lon,
        tree.location.lat,
        surfaceElevation(tree, surfaceElevations) +
          treeHeight(tree) * CANOPY_CENTER_FRACTION,
      ],
      getScale: (tree) => [
        canopyRadius(tree),
        canopyRadius(tree),
        treeHeight(tree) * CANOPY_VERTICAL_RADIUS_FRACTION,
      ],
      updateTriggers: {
        getPosition: surfaceElevations,
        getColor: interaction?.selectedTreeId,
      },
      getColor: (tree) =>
        tree.assetId === interaction?.selectedTreeId
          ? [245, 158, 11, 255]
          : [38, 132, 78, 255],
      material: true,
      pickable: true,
      autoHighlight: true,
      onClick,
    }),
  ];
  return layers;
}
