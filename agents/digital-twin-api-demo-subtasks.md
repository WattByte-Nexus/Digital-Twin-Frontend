# Digital Twin API Demo Subtasks

Generated: 2026-07-28

## Goal

Build a focused GeoLibre demo that uses the Engine API in
`/Users/luke/Documents/Digital_Twin_Engine` to:

- select a published region and load its tree/power-line assets;
- select one or more specific tree assets as wildfire ignition points;
- create and monitor an asynchronous simulation run;
- render the completed burn footprint on the map;
- show the exact weather and Earth Engine inputs used by the demo; and
- preserve a reliable precomputed/fallback path for presentations.

## Existing Artifacts Inspected

Engine:

- `src/api/README.md`
- `src/api/routes/README.md`
- `src/api/routes/{regions,assets,data_sources,scenarios,simulation_runs}.py`
- `src/api/schemas/{regions,assets,data_sources,scenarios,simulation_runs}.py`
- `src/api/projection/simulation_results.py`
- `docs/architecture/geolibre-2-integration-research.md`
- `docs/development/synthetic-wind-simulation-api-plan.md`
- `docs/guides/running-wildfire-demo-with-aws-data.md`

Frontend:

- `packages/plugins/src/types.ts`
- `packages/core/src/store.ts`
- `packages/map/src/{geojson-loader,layer-sync,MapCanvas}.tsx`
- `packages/plugins/src/plugins/weather-layer.ts`
- `packages/plugins/src/plugins/maplibre-earth-engine.ts`
- `apps/geolibre-desktop/src/hooks/usePlugins.ts`
- `apps/geolibre-desktop/public/plugins/digital-twin-demo/`
- `docs/plugin-api.md`

## Assumptions

- The first target is the browser build at `http://localhost:5173`; desktop
  support follows once the web demo works.
- The Engine API runs locally at `http://127.0.0.1:8000`, with OpenAPI at
  `/docs` and all product routes under `/api/v1`.
- A published Colorado/front-range region and its authoritative tree assets are
  seeded before the demo. Region/asset authoring is setup work, not part of the
  first operator UI.
- Multiple selected trees are a real requirement. Therefore the primary flow
  uses scenario-backed runs, because direct-time submissions accept one
  `ignition_location`, while scenario-backed submissions accept 1-100 ordered
  GeoJSON ignition points.
- The legacy Distribution Network Demo is removed. Its large synthetic Boulder
  feeder and tree fixtures are owned by the Digital Twin Demo, while the Engine
  API asset catalog remains the source of truth for selectable ignition trees.
- The Engine's existing weather and Earth Engine catalog endpoints are not
  sufficient to render those datasets. They currently return metadata and
  readiness without a COG, tile template, or other browser-readable data URL.

## Minimum Complete Slice

The first end-to-end proof is:

1. Load one published region.
2. Add `/assets.geojson` to GeoLibre.
3. Select one tree on the map.
4. Create one scenario using the newest ready weather version.
5. Submit one run using that tree's coordinates.
6. Poll until `COMPLETED`.
7. Add `/result.geojson` as a burn-footprint layer and fit the map to it.

Weather/Earth Engine raster rendering follows immediately after this slice,
using the additive map-layer contract below. Until that contract is complete,
the UI must label those sources as “available” or “not ready,” not “rendered.”

## Execution Shape

- Critical path: T1 -> T2 -> T4 -> T5 -> T6 -> T7
- Parallel after T1: T2 (Engine map layers) and T3 (frontend client/state)
- Integration point: T5 combines the Engine client, tree selection, and run
  lifecycle in the plugin panel.
- Riskiest assumption: the hosted Engine can start with the required AWS data,
  accept a scenario, and finish a bounded wildfire run in presentation time.
- Presentation fallback: keep one known completed run/result GeoJSON and one
  known set of input COGs available to load without launching a fresh run.

## Endpoint Map

### Existing endpoints used by the UI

