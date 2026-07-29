import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { DEFAULT_LAYER_STYLE, useAppStore } from "../packages/core/src";
import type { GeoLibreAppAPI } from "../packages/plugins/src/types";
import {
  createIllustrativeWindField,
  createWindParticleController,
  type WindField,
  type WindParticleDependencies,
} from "../packages/plugins/src/plugins/maplibre-wind-particles";

const field: WindField = {
  ...createIllustrativeWindField(4, 3),
  dataLabel: "Test field",
};

function makeHarness(loadField: () => Promise<WindField> = async () => field) {
  const rendered: unknown[][] = [];
  const layerProps: Record<string, unknown>[] = [];
  let ensureCount = 0;
  const dependencies: WindParticleDependencies = {
    loadField,
    ensureOverlay: async () => {
      ensureCount += 1;
      return {};
    },
    createLayer: (props) => {
      layerProps.push(props as unknown as Record<string, unknown>);
      return { id: props.id } as never;
    },
    setLayers: (layers) => rendered.push(layers),
  };
  return {
    controller: createWindParticleController(dependencies),
    rendered,
    layerProps,
    get ensureCount() {
      return ensureCount;
    },
  };
}

beforeEach(() => {
  useAppStore.setState({
    layers: [],
    layerGroups: [],
    selectedLayerId: null,
    isDirty: false,
  });
});

describe("wind particles", () => {
  it("builds a global RGBA byte vector field with varying flow", () => {
    const generated = createIllustrativeWindField(4, 3);
    assert.equal(generated.image.width, 4);
    assert.equal(generated.image.height, 3);
    assert.equal(generated.image.data.length, 4 * 3 * 4);
    assert.equal(generated.image.data instanceof Uint8ClampedArray, true);
    assert.deepEqual(generated.imageUnscale, [-32, 32]);
    assert.deepEqual(generated.bounds, [-180, -90, 180, 90]);

    const values = [...generated.image.data].filter(
      (_value, index) => index % 4 < 2
    );
    assert.equal(values.every(Number.isFinite), true);
    assert.ok(
      new Set(values.map((value) => value.toFixed(3))).size > 4,
      "flow varies by position"
    );
  });

  it("adds a persisted layer, follows layer visibility/opacity, and clears on deactivate", async () => {
    const harness = makeHarness();
    const projections: string[] = [];
    const app = {
      setMapProjection: (projection: string) => projections.push(projection),
    } as unknown as GeoLibreAppAPI;

    assert.equal(await harness.controller.activate(app), true);
    assert.equal(harness.ensureCount, 1);
    assert.deepEqual(projections, ["mercator"]);

    const owned = useAppStore
      .getState()
      .layers.filter((layer) => layer.metadata.windParticleLayer === true);
    assert.equal(owned.length, 1);
    assert.equal(owned[0].metadata.externalDeckLayer, true);
    assert.equal(owned[0].metadata.windDataKind, "illustrative");
    assert.equal(harness.layerProps.at(-1)?.visible, true);
    assert.equal(harness.layerProps.at(-1)?.opacity, 0.82);
    assert.equal(harness.layerProps.at(-1)?.numParticles, 5_000);

    useAppStore
      .getState()
      .updateLayer(owned[0].id, { visible: false, opacity: 0.35 });
    assert.equal(harness.layerProps.at(-1)?.visible, false);
    assert.equal(harness.layerProps.at(-1)?.opacity, 0.35);

    harness.controller.setParticleCount(7_500);
    harness.controller.setSpeedFactor(0.7);
    harness.controller.setAnimating(false);
    assert.equal(harness.layerProps.at(-1)?.numParticles, 7_500);
    assert.equal(harness.layerProps.at(-1)?.speedFactor, 0.7);
    assert.equal(harness.layerProps.at(-1)?.animate, false);
    assert.deepEqual(
      useAppStore.getState().layers[0].metadata.windParticleSettings,
      {
        animate: false,
        numParticles: 7_500,
        speedFactor: 0.7,
      }
    );

    harness.controller.deactivate();
    assert.equal(
      useAppStore
        .getState()
        .layers.some((layer) => layer.metadata.windParticleLayer === true),
      false
    );
    assert.deepEqual(harness.rendered.at(-1), []);
  });

  it("adopts a restored layer and its saved particle settings without duplicating it", async () => {
    useAppStore.getState().addLayer({
      id: "restored-wind",
      name: "Wind particles",
      type: "deckgl-viz",
      source: { type: "weather-wind" },
      visible: true,
      opacity: 0.6,
      style: { ...DEFAULT_LAYER_STYLE },
      metadata: {
        windParticleLayer: true,
        externalDeckLayer: true,
        windParticleSettings: {
          animate: false,
          numParticles: 8_000,
          speedFactor: 0.4,
        },
      },
    });

    const harness = makeHarness();
    assert.equal(await harness.controller.activate({} as GeoLibreAppAPI), true);
    assert.equal(
      useAppStore
        .getState()
        .layers.filter((layer) => layer.metadata.windParticleLayer === true)
        .length,
      1
    );
    assert.equal(harness.layerProps.at(-1)?.animate, false);
    assert.equal(harness.layerProps.at(-1)?.numParticles, 8_000);
    assert.equal(harness.layerProps.at(-1)?.speedFactor, 0.4);
    assert.equal(harness.layerProps.at(-1)?.opacity, 0.6);
    harness.controller.deactivate();
  });

  it("does not resurrect particles when deactivated during an in-flight data load", async () => {
    let release: ((value: WindField) => void) | undefined;
    const harness = makeHarness(
      () =>
        new Promise<WindField>((resolve) => {
          release = resolve;
        })
    );
    const activating = harness.controller.activate({} as GeoLibreAppAPI);
    harness.controller.deactivate();
    release?.(field);

    assert.equal(await activating, false);
    assert.equal(useAppStore.getState().layers.length, 0);
    assert.deepEqual(harness.rendered.at(-1), []);
  });
});
