import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type maplibregl from "maplibre-gl";
import {
  ensureGeneratedImageHandler,
  registerGeneratedImage,
} from "../packages/map/src/generated-images";

interface FakeMapState {
  handlers: Map<string, (event: { id: string }) => void>;
  images: Map<string, { image: unknown; options?: { pixelRatio?: number } }>;
}

function fakeMap(): { map: maplibregl.Map; state: FakeMapState } {
  const state: FakeMapState = {
    handlers: new Map(),
    images: new Map(),
  };
  const map = {
    on(event: string, handler: (event: { id: string }) => void) {
      state.handlers.set(event, handler);
      return map;
    },
    hasImage(id: string) {
      return state.images.has(id);
    },
    addImage(id: string, image: unknown, options?: { pixelRatio?: number }) {
      state.images.set(id, { image, options });
      return map;
    },
  } as unknown as maplibregl.Map;
  return { map, state };
}

describe("ensureGeneratedImageHandler", () => {
  it("adds a transparent no-op image for basemap sprite IDs the style does not provide", () => {
    const { map, state } = fakeMap();
    ensureGeneratedImageHandler(map);

    state.handlers.get("styleimagemissing")?.({ id: "us-interstate_4" });

    const added = state.images.get("us-interstate_4");
    assert.ok(added, "the missing image request should be resolved");
    assert.deepEqual(added.image, {
      width: 1,
      height: 1,
      data: new Uint8Array([0, 0, 0, 0]),
    });
    assert.equal(added.options?.pixelRatio, 1);
  });

  it("still materializes registered GeoLibre images instead of the no-op fallback", () => {
    const { map, state } = fakeMap();
    const id = "geolibre-test-generated-image";
    const generated = {
      width: 1,
      height: 1,
      data: new Uint8Array([10, 20, 30, 255]),
    };
    registerGeneratedImage(id, () => ({ image: generated, pixelRatio: 2 }));
    ensureGeneratedImageHandler(map);

    state.handlers.get("styleimagemissing")?.({ id });

    assert.deepEqual(state.images.get(id), {
      image: generated,
      options: { pixelRatio: 2 },
    });
  });

  it("does not hide an unregistered GeoLibre image bug behind the fallback", () => {
    const { map, state } = fakeMap();
    ensureGeneratedImageHandler(map);

    state.handlers.get("styleimagemissing")?.({ id: "geolibre-missing-factory" });

    assert.equal(state.images.has("geolibre-missing-factory"), false);
  });
});