| Phase | Endpoint | UI use | Important behavior |
| --- | --- | --- | --- |
| Bootstrap | `GET /api/v1/health/ready` | Connection/readiness badge; disable run actions until ready | Readiness is stronger than liveness |
| Bootstrap | `GET /api/v1/data-sources` | Show weather and Earth Engine source readiness | Metadata only; not renderable |
| Region | `GET /api/v1/regions?limit=100` | Populate published-region selector | Use only `status === "published"` for runs |
| Region | `GET /api/v1/regions/{region_id}` | Refresh authoritative bounds/revision | Bounds drive map fit and scenario rectangle |
| Assets | `GET /api/v1/regions/{region_id}/assets.geojson` | Add map-ready tree/power-line layer | WGS84, bounded to 5 MiB, strong ETag |
| Assets | `GET /api/v1/regions/{region_id}/assets` | Optional typed list for detail panels | Filter `kind === "tree"` for ignition candidates |
| Weather | `GET /api/v1/regions/{region_id}/weather-datasets?limit=100` | Select newest or explicit ready weather version; show timestamp, bands, CRS, resolution | Newest-first, cursor-paginated, exact immutable versions |
| Earth Engine | `GET /api/v1/regions/{region_id}/earth-engine` | Show readiness, CRS, and available `evt`, `evc`, `nasadem` datasets | Metadata only today |
| Scenario | `POST /api/v1/scenarios` | Create immutable weather/wind/bounds input for a multi-tree run | Requires `Idempotency-Key`; rectangular WGS84 polygon inside a published region |
| Run | `POST /api/v1/simulation-runs` | Submit `{scenario_id, ignition_points}` | Requires `Idempotency-Key`; returns `202`, `run_id`, `status_url`, `result_url` |
| Run | `GET /api/v1/simulation-runs/{run_id}` | Poll lifecycle and show progress via status/tick count | States: `QUEUED`, `STARTED`, `CANCEL_REQUESTED`, `CANCELLED`, `COMPLETED`, `FAILED` |
| Run | `POST /api/v1/simulation-runs/{run_id}/cancel` | Cancel queued/active run | Terminal completed/failed runs reject cancellation |
| Result | `GET /api/v1/simulation-runs/{run_id}/result.geojson` | Add final burn footprint | Only available after completion; convex-hull WGS84 GeoJSON, 5 MiB max, ETag |
| Recovery | `GET /api/v1/simulation-runs?limit=20` | Recent-run list and reload completed results | Cursor-paginated |

### Setup-only existing endpoints

These support a seed script or admin workflow, not the first demo panel:

| Endpoint | Setup use |
| --- | --- |
| `POST /api/v1/regions` | Create a draft region |
| `PATCH /api/v1/regions/{region_id}` | Correct draft name/bounds |
| `POST /api/v1/regions/{region_id}/assets` | Add canonical tree or power-line assets |
| `PATCH /api/v1/assets/{asset_id}` | Correct a draft asset |
| `POST /api/v1/regions/{region_id}/publish` | Freeze the simulation-ready region revision |

### Additive endpoints needed for input-layer rendering

Do not expose S3 paths, local paths, Zarr cache URIs, credentials, or raw
internal state. Add a browser-facing descriptor/projection layer:

#### Weather map layers

```http
GET /api/v1/regions/{region_id}/weather-datasets/{dataset_id}/map-layers
```

Return one descriptor per supported band, initially a small curated set such as
wind speed, wind direction, temperature, and relative humidity:

```json
{
  "items": [
    {
      "layer_id": "weather-abc-wind-speed",
      "name": "Wind speed · 2026-07-28 18:00Z",
      "category": "weather",
      "format": "cog",
      "url": "/api/v1/map-layers/weather-abc-wind-speed/data.tif",
      "bounds": [-105.45, 39.88, -105.12, 40.14],
      "crs": "EPSG:4326",
      "band": "wind_speed",
      "units": "m/s",
      "default_style": {
        "colormap": "viridis",
        "rescale_min": 0,
        "rescale_max": 30,
        "opacity": 0.65
      },
      "version": "2026-07-28T18:00:00Z"
    }
  ]
}
```

