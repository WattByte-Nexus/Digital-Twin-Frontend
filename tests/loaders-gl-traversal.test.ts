import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { Tile3D, TILE_CONTENT_STATE, TILE_REFINEMENT } from "@loaders.gl/tiles";
import { RequestScheduler } from "@loaders.gl/loader-utils";
import { Tileset3DTraverser } from "../node_modules/@loaders.gl/tiles/dist/tileset/format-3d-tiles/tileset-3d-traverser.js";

const require = createRequire(import.meta.url);
const cjs = require("@loaders.gl/tiles");
const installedDir = path.resolve("node_modules/@loaders.gl/tiles");
const patchedFiles = [
  "src/tileset/tileset-traverser.ts",
  "dist/tileset/tileset-traverser.js",
  "dist/index.cjs",
];

async function patchLoadersGlTraversal(directory: string) {
  const patch = await import("../scripts/patch-loaders-gl-traversal.mjs");
  return patch.patchLoadersGlTraversal(directory);
}

// Exercise real traversal, tile getters/priority, and scheduling. Only the camera
// visibility update and cache are inert, keeping these tests GPU/network-free.
function createGroup(Traverser = Tileset3DTraverser, Tile = Tile3D) {
  const traverser = new Traverser({});
  const tileset = {
    memoryAdjustedScreenSpaceError: 8,
    _cache: { touch() {} },
    _frameNumber: 0,
    _traverser: traverser,
  };
  function makeTile(id: string, ready = false): Tile3D {
    return Object.assign(Object.create(Tile.prototype), {
      id, header: {}, parent: null, children: [], tileset,
      refine: TILE_REFINEMENT.REPLACE,
      contentState: ready ? TILE_CONTENT_STATE.READY : TILE_CONTENT_STATE.UNLOADED,
      hasEmptyContent: false, hasTilesetContent: false, _expiredContent: null,
      _visible: true, _inRequestVolume: true, _distanceToCamera: 1,
      _screenSpaceError: 0, _touchedFrame: 0,
      updateVisibility() {},
    });
  }
  const root = makeTile("root", true);
  root._screenSpaceError = 100;
  const children = Array.from({ length: 8 }, (_, i) => {
    const child = makeTile(`child-${i}`);
    child.parent = root;
    return child;
  });
  root.children = children;
  const frame = () => {
    traverser.traverse(root, {
      frameNumber: ++tileset._frameNumber,
      viewport: { id: "test" },
    }, {});
    return {
      requested: Object.keys(traverser.requestedTiles).sort(),
      selected: Object.keys(traverser.selectedTiles).sort(),
    };
  };
  return { traverser, root, children, makeTile, frame };
}

