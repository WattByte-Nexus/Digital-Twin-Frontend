import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

// Bundled ESM cannot infer the worker asset URL from MapLibre's import.meta.url.
setWorkerUrl(workerUrl);