#### Earth Engine map layers

```http
GET /api/v1/regions/{region_id}/earth-engine/map-layers
```

Return descriptors for `evt`, `evc`, and `nasadem`, with safe names,
attribution, bounds, units/categories, and default styles. The internal source
is EPSG:5070 Zarr; the published COG should be browser-readable and carry
correct georeferencing. Prefer EPSG:4326 or a COG GeoLibre's raster renderer
can reproject correctly.

#### COG bytes

```http
GET /api/v1/map-layers/{layer_id}/data.tif
```

Requirements:

- support HTTP byte-range requests;
- provide `Content-Type: image/tiff`, `Accept-Ranges`, `ETag`, and cache headers;
- return safe 404/409/503 problem details for unknown, not-prepared, or
  unavailable layers;
- generate/cache artifacts outside the Uvicorn event loop;
- enforce a bounded artifact catalog rather than accepting filesystem paths
  from the request; and
- work through local CORS and same-origin production proxying.

If exporting COGs proves slower than a tile adapter for the existing Zarr,
preserve the descriptor shape and allow `format: "xyz"` plus a safe tile
template. The frontend should branch on the descriptor, not on dataset names.

## Request Mapping

### Scenario creation

For a selected region, weather version, scenario rectangle, and UI controls:

```json
{
  "region_id": "<region_id>",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[
      ["<west>", "<south>"],
      ["<east>", "<south>"],
      ["<east>", "<north>"],
      ["<west>", "<north>"],
      ["<west>", "<south>"]
    ]]
  },
  "base_weather_version": "<weather.version>",
  "wind_speed": {
    "value": 15,
    "unit": "mph"
  },
  "wind_direction": {
    "bearing_degrees": 90,
    "reference": "towards"
  },
  "duration_hours": 4
}
```

For the MVP, default the geometry to the selected region bounds or a smaller
demo rectangle that contains all selected trees. The UI must reject a submit
when a selected tree lies outside that rectangle.

### Run submission

Map each selected Engine tree feature to GeoJSON longitude/latitude order:

```json
{
  "scenario_id": "<scenario_id>",
  "ignition_points": [
    {
      "type": "Point",
      "coordinates": ["<tree longitude>", "<tree latitude>"]
    }
  ]
}
```

Keep the associated `asset_id` in frontend state for labels/audit, although the
current run contract sends coordinates rather than asset IDs.

### Result projection

The existing result contains one `burned_footprint` feature with
`simulation_id`, `run_id`, `region_id`, `tick`, `active_cell_count`, and
`weather_version`. Add it as a normal GeoLibre GeoJSON layer and retain the
metadata for a compact run summary.

## UI Changes

### Delivery shape

Add a first-party bundled external plugin, tentatively:

```text
apps/geolibre-desktop/public/plugins/digital-twin-demo/
  plugin.json
  dist/index.js
  dist/style.css
```

Use `activeByDefault: true` for the dedicated demo build. This reuses the
existing `public/plugins/<id>/` discovery path and keeps the integration out of
GeoLibre core. Keep all Engine transport and state inside this plugin.

### Right panel

Register a `Digital Twin Demo` right panel via `registerRightPanel` with these
sections:

1. **Engine**
   - API base URL (default from `VITE_DIGITAL_TWIN_API_URL`, falling back to
     `http://127.0.0.1:8000`)
   - readiness badge and retry action
2. **Region and inputs**
   - published-region selector
   - weather version selector with time/provider/bands/readiness
   - Earth Engine readiness and layer toggles
   - weather band layer toggles
3. **Ignition trees**
   - “Select trees on map” mode
   - selected tree count, compact list (`asset_id`, species, height), clear and
     remove actions
   - enforce the API maximum of 100 points
4. **Scenario**
   - bounds source: region bounds initially, optional drawn/custom rectangle
   - wind speed/unit, wind-toward bearing, duration
5. **Run**
   - Run and Cancel buttons
   - status, elapsed time, produced tick count, failure message
   - recent runs with “Show result”

### Map layers