for (const [format, Traverser, Tile] of [
  ["browser ESM 3D Tiles", Tileset3DTraverser, Tile3D],
  ["CommonJS", cjs.TilesetTraverser, cjs.Tile3D],
] as const) {
  describe(`loaders.gl replacement traversal (${format})`, () => {
    it("discovers eight cold siblings in one pass and keeps the parent until all are ready", () => {
      const { root, children, frame } = createGroup(Traverser, Tile);
      assert.deepEqual(frame(), {
        requested: children.map((tile) => tile.id), selected: ["root"],
      });
      assert.equal(root._shouldRefine, false);
      children[7].contentState = TILE_CONTENT_STATE.READY;
      assert.deepEqual(frame(), {
        requested: children.slice(0, 7).map((tile) => tile.id),
        // Upstream permits ready child + parent overlap during refinement.
        selected: ["child-7", "root"],
      });
      assert.equal(root._shouldRefine, false);
      for (const tile of children) tile.contentState = TILE_CONTENT_STATE.READY;
      assert.deepEqual(frame(), {
        requested: [], selected: children.map((tile) => tile.id),
      });
      assert.equal(root._shouldRefine, true);
    });

    it("visits later offscreen siblings and nested branches while retaining both coverage levels", () => {
      const { children, makeTile, frame } = createGroup(Traverser, Tile);
      children[1]._visible = false;
      const nested = children[7];
      nested.contentState = TILE_CONTENT_STATE.READY;
      nested._screenSpaceError = 100;
      const descendants = [makeTile("nested-0"), makeTile("nested-1")];
      for (const tile of descendants) tile.parent = nested;
      nested.children = descendants;
      assert.deepEqual(frame(), {
        requested: [...children.slice(0, 7), ...descendants].map((tile) => tile.id),
        selected: ["child-7", "root"],
      });
      assert.equal(nested._shouldRefine, false);
      for (const tile of children) tile.contentState = TILE_CONTENT_STATE.READY;
      assert.deepEqual(frame(), {
        requested: descendants.map((tile) => tile.id),
        selected: children.filter((tile) => tile._visible).map((tile) => tile.id),
      });
      for (const tile of descendants) tile.contentState = TILE_CONTENT_STATE.READY;
      assert.deepEqual(frame(), {
        requested: [],
        selected: [...children.slice(0, 7).filter((tile) => tile._visible), ...descendants].map((tile) => tile.id),
      });
      assert.equal(nested._shouldRefine, true);
    });

    it("keeps request-volume coverage blocked while still discovering later empty branches", () => {
      const { root, children, makeTile, frame } = createGroup(Traverser, Tile);
      for (const tile of children) tile.contentState = TILE_CONTENT_STATE.READY;
      children[0]._inRequestVolume = false;
      const emptyBranch = children[7];
      emptyBranch.hasEmptyContent = true;
      emptyBranch._screenSpaceError = 100;
      const descendant = makeTile("nested");
      descendant.parent = emptyBranch;
      emptyBranch.children = [descendant];
      const result = frame();
      assert.deepEqual(result.requested, ["nested"]);
      assert.ok(result.selected.includes("root"));
      assert.equal(root._shouldRefine, false);
      descendant.contentState = TILE_CONTENT_STATE.READY;
      frame();
      assert.equal(root._shouldRefine, false);
      children[0]._inRequestVolume = true;
      assert.ok(!frame().selected.includes("root"));
      assert.equal(root._shouldRefine, true);
    });

    it("preserves 4.4.3 offscreen prefetch policy without refining outside request volume", () => {
      const { root, children, frame } = createGroup(Traverser, Tile);
      children[1]._inRequestVolume = false;
      assert.equal(frame().requested.length, 8);
      for (const tile of children) tile.contentState = TILE_CONTENT_STATE.READY;
      assert.ok(frame().selected.includes("root"));
      assert.equal(root._shouldRefine, false);
    });

    it("bounds concurrent loading and cancels queued requests after zooming out", async (t) => {
      t.mock.timers.enable({ apis: ["setTimeout"] });
      const { root, traverser, frame } = createGroup(Traverser, Tile);
      const scheduler = new RequestScheduler({ maxRequests: 2 });
      frame();
      const requests = Object.values(traverser.requestedTiles).map((tile: Tile3D) => {
        tile.contentState = TILE_CONTENT_STATE.LOADING;
        return scheduler.scheduleRequest(tile.id, tile._getPriority.bind(tile));
      });
      assert.equal(requests.length, 8);
      t.mock.timers.tick(0);
      assert.equal(scheduler.activeRequestCount, 2);
      const tokens = await Promise.all(requests.slice(0, 2));
      assert.ok(tokens.every(Boolean));
      root._screenSpaceError = 0;
      assert.deepEqual(frame(), { requested: [], selected: ["root"] });
      for (const token of tokens) token!.done();
      t.mock.timers.tick(0);
      assert.deepEqual(await Promise.all(requests.slice(2)), Array(6).fill(null));
      assert.equal(scheduler.activeRequestCount, 0);
    });
  });
}

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "loaders-gl-patch-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, "package.json"), JSON.stringify({
    name: "@loaders.gl/tiles", version: "4.4.3",
  }));
  const originals = new Map<string, string>();
  for (const file of patchedFiles) {
    const installed = await readFile(path.join(installedDir, file), "utf8");
    const step = file.endsWith(".js") ? "    " : "  ";
    const original = installed.replace(
      /^( *)\/\/ Readiness controls replacement, not discovery\.\n\1\/\/ Visit every sibling before deciding whether to refine\.\n\1\/\/ Backport: visgl\/loaders\.gl#4089\./gm,
      (_, indent) => `${indent}if (!refines) {\n${indent}${step}return false;\n${indent}}`,
    );
    originals.set(file, original);
    await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
    await writeFile(path.join(directory, file), original);
  }
  return { directory, originals };
}

describe("loaders.gl install patch", () => {
  it("patches pristine package source and both runtime formats, and is idempotent", async (t) => {
    const { directory, originals } = await fixture(t);
    await patchLoadersGlTraversal(directory);
    const first = await Promise.all(patchedFiles.map((file) => readFile(path.join(directory, file), "utf8")));
    for (const [index, file] of patchedFiles.entries()) {
      assert.notEqual(first[index], originals.get(file));
      assert.equal(first[index].split("\n").length, originals.get(file)!.split("\n").length);
      assert.equal(first[index], await readFile(path.join(installedDir, file), "utf8"));
    }
    await patchLoadersGlTraversal(directory);
    assert.deepEqual(await Promise.all(patchedFiles.map((file) => readFile(path.join(directory, file), "utf8"))), first);
  });

  it("fails clearly on unexpected versions without editing source", async (t) => {
    const { directory, originals } = await fixture(t);
    await writeFile(path.join(directory, "package.json"), JSON.stringify({ name: "@loaders.gl/tiles", version: "4.5.4" }));
    await assert.rejects(patchLoadersGlTraversal(directory), /requires @loaders.gl\/tiles 4\.4\.3; found @loaders.gl\/tiles 4\.5\.4/);
    for (const [file, source] of originals) assert.equal(await readFile(path.join(directory, file), "utf8"), source);
  });

  it("validates every artifact before writing when one has unexpected source", async (t) => {
    const { directory, originals } = await fixture(t);
    await writeFile(path.join(directory, "dist/index.cjs"), `${originals.get("dist/index.cjs")}\n// unexpected change\n`);
    await assert.rejects(patchLoadersGlTraversal(directory), /unexpected source in dist\/index\.cjs/);
    for (const file of patchedFiles.slice(0, 2)) {
      assert.equal(await readFile(path.join(directory, file), "utf8"), originals.get(file));
    }
  });
});
