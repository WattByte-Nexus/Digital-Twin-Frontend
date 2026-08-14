// Build the self-hosted JupyterLite site that the web build embeds in the
// Notebook panel (an <iframe> pointed at apps/geolibre-desktop/public/jupyterlite/).
//
// JupyterLite is a full Jupyter UI running entirely in the browser on a Pyodide
// (WASM) kernel — no server. The desktop (Tauri) build launches a real
// JupyterLab server instead and does not use this output.
//
// This step uses an installed `jupyter lite` CLI or asks uv to provide the
// requirements from apps/geolibre-desktop/jupyterlite/requirements.txt in an
// isolated environment. It is intentionally **best-effort**: if neither path is
// available, it logs a warning and exits 0 so a Node-only `npm run build` still
// succeeds. When the assets are absent the Notebook panel shows a "not built"
// message on web; run this script after installing uv or the requirements to
// enable it.
//
// Output: apps/geolibre-desktop/public/jupyterlite/  (git-ignored; Vite copies
// public/ into dist/ at build time).

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const liteDir = resolve(repoRoot, "apps/geolibre-desktop/jupyterlite");
const contentsDir = resolve(liteDir, "files");
// The kernel-side `geolibre` client and the Welcome example both have a single
// canonical copy under the backend (so the desktop launcher bundles/copies the
// same files); stage them into the JupyterLite contents here so the web kernel
// gets `import geolibre` and the same starter notebook.
const notebookClientSrc = resolve(repoRoot, "backend/geolibre_server/notebook_client.py");
const notebookClientDest = resolve(contentsDir, "geolibre.py");
const welcomeSrc = resolve(repoRoot, "backend/geolibre_server/notebook_examples/Welcome.ipynb");
const welcomeDest = resolve(contentsDir, "Welcome.ipynb");
const outputDir = resolve(repoRoot, "apps/geolibre-desktop/public/jupyterlite");
const requirementsFile = resolve(liteDir, "requirements.txt");
const uvEnvironment = {
  ...process.env,
  UV_CACHE_DIR: process.env.UV_CACHE_DIR ?? resolve(repoRoot, ".uv-cache"),
};

const isWin = process.platform === "win32";

// The desktop (Tauri) build launches a real JupyterLab server, so the static
// JupyterLite site is dead weight in the installer. Tauri sets TAURI_ENV_* on
// its beforeBuildCommand; skip the build there. The plain web build and the
// embed build (Jupyter widget) do not set it, so they still get the site.
if (process.env.TAURI_ENV_PLATFORM) {
  console.log(
    "[build-jupyterlite] Tauri build detected — skipping JupyterLite " +
      "(desktop uses a real JupyterLab server).",
  );
  process.exit(0);
}

// `--if-missing` (used by the `predev` hook) builds only when the site is not
// already present, so `npm run dev` pays the build cost once and is instant
// afterwards. The authoritative `build`/`build:jupyterlite` paths omit the flag
// and always rebuild so a changed client/config is picked up.
const onlyIfMissing = process.argv.includes("--if-missing");
if (onlyIfMissing && existsSync(resolve(outputDir, "lab", "index.html"))) {
  console.log(
    "[build-jupyterlite] JupyterLite site already present — skipping " +
      "(run `npm run build:jupyterlite` to rebuild it).",
  );
  process.exit(0);
}

// Prefer an already-installed CLI. When it is absent, uv can provide the build
// dependencies in a cached, isolated environment without modifying the user's
// system Python.
let command = "jupyter";
let commandPrefix = [];
let probe = spawnSync(command, ["lite", "--version"], {
  cwd: repoRoot,
  shell: isWin,
  stdio: "ignore",
});

if (probe.status !== 0) {
  command = "uv";
  commandPrefix = ["run", "--with-requirements", requirementsFile, "--", "jupyter"];
  probe = spawnSync(command, [...commandPrefix, "lite", "--version"], {
    cwd: repoRoot,
    env: uvEnvironment,
    shell: isWin,
    stdio: "inherit",
  });
}

if (probe.status !== 0) {
  console.warn(
    "[build-jupyterlite] neither `jupyter lite` nor `uv` is available — skipping the " +
      "JupyterLite build. The web Notebook panel will show a 'not built' " +
      "message. To enable it, install uv or install the build deps directly:\n" +
      "  pip install -r apps/geolibre-desktop/jupyterlite/requirements.txt\n" +
      "then re-run `npm run build:jupyterlite`.",
  );
  process.exit(0);
}

// Stage the kernel-side `geolibre` client and the Welcome example into the
// contents (the dir holds only generated copies, so ensure it exists first).
mkdirSync(contentsDir, { recursive: true });
copyFileSync(notebookClientSrc, notebookClientDest);
copyFileSync(welcomeSrc, welcomeDest);

// Rebuild cleanly so stale assets from an older JupyterLite version don't linger.
rmSync(outputDir, { recursive: true, force: true });

const result = spawnSync(
  command,
  [
    ...commandPrefix,
    "lite",
    "build",
    "--lite-dir",
    liteDir,
    "--contents",
    contentsDir,
    "--output-dir",
    outputDir,
  ],
  {
    cwd: repoRoot,
    env: command === "uv" ? uvEnvironment : process.env,
    shell: isWin,
    stdio: "inherit",
  },
);

if (result.status !== 0) {
  console.error("[build-jupyterlite] `jupyter lite build` failed.");
  process.exit(result.status ?? 1);
}

if (!existsSync(resolve(outputDir, "lab", "index.html"))) {
  console.error(
    "[build-jupyterlite] build finished but lab/index.html is missing in " +
      `${outputDir}. Check the JupyterLite output above.`,
  );
  process.exit(1);
}

console.log(`[build-jupyterlite] Built JupyterLite site into ${outputDir}`);