Use stable semantic layers:

- `Engine assets · <region>` from `/assets.geojson`
- `Selected ignition trees` as a plugin-owned highlight layer
- selected weather band COG(s)
- selected Earth Engine COG(s)
- `Wildfire result · <run_id>` from `/result.geojson`

`addGeoJsonLayer` returns a GeoLibre layer ID. Point render layers use
`layer-${layerId}-circle` and source IDs use `source-${layerId}`. Bind map
clicks after the layer exists, accept only features with `kind === "tree"`, and
unbind on region change/deactivation. Keep the engine `asset_id` as the
selection key. Use a separate high-contrast selection overlay rather than
mutating the authoritative asset layer.

Use `addCogLayer` for `format: "cog"` descriptors and `addTileLayer` for
`format: "xyz"`. Input layers should appear in the normal Layers panel so
visibility, opacity, ordering, metadata, project persistence, and attribution
work without custom controls.

### Run state machine

```text
disconnected
  -> loading inputs
  -> ready/selecting
  -> creating scenario
  -> submitting run
  -> queued
  -> started
  -> completed -> loading result -> displayed
             \-> failed
             \-> cancelled
```

- Poll `status_url` every second while queued/started, backing off to two
  seconds after 30 seconds.
- Stop polling on terminal state, region change, plugin deactivation, or abort.
- Reuse one idempotency key for retries of the same scenario request and one
  for retries of the same run request. Generate a new key when inputs change.
- Treat `409` as an actionable regional-run/idempotency conflict and offer to
  refresh recent runs.
- Render API `ProblemDetails` safely; never expose internal failure diagnostics.
- Persist only safe UI preferences and recent run IDs. Reload authoritative
  run state from the API.

## Subtasks

### T1: Lock the demo contract and fixture

**Outcome:** One verified published region, exact weather version, asset set,
and bounded scenario can complete through the current API.

**Scope:** Engine startup, fixture identity, request/response captures, runtime
timing. No frontend implementation.

**Context packet:** Engine API/docs listed above; Colorado Earth Engine config;
wildfire AWS demo guide.

**Instructions:**

1. Start Redis and the Engine API using the repository-supported environment.
2. Verify `/health/ready`, OpenAPI, regions, assets, weather inventory, and
   Earth Engine readiness.
3. Submit the exact scenario/run flow with one and then multiple tree
   coordinates.
4. Record time-to-start, time-to-complete, response sizes, and known-good IDs.
5. Save sanitized response fixtures for frontend tests and a completed result
   GeoJSON for presentation fallback.

**Acceptance criteria:**

- A documented curl/HTTP sequence reaches `COMPLETED`.
- `/result.geojson` is valid WGS84 GeoJSON and renders in GeoLibre.
- At least one selected coordinate comes from a real Engine tree asset.
- A fallback result fixture is available without AWS credentials.

**Validation:** Engine focused API tests plus one real local smoke run.

**Dependencies:** None.

**Handoff:** Contract fixture set and a short runtime-readiness report.

### T2: Publish browser-renderable Engine input layers

**Outcome:** Weather and Earth Engine data have safe, renderable descriptors and
COG/XYZ URLs.

**Scope:** Additive Engine API contracts, projection/export/cache service,
range-capable responses, focused tests, docs. Do not expose internal URIs.

**Context packet:** `src/api/catalog/data_sources.py`,
`src/api/routes/data_sources.py`, existing result projection patterns, weather
snapshot/grid stores, Earth Engine Zarr config, GeoLibre `addCogLayer` contract.

**Instructions:**

1. Define `MapLayerDescriptor` and the three additive endpoints above.
2. Start with one weather band and `nasadem`; expand to the curated MVP bands
   and `evt`/`evc` only after the first two render.
3. Export/cache outside the request event loop and preserve exact source
   version/provenance.
4. Add byte-range, ETag, cache, CORS, bounds, CRS, unit, and failure tests.
5. Document artifact lifecycle and cleanup.

