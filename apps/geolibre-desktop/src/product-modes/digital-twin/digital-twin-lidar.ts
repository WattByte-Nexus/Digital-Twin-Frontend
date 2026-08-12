import { Tile3DLayer } from "@deck.gl/geo-layers";
import { PointCloudLayer } from "@deck.gl/layers";
import type { DigitalTwinReadyPointCloudDataset } from "../../lib/digital-twin-point-cloud";

export const MISSING_POINT_RGB_VERTEX_INJECTION = `
  if (color.r + color.g + color.b < 0.003) {
    color = vec4(0.22, 0.74, 0.97, 0.90);
  }
`;

export const ADAPTIVE_SURFEL_VERTEX_INJECTION = `
  float projectedSurfelRadius = length(size.xy);
  if (projectedSurfelRadius > 0.0) {
    float clampedSurfelRadius = clamp(projectedSurfelRadius, 2.0, 10.0);
    size.xy *= clampedSurfelRadius / projectedSurfelRadius;
  }
`;

/** Preserve source RGB, but keep malformed/missing zero-RGB tiles visible. */
export class VisibleRgbPointCloudLayer extends PointCloudLayer {
  static layerName = "VisibleRgbPointCloudLayer";

  override getShaders() {
    const shaders = super.getShaders();
    return {
      ...shaders,
      inject: {
        ...shaders.inject,
        "vs:DECKGL_FILTER_COLOR": MISSING_POINT_RGB_VERTEX_INJECTION,
        "vs:DECKGL_FILTER_SIZE": ADAPTIVE_SURFEL_VERTEX_INJECTION,
      },
    };
  }

}

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
export class GaussianSurfelPointCloudLayer extends VisibleRgbPointCloudLayer {
  static layerName = "GaussianSurfelPointCloudLayer";

  override getShaders() {
    const shaders = super.getShaders();
    return {
      ...shaders,
      inject: {
        ...shaders.inject,
        "fs:DECKGL_FILTER_COLOR": GAUSSIAN_SURFEL_FRAGMENT_INJECTION,
      },
    };
  }
}

export const POINT_CLOUD_TILESET_LOAD_OPTIONS = {
  tileset: {
    // Start with the hierarchy's previews and refine only after the camera
    // settles. Native leaves remain available without blocking interaction.
    maximumScreenSpaceError: 4,
    maximumMemoryUsage: 512,
    memoryAdjustedScreenSpaceError: true,
    throttleRequests: true,
    maxRequests: 12,
    // Camera motion can otherwise trigger a traversal for every input event.
    debounceTime: 100,
    // Engine tiles are georeferenced once and remain stationary.
    updateTransforms: false,
  },
} as const;

export type DigitalTwinPointCloudRenderMode = "opaque" | "gaussian";

export interface DigitalTwinPointCloudDiagnostics {
  datasetId: string;
  residentTileCount: number;
  selectedTileCount: number;
  visiblePointCount: number;
  gpuMemoryUsageBytes: number;
  screenSpaceError: number;
  settled: boolean;
}

interface PointCloudTilesetDiagnosticsSource {
  stats: {
    get: (name: string) => { count: number };
  };
  gpuMemoryUsageInBytes: number;
  memoryAdjustedScreenSpaceError: number;
  selectedTiles: unknown[];
  isLoaded: () => boolean;
}

interface DigitalTwinPointCloudLayerCallbacks {
  onError: (error: Error) => void;
  onReady?: () => void;
  onCameraTargetElevation?: (elevationMeters: number) => void;
  onDiagnostics?: (snapshot: DigitalTwinPointCloudDiagnostics) => void;
  renderMode?: DigitalTwinPointCloudRenderMode;
  beforeId?: string;
}

function pointRadiusForSpacing(minimumSpacingMeters: number): number {
  return Math.max(0.05, minimumSpacingMeters * 0.75);
}

/**
 * Builds a streamed point-cloud layer from an Engine dataset descriptor.
 *
 * deck.gl selects spatial detail from the current camera. The layer remains
 * depth-tested so terrain supplies the ground while point sprites provide
 * above-ground survey structure. Gaussian coverage is an opt-in quality mode.
 */
export function createDigitalTwinPointCloudLayer(
  dataset: DigitalTwinReadyPointCloudDataset,
  {
    onError,
    onReady,
    onCameraTargetElevation,
    onDiagnostics,
    renderMode = "opaque",
    beforeId,
  }: DigitalTwinPointCloudLayerCallbacks
): Tile3DLayer {
  let firstTileLoaded = false;
  let cameraTargetElevationReported = false;
  let tileset: PointCloudTilesetDiagnosticsSource | null = null;

  const reportError = (error: Error) => {
    if (!firstTileLoaded) onError(error);
  };

  const reportDiagnostics = () => {
    if (!onDiagnostics || !tileset) return;

    onDiagnostics({
      datasetId: dataset.datasetId,
      residentTileCount: tileset.stats.get("Tiles In Memory").count,
      selectedTileCount: tileset.selectedTiles.length,
      visiblePointCount: tileset.stats.get("Points/Vertices").count,
      gpuMemoryUsageBytes: tileset.gpuMemoryUsageInBytes,
      screenSpaceError: tileset.memoryAdjustedScreenSpaceError,
      settled: tileset.isLoaded(),
    });
  };

  return new Tile3DLayer({
    id: `digital-twin-point-cloud-${dataset.datasetId}`,
    data: dataset.tilesetUrl,
    pointSize: pointRadiusForSpacing(dataset.minimumSpacingMeters),
    pickable: false,
    operation: "draw",
    beforeId,
    loadOptions: POINT_CLOUD_TILESET_LOAD_OPTIONS,
    _subLayerProps: {
      pointcloud: {
        type:
          renderMode === "gaussian"
            ? GaussianSurfelPointCloudLayer
            : VisibleRgbPointCloudLayer,
        sizeUnits: "meters",
      },
    },
    onTilesetLoad: (loadedTileset) => {
      tileset = loadedTileset;
      reportDiagnostics();
    },
    onTileLoad: (tile) => {
      const cameraTargetElevation = tile.parent
        ? undefined
        : tile.content?.cartographicOrigin?.[2];
      if (
        !cameraTargetElevationReported &&
        Number.isFinite(cameraTargetElevation)
      ) {
        cameraTargetElevationReported = true;
        onCameraTargetElevation?.(cameraTargetElevation);
      }
      if (!firstTileLoaded) {
        firstTileLoaded = true;
        onReady?.();
      }
      reportDiagnostics();
    },
    onTileUnload: reportDiagnostics,
    // @loaders.gl calls this as (tile, message, url), despite deck.gl's type
    // declaration naming the string arguments in the opposite order.
    onTileError: (_tile, message, url) => {
      reportError(
        new Error(`${dataset.name} tile failed to load: ${message} (${url})`)
      );
    },
    onError: (error) => {
      reportError(error);
      return true;
    },
  });
}
