import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  buildNetwork,
  pickedFeatureDetails,
  placementCoordinates,
} from "../apps/geolibre-desktop/public/plugins/distribution-network/dist/index.js";

const pluginRoot = new URL(
  "../apps/geolibre-desktop/public/plugins/distribution-network/",
  import.meta.url,
);

describe("distribution-network bundled plugin", () => {
  it("builds one conductor on each side over two spans and three aligned poles", async () => {
    const geojson = JSON.parse(
      await readFile(new URL("assets/testpowerlines.geojson", pluginRoot), "utf8"),
    );
    const network = buildNetwork(geojson);

    assert.equal(network.conductors.length, 4);
    assert.equal(network.poles.length, 3);
    assert.ok(network.conductors.every((conductor) => conductor.path.length === 2));
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
    assert.ok(network.poles.every((pole) => Number.isFinite(pole.bearing)));
    assert.ok(network.conductors.every((conductor) => conductor.lengthMeters > 0));
  });

  it("describes clicked poles by ID and clicked lines by length", () => {
    const network = buildNetwork({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [[0, 0], [0, 0.001]] },
        },
      ],
    });

    assert.deepEqual(pickedFeatureDetails(network.poles[0]), {
      title: "Distribution pole",
      rows: [{ label: "Pole ID", value: "pole-1" }],
    });
    assert.deepEqual(pickedFeatureDetails(network.conductors[0]), {
      title: "Distribution line",
      rows: [
        { label: "Line ID", value: "line-1-left" },
        { label: "Length", value: "111 m" },
      ],
    });
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
    assert.equal(network.conductors.length, 2);
    assert.ok(network.conductors.every((conductor) => conductor.path.length === 2));
  });

  it("aligns each pole with the local line bearing", () => {
    const network = buildNetwork({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [[0, 0], [0, 1], [1, 1]],
          },
        },
      ],
    });

    assert.ok(Math.abs(network.poles[0].bearing - 0) < 0.01);
    assert.ok(Math.abs(network.poles[1].bearing - 45) < 1);
    assert.ok(Math.abs(network.poles[2].bearing - 90) < 0.01);
    assert.ok(Math.abs(network.poles[0].modelYaw - 90) < 0.01);
    assert.ok(Math.abs(network.poles[1].modelYaw - 45) < 1);
    assert.ok(Math.abs(network.poles[2].modelYaw - 0) < 0.01);
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
