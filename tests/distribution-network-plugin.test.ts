import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  buildNetwork,
  placementCoordinates,
} from "../apps/geolibre-desktop/public/plugins/distribution-network/dist/index.js";

const pluginRoot = new URL(
  "../apps/geolibre-desktop/public/plugins/distribution-network/",
  import.meta.url,
);

describe("distribution-network bundled plugin", () => {
  it("builds four parallel conductors over two spans and three pole placements", async () => {
    const geojson = JSON.parse(
      await readFile(new URL("assets/testpowerlines.geojson", pluginRoot), "utf8"),
    );
    const network = buildNetwork(geojson);

    assert.equal(network.conductors.length, 4);
    assert.equal(network.poles.length, 3);
    assert.ok(network.conductors.every((conductor) => conductor.path.length === 3));
    assert.equal(
      new Set(network.conductors.map((conductor) => conductor.path[0].slice(0, 2).join(",")))
        .size,
      4,
    );
    assert.deepEqual(
      network.poles.map((pole) => pole.position.slice(0, 2)),
      [
        [-105.208906, 40.025324],
        [-105.209022, 40.024218],
        [-105.208791, 40.023422],
      ],
    );
  });

  it("extracts unique model placements from point GeoJSON", () => {
    assert.deepEqual(
      placementCoordinates({
        type: "FeatureCollection",
        features: [
          { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [1, 2] } },
          {
            type: "Feature",
            properties: {},
            geometry: { type: "MultiPoint", coordinates: [[3, 4], [1, 2]] },
          },
        ],
      }),
      [[1, 2], [3, 4]],
    );
  });

  it("connects point-based pole positions when no line geometry is present", () => {
    const network = buildNetwork({
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [-105, 40] } },
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [-105.001, 40.001] },
        },
      ],
    });

    assert.equal(network.poles.length, 2);
    assert.equal(network.conductors.length, 4);
    assert.ok(network.conductors.every((conductor) => conductor.path.length === 2));
  });

  it("declares a matching active-by-default plugin manifest", async () => {
    const manifest = JSON.parse(await readFile(new URL("plugin.json", pluginRoot), "utf8"));
    const { default: plugin } = await import(
      "../apps/geolibre-desktop/public/plugins/distribution-network/dist/index.js"
    );

    assert.equal(manifest.activeByDefault, true);
    assert.equal(manifest.style, "dist/style.css");
    assert.equal(plugin.id, manifest.id);
    assert.equal(plugin.name, manifest.name);
    assert.equal(plugin.version, manifest.version);
  });
});