**Reuse/library check:** Before implementing custom range or COG serving, use
`$deep-dive` to compare FastAPI/Starlette file responses, S3 range proxying,
rasterio COG export, and any existing Engine artifact/cache utilities. Adopt an
existing path only if it reduces lifecycle and security complexity.

**Acceptance criteria:**

- A browser can add returned weather and Earth Engine URLs with
  `addCogLayer`/`addTileLayer`.
- No response contains S3 bucket names, cache URIs, local paths, or credentials.
- Raster extent aligns with the region/assets in GeoLibre.
- Range and cache validators are covered by tests.

**Validation:** Engine API tests, `rio cogeo validate` or equivalent raster
validation, and a GeoLibre visual alignment smoke test.

**Dependencies:** T1 chooses exact fixture/version.

**Handoff:** OpenAPI contract, sample descriptors, and renderable test URLs.

### T3: Build the typed demo client and state model

**Outcome:** Framework-independent frontend client functions and a tested run
state reducer/controller.

**Scope:** API base URL normalization, request/response types, abortable fetch,
ProblemDetails, idempotency, polling. No panel styling.

**Context packet:** Endpoint map and fixture responses from T1; frontend
`fetch-error.ts`, `url-utils.ts`, and external plugin conventions.

**Instructions:**

1. Implement calls for readiness, regions, assets, sources, scenarios, runs,
   cancellation, results, and map-layer descriptors.
2. Validate discriminated run status and request shapes at the boundary.
3. Add abortable polling with terminal-state handling and retry/backoff.
4. Separate authoritative server state from ephemeral tree selection/UI state.
5. Test 202, 304, 400/404/409/422/503, network failure, cancellation, and
   deactivation during polling.

**Acceptance criteria:**

- No panel code calls `fetch` directly.
- Duplicate button presses cannot create duplicate logical submissions.
- Polling always tears down cleanly.
- Fixtures from T1 pass client parsing.

**Validation:** Node unit tests using deterministic mocked fetch/time.

**Dependencies:** T1; descriptor type from T2 can be mocked first.

**Handoff:** Client module, state controller, and focused tests.

### T4: Add region, asset, and ignition-tree map interaction

**Outcome:** Users can select a region, see its assets, and choose 1-100 tree
features as ignition points.

**Scope:** Bundled plugin shell, right panel bootstrap, assets layer, tree-only
selection and highlight. No run submission yet.

**Context packet:** GeoLibre plugin API/types, bundled-plugin discovery, and
GeoJSON layer ID conventions.

**Instructions:**

1. Add `digital-twin-demo/plugin.json`, bundle, styles, and plugin tests.
2. Register/open the right panel and load published regions.
3. Load `/assets.geojson`, fit to region bounds, and bind point-layer clicks.
4. Select only `kind: "tree"` features keyed by `asset_id`; support toggle,
   clear, and list removal.
5. Render a visible selection halo/marker and clean up all listeners/overlays.
6. Show clear empty/error/oversize states.

**Acceptance criteria:**

- Clicking power lines cannot add ignition points.
- Clicking the same tree toggles it without duplicates.
- Selection survives panel collapse but clears safely on region change.
- The plugin deactivates without orphaned listeners or native overlays.

**Validation:** Unit tests for selection logic plus Playwright click/visual
smoke test.

**Dependencies:** T3 client bootstrap.

**Handoff:** Selectable tree demo with screenshots.

### T5: Implement scenario creation and run lifecycle UI

**Outcome:** Selected trees launch a scenario-backed run and the panel tracks it
to a terminal state.

**Scope:** Scenario form/defaults, request mapping, Run/Cancel, status/recent
runs. No raster layers.

**Context packet:** T1 fixture/defaults, T3 client/state, T4 selection.

**Instructions:**

1. Default scenario geometry and values from the known demo fixture.
2. Validate all selected trees are inside the scenario rectangle.
3. Create the scenario, then submit ordered ignition points.
4. Poll status, show tick count, support cancellation, and recover recent runs.
5. Prevent edits that would make the active run UI ambiguous; allow a new run
   only after terminal state.

**Acceptance criteria:**

