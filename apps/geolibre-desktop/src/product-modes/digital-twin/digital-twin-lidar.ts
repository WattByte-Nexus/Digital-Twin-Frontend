import { WebMercatorViewport, type Viewport } from "@deck.gl/core";
import { Tile3DLayer } from "@deck.gl/geo-layers";
import { PointCloudLayer, type PointCloudLayerProps } from "@deck.gl/layers";
import type { DigitalTwinReadyPointCloudDataset } from "../../lib/digital-twin-point-cloud";

export const MISSING_POINT_RGB_VERTEX_INJECTION = `
  if (color.r + color.g + color.b < 0.003) {
    color = vec4(0.22, 0.74, 0.97, 0.90);
  }
`;

interface PointCloudTileProps {
  tile?: {
    extras?: {
      samplingSpacingMeters?: unknown;
    };
  };
}

type DigitalTwinPointCloudLayerProps = PointCloudLayerProps & PointCloudTileProps;

/**
 * LiDAR surfel sizing controls.
 *
 * `radiusToSpacingRatio` changes coverage at every zoom. The soft cap keeps
 * medium views crisp; beyond it, projected radii ease toward the close-range
 * maximum so native leaves remain legible without returning to giant discs.
 * Keep all values positive and `closeRangeMaxRadiusPixels` above the soft cap.
 */
export const POINT_CLOUD_SURFEL_SIZING = {
  radiusToSpacingRatio: 0.75,
  softCapRadiusPixels: 2,
  closeRangeMaxRadiusPixels: 3,
} as const;

export const MAX_POINT_RADIUS_VERTEX_INJECTION = `
  // PointCloudLayer's covering triangle has twice the rendered circle radius.
  const float softCapRadiusPixels = ${POINT_CLOUD_SURFEL_SIZING.softCapRadiusPixels.toFixed(1)};
  const float closeRangeMaxRadiusPixels = ${POINT_CLOUD_SURFEL_SIZING.closeRangeMaxRadiusPixels.toFixed(1)};
  float pointTriangleRadiusPixels = length(size.xy);
  float pointRadiusPixels = pointTriangleRadiusPixels * 0.5;
  if (pointRadiusPixels > softCapRadiusPixels) {
    float compressionRangePixels = closeRangeMaxRadiusPixels - softCapRadiusPixels;
    float compressedRadiusPixels = softCapRadiusPixels + compressionRangePixels *
      (1.0 - exp(-(pointRadiusPixels - softCapRadiusPixels) / compressionRangePixels));
    size.xy *= compressedRadiusPixels / pointRadiusPixels;
  }
`;

interface DigitalTwinPointCloudTileLayerProps {
  getTraversalElevationMeters?: () => number | undefined;
  beforeId?: string;
}

export function createDigitalTwinPointCloudTraversalViewport(
  renderViewport: Viewport,
  elevationMeters: number | undefined
): Viewport {
  if (
    !(renderViewport instanceof WebMercatorViewport) ||
    typeof elevationMeters !== "number" ||
    !Number.isFinite(elevationMeters)
  ) {
    return renderViewport;
  }

  return new WebMercatorViewport({
    id: renderViewport.id,
    x: renderViewport.x,
    y: renderViewport.y,
    width: renderViewport.width,
    height: renderViewport.height,
    longitude: renderViewport.longitude,
    latitude: renderViewport.latitude,
    zoom: renderViewport.zoom,
    pitch: renderViewport.pitch,
    bearing: renderViewport.bearing,
    position: [
      renderViewport.position[0] ?? 0,
      renderViewport.position[1] ?? 0,
      elevationMeters,
    ],
    padding: renderViewport.padding,
    orthographic: renderViewport.orthographic,
    fovy: renderViewport.fovy,
  });
}

/** Use an elevated viewport for tile selection without changing render projection. */
export class DigitalTwinPointCloudTileLayer extends Tile3DLayer<
  unknown,
  DigitalTwinPointCloudTileLayerProps
