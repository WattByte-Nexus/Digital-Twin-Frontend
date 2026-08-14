import { MapboxOverlay } from "@deck.gl/mapbox";
import { memo, useEffect, useMemo, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  buildSatelliteTerrainStyle,
  setSatelliteVisibility,
  setTerrainGroundVisibility,
  type SatelliteRasterSource,
  type TerrainRasterSource,
} from "./satellite-terrain-style";
import {
  DEFAULT_SATELLITE_REFERENCE_VISIBILITY,
  setSatelliteReferenceVisibility,
  type SatelliteReferenceLayer,
  type SatelliteReferenceOverlay,
  type SatelliteReferenceVisibility,
} from "./satellite-reference-overlay";
import type { MapThemeMode } from "./theme-basemap";
import {
  composeDigitalTwinSurfaceLayers,
  type DigitalTwinSurfaceLayerGroup,
} from "./digital-twin-surface-layers";
import { applyDigitalTwinSurfaceElevationState } from "./digital-twin-surface-state";
import { createDigitalTwinSurfaceMapView } from "./digital-twin-surface-view";

const EMPTY_SURFACE_LAYERS: readonly DigitalTwinSurfaceLayerGroup[] = [];

export interface SatelliteTerrainInitialView {
  center: [longitude: number, latitude: number];
  zoom: number;
  pitch?: number;
  bearing?: number;
}

export interface SatelliteTerrainMapProps {
  satelliteSource: SatelliteRasterSource;
  referenceOverlay?: SatelliteReferenceOverlay;
  referenceOverlayVisibility?: SatelliteReferenceVisibility;
  terrainSource: TerrainRasterSource;
  initialView: SatelliteTerrainInitialView;
  terrainExaggeration?: number;
  satelliteVisible?: boolean;
  elevationEnabled?: boolean;
  /** App theme used for imagery treatment and the reference overlay style. */
  themeMode?: MapThemeMode;
  className?: string;
  ariaLabel?: string;
  /** Typed capabilities rendered in this map's one validated world surface. */
  surfaceLayers?: readonly DigitalTwinSurfaceLayerGroup[];
  /** Absolute dataset height used for 3D LOD until terrain elevation is ready. */
  surfaceReferenceElevationMeters?: number;
  onMapReady?: (map: maplibregl.Map | null) => void;
}

/**
 * The standalone Digital Twin map surface. MapLibre owns the geographic and
 * terrain frame while one interleaved deck overlay renders every validated
 * analytical layer group in that same frame.
 */
