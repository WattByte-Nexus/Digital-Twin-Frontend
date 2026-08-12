import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SATELLITE_FALLBACK_LAYER_ID,
  SATELLITE_LAYER_ID,
  TERRAIN_GROUND_LAYER_ID,
} from "../packages/map/src/satellite-terrain-style";
import { DEFAULT_WEATHER_SETTINGS } from "../packages/ui/src/components/weather/types";
import {
  mountainWeatherDateTime,
  weatherSettingsDateMs,
} from "../apps/geolibre-desktop/src/product-modes/digital-twin/weather-settings-time";
import { createWeatherSunSimulationController } from "../apps/geolibre-desktop/src/product-modes/digital-twin/weather-sun-simulation";
import {
  timeOfDayIllumination,
  timeOfDayLightingOverlay,
  timeOfDaySky,
} from "../apps/geolibre-desktop/src/product-modes/digital-twin/weather-time-of-day-presentation";

function installCanvasStub() {
  const previousDocument = globalThis.document;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => null,
      }),
    },
  });
  return () => {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: previousDocument,
    });
  };
}

describe("weatherSettingsDateMs", () => {
  it("uses the popup's local date and time in manual mode", () => {
    const dateMs = weatherSettingsDateMs({
      ...DEFAULT_WEATHER_SETTINGS,
      date: "2026-08-07",
      hour: 18,
      minute: 45,
    });
    assert.equal(dateMs, new Date(2026, 7, 7, 18, 45).getTime());
  });

  it("tracks the current instant in automatic mode", () => {
    const now = Date.UTC(2026, 7, 7, 12, 30);
    assert.equal(
      weatherSettingsDateMs({ ...DEFAULT_WEATHER_SETTINGS, mode: "auto" }, now),
      now
    );
  });

  it("falls back to the current instant for an invalid date", () => {
    const now = Date.UTC(2026, 7, 7, 12, 30);
    assert.equal(
      weatherSettingsDateMs(
        { ...DEFAULT_WEATHER_SETTINGS, date: "not-a-date" },
        now
      ),
      now
    );
    assert.equal(
      weatherSettingsDateMs(
        { ...DEFAULT_WEATHER_SETTINGS, date: "2026-02-31" },
        now
      ),
      now
    );
  });
});

describe("mountainWeatherDateTime", () => {
  it("uses Mountain Daylight Time in summer", () => {
    assert.deepEqual(mountainWeatherDateTime("2026-08-12T18:07:00Z"), {
      date: "2026-08-12",
      hour: 12,
      minute: 7,
      month: 8,
    });
  });

  it("uses Mountain Standard Time and the local date in winter", () => {
    assert.deepEqual(mountainWeatherDateTime("2026-01-01T03:15:00Z"), {
      date: "2025-12-31",
      hour: 20,
      minute: 15,
      month: 12,
    });
  });
});

describe("timeOfDaySky", () => {
  it("moves from the night palette to the day palette with solar altitude", () => {
    const night = timeOfDaySky(-30);
    const day = timeOfDaySky(60);
    assert.equal(night["sky-color"], "rgb(7, 17, 31)");
    assert.equal(day["sky-color"], "rgb(136, 198, 252)");
    assert.notEqual(night["horizon-color"], day["horizon-color"]);
  });

  it("warms the horizon around twilight", () => {
    const night = timeOfDaySky(-30);
    const twilight = timeOfDaySky(-2);
    assert.notEqual(twilight["horizon-color"], night["horizon-color"]);
  });

  it("returns bounded illumination for local raster dimming", () => {
    assert.equal(timeOfDayIllumination(-30), 0);
    assert.equal(timeOfDayIllumination(60), 1);
    assert.ok(timeOfDayIllumination(0) > 0);
    assert.ok(timeOfDayIllumination(0) < 1);
  });

  it("provides a global lighting overlay that is strongest at night", () => {
    const night = timeOfDayLightingOverlay(-30);
    const twilight = timeOfDayLightingOverlay(-2);
    const day = timeOfDayLightingOverlay(60);

    assert.ok(night.opacity >= 0.6);
    assert.ok(twilight.opacity > day.opacity);
    assert.equal(day.opacity, 0);
    assert.notEqual(night.color, twilight.color);
  });
});

