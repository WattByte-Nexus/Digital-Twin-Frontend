import { SolidPolygonLayer } from "@deck.gl/layers";
import { digitalTwinSurfaceCoordinateKey } from "@geolibre/map/digital-twin-surface-state";
import type { DigitalTwinTreeAsset } from "../../lib/digital-twin-assets";

const DEFAULT_TREE_HEIGHT_METERS = 8;
const DEFAULT_CANOPY_RADIUS_METERS = 2.5;
const TRUNK_HEIGHT_FRACTION = 0.55;
const CANOPY_BASE_FRACTION = 0.35;
const CANOPY_HEIGHT_FRACTION = 0.65;

export interface DigitalTwinTreeSurfaceOptions {
  surfaceElevations?: ReadonlyMap<string, number>;
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

/** Render segmented trees as terrain-registered trunks and compact crowns. */
export function createDigitalTwinTreeLayers(
  trees: readonly DigitalTwinTreeAsset[],
  { surfaceElevations }: DigitalTwinTreeSurfaceOptions = {}
): [
  SolidPolygonLayer<DigitalTwinTreeAsset>,
  SolidPolygonLayer<DigitalTwinTreeAsset>,
] {
  return [
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
      getFillColor: [108, 78, 52, 255],
      extruded: true,
      pickable: false,
    }),
    new SolidPolygonLayer<DigitalTwinTreeAsset>({
      id: "digital-twin-tree-crowns",
      data: trees,
      positionFormat: "XYZ",
      getPolygon: (tree) =>
        circlePolygon(
          tree,
          canopyRadius(tree),
          surfaceElevation(tree, surfaceElevations) +
            treeHeight(tree) * CANOPY_BASE_FRACTION,
          14
        ),
      getElevation: (tree) => treeHeight(tree) * CANOPY_HEIGHT_FRACTION,
      getFillColor: [38, 132, 78, 218],
      extruded: true,
      pickable: false,
    }),
  ];
}
