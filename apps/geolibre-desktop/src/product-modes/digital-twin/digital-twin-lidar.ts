import { WebMercatorViewport, type Viewport } from "@deck.gl/core";
import { Tile3DLayer } from "@deck.gl/geo-layers";
import { PointCloudLayer } from "@deck.gl/layers";
import type { DigitalTwinReadyPointCloudDataset } from "../../lib/digital-twin-point-cloud";

export const MISSING_POINT_RGB_VERTEX_INJECTION = `
  if (color.r + color.g + color.b < 0.003) {
    color = vec4(0.22, 0.74, 0.97, 0.90);
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

/** Preserve source RGB, but keep malformed/missing zero-RGB tiles visible. */
export class VisibleRgbPointCloudLayer extends PointCloudLayer<
  unknown,
  { tile?: { tileDrawn: boolean } }
> {
  static layerName = "VisibleRgbPointCloudLayer";

  override draw(options: Parameters<PointCloudLayer["draw"]>[0]): void {
    if (!this.state.model) return;
    super.draw(options);
    // Tile3DLayer marks PNTS tiles undrawn on load, but its standard point-cloud
    // sublayer never acknowledges the first draw. Complete that handshake so
    // loaders.gl releases replaced ancestors and stops its transition loop.
    if (this.props.tile) this.props.tile.tileDrawn = true;
  }

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

export const POINT_CLOUD_TILESET_LOAD_OPTIONS = {
  tileset: {
    // Keep useful previews and replacement tiles resident together. The bounded
    // cache can relax detail on larger datasets before frames stall.
    maximumScreenSpaceError: 8,
    maximumMemoryUsage: 256,
    memoryAdjustedScreenSpaceError: true,
    throttleRequests: true,
    // Fetch a complete octant together instead of serializing sibling refinement.
    maxRequests: 8,
    // Coalesce a frame of camera input without delaying every level by 250 ms.
    debounceTime: 16,
    // Engine tiles are georeferenced once and remain stationary.
    updateTransforms: false,
  },
} as const;

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
    // LOD controls density; a stable pixel footprint keeps close views crisp
    // and prevents coarse preview points from becoming metre-wide bubbles.
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
        type: VisibleRgbPointCloudLayer,
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