describe("createWeatherSunSimulationController", () => {
  it("applies popup time to sky, imagery, and numeric hillshade lighting", () => {
    const restoreDocument = installCanvasStub();
    let styleLoaded = false;
    const layers = new Set<string>([
      SATELLITE_FALLBACK_LAYER_ID,
      SATELLITE_LAYER_ID,
      TERRAIN_GROUND_LAYER_ID,
    ]);
    const sources = new Map<string, unknown>();
    const listeners = new Map<string, Set<() => void>>();
    const paint = new Map<string, unknown>([
      [`${SATELLITE_LAYER_ID}:raster-brightness-max`, 1],
      [`${SATELLITE_LAYER_ID}:raster-brightness-min`, 0],
      [`${SATELLITE_LAYER_ID}:raster-saturation`, 0],
      [`${SATELLITE_FALLBACK_LAYER_ID}:raster-brightness-max`, 1],
      [`${SATELLITE_FALLBACK_LAYER_ID}:raster-brightness-min`, 0],
      [`${SATELLITE_FALLBACK_LAYER_ID}:raster-saturation`, 0],
      [`${TERRAIN_GROUND_LAYER_ID}:hillshade-illumination-direction`, 335],
      [`${TERRAIN_GROUND_LAYER_ID}:hillshade-illumination-altitude`, 45],
    ]);
    const skies: unknown[] = [];
    const lightingOverlays: unknown[] = [];
    const map = {
      addLayer: (layer: { id: string }) => layers.add(layer.id),
      addSource: (id: string, source: unknown) => sources.set(id, source),
      getCenter: () => ({ lat: 40, lng: -105 }),
      getLayer: (id: string) => (layers.has(id) ? { id } : undefined),
      getLight: () => ({ anchor: "viewport", intensity: 0.5 }),
      getPaintProperty: (id: string, property: string) =>
        paint.get(`${id}:${property}`),
      getSky: () => undefined,
      getSource: (id: string) => sources.get(id),
      isStyleLoaded: () => styleLoaded,
      off: (event: string, listener: () => void) =>
        listeners.get(event)?.delete(listener),
      on: (event: string, listener: () => void) => {
        const eventListeners = listeners.get(event) ?? new Set();
        eventListeners.add(listener);
        listeners.set(event, eventListeners);
      },
      removeLayer: (id: string) => layers.delete(id),
      removeSource: (id: string) => sources.delete(id),
      setLight: () => undefined,
      setPaintProperty: (id: string, property: string, nextValue: unknown) =>
        paint.set(`${id}:${property}`, nextValue),
      setSky: (sky: unknown) => {
        if (!styleLoaded) throw new Error("Style is not done loading");
        skies.push(sky);
      },
    };

    try {
      const controller = createWeatherSunSimulationController(
        map as never,
        {
          ...DEFAULT_WEATHER_SETTINGS,
          date: "2026-08-07",
          hour: 2,
          minute: 0,
        },
        (overlay) => lightingOverlays.push(overlay)
      );

      assert.ok(lightingOverlays.length > 0);
      assert.equal(skies.length, 0);

      styleLoaded = true;
      for (const listener of listeners.get("style.load") ?? []) listener();
      assert.ok(skies.length > 0);
      assert.equal(
        typeof paint.get(
          `${TERRAIN_GROUND_LAYER_ID}:hillshade-illumination-direction`
        ),
        "number"
      );
      assert.equal(
        typeof paint.get(
          `${TERRAIN_GROUND_LAYER_ID}:hillshade-illumination-altitude`
        ),
        "number"
      );
      assert.ok(
        (paint.get(`${SATELLITE_LAYER_ID}:raster-brightness-max`) as number) < 1
      );

      controller.destroy();
      controller.destroy();
      assert.equal(listeners.get("style.load")?.size, 0);
      assert.equal(paint.get(`${SATELLITE_LAYER_ID}:raster-brightness-max`), 1);
    } finally {
      restoreDocument();
    }
  });
});
