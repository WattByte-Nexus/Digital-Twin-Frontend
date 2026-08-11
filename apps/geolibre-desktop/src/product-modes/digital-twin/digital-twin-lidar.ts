import { Tile3DLayer } from "@deck.gl/geo-layers";
import { PointCloudLayer } from "@deck.gl/layers";

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

export const GOLDEN_USGS_LIDAR_TILESET_URL =
  "/data/usgs-lidar/golden-city/tileset.json";

export const DIGITAL_TWIN_LIDAR_OVERLAY_PROPS = {
  interleaved: true,
} as const;

export const GOLDEN_LIDAR_TILESET_LOAD_OPTIONS = {
  tileset: {
    // The city-wide hierarchy's source spacing is one metre. deck.gl's default
    // SSE (16) can accept the sparse overview tile even at street level, so the
    // detailed surfels are never requested. A one-pixel error budget keeps the
    // hierarchy refining as the camera approaches the survey.
    maximumScreenSpaceError: 1,
  },
} as const;

interface GoldenUsgsLidarLayerCallbacks {
  onError: (error: Error) => void;
  onReady?: () => void;
}

/**
 * Builds the streamed Golden LiDAR layer used by the Digital Twin map.
 *
 * The 3D Tiles hierarchy replaces the former monolithic point buffer so deck.gl
 * can select spatial detail from the current camera. The layer is intentionally
 * depth-tested: ground is supplied by the satellite terrain, while Gaussian
 * surfels provide smooth above-ground survey structure without reconstruction.
 */
export function createGoldenUsgsLidarLayer({
  onError,
  onReady,
}: GoldenUsgsLidarLayerCallbacks): Tile3DLayer {
  let firstTileLoaded = false;

  const reportError = (error: Error) => {
    if (!firstTileLoaded) onError(error);
  };

  return new Tile3DLayer({
    id: "golden-usgs-lidar-point-cloud",
    data: GOLDEN_USGS_LIDAR_TILESET_URL,
    pointSize: 2.5,
    pickable: false,
    operation: "draw",
    loadOptions: GOLDEN_LIDAR_TILESET_LOAD_OPTIONS,
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
      reportError(new Error(`Golden LiDAR tile failed to load: ${message} (${url})`));
    },
    onError: (error) => {
      reportError(error);
      return true;
    },
  });
}
