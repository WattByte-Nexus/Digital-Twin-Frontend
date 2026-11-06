import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Backport https://github.com/visgl/loaders.gl/pull/4089 to the locked 4.4.3.
// Discovery must visit every sibling; accumulated readiness still determines
// whether the parent can be replaced. RequestScheduler still limits requests.
// Remove this patch when upgrading to a stable version containing that fix,
// after running tests/loaders-gl-traversal.test.ts against the new version.
const version = "4.4.3";
const files = [
  ["src/tileset/tileset-traverser.ts", "5650b7b970ad8b75a10341a7930a385b3c856ce2a4262293077913af948370fc"],
  ["dist/tileset/tileset-traverser.js", "a4ea9a3aa4123168b1bb03fb5a7831291d03d87614590d751b892dd31a7e1192"],
  ["dist/index.cjs", "92f124b54778c38bee130eec25a8ad2fc470591ffd303151ef9819c63a452ce6"],
];

const original = /^( *)if \(!refines\) \{\n\1  (?:  )?return false;\n\1\}/gm;
const patched = /^( *)\/\/ Readiness controls replacement, not discovery\.\n\1\/\/ Visit every sibling before deciding whether to refine\.\n\1\/\/ Backport: visgl\/loaders\.gl#4089\./gm;
const hash = (source) => createHash("sha256").update(source).digest("hex");

/** Patch the actual ESM and CommonJS entry paths, validating all files first. */
export async function patchLoadersGlTraversal(packageDir) {
  const manifest = JSON.parse(await readFile(path.join(packageDir, "package.json"), "utf8"));
  if (manifest.name !== "@loaders.gl/tiles" || manifest.version !== version) {
    throw new Error(`loaders.gl traversal patch requires @loaders.gl/tiles ${version}; found ${manifest.name} ${manifest.version}. Review the upstream fix before upgrading.`);
  }

  const edits = await Promise.all(files.map(async ([relativePath, expectedHash]) => {
    const filePath = path.join(packageDir, relativePath);
    const source = await readFile(filePath, "utf8");
    // Published ESM uses four-space indentation; TS and CJS use two-space.
    const indentStep = relativePath.endsWith(".js") ? "    " : "  ";
    const restored = source.replace(patched, (_, indent) => `${indent}if (!refines) {\n${indent}${indentStep}return false;\n${indent}}`);
    if (hash(restored) !== expectedHash) {
      throw new Error(`loaders.gl traversal patch: unexpected source in ${relativePath}; refusing to patch. Review the pinned dependency and upstream fix.`);
    }
    const matches = [...restored.matchAll(original)];
    if (matches.length !== 1) {
      throw new Error(`loaders.gl traversal patch: expected exactly one replacement-readiness guard in ${relativePath}.`);
    }
    // Keep line counts unchanged so bundled source maps retain their line offsets.
    const updated = restored.replace(original, (_, indent) => `${indent}// Readiness controls replacement, not discovery.\n${indent}// Visit every sibling before deciding whether to refine.\n${indent}// Backport: visgl/loaders.gl#4089.`);
    return { filePath, source, updated };
  }));

  for (const { filePath, source, updated } of edits) {
    if (source !== updated) await writeFile(filePath, updated);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await patchLoadersGlTraversal(path.resolve("node_modules/@loaders.gl/tiles"));
  console.log("Patched loaders.gl 4.4.3 replacement sibling discovery (ESM, CJS, source).");
}
