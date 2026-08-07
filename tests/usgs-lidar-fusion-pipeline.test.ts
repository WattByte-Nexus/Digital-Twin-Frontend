import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const ROOT = path.resolve(import.meta.dirname, "..");
const SCRIPT = path.join(ROOT, "scripts/build-usgs-lidar-tiles.py");
const DATASET = path.join(
  ROOT,
  "apps/geolibre-desktop/public/data/usgs-lidar/golden-city",
);

describe("Golden LiDAR imagery-fusion pipeline", () => {
  it("builds an imagery-colored above-ground point cloud", async () => {
    const source = JSON.parse(
      await readFile(path.join(DATASET, "source.json"), "utf8"),
    ) as {
      classifications: number[];
      pointColoring: {
        imagerySize: number;
        mode: string;
        sourceUrl: string;
      };
    };

    assert.ok(!source.classifications.includes(2), "ground is supplied by terrain");
    assert.ok(source.classifications.includes(1), "unclassified returns retain canopy and structures");
    assert.equal(source.pointColoring.mode, "imagery-overlay");
    assert.ok(source.pointColoring.imagerySize >= 1024);
    assert.match(source.pointColoring.sourceUrl, /ImageServer/);
  });

  it("does not emit the obsolete monolithic points buffer", async () => {
    const script = await readFile(SCRIPT, "utf8");
    assert.doesNotMatch(script, /write_map_workspace_point_cloud/);

    await assert.rejects(
      access(path.join(DATASET, "points.bin")),
      /ENOENT/,
    );
  });
});
