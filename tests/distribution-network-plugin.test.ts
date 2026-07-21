import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { buildNetwork } from "../apps/geolibre-desktop/public/plugins/distribution-network/dist/index.js";

const pluginRoot = new URL(
  "../apps/geolibre-desktop/public/plugins/distribution-network/",
  import.meta.url,
);

describe("distribution-network bundled plugin", () => {
  it("builds exactly two consecutive spans and three pole placements", async () => {
    const geojson = JSON.parse(
      await readFile(new URL("assets/testpowerlines.geojson", pluginRoot), "utf8"),
    );
    const network = buildNetwork(geojson);

    assert.equal(network.spans.length, 2);
    assert.equal(network.poles.length, 3);
    assert.deepEqual(network.spans[0].path[1], network.spans[1].path[0]);
    assert.deepEqual(
      network.poles.map((pole) => pole.position.slice(0, 2)),
      [
        [-105.208906, 40.025324],
        [-105.209022, 40.024218],
        [-105.208791, 40.023422],
      ],
    );
  });

  it("declares a matching active-by-default plugin manifest", async () => {
    const manifest = JSON.parse(await readFile(new URL("plugin.json", pluginRoot), "utf8"));
    const { default: plugin } = await import(
      "../apps/geolibre-desktop/public/plugins/distribution-network/dist/index.js"
    );

    assert.equal(manifest.activeByDefault, true);
    assert.equal(plugin.id, manifest.id);
    assert.equal(plugin.name, manifest.name);
    assert.equal(plugin.version, manifest.version);
  });
});
