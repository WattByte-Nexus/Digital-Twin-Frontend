import { Tile3DLayer } from "@deck.gl/geo-layers";
import { PointCloudLayer } from "@deck.gl/layers";
import type { DigitalTwinReadyPointCloudDataset } from "../../lib/digital-twin-point-cloud";

export const MISSING_POINT_RGB_VERTEX_INJECTION = `
  if (color.r + color.g + color.b < 0.003) {
    color = vec4(0.22, 0.74, 0.97, 0.90);
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
    // Two pixels removes coarse tile patches at close range. Request and memory
    // caps below keep that refinement from monopolizing the render thread.
    maximumScreenSpaceError: 2,
    maximumMemoryUsage: 512,
    // Keep refinement deterministic. The adaptive loader raises this threshold
    // as the cache fills and can otherwise strand a close view at a coarse LOD.
    memoryAdjustedScreenSpaceError: false,
    throttleRequests: true,
    // Bound concurrent parsing and GPU uploads so refinement stays interactive.
    maxRequests: 8,
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
  cartographicCenter: ArrayLike<number> | null;
  stats: {
    get: (name: string) => { count: number };
  };
  gpuMemoryUsageInBytes: number;
  memoryAdjustedScreenSpaceError: number;
  selectedTiles: unknown[];
  isLoaded: () => boolean;
}

interface SelectedPointCloudTile {
  contentAvailable: boolean;
  content?: { pointCount?: number };
}

interface DigitalTwinPointCloudLayerCallbacks {
  onError: (error: Error) => void;
  onReady?: () => void;
  onSurfaceReferenceElevation?: (elevationMeters: number) => void;
  onDiagnostics?: (snapshot: DigitalTwinPointCloudDiagnostics) => void;
  renderMode?: DigitalTwinPointCloudRenderMode;
  beforeId?: string;
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
    onSurfaceReferenceElevation,
    onDiagnostics,
    renderMode = "opaque",
    beforeId,
  }: DigitalTwinPointCloudLayerCallbacks
): Tile3DLayer {
  let visiblePointsReported = false;
  let tileset: PointCloudTilesetDiagnosticsSource | null = null;

  const reportError = (error: Error) => {
    if (!visiblePointsReported) onError(error);
  };

  const reportDiagnostics = () => {
    if (!tileset) return;
    const visiblePointCount = tileset.stats.get("Points/Vertices").count;
    if (!onDiagnostics) return;

    onDiagnostics({
      datasetId: dataset.datasetId,
      residentTileCount: tileset.stats.get("Tiles In Memory").count,
      selectedTileCount: tileset.selectedTiles.length,
      visiblePointCount,
      gpuMemoryUsageBytes: tileset.gpuMemoryUsageInBytes,
      screenSpaceError: tileset.memoryAdjustedScreenSpaceError,
      settled: tileset.isLoaded(),
    });
  };

  const handleTraversalComplete = <Tile extends SelectedPointCloudTile>(
    selectedTiles: Tile[]
  ): Tile[] => {
    if (!visiblePointsReported) {
      const visiblePointCount = selectedTiles.reduce((count, tile) => {
        const pointCount = tile.content?.pointCount;
        return tile.contentAvailable &&
          typeof pointCount === "number" &&
          Number.isFinite(pointCount)
          ? count + pointCount
          : count;
      }, 0);
      if (visiblePointCount > 0) {
        visiblePointsReported = true;
        onReady?.();
      }
    }
    if (onDiagnostics) queueMicrotask(reportDiagnostics);
    return selectedTiles;
  };

  return new Tile3DLayer({
    id: `digital-twin-point-cloud-${dataset.datasetId}`,
    data: dataset.tilesetUrl,
    // Tile3DLayer defines pointSize in pixels. Keeping previews at a one-pixel
    // radius prevents coarse hierarchy points from merging into opaque,
    // tile-shaped sheets while native leaves still resolve at close zoom.
    pointSize: 1,
    pickable: false,
    operation: "draw",
    beforeId,
    loadOptions: {
      ...POINT_CLOUD_TILESET_LOAD_OPTIONS,
      tileset: {
        ...POINT_CLOUD_TILESET_LOAD_OPTIONS.tileset,
        onTraversalComplete: handleTraversalComplete,
      },
    },
    _subLayerProps: {
      pointcloud: {
        type:
          renderMode === "gaussian"
            ? GaussianSurfelPointCloudLayer
            : VisibleRgbPointCloudLayer,
        sizeUnits: "pixels",
      },
    },
    onTilesetLoad: (loadedTileset) => {
      tileset = loadedTileset;
      const referenceElevation = loadedTileset.cartographicCenter?.[2];
      if (
        typeof referenceElevation === "number" &&
        Number.isFinite(referenceElevation)
      ) {
        onSurfaceReferenceElevation?.(referenceElevation);
      }
      reportDiagnostics();
    },
    onTileLoad: reportDiagnostics,
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
