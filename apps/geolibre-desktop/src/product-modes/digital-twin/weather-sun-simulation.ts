import {
  SATELLITE_FALLBACK_LAYER_ID,
  SATELLITE_LAYER_ID,
  TERRAIN_GROUND_LAYER_ID,
} from "@geolibre/map/satellite-terrain-style";
import {
  createSunSimulationController,
  DEFAULT_SUN_SETTINGS,
  sunPositionAt,
} from "@geolibre/plugins/maplibre-sun";
import type { WeatherSettingsValue } from "@geolibre/ui";
import type { Map as MapLibreMap } from "maplibre-gl";
import { weatherSettingsDateMs } from "./weather-settings-time";
import {
  timeOfDayIllumination,
  timeOfDayLightingOverlay,
  timeOfDaySky,
  type TimeOfDayLightingOverlay,
} from "./weather-time-of-day-presentation";

const AUTO_CLOCK_REFRESH_MS = 60_000;

export interface WeatherSunSimulationController {
  destroy: () => void;
  update: (value: WeatherSettingsValue) => void;
}

interface RasterPresentation {
  brightnessMax: number;
  brightnessMin: number;
  saturation: number;
}

const SATELLITE_LAYER_IDS = [
  SATELLITE_FALLBACK_LAYER_ID,
  SATELLITE_LAYER_ID,
] as const;

function numericPaintValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Product adapter between the Weather popup state and GeoLibre's headless Sun
 * renderer. It deliberately owns no UI: changing the popup's date or time
 * updates the night mask, directional light, sky, imagery, and hillshade.
 */
export function createWeatherSunSimulationController(
  map: MapLibreMap,
  initialValue: WeatherSettingsValue,
  onLightingOverlayChange: (overlay: TimeOfDayLightingOverlay) => void,
): WeatherSunSimulationController {
  let value = initialValue;
  let autoClock: ReturnType<typeof setInterval> | null = null;
  let destroyed = false;
  let baseSky = map.isStyleLoaded() ? map.getSky() : undefined;
  let baseHillshadeDirection: unknown;
  let baseHillshadeAltitude: unknown;
  const baseRasterPresentation = new Map<string, RasterPresentation>();
  const sun = createSunSimulationController(map, {
    ...DEFAULT_SUN_SETTINGS,
    dateMs: weatherSettingsDateMs(initialValue),
  });

  const captureHillshade = () => {
    if (!map.getLayer(TERRAIN_GROUND_LAYER_ID)) return;
    baseHillshadeDirection = map.getPaintProperty(
      TERRAIN_GROUND_LAYER_ID,
      "hillshade-illumination-direction",
    );
    baseHillshadeAltitude = map.getPaintProperty(
      TERRAIN_GROUND_LAYER_ID,
      "hillshade-illumination-altitude",
    );
  };

  const captureRasterPresentation = () => {
    baseRasterPresentation.clear();
    for (const layerId of SATELLITE_LAYER_IDS) {
      if (!map.getLayer(layerId)) continue;
      baseRasterPresentation.set(layerId, {
        brightnessMax: numericPaintValue(
          map.getPaintProperty(layerId, "raster-brightness-max"),
          1,
        ),
        brightnessMin: numericPaintValue(
          map.getPaintProperty(layerId, "raster-brightness-min"),
          0,
        ),
        saturation: numericPaintValue(
          map.getPaintProperty(layerId, "raster-saturation"),
          0,
        ),
      });
    }
  };

  const applyPresentation = (dateMs: number) => {
    const center = map.getCenter();
    const { altitude, azimuth } = sunPositionAt(dateMs, center.lat, center.lng);
    const illumination = timeOfDayIllumination(altitude);
    onLightingOverlayChange(timeOfDayLightingOverlay(altitude));
    if (!map.isStyleLoaded()) return;
    map.setSky(timeOfDaySky(altitude));
    for (const [layerId, base] of baseRasterPresentation) {
      if (!map.getLayer(layerId)) continue;
      map.setPaintProperty(
        layerId,
        "raster-brightness-max",
        base.brightnessMax * (0.12 + illumination * 0.88),
      );
      map.setPaintProperty(
        layerId,
        "raster-brightness-min",
        base.brightnessMin * illumination,
      );
      map.setPaintProperty(
        layerId,
        "raster-saturation",
        Math.max(-1, base.saturation - (1 - illumination) * 0.4),
      );
    }
    if (map.getLayer(TERRAIN_GROUND_LAYER_ID)) {
      map.setPaintProperty(
        TERRAIN_GROUND_LAYER_ID,
        "hillshade-illumination-direction",
        azimuth,
      );
      map.setPaintProperty(
        TERRAIN_GROUND_LAYER_ID,
        "hillshade-illumination-altitude",
        Math.max(5, altitude),
      );
    }
  };

  const stopAutoClock = () => {
    if (autoClock === null) return;
    clearInterval(autoClock);
    autoClock = null;
  };

  const syncClock = () => {
    const dateMs = weatherSettingsDateMs(value);
    sun.setSettings({
      dateMs,
      playing: false,
    });
    applyPresentation(dateMs);
  };

  const syncAutoClock = () => {
    stopAutoClock();
    if (value.mode !== "auto") return;
    autoClock = setInterval(syncClock, AUTO_CLOCK_REFRESH_MS);
  };

  const handleStyleLoad = () => {
    baseSky = map.getSky();
    captureHillshade();
    captureRasterPresentation();
    syncClock();
  };

  map.on("style.load", handleStyleLoad);
  if (map.isStyleLoaded()) handleStyleLoad();
  else syncClock();
  syncAutoClock();

  return {
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      stopAutoClock();
      map.off("style.load", handleStyleLoad);
      sun.destroy();
      if (baseSky) map.setSky(baseSky);
      for (const [layerId, base] of baseRasterPresentation) {
        if (!map.getLayer(layerId)) continue;
        map.setPaintProperty(
          layerId,
          "raster-brightness-max",
          base.brightnessMax,
        );
        map.setPaintProperty(
          layerId,
          "raster-brightness-min",
          base.brightnessMin,
        );
        map.setPaintProperty(layerId, "raster-saturation", base.saturation);
      }
      if (map.getLayer(TERRAIN_GROUND_LAYER_ID)) {
        map.setPaintProperty(
          TERRAIN_GROUND_LAYER_ID,
          "hillshade-illumination-direction",
          baseHillshadeDirection,
        );
        map.setPaintProperty(
          TERRAIN_GROUND_LAYER_ID,
          "hillshade-illumination-altitude",
          baseHillshadeAltitude,
        );
      }
    },
    update: (nextValue) => {
      if (destroyed) return;
      const modeChanged = value.mode !== nextValue.mode;
      value = nextValue;
      syncClock();
      if (modeChanged) syncAutoClock();
    },
  };
}