export const SatelliteTerrainMap = memo(function SatelliteTerrainMap({
  satelliteSource,
  referenceOverlay,
  referenceOverlayVisibility = DEFAULT_SATELLITE_REFERENCE_VISIBILITY,
  terrainSource,
  initialView,
  terrainExaggeration = 1,
  satelliteVisible = true,
  elevationEnabled = true,
  themeMode = "light",
  className,
  ariaLabel = "Satellite terrain map",
  surfaceLayers = EMPTY_SURFACE_LAYERS,
  surfaceReferenceElevationMeters,
  onMapReady,
}: SatelliteTerrainMapProps) {
  const composedSurface = useMemo(
    () => composeDigitalTwinSurfaceLayers(surfaceLayers),
    [surfaceLayers]
  );
  const deckLayers = composedSurface.layers;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const deckOverlayRef = useRef<MapboxOverlay | null>(null);
  const deckLayersRef = useRef(deckLayers);
  const referenceLayersRef = useRef<SatelliteReferenceLayer[]>(
    referenceOverlay?.layers ?? []
  );
  const referenceOverlayVisibilityRef = useRef(referenceOverlayVisibility);
  const satelliteVisibleRef = useRef(satelliteVisible);
  const elevationEnabledRef = useRef(elevationEnabled);
  const themeModeRef = useRef(themeMode);
  const appliedThemeModeRef = useRef<MapThemeMode | null>(null);
  const onMapReadyRef = useRef(onMapReady);
  const surfaceReferenceElevationRef = useRef(surfaceReferenceElevationMeters);
  referenceOverlayVisibilityRef.current = referenceOverlayVisibility;
  satelliteVisibleRef.current = satelliteVisible;
  elevationEnabledRef.current = elevationEnabled;
  themeModeRef.current = themeMode;
  onMapReadyRef.current = onMapReady;
  surfaceReferenceElevationRef.current = surfaceReferenceElevationMeters;
  deckLayersRef.current = deckLayers;

  // Sources and camera are mount-time inputs. Changing datasets should remount
  // the component with a new key rather than diffing the foundational style.
  const initialOptionsRef = useRef({
    satelliteSource,
    referenceOverlay,
    terrainSource,
    initialView,
    terrainExaggeration,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const options = initialOptionsRef.current;
    let resizeObserver: ResizeObserver | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    const initialThemeMode = themeModeRef.current;
    const initialSatelliteVisible = satelliteVisibleRef.current;
    const initialElevationEnabled = elevationEnabledRef.current;
    const map = new maplibregl.Map({
      container,
      style: buildSatelliteTerrainStyle({
        satelliteSource: options.satelliteSource,
        referenceOverlay: options.referenceOverlay,
        referenceOverlayVisibility: referenceOverlayVisibilityRef.current,
        terrainSource: options.terrainSource,
        terrainExaggeration: options.terrainExaggeration,
        satelliteVisible: initialSatelliteVisible,
        elevationEnabled: initialElevationEnabled,
        themeMode: initialThemeMode,
      }),
      center: options.initialView.center,
      zoom: options.initialView.zoom,
      pitch: options.initialView.pitch ?? 0,
      bearing: options.initialView.bearing ?? 0,
      maxPitch: 85,
      renderWorldCopies: false,
      // Prefer the broadly available adapter. A single interleaved MapLibre +
      // deck.gl context is the performance win; forcing a discrete adapter can
      // fail entirely on remote/software-rendered Chromium and some laptops.
      canvasContextAttributes: { powerPreference: "low-power" },
      // These basemaps are versioned/static. Do not wake the map back up to
      // revalidate expired tiles while the workspace is open.
      refreshExpiredTiles: false,
      maxTileCacheZoomLevels: 5,
      attributionControl: false,
    });
    mapRef.current = map;
    appliedThemeModeRef.current = initialThemeMode;
    onMapReadyRef.current?.(map);

    const handleLoad = () => {
      const deckOverlay = new MapboxOverlay({
        interleaved: true,
        layers: deckLayersRef.current,
        // MapboxOverlay's generic type defaults `views` to null even though
        // the runtime supports a custom MapView.
        views: createDigitalTwinSurfaceMapView({
          getMapCenterElevation: () => map.getCenterElevation(),
          getSurfaceReferenceElevation: () =>
            surfaceReferenceElevationRef.current,
        }) as never,
      });
      map.addControl(deckOverlay);
      deckOverlayRef.current = deckOverlay;
      setSatelliteReferenceVisibility(
        map,
        referenceLayersRef.current,
        referenceOverlayVisibilityRef.current
      );
      if (satelliteVisibleRef.current !== initialSatelliteVisible) {
        setSatelliteVisibility(map, satelliteVisibleRef.current);
      }
      applyDigitalTwinSurfaceElevationState(map, {
        enabled: elevationEnabledRef.current,
        exaggeration: options.terrainExaggeration,
      });
      setTerrainGroundVisibility(
        map,
        satelliteVisibleRef.current,
        elevationEnabledRef.current
      );
    };
    // Analytical layers only require the style graph. Waiting for MapLibre's
    // full load event also waits on remote raster tiles, so a basemap outage
    // would otherwise prevent power lines and point clouds from mounting.
    map.once("style.load", handleLoad);

    resizeObserver = new ResizeObserver(() => {
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      // Animated panels can report a new width every frame. Resizing the
      // WebGL drawing buffer for each report causes visible flashes, so let
      // the layout settle and resize the map once at its final dimensions.
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        map.resize();
      }, 80);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver?.disconnect();
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      onMapReadyRef.current?.(null);
      const deckOverlay = deckOverlayRef.current;
      if (deckOverlay && map.hasControl(deckOverlay)) {
        map.removeControl(deckOverlay);
      }
      deckOverlayRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      appliedThemeModeRef.current = null;
      referenceLayersRef.current = [];
    };
  }, []);

  useEffect(() => {
    deckOverlayRef.current?.setProps({ layers: deckLayers });
  }, [deckLayers]);

  useEffect(() => {
    // The custom map view reads this value lazily; repaint creates the new
    // viewport and causes Tile3DLayer to traverse with the corrected height.
    mapRef.current?.triggerRepaint();
  }, [surfaceReferenceElevationMeters]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedThemeModeRef.current === themeMode) return;

    const options = initialOptionsRef.current;
    const handleStyleLoad = () => {
      setSatelliteReferenceVisibility(
        map,
        referenceLayersRef.current,
        referenceOverlayVisibilityRef.current
      );
      setTerrainGroundVisibility(
        map,
        satelliteVisibleRef.current,
        elevationEnabledRef.current
      );
      applyDigitalTwinSurfaceElevationState(map, {
        enabled: elevationEnabledRef.current,
        exaggeration: options.terrainExaggeration,
      });
    };
    map.once("style.load", handleStyleLoad);
    map.setStyle(
      buildSatelliteTerrainStyle({
        satelliteSource: options.satelliteSource,
        referenceOverlay: options.referenceOverlay,
        referenceOverlayVisibility: referenceOverlayVisibilityRef.current,
        terrainSource: options.terrainSource,
        terrainExaggeration: options.terrainExaggeration,
        satelliteVisible: satelliteVisibleRef.current,
        elevationEnabled: elevationEnabledRef.current,
        themeMode,
      })
    );
    appliedThemeModeRef.current = themeMode;

    return () => {
      map.off("style.load", handleStyleLoad);
    };
  }, [themeMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setSatelliteReferenceVisibility(
      map,
      referenceLayersRef.current,
      referenceOverlayVisibility
    );
  }, [referenceOverlayVisibility]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    setSatelliteVisibility(map, satelliteVisible);
    setTerrainGroundVisibility(
      map,
      satelliteVisible,
      elevationEnabledRef.current
    );
  }, [satelliteVisible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    applyDigitalTwinSurfaceElevationState(map, {
      enabled: elevationEnabled,
      exaggeration: terrainExaggeration,
    });
    setTerrainGroundVisibility(
      map,
      satelliteVisibleRef.current,
      elevationEnabled
    );
  }, [elevationEnabled, terrainExaggeration]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height: "100%", width: "100%" }}
      role="region"
      aria-label={ariaLabel}
      data-testid="satellite-terrain-map"
      data-map-theme={themeMode}
    />
  );
});
