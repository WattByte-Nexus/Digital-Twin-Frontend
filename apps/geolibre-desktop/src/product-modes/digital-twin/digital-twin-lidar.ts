import { Tile3DLayer } from "@deck.gl/geo-layers";
import { PointCloudLayer } from "@deck.gl/layers";
import type { DigitalTwinReadyPointCloudDataset } from "../../lib/digital-twin-point-cloud";

export const GAUSSIAN_SURFEL_VERTEX_INJECTION = `
  float projectedSurfelRadius = length(size.xy);
  if (projectedSurfelRadius > 0.0) {
    float clampedSurfelRadius = clamp(projectedSurfelRadius, 1.5, 18.0);
    size.xy *= clampedSurfelRadius / projectedSurfelRadius;
  }
`;

export const GAUSSIAN_SURFEL_FRAGMENT_INJECTION = `
  float gaussianRadiusSquared = dot(geometry.uv, geometry.uv);
  float gaussianWeight = exp(-1.25 * gaussianRadiusSquared);
  float gaussianEdgeFade = 1.0 - smoothstep(0.78, 1.0, gaussianRadiusSquared);
  color.a *= gaussianWeight * gaussianEdgeFade;
  if (color.a < 0.01) {
    discard;
  }
`;

/**
 * A deliberately small Gaussian-surfel prototype.
 *
 * It keeps deck.gl's streamed point-cloud geometry and depth behavior, changing
 * only the fragment coverage from a hard-edged disk to a truncated Gaussian.
 * Full 3D Gaussian reconstruction is a separate path that requires multi-view
 * imagery rather than the single orthophoto used by this dataset.
 */
export class GaussianSurfelPointCloudLayer extends PointCloudLayer {
  static layerName = "GaussianSurfelPointCloudLayer";

  override getShaders() {
    const shaders = super.getShaders();
    return {
      ...shaders,
      inject: {
        ...shaders.inject,
        "vs:DECKGL_FILTER_SIZE": GAUSSIAN_SURFEL_VERTEX_INJECTION,
        "fs:DECKGL_FILTER_COLOR": GAUSSIAN_SURFEL_FRAGMENT_INJECTION,
      },
    };
  }
}

export const DIGITAL_TWIN_LIDAR_OVERLAY_PROPS = {
  interleaved: true,
} as const;

export const POINT_CLOUD_TILESET_LOAD_OPTIONS = {
  tileset: {
    // A one-pixel error budget keeps the hierarchy refining near the camera.
    maximumScreenSpaceError: 1,
    // Bound decoded tile memory independently of the browser cache.
    maximumMemoryUsage: 512,
    memoryAdjustedScreenSpaceError: true,
    throttleRequests: true,
  },
  core: {
    // Point-cloud payloads are already spatially bounded. Keeping parsing on the
    // app origin also avoids loaders.gl trying to fetch worker bundles from a CDN.
    worker: false,
  },
} as const;

interface DigitalTwinPointCloudLayerCallbacks {
  onError: (error: Error) => void;
  onReady?: () => void;
}

function pointSizeForSpacing(minimumSpacingMeters: number): number {
  return Math.min(2.5, Math.max(0.5, minimumSpacingMeters * 1.5));
}

/**
 * Builds a streamed point-cloud layer from an Engine dataset descriptor.
 *
 * deck.gl selects spatial detail from the current camera. The layer remains
 * depth-tested so terrain supplies the ground while Gaussian surfels provide
 * smooth above-ground survey structure.
 */
export function createDigitalTwinPointCloudLayer(
  dataset: DigitalTwinReadyPointCloudDataset,
  { onError, onReady }: DigitalTwinPointCloudLayerCallbacks,
): Tile3DLayer {
  let firstTileLoaded = false;

  const reportError = (error: Error) => {
    if (!firstTileLoaded) onError(error);
  };

  return new Tile3DLayer({
    id: `digital-twin-point-cloud-${dataset.datasetId}`,
    data: dataset.tilesetUrl,
    pointSize: pointSizeForSpacing(dataset.minimumSpacingMeters),
    pickable: false,
    operation: "draw",
    loadOptions: POINT_CLOUD_TILESET_LOAD_OPTIONS,
    _subLayerProps: {
      pointcloud: {
        type: GaussianSurfelPointCloudLayer,
        sizeUnits: "meters",
      },
    },
    onTileLoad: () => {
      if (firstTileLoaded) return;
      firstTileLoaded = true;
      onReady?.();
    },
    // @loaders.gl calls this as (tile, message, url), despite deck.gl's type
    // declaration naming the string arguments in the opposite order.
    onTileError: (_tile, message, url) => {
      reportError(
        new Error(`${dataset.name} tile failed to load: ${message} (${url})`),
      );
    },
    onError: (error) => {
      reportError(error);
      return true;
    },
  });
}
