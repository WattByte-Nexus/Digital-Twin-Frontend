import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const distDir = path.join(
  process.cwd(),
  "node_modules",
  "maplibre-gl-time-slider",
  "dist",
);

const replacements = [
  ['speedInput.min = "100";', 'speedInput.min = "1";'],
  ['speedInput.step = "100";', 'speedInput.step = "1";'],
  ['speed.input.min = "100";', 'speed.input.min = "1";'],
  ['speed.input.step = "100";', 'speed.input.step = "1";'],
  ["speed: Math.max(100, options.speed ?? 1e3),", "speed: Math.max(1, options.speed ?? 1e3),"],
  ["minimum 100", "minimum 1"],
  ["this._state.speed = Math.max(100, ms);", "this._state.speed = Math.max(1, ms);"],
  ["s.speed = Math.max(100, config.speed);", "s.speed = Math.max(1, config.speed);"],
];

const files = (await readdir(distDir)).filter((file) =>
  /^TimeSliderControl-.*\.(?:js|cjs)$/.test(file),
);

if (files.length === 0) {
  throw new Error(`Could not find maplibre-gl-time-slider bundles in ${distDir}`);
}

for (const file of files) {
  const filePath = path.join(distDir, file);
  let source = await readFile(filePath, "utf8");
  let changed = false;

  for (const [before, after] of replacements) {
    if (source.includes(before)) {
      source = source.replaceAll(before, after);
      changed = true;
    } else if (!source.includes(after)) {
      throw new Error(
        `maplibre-gl-time-slider changed unexpectedly: neither patch marker was found in ${file}`,
      );
    }
  }

  if (changed) await writeFile(filePath, source);
}

console.log("Patched maplibre-gl-time-slider playback speed minimum to 1 ms.");
