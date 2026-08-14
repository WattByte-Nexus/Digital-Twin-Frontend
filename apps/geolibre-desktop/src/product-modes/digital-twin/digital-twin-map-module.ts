import {
  DIGITAL_TWIN_SHARED_SURFACE,
  type DigitalTwinSurfaceLayerGroup,
} from "@geolibre/map/digital-twin-surface-layers";
import type { DigitalTwinPowerLineAsset } from "../../lib/digital-twin-assets";
import type { DigitalTwinReadyPointCloudDataset } from "../../lib/digital-twin-point-cloud";
import { createDigitalTwinPointCloudLayer } from "./digital-twin-lidar";
import {
  createDigitalTwinPowerLineLayers,
  resolveDigitalTwinPowerPoleModelUrl,
} from "./digital-twin-power-line-rendering";
import { DIGITAL_TWIN_REFERENCE_LABEL_ANCHOR_LAYER_ID } from "./digital-twin-map-ids";

export const DIGITAL_TWIN_POWER_LINE_SURFACE_GROUP_ID =
  "digital-twin-power-lines";
export const DIGITAL_TWIN_POINT_CLOUD_SURFACE_GROUP_ID =
  "digital-twin-point-cloud";

export interface DigitalTwinMapPointCloud {
  dataset: DigitalTwinReadyPointCloudDataset;
  onError: (error: Error) => void;
  onReady?: () => void;
  onSurfaceReferenceElevation?: (elevationMeters: number) => void;
}

export interface DigitalTwinMapSurfaceLayerOptions {
  powerLines: readonly DigitalTwinPowerLineAsset[];
  powerLineSurfaceElevations?: ReadonlyMap<string, number>;
  pointCloud?: DigitalTwinMapPointCloud;
}

/**
 * The product's only analytical map-layer entry point. New capabilities join
 * the scene by adding another declared group on the shared world surface.
 */
export function createDigitalTwinMapSurfaceLayers({
  powerLines,
  powerLineSurfaceElevations,
  pointCloud,
}: DigitalTwinMapSurfaceLayerOptions): DigitalTwinSurfaceLayerGroup[] {
  const groups: DigitalTwinSurfaceLayerGroup[] = [];

  if (powerLines.length > 0) {
    groups.push({
      id: DIGITAL_TWIN_POWER_LINE_SURFACE_GROUP_ID,
      surface: DIGITAL_TWIN_SHARED_SURFACE,
      layers: createDigitalTwinPowerLineLayers(powerLines, {
        modelUrl: resolveDigitalTwinPowerPoleModelUrl(),
        surfaceElevations: powerLineSurfaceElevations,
      }),
    });
  }

  if (pointCloud) {
    groups.push({
      id: DIGITAL_TWIN_POINT_CLOUD_SURFACE_GROUP_ID,
      surface: DIGITAL_TWIN_SHARED_SURFACE,
      layers: [
        createDigitalTwinPointCloudLayer(pointCloud.dataset, {
          beforeId: DIGITAL_TWIN_REFERENCE_LABEL_ANCHOR_LAYER_ID,
          onError: pointCloud.onError,
          onReady: pointCloud.onReady,
          onSurfaceReferenceElevation:
            pointCloud.onSurfaceReferenceElevation,
        }),
      ],
    });
  }

  return groups;
}
