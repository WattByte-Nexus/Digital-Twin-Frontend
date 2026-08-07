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
  loadSatelliteReferenceOverlay,
  setSatelliteReferenceVisibility,
  type SatelliteReferenceLayer,
  type SatelliteReferenceVisibility,
} from "./satellite-reference-overlay";

export interface SatelliteTerrainInitialView {
  center: [longitude: number, latitude: number];
  zoom: number;
  pitch?: number;
  bearing?: number;
}

export interface SatelliteTerrainMapProps {
  satelliteSource: SatelliteRasterSource;
  satelliteFallbackSource?: SatelliteRasterSource;
  referenceOverlayStyleUrl?: string;
  referenceOverlayVisibility?: SatelliteReferenceVisibility;
  terrainSource: TerrainRasterSource;
  initialView: SatelliteTerrainInitialView;
  terrainExaggeration?: number;
  satelliteVisible?: boolean;
  elevationEnabled?: boolean;
  className?: string;
  ariaLabel?: string;
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
  satelliteFallbackSource,
  referenceOverlayStyleUrl,
  referenceOverlayVisibility = DEFAULT_SATELLITE_REFERENCE_VISIBILITY,
  terrainSource,
  initialView,
  terrainExaggeration = 1,
  satelliteVisible = true,
  elevationEnabled = true,
  className,
  ariaLabel = "Satellite terrain map",
  onMapReady,
}: SatelliteTerrainMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const referenceLayersRef = useRef<SatelliteReferenceLayer[]>([]);
  const referenceOverlayVisibilityRef = useRef(referenceOverlayVisibility);
  const satelliteVisibleRef = useRef(satelliteVisible);
  const elevationEnabledRef = useRef(elevationEnabled);
  const onMapReadyRef = useRef(onMapReady);
  referenceOverlayVisibilityRef.current = referenceOverlayVisibility;
  satelliteVisibleRef.current = satelliteVisible;
  elevationEnabledRef.current = elevationEnabled;
  onMapReadyRef.current = onMapReady;

  // Sources and camera are mount-time inputs. Changing datasets should remount
  // the component with a new key rather than diffing the foundational style.
  const initialOptionsRef = useRef({
    satelliteSource,
    satelliteFallbackSource,
    referenceOverlayStyleUrl,
    terrainSource,
    initialView,
    terrainExaggeration,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const options = initialOptionsRef.current;
    const abortController = new AbortController();
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    void (async () => {
      let referenceOverlay;
      if (options.referenceOverlayStyleUrl) {
        try {
          referenceOverlay = await loadSatelliteReferenceOverlay(
            options.referenceOverlayStyleUrl,
            abortController.signal
          );
        } catch (error) {
          if (abortController.signal.aborted) return;
          console.warn(
            "Satellite reference overlay could not be loaded",
            error
          );
        }
      }
      if (disposed) return;

      const initialSatelliteVisible = satelliteVisibleRef.current;
      const initialElevationEnabled = elevationEnabledRef.current;
      const map = new maplibregl.Map({
        container,
        style: buildSatelliteTerrainStyle({
          satelliteSource: options.satelliteSource,
          satelliteFallbackSource: options.satelliteFallbackSource,
          referenceOverlay,
          referenceOverlayVisibility: referenceOverlayVisibilityRef.current,
          terrainSource: options.terrainSource,
          terrainExaggeration: options.terrainExaggeration,
          satelliteVisible: initialSatelliteVisible,
          elevationEnabled: initialElevationEnabled,
        }),
        center: options.initialView.center,
        zoom: options.initialView.zoom,
        pitch: options.initialView.pitch ?? 0,
        bearing: options.initialView.bearing ?? 0,
        maxPitch: 85,
        renderWorldCopies: false,
        // Keep coarser in-flight tiles available as placeholders while a zoom
        // requests the next level. This trades a small amount of short-lived
        // work for continuous imagery instead of holes during navigation.
        cancelPendingTileRequestsWhileZooming: false,
        // Keep more previously visited levels available for fast camera moves.
        maxTileCacheZoomLevels: 8,
        attributionControl: false,
      });
      mapRef.current = map;
      referenceLayersRef.current = referenceOverlay?.layers ?? [];
      onMapReadyRef.current?.(map);

      const handleLoad = () => {
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
    })();

    return () => {
      disposed = true;
      abortController.abort();
      resizeObserver?.disconnect();
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      mapRef.current?.remove();
      mapRef.current = null;
      referenceLayersRef.current = [];
      onMapReadyRef.current?.(null);
    };
  }, []);

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

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height: "100%", width: "100%" }}
      role="region"
      aria-label={ariaLabel}
      data-testid="satellite-terrain-map"
    />
  );
});