- One and multiple selected trees produce contract-correct requests.
- Retry behavior is idempotent.
- Every terminal status has an explicit UI.
- Region conflict and invalid weather/scenario responses are actionable.

**Validation:** Mocked lifecycle tests and one real API run.

**Dependencies:** T1, T3, T4.

**Handoff:** Live run recording and request trace.

### T6: Render input layers and completed results

**Outcome:** The map shows selected weather, Earth Engine layers, and the final
burn footprint with provenance.

**Scope:** Descriptor consumption, COG/XYZ layer registration, result GeoJSON,
legend/summary, ETag-aware reload.

**Context packet:** T2 descriptors, GeoLibre `addCogLayer`/`addTileLayer`,
existing result projection.

**Instructions:**

1. Add source readiness and layer toggles to the input section.
2. Register each descriptor through the matching GeoLibre app API.
3. Apply default opacity/style and show units/version/attribution.
4. On completion, fetch/add result GeoJSON and fit to its geometry.
5. Preserve old run layers with clear run IDs or replace them behind an
   explicit “keep previous result” preference.
6. Show result tick, active cell count, weather version, and aggregation note.

**Acceptance criteria:**

- Weather and Earth Engine layers align with assets and region bounds.
- Layer visibility/opacity works in the normal Layers panel.
- A completed run produces one identifiable result layer.
- Reloading a cached result handles ETag/304 correctly.

**Validation:** Visual regression/screenshot plus API integration smoke test.

**Dependencies:** T2 and T5.

**Handoff:** End-to-end demo screenshot/video and layer metadata capture.

### T7: Harden and package the demo

**Outcome:** A repeatable local demo and a safe fallback can be run by another
developer.

**Scope:** Documentation, environment configuration, CORS/proxy, test matrix,
fallback data, presentation runbook.

**Instructions:**

1. Document Engine/API and frontend startup commands and required AWS profile.
2. Add `VITE_DIGITAL_TWIN_API_URL` documentation and production same-origin
   proxy guidance.
3. Verify browser and, secondarily, Tauri CSP/network behavior.
4. Add one happy-path E2E test and failure tests for unavailable Engine, no
   weather, failed run, and result-not-ready.
5. Add a “Load fallback demo” action that uses sanitized local fixtures.
6. Record expected runtime and reset steps between demos.

**Acceptance criteria:**

- A clean checkout can run the demo from the runbook.
- No credentials or private storage paths enter frontend bundles/fixtures.
- The live and fallback paths look materially the same.
- Typecheck, frontend tests, relevant Engine tests, and E2E smoke pass.

**Validation:** Fresh-session rehearsal by a developer who did not implement
the feature.

**Dependencies:** T1-T6.

**Handoff:** Demo runbook and release checklist.

## Coordination Notes

- T2 belongs in `Digital_Twin_Engine`; T3-T7 frontend portions belong in
  `Digital_Twin_Frontend`. Keep their commits/PRs separate and integrate through
  the documented OpenAPI descriptor contract.
- Do not make the frontend read the Engine's private S3/Zarr paths. That would
  bypass the API's redaction boundary and couple the UI to AWS credentials.
- Do not use the existing RainViewer/NASA weather overlays as a substitute for
  Engine weather. They can remain optional context layers, but the demo must
  label them as external live weather.
- The final simulation projection is a convex hull of burned cells, not a
  time animation or intensity raster. A timeline requires a future endpoint for
  tick projections; it is explicitly out of the MVP.
- There is no scenario list/get endpoint today. The MVP creates an immutable
  scenario immediately before a run and retains its returned ID. Add scenario
  query endpoints only if scenario reuse/history becomes a product requirement.
- The current run contract records ignition coordinates, not selected
  `asset_id`s. The UI can show the tree IDs, but durable server-side audit of
  “which asset was selected” would require an additive trigger/request field.

## Suggested Next Dispatch

Start with T1. It converts the largest uncertainty—whether a live AWS-backed
run completes reliably—into a known fixture and prevents the frontend from
being built against guessed runtime behavior.
