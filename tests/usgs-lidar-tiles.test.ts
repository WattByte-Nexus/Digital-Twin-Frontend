import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");
const TILESET_DIR = path.join(
  ROOT,
  "apps/geolibre-desktop/public/data/usgs-lidar/golden-pilot",
);

interface Tile {
  content?: { uri?: string };
  children?: Tile[];
}

function contentUris(tile: Tile): string[] {
  return [
    ...(tile.content?.uri ? [tile.content.uri] : []),
    ...(tile.children ?? []).flatMap(contentUris),
  ];
}

describe("Golden USGS LiDAR 3D Tiles pilot", () => {
  it("ships a sourced tileset whose point-tile references are valid", async () => {
    const tileset = JSON.parse(
      await readFile(path.join(TILESET_DIR, "tileset.json"), "utf8"),
    ) as { asset: { extras: Record<string, unknown> }; root: Tile };
    const source = JSON.parse(
      await readFile(path.join(TILESET_DIR, "source.json"), "utf8"),
    ) as { pointCount: number; source: string; rights: string };

    assert.equal(tileset.asset.extras.source, "U.S. Geological Survey 3D Elevation Program");
    assert.equal(tileset.asset.extras.rights, "Public domain");
    assert.ok(source.pointCount > 50_000);
    assert.match(source.source, /U\.S\. Geological Survey/);
    assert.match(source.rights, /Public domain/);

    const pointCloud = await readFile(path.join(TILESET_DIR, "points.bin"));
    assert.equal(pointCloud.subarray(0, 8).toString("ascii"), "GLPC0001");
    assert.equal(pointCloud.readUInt32LE(8), source.pointCount);
    assert.equal(pointCloud.byteLength, 36 + source.pointCount * 15);

    const uris = contentUris(tileset.root);
    assert.ok(uris.length > 1);
    for (const uri of uris) {
      assert.match(uri, /\.pnts$/);
      const tilePath = path.join(TILESET_DIR, uri);
      const [header, tileStat] = await Promise.all([readFile(tilePath), stat(tilePath)]);
      assert.equal(header.subarray(0, 4).toString("ascii"), "pnts");
      assert.equal(header.readUInt32LE(4), 1);
      assert.equal(header.readUInt32LE(8), tileStat.size);
    }
  });

  it("is available from the built-in 3D Tiles sample menu", async () => {
    const pluginSource = await readFile(
      path.join(ROOT, "packages/plugins/src/plugins/maplibre-3d-tiles.ts"),
      "utf8",
    );
    assert.match(pluginSource, /Golden USGS LiDAR \(3DEP\)/);
    assert.match(pluginSource, /\/data\/usgs-lidar\/golden-pilot\/tileset\.json/);
  });
});
