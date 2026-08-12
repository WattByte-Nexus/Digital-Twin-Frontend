import type { Layer } from "@deck.gl/core";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { memo, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  buildSatelliteTerrainStyle,
  setElevationEnabled,
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
import { syncTerrainCameraTarget } from "./terrain-camera-target";
import { MapboxAttributionLogo } from "./MapboxAttributionLogo";

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
  /** Elevation of the active 3D dataset's camera target, in meters. */
  cameraTargetElevation?: number;
  /** App theme used for imagery treatment and the reference overlay style. */
  themeMode?: MapThemeMode;
  className?: string;
  ariaLabel?: string;
  /** Ordered analytical layers rendered in this map's shared WebGL2 context. */
  deckLayers?: Layer[];
  onMapReady?: (map: maplibregl.Map | null) => void;
}

/**
 * A standalone, map-only Digital Twin surface. It intentionally owns no app
 * controls or product state yet: MapLibre renders a satellite raster draped
 * over tiled raster-DEM terrain, leaving later asset layers to build on a
 * working geographic foundation.
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
  cameraTargetElevation,
  themeMode = "light",
  className,
  ariaLabel = "Satellite terrain map",
  deckLayers = [],
  onMapReady,
}: SatelliteTerrainMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const deckOverlayRef = useRef<MapboxOverlay | null>(null);
  const deckLayersRef = useRef(deckLayers);
  const referenceLayersRef = useRef<SatelliteReferenceLayer[]>(referenceOverlay?.layers ?? []);
  const referenceOverlayVisibilityRef = useRef(referenceOverlayVisibility);
  const satelliteVisibleRef = useRef(satelliteVisible);
  const elevationEnabledRef = useRef(elevationEnabled);
  const cameraTargetElevationRef = useRef(cameraTargetElevation);
  const themeModeRef = useRef(themeMode);
  const appliedThemeModeRef = useRef<MapThemeMode | null>(null);
  const onMapReadyRef = useRef(onMapReady);
  referenceOverlayVisibilityRef.current = referenceOverlayVisibility;
  satelliteVisibleRef.current = satelliteVisible;
  elevationEnabledRef.current = elevationEnabled;
  cameraTargetElevationRef.current = cameraTargetElevation;
  themeModeRef.current = themeMode;
  onMapReadyRef.current = onMapReady;
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
      // Cancel obsolete requests during continuous camera movement. Mapbox's
      // own pyramid supplies every imagery tier, so no second raster is exposed.
      cancelPendingTileRequestsWhileZooming: true,
      maxTileCacheZoomLevels: 5,
      attributionControl: { compact: false },
    });
    mapRef.current = map;
    appliedThemeModeRef.current = initialThemeMode;
    onMapReadyRef.current?.(map);

    const handleLoad = () => {
      const deckOverlay = new MapboxOverlay({
        interleaved: true,
        layers: deckLayersRef.current,
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
      if (elevationEnabledRef.current !== initialElevationEnabled) {
        setElevationEnabled(
          map,
          elevationEnabledRef.current,
          options.terrainExaggeration
        );
      }
      setTerrainGroundVisibility(
        map,
        satelliteVisibleRef.current,
        elevationEnabledRef.current
      );
      syncTerrainCameraTarget(map, cameraTargetElevationRef.current);
    };
    map.once("load", handleLoad);

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
      syncTerrainCameraTarget(map, cameraTargetElevationRef.current);
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
    setElevationEnabled(map, elevationEnabled, terrainExaggeration);
    setTerrainGroundVisibility(
      map,
      satelliteVisibleRef.current,
      elevationEnabled
    );
  }, [elevationEnabled, terrainExaggeration]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    syncTerrainCameraTarget(map, cameraTargetElevation);
  }, [cameraTargetElevation]);

  return (
    <div className={className} style={{ height: "100%", position: "relative", width: "100%" }}>
      <div
        ref={containerRef}
        style={{ height: "100%", width: "100%" }}
        role="region"
        aria-label={ariaLabel}
        data-testid="satellite-terrain-map"
        data-map-theme={themeMode}
      />
      <MapboxAttributionLogo />
    </div>
  );
});
