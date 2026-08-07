import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createSunSimulationController,
  DEFAULT_SUN_SETTINGS,
  advanceSunClock,
  getSunSettings,
  isSunPanelVisible,
  normalizeSunSettings,
  setSunSettings,
  SUN_SHADE_MAX,
  SUN_SPEED_MAX,
  SUN_SPEED_MIN,
  subsolarPoint,
  sunEquatorialPosition,
  sunPositionAt,
} from "../packages/plugins/src/plugins/maplibre-sun";

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

describe("normalizeSunSettings", () => {
  it("fills defaults for missing/invalid fields", () => {
    const s = normalizeSunSettings({});
    assert.deepEqual(s, DEFAULT_SUN_SETTINGS);
  });

  it("clamps speed and shade into range and coerces types", () => {
    const s = normalizeSunSettings({
      speed: 100000,
      shadeOpacity: 5,
      playing: "yes" as unknown as boolean,
      dateMs: Number.NaN,
    });
    assert.equal(s.speed, SUN_SPEED_MAX);
    assert.equal(s.shadeOpacity, SUN_SHADE_MAX);
    // Non-boolean playing falls back to the default, NaN date to the default.
    assert.equal(s.playing, DEFAULT_SUN_SETTINGS.playing);
    assert.equal(s.dateMs, DEFAULT_SUN_SETTINGS.dateMs);
  });

  it("keeps a valid low speed and floors are respected", () => {
    assert.equal(normalizeSunSettings({ speed: -10 }).speed, SUN_SPEED_MIN);
  });
});

describe("solar declination", () => {
  it("is near +23.4° at the June solstice and near -23.4° at December", () => {
    const june = sunEquatorialPosition(Date.UTC(2024, 5, 20, 20, 51));
    assert.ok(Math.abs(june.delta - 23.44) < 0.4, `June declination ${june.delta} not near +23.44`);
    const dec = sunEquatorialPosition(Date.UTC(2024, 11, 21, 9, 21));
    assert.ok(
      Math.abs(dec.delta + 23.44) < 0.4,
      `December declination ${dec.delta} not near -23.44`,
    );
  });

  it("is near 0° at the equinoxes", () => {
    const mar = sunEquatorialPosition(Date.UTC(2024, 2, 20, 3, 6));
    assert.ok(Math.abs(mar.delta) < 0.7, `March declination ${mar.delta}`);
  });
});

describe("subsolarPoint / sunPositionAt round trip", () => {
  // Sampling several instants across a year is the strongest end-to-end check:
  // the sun must sit ~overhead at its own subsolar point and ~underfoot at the
  // antipode, which only holds if declination, sidereal time, and the hour
  // angle all agree.
  const instants = [
    Date.UTC(2024, 0, 5, 3, 0),
    Date.UTC(2024, 3, 15, 12, 30),
    Date.UTC(2024, 6, 21, 18, 45),
    Date.UTC(2024, 9, 2, 6, 15),
    Date.UTC(2025, 1, 11, 21, 0),
  ];

  for (const dateMs of instants) {
    it(`sun is overhead at its subsolar point (${new Date(dateMs).toISOString()})`, () => {
      const { lat, lng } = subsolarPoint(dateMs);
      const here = sunPositionAt(dateMs, lat, lng);
      assert.ok(here.altitude > 89, `altitude ${here.altitude} at subsolar point should be ~90`);
      const anti = sunPositionAt(dateMs, -lat, lng + 180);
      assert.ok(anti.altitude < -89, `altitude ${anti.altitude} at antipode should be ~-90`);
    });
  }

  it("declination equals the subsolar latitude", () => {
    const dateMs = Date.UTC(2024, 7, 1, 9, 0);
    const { lat } = subsolarPoint(dateMs);
    const { delta } = sunEquatorialPosition(dateMs);
    assert.ok(Math.abs(lat - delta) < 1e-9);
  });
});

describe("advanceSunClock", () => {
  it("loops within the displayed local day", () => {
    const start = new Date(2024, 0, 15, 23, 59, 0).getTime();
    setSunSettings({ ...DEFAULT_SUN_SETTINGS, dateMs: start, loop: true });
    advanceSunClock(2 * 60 * 1000);

    const next = new Date(getSunSettings().dateMs);
    assert.equal(next.getFullYear(), 2024);
    assert.equal(next.getMonth(), 0);
    assert.equal(next.getDate(), 15);
    assert.equal(next.getHours(), 0);
    assert.equal(next.getMinutes(), 1);

    setSunSettings(DEFAULT_SUN_SETTINGS);
  });
});

describe("createSunSimulationController", () => {
  it("drives the existing sun renderer without opening the Sun panel", () => {
    const restoreDocument = installCanvasStub();
    const sources = new Map<string, unknown>();
    const layers = new Set<string>();
    const listeners = new Map<string, Set<() => void>>();
    const lights: unknown[] = [];
    const map = {
      addLayer: (layer: { id: string }) => layers.add(layer.id),
      addSource: (id: string, source: unknown) => sources.set(id, source),
      getCenter: () => ({ lat: 40, lng: -105 }),
      getLayer: (id: string) => (layers.has(id) ? { id } : undefined),
      getLight: () => ({ anchor: "viewport", intensity: 0.5 }),
      getSource: (id: string) => sources.get(id),
      isStyleLoaded: () => true,
      off: (event: string, listener: () => void) => listeners.get(event)?.delete(listener),
      on: (event: string, listener: () => void) => {
        const eventListeners = listeners.get(event) ?? new Set();
        eventListeners.add(listener);
        listeners.set(event, eventListeners);
      },
      removeLayer: (id: string) => layers.delete(id),
      removeSource: (id: string) => sources.delete(id),
      setLight: (light: unknown) => lights.push(light),
    };

    try {
      const controller = createSunSimulationController(
        map as never,
        { ...DEFAULT_SUN_SETTINGS, dateMs: Date.UTC(2024, 5, 21, 18) },
      );

      assert.equal(layers.has("geolibre-sun-night-layer"), true);
      assert.equal(sources.has("geolibre-sun-night-source"), true);
      assert.equal(lights.length, 1);
      assert.equal(controller.getSettings().dateMs, Date.UTC(2024, 5, 21, 18));
      assert.equal(
        controller.setSettings({ dateMs: Date.UTC(2024, 5, 21, 19) }),
        true,
      );
      assert.equal(lights.length, 2);
      assert.equal(isSunPanelVisible(), false);

      controller.destroy();
      assert.equal(layers.has("geolibre-sun-night-layer"), false);
      assert.equal(sources.has("geolibre-sun-night-source"), false);
      assert.equal(listeners.get("styledata")?.size, 0);
    } finally {
      restoreDocument();
    }
  });
});