> {
  static layerName = "DigitalTwinPointCloudTileLayer";

  override activateViewport(renderViewport: Viewport): void {
    this.internalState!.viewport = renderViewport;
    const traversalViewport = createDigitalTwinPointCloudTraversalViewport(
      renderViewport,
      this.props.getTraversalElevationMeters?.()
    );
    const activeViewports = this.state.activeViewports as Record<string, Viewport>;
    const lastUpdatedViewports = this.state.lastUpdatedViewports as Record<
      string,
      Viewport
    > | null;

    activeViewports[renderViewport.id] = traversalViewport;
    const lastViewport = lastUpdatedViewports?.[renderViewport.id];
    if (!lastViewport || !traversalViewport.equals(lastViewport)) {
      this.setChangeFlags({ viewportChanged: true });
      this.setNeedsUpdate();
    }
  }
}

function pointRadiusMetersForSpacing(spacingMeters: number): number {
  return spacingMeters * POINT_CLOUD_SURFEL_SIZING.radiusToSpacingRatio;
}

function pointSizingForTile(
  propObjects: Partial<DigitalTwinPointCloudLayerProps>[]
): number | undefined {
  let fallbackRadius: number | undefined;
  let samplingSpacingMeters: number | undefined;

  for (const props of propObjects) {
    if (
      typeof props.pointSize === "number" &&
      Number.isFinite(props.pointSize) &&
      props.pointSize > 0
    ) {
      fallbackRadius = props.pointSize;
    }
    const tileSpacing = props.tile?.extras?.samplingSpacingMeters;
    if (
      typeof tileSpacing === "number" &&
      Number.isFinite(tileSpacing) &&
      tileSpacing > 0
    ) {
      samplingSpacingMeters = tileSpacing;
    }
  }

  return samplingSpacingMeters === undefined
    ? fallbackRadius
    : pointRadiusMetersForSpacing(samplingSpacingMeters);
}

/** Preserve source RGB, but keep malformed/missing zero-RGB tiles visible. */
export class VisibleRgbPointCloudLayer extends PointCloudLayer<
  unknown,
  PointCloudTileProps
> {
  static layerName = "VisibleRgbPointCloudLayer";

  constructor(...propObjects: Partial<DigitalTwinPointCloudLayerProps>[]) {
    const pointRadius = pointSizingForTile(propObjects);
    super(...propObjects, pointRadius === undefined ? {} : { pointSize: pointRadius });
  }

  override getShaders() {
    const shaders = super.getShaders();
    return {
      ...shaders,
      inject: {
        ...shaders.inject,
        "vs:DECKGL_FILTER_SIZE": MAX_POINT_RADIUS_VERTEX_INJECTION,
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
    // One pixel removes coarse tile patches at close range. Request and memory
    // caps below keep that refinement from monopolizing the render thread.
    maximumScreenSpaceError: 1,
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
    onDiagnostics,
    renderMode = "opaque",
    beforeId,
  }: DigitalTwinPointCloudLayerCallbacks
): DigitalTwinPointCloudTileLayer {
  let visiblePointsReported = false;
  let tileset: PointCloudTilesetDiagnosticsSource | null = null;
  let traversalElevationMeters: number | undefined;

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

  return new DigitalTwinPointCloudTileLayer({
    id: `digital-twin-point-cloud-${dataset.datasetId}`,
    data: dataset.tilesetUrl,
    getTraversalElevationMeters: () => traversalElevationMeters,
    // A leaf records zero geometric error, so use the dataset's native spacing
    // as its world-space coverage. Preview tiles replace this radius with their
    // own sampling spacing; the vertex hook caps only the projected footprint.
    pointSize: pointRadiusMetersForSpacing(dataset.minimumSpacingMeters),
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
        sizeUnits: "meters",
      },
    },
    onTilesetLoad: (loadedTileset) => {
      tileset = loadedTileset;
      const referenceElevation = loadedTileset.cartographicCenter?.[2];
      if (
        typeof referenceElevation === "number" &&
        Number.isFinite(referenceElevation)
      ) {
        traversalElevationMeters = referenceElevation;
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
