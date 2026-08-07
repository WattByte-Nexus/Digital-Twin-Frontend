import { memo, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  buildSatelliteTerrainStyle,
  type SatelliteRasterSource,
  type TerrainRasterSource,
} from "./satellite-terrain-style";

export interface SatelliteTerrainInitialView {
  center: [longitude: number, latitude: number];
  zoom: number;
  pitch?: number;
  bearing?: number;
}

export interface SatelliteTerrainMapProps {
  satelliteSource: SatelliteRasterSource;
  terrainSource: TerrainRasterSource;
  initialView: SatelliteTerrainInitialView;
  terrainExaggeration?: number;
  className?: string;
  ariaLabel?: string;
}

/**
 * A standalone, map-only Digital Twin surface. It intentionally owns no app
 * controls or product state yet: MapLibre renders a satellite raster draped
 * over tiled raster-DEM terrain, leaving later asset layers to build on a
 * working geographic foundation.
 */
export const SatelliteTerrainMap = memo(function SatelliteTerrainMap({
  satelliteSource,
  terrainSource,
  initialView,
  terrainExaggeration = 1,
  className,
  ariaLabel = "Satellite terrain map",
}: SatelliteTerrainMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Sources and camera are mount-time inputs. Changing datasets should remount
  // the component with a new key rather than diffing the foundational style.
  const initialOptionsRef = useRef({
    satelliteSource,
    terrainSource,
    initialView,
    terrainExaggeration,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const options = initialOptionsRef.current;
    const map = new maplibregl.Map({
      container,
      style: buildSatelliteTerrainStyle({
        satelliteSource: options.satelliteSource,
        terrainSource: options.terrainSource,
        terrainExaggeration: options.terrainExaggeration,
      }),
      center: options.initialView.center,
      zoom: options.initialView.zoom,
      pitch: options.initialView.pitch ?? 0,
      bearing: options.initialView.bearing ?? 0,
      maxPitch: 85,
      renderWorldCopies: false,
      attributionControl: { compact: false },
    });

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      map.remove();
    };
  }, []);

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
