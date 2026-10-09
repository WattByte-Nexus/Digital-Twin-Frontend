# Frontend API coverage audit — 2026-10-09

> Historical baseline, captured before implementation. The findings and source line references below describe that baseline. Native replacements and Engine contract additions are now in the working tree; see the [implementation and verification report](native-api-sync-implementation-2026-10-09.md) and [current operation manifest](../tests/fixtures/digital-twin-endpoint-coverage.json). The current contract has 40 `/api/v1` operations assigned to native workflows plus one infrastructure readiness alias; this is not a live-deployment acceptance claim.

The custom native Digital Twin UI is not fully synchronized with the current Engine API. **22 of 37 public operations have callers in that UI; 15 do not.** Most read, visualization, and scenario-run paths have callers, but several complete workflows are missing. Some connected screens also discard supported response fields or present controls that do not affect the submitted request.

The audit target is the user's custom product UI rooted at `App.tsx → DigitalTwinMapWorkspace`, including its Assets, Scenarios, Runs, and Settings screens. The old demo plugin and GeoLibre Expert GIS are not the product under audit and receive no coverage credit. Here “native UI” means that custom first-party product, not a claim about a particular desktop runtime.

## Scope and evidence

- Engine: `/Users/luke/Documents/Digital_Twin_Engine`, commit `b83be2eb85e7a485ce8be3963d8998fca37205c2`.
- Frontend: `/Users/luke/Documents/Digital_Twin_Frontend`, commit `90629113e1997e68ffce2e976f495d72e3666c82`, **including existing uncommitted changes** to assets, physics, map rendering, and related tests. Those changes were preserved.
- Enumerated the actual schema from `api.api.create_app().openapi()` without starting the Engine lifespan or external services. It contains **37 public operations**. Source inspection found two additional HEAD routes excluded from OpenAPI.
- Traced callers from `App.tsx:64` into the custom native `DigitalTwinMapWorkspace` and its actual child screens. Old plugin, Expert GIS, and seed-script references were inspected only to distinguish obsolete or external callers from native product coverage.
- This is a source and contract audit, not a deployed-browser acceptance test. Authentication, real dataset availability, network behavior, and rendering against a running deployment were not verified.
- Scope is the Engine-owned `/api/v1` contract. The generic GeoLibre Python sidecar, third-party GIS providers, and deployment-owned identity endpoints are separate surfaces and are not included in the denominator.

## Coverage totals

These are **caller-presence counts**, not percentages of working product functionality. Partial request/response coverage still counts as a caller.

| Surface | Operations | Share of 37 |
| --- | ---: | ---: |
| Connected in the custom native UI | 22 | 59.5% |
| Missing from the custom native UI | 15 | 40.5% |

All 15 missing operations are gaps for this audit, including those with leftover callers in the demo plugin or Expert GIS. Some belong in an administration/data-management surface within the custom product rather than an operator screen. Binary delivery and SSE do not each need a separate control; they need appropriate native workflow integration.

## Findings, in priority order

### 1. P1 — Scenario controls promise inputs the Engine never receives

The builder exposes fuel moisture, spotting, crown fire, grid size, and output interval. It sends `modelSettings` to its callback, but the actual workspace forwards only scenario name, region, duration, ignitions, wind speed, and wind direction. Other weather controls are also omitted from the request. The current Engine scenario schema does not accept these model settings, so merely forwarding them would produce validation errors.

Evidence: [builder controls](../apps/geolibre-desktop/src/product-modes/digital-twin/ui/views/ScenarioBuilder.tsx), lines 363–370 and 776–894; [actual submission boundary](../apps/geolibre-desktop/src/product-modes/digital-twin/ui/DigitalTwinMapWorkspace.tsx), lines 1254–1268; [request serialization](../apps/geolibre-desktop/src/lib/digital-twin-runs.ts), lines 447–537. Engine: `src/api/schemas/scenarios.py:134` and `src/api/schemas/simulation_runs.py:110`.

Required outcome: every simulation-affecting control must correspond to accepted Engine intent. Remove or explicitly disable unsupported controls until their Engine contracts exist; do not imply that visual weather settings alter the numerical run.

### 2. P1 — The scenario library is fixture data, and draft saving is not implemented

The Scenarios screen filters a constant five-record `SCENARIOS` array. Opening a record reconstructs ignition coordinates from hard-coded location centers and offsets, rather than retrieving stored scenario intent. The builder displays “Draft autosaved just now” while its inputs live in component state. New submissions do create an Engine scenario and run, but the scenario library never reads those records.

Evidence: [ScenariosView](../apps/geolibre-desktop/src/product-modes/digital-twin/ui/views/ScenariosView.tsx), lines 84, 165, and 236; [ScenarioBuilder](../apps/geolibre-desktop/src/product-modes/digital-twin/ui/views/ScenarioBuilder.tsx), lines 248 and 411.

Backend dependency: the current API has **POST `/scenarios` only**. It has no scenario list, get, update, or delete operation. Scenarios are currently immutable. A real library needs Engine read contracts and an explicit draft/revision design if editing is required; this cannot be completed by wiring existing endpoints alone.

### 3. P1 — Settings report invented operational status

`EngineStatusPage` renders constant “Connected,” “Ready,” “0 queued,” “SQLite,” “Just now,” a localhost endpoint, and “Local Redis Disabled.” It does not consume the health client already used by the live map. Account preferences, simulation presets, and much of the settings UI keep local component state. The members table is also hard-coded, though its mutation actions are correctly disabled.

Evidence: [settings pages](../apps/geolibre-desktop/src/product-modes/digital-twin/ui/views/settings-view-pages.tsx), lines 64, 266, 562, and 636–678; [real health client](../apps/geolibre-desktop/src/lib/digital-twin-status.ts), line 77.

Required outcome: wire existing health endpoints and actual configured connection into the status page. Remove unsupported claims about queue/storage/version or add explicit backend diagnostic contracts. Account persistence, membership, alert routing, and preset management have no corresponding Engine operations today; identify the owning service before implementing them.

### 4. P1 — Supported direct-time and forecast simulations cannot be launched

Both the primary UI and bundled simulation plugin create synthetic-wind scenarios and then submit `{scenario_id, ignition_points}`. Neither exposes the Engine's direct submission shape with `region_id`, `ignition_location`, `time`, and `delta_t_hours`. That leaves both `present_forecast` and `bounded` time modes uncovered. No frontend caller uses `/regions/{region_id}/weather-forecasts/resolve`.

Evidence: [submission client](../apps/geolibre-desktop/src/lib/digital-twin-runs.ts), lines 447–537; [plugin startRun](../apps/geolibre-desktop/public/plugins/digital-twin-demo/dist/index.js), line 4170 onward. Engine: `src/api/schemas/simulation_runs.py:19`, `src/schemas/simulation_runs.py:29`, and `src/api/routes/data_sources.py:100`.

Required outcome: add an explicit direct-run flow with present/forecast duration or exact timezone-aware bounds, timestep validation, forecast availability, and retained input lineage. Keep synthetic-wind scenarios as a distinct supported mode.

### 5. P1 — Cancellation is absent from the primary run workflow

The Engine supports cancellation and durable SSE progress. The bundled plugin has `cancelRun` and `watchRun`, but `DigitalTwinMapWorkspace` and `RunDetailView` do not expose cancellation. The primary run views poll instead of using SSE. Polling supplies real progress and is not itself a failure; cancellation is the missing operator action, while SSE is an endpoint-parity gap.

Evidence: [plugin client](../apps/geolibre-desktop/public/plugins/digital-twin-demo/dist/index.js), lines 832–920 and 4388; [primary run detail](../apps/geolibre-desktop/src/product-modes/digital-twin/ui/views/RunDetailView.tsx), line 86 onward; [product entry point](../apps/geolibre-desktop/src/App.tsx), line 64. Engine: `src/api/routes/simulation_runs.py:391` and `:729`.

Required outcome: native run details must cancel eligible runs, render `CANCEL_REQUESTED` through terminal acknowledgement, and recover from a refreshed run snapshot. Keep one native Engine client and remove obsolete plugin paths when their remaining functionality is replaced.

### 6. P2 — Region and asset authoring cannot complete end to end

No UI creates, updates, deletes, or publishes a region. The seed script alone creates regions, batch-adds assets, and publishes. Native asset CSV import, patch, and delete callers exist, but there is no single-asset POST caller or interactive batch POST flow. Consequently the UI cannot take a new region from draft through asset ingestion to publication.

The asset screen also receives region ID/name/description without draft status and offers editing/import choices across those regions. The Engine allows mutations only on drafts; published-region users discover the restriction through a failed request instead of capability-aware controls.

Evidence: [seed script](../scripts/seed-boulder-region.mjs), lines 378–409; [asset clients](../apps/geolibre-desktop/src/lib/digital-twin-assets.ts), lines 645–716; [region projection](../apps/geolibre-desktop/src/product-modes/digital-twin/ui/DigitalTwinMapWorkspace.tsx), line 575; [asset UI](../apps/geolibre-desktop/src/product-modes/digital-twin/ui/assets/AssetsView.tsx), lines 341–351, 398–406, and 724. Engine: `src/api/routes/regions.py` and `src/api/routes/assets.py`.

Required outcome: a permission-appropriate administration workflow for draft creation, edits, import, validation, and publication; preserve draft status through the UI. The single and batch creation endpoints are alternative authoring methods, so separate controls are only necessary if literal endpoint parity is the product requirement. Do not add pole-edit forms: the Engine's current public mutation schema supports trees and power lines, not pole creation/patching.

### 7. P2 — Point clouds can be viewed, but surveys cannot be managed

The frontend reads the collection, selects the active ready dataset, refreshes lifecycle state, and loads returned tile URLs. It never reads an individual dataset or submits a survey replacement. There is no dataset-selection workflow or PLY upload with reviewed georeferencing metadata and queued/building/failed completion handling.

Evidence: [point-cloud client](../apps/geolibre-desktop/src/lib/digital-twin-point-cloud.ts), line 208; [map lifecycle refresh](../apps/geolibre-desktop/src/product-modes/digital-twin/ui/DigitalTwinMapWorkspace.tsx), line 786; [tile loader](../apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-lidar.ts), line 218. Engine: `src/api/routes/point_clouds.py:154` and `:214`.

Required outcome: authorized dataset/survey management using the existing item and multipart survey endpoints. Tile delivery has a descriptor-driven caller; production permission/cookie behavior still needs deployment acceptance testing.

### 8. P2 — Connected run endpoints have confirmed response-contract drift

- **Bounded runs lose their duration and expected ticks.** The list/detail adapter reads `trigger.time.duration_hours` but does not derive duration from `start_at` and `end_at`.
- **Fractional forecast durations undercount ticks.** The frontend uses `Math.round(duration / timestep)`; the Engine uses whole-tick rounding with a ceiling for a partial final interval. A 1.2-hour run with a 1-hour step displays one expected tick instead of two.
- **Failure details are dropped.** The Engine returns `{error_type, error_message}`. The catalog parser reads `failure.code`, and the detail interface/rendering checks `message`, `detail`, then `error_type`, omitting `error_message`.

Evidence: [run adapter](../apps/geolibre-desktop/src/lib/digital-twin-runs.ts), lines 186–267; [detail response type](../apps/geolibre-desktop/src/product-modes/digital-twin/ui/digital-twin-run-api.ts), line 58; [failure rendering](../apps/geolibre-desktop/src/product-modes/digital-twin/ui/views/RunDetailTabs.tsx), lines 124 and 263. Engine: `src/schemas/simulation_runs.py:97` and `:395`.

Verified by invoking the actual frontend parser with current-contract fields: a two-hour bounded failed run produced `durationHours: null`, `expectedTicks: null`, and `failureCode: null`; a 1.2-hour present/forecast run produced `expectedTicks: 1`.

### 9. P2 — Idle monitoring misses externally started runs

The primary workspace schedules its next run-catalog poll only if the most recent snapshot already contains an active run. Once idle, it stops observing the catalog. An autonomous Engine run, another operator's submission, or a run started through another surface will not appear until a refresh/remount or another triggering action. Run details also silently retry failed polls while retaining stale displayed data.

Evidence: [catalog polling](../apps/geolibre-desktop/src/product-modes/digital-twin/ui/DigitalTwinMapWorkspace.tsx), lines 594–640; [detail polling](../apps/geolibre-desktop/src/product-modes/digital-twin/ui/views/RunDetailView.tsx), lines 90–120.

Required outcome: continue bounded idle catalog refresh or add a backend catalog event feed; expose stale/disconnected status. Existing per-run SSE alone cannot discover a previously unknown run ID.

### 10. P2 — Data-source inventory and historical selection are fragmented

Configured-source and Earth Engine metadata requests exist only in the bundled plugin. Earth Engine raster discovery/loading exists in the Expert GIS dialog, not the primary product. Its region inventory reads only `limit=100` and ignores `next_cursor`, although the general region client already follows pagination. Scenario submission always selects the first ready weather version from the first 100 results and uses the entire region bounds; it provides neither exact historical base-weather selection nor the API-supported rectangular scenario subset.

Evidence: [plugin catalog client](../apps/geolibre-desktop/public/plugins/digital-twin-demo/dist/index.js), lines 868–894; [Expert GIS dialog](../apps/geolibre-desktop/src/components/layout/AddEarthEngineDataDialog.tsx), lines 68 and 97; [Earth Engine discovery](../apps/geolibre-desktop/src/lib/digital-twin-earth-engine.ts), lines 294–340; [scenario serialization](../apps/geolibre-desktop/src/lib/digital-twin-runs.ts), lines 422–507.

Required outcome: product-level source readiness and intentional weather/bounds selection where needed; reuse complete region pagination. Re-fetching “latest weather” on a retry also changes scenario intent under the same idempotency key if new weather arrives; freeze accepted submission inputs across retries.

### 11. P2 — Passing frontend tests do not establish Engine compatibility

The focused tests primarily use handwritten responses, mock fetch functions, or source assertions. The browser suite intercepts `/api/v1/**`. No Engine OpenAPI generation/compatibility check was found in the frontend tests, scripts, or CI configuration. For example, the run-catalog fixture still uses `time.mode: "duration"`, while the current Engine accepts `present_forecast` or `bounded`.

Evidence: [run tests](../tests/digital-twin-runs.test.ts), line 106; [browser interception](../e2e/digital-twin-ui.spec.ts), lines 145–148; Engine `tests/api/test_surface.py` guards the operation count but not frontend coverage.

Required outcome: a shared generated contract or Engine-validated fixtures, plus cross-boundary tests for each supported workflow and failure state. Keep the endpoint matrix checked against OpenAPI so new routes cannot silently fall out of scope.

## Endpoint matrix

All paths below are relative to `/api/v1`. **Native** means a traced caller in the custom Digital Twin UI, including descriptor-driven tile loading. **Missing** means no caller in that product. References to old plugin, Expert GIS, or scripts only document where disconnected code remains; they do not count as coverage. Native caller presence does not imply full behavioral coverage; see findings above.

| # | Method | Path | Coverage | Evidence / limitation |
| ---: | --- | --- | --- | --- |
| 1 | GET | `/health/live` | Native | `digital-twin-status.ts:77`; live monitoring, but settings status is static |
| 2 | GET | `/health/ready` | Native | `digital-twin-status.ts:77`; also plugin |
| 3 | GET | `/regions` | Native | `digital-twin-runs.ts:336`; fully paginated there |
| 4 | POST | `/regions` | Missing | `seed-boulder-region.mjs:378`; no region creation UI |
| 5 | GET | `/regions/{region_id}` | Native | `digital-twin-runs.ts:458`; submission preflight |
| 6 | PATCH | `/regions/{region_id}` | Missing | No draft region editor |
| 7 | DELETE | `/regions/{region_id}` | Missing | No draft region deletion |
| 8 | POST | `/regions/{region_id}/publish` | Missing | `seed-boulder-region.mjs:409`; no publish UI |
| 9 | GET | `/regions/{region_id}/assets` | Native | `digital-twin-assets.ts:573`; map/catalog and live physics |
| 10 | POST | `/regions/{region_id}/assets` | Missing | CSV is the current interactive creation path |
| 11 | POST | `/regions/{region_id}/assets:batch` | Missing | `seed-boulder-region.mjs:393`; no interactive JSON batch |
| 12 | POST | `/regions/{region_id}/assets:csv` | Native | `digital-twin-assets.ts:645`; draft awareness incomplete |
| 13 | GET | `/regions/{region_id}/assets/{asset_id}` | Native | `digital-twin-assets.ts:624`; detail and physics |
| 14 | PATCH | `/regions/{region_id}/assets/{asset_id}` | Native | `digital-twin-assets.ts:681`; no draft-aware enablement |
| 15 | DELETE | `/regions/{region_id}/assets/{asset_id}` | Native | `digital-twin-assets.ts:704`; no draft-aware enablement |
| 16 | GET | `/regions/{region_id}/assets.geojson` | Native | `digital-twin-run-api.ts:258`; run exposure geometry |
| 17 | GET | `/data-sources` | Missing | `dist/index.js:868`; no primary source inventory |
| 18 | GET | `/regions/{region_id}/weather-datasets` | Native | status/live-weather/submission clients; historical choice incomplete |
| 19 | GET | `/regions/{region_id}/weather-forecasts/resolve` | Missing | No forecast resolver or time-selection flow |
| 20 | GET | `/regions/{region_id}/weather-datasets/{dataset_id}/map-layers` | Native | `digital-twin-live-weather.ts:376`; current weather sampling |
| 21 | GET | `/regions/{region_id}/weather-datasets/{dataset_id}/station-observations` | Native | `digital-twin-live-weather.ts:380`; nearest-station evidence |
| 22 | GET | `/regions/{region_id}/earth-engine` | Missing | `dist/index.js:887`; metadata/readiness |
| 23 | GET | `/regions/{region_id}/earth-engine/map-layers` | Missing | `digital-twin-earth-engine.ts:294`; also plugin |
| 24 | GET | `/map-layers/{layer_id}/data.tif` | Missing | Returned descriptor URL passed to COG loader in AddEarthEngineDataDialog; also plugin |
| 25 | GET | `/map-layers/{layer_id}/data.json` | Native | `digital-twin-live-weather.ts:267`; point sampling |
| 26 | GET | `/regions/{region_id}/point-cloud-datasets` | Native | `digital-twin-point-cloud.ts:208`; active dataset only |
| 27 | GET | `/regions/{region_id}/point-cloud-datasets/{dataset_id}` | Missing | No independent dataset selection/detail flow |
| 28 | POST | `/regions/{region_id}/point-cloud-datasets/{dataset_id}/surveys` | Missing | No PLY/georeferencing upload lifecycle |
| 29 | GET | `/point-clouds/{region_id}/{dataset_id}/{version}/{object_path}` | Native | `digital-twin-lidar.ts:218`; descriptor-driven API-proxy tile URL, conditional on Engine delivery mode |
| 30 | POST | `/simulation-runs` | Native | `digital-twin-runs.ts:516`; scenario shape only, direct-time shape missing |
| 31 | GET | `/simulation-runs` | Native | `digital-twin-runs.ts:320`; paginated; idle refresh stops |
| 32 | GET | `/simulation-runs/{run_id}` | Native | `digital-twin-runs.ts:352` and run-tab loader; field drift |
| 33 | GET | `/simulation-runs/{run_id}/events` | Missing | `dist/index.js:832`; primary UI polls |
| 34 | GET | `/simulation-runs/{run_id}/result.geojson` | Native | `digital-twin-run-api.ts:237`; also plugin |
| 35 | GET | `/simulation-runs/{run_id}/ticks/{tick}/result.geojson` | Native | `digital-twin-run-api.ts:210`; charts/replay/exposure |
| 36 | POST | `/simulation-runs/{run_id}/cancel` | Missing | `dist/index.js:915`; no primary cancellation control |
| 37 | POST | `/scenarios` | Native | `digital-twin-runs.ts:478`; create-and-run only; no library persistence UI |

Additional transport operations, outside the 37-operation denominator:

- HEAD `/map-layers/{layer_id}/data.tif`: explicitly called by `prepareDigitalTwinEarthEngineCog` (`digital-twin-earth-engine.ts:238`) from Expert GIS.
- HEAD `/point-clouds/{region_id}/{dataset_id}/{version}/{object_path}`: server supports it; no explicit application-level caller found. A separate user-facing action is unnecessary; verify the chosen tile loader's transport needs.
- `/point-clouds/...` local static delivery is mounted at runtime in local-storage mode; descriptor URLs are consumed by the same tile loader. Framework docs/OpenAPI endpoints are not product operations.

## Features that require backend work, not a missing existing-endpoint hookup

The current Engine surface has no scenario retrieval/library CRUD, alert list/detail/acknowledgement, durable evidence handoff/export, account preferences, organization/member administration, alert routing, simulation preset CRUD, or operational queue/storage/version diagnostic resource. Existing UI fixtures must not be interpreted as implemented workflows. Identity bootstrap/sign-in use deployment-owned `/api/digital-twin/...` URLs and are outside this Engine schema.

## Recommended implementation order

1. Correct misleading UI immediately: scenario fixtures, false autosave/status claims, and unsupported simulation controls. Fix the verified run-field/tick defects and add Engine-validated fixtures.
2. Complete existing operator contracts: primary cancellation, ongoing discovery of new runs, accurate failure/staleness reporting, and direct-time/forecast simulation.
3. Complete existing data-management contracts in the appropriate authorized surface: region draft-to-publication, asset creation/import, and survey upload/dataset lifecycle.
4. Add the backend contracts needed for a real scenario library and operational alert/evidence workflows. Connect settings only to their actual owning service.
5. Make OpenAPI drift and supported-workflow integration checks part of CI; use the matrix as an explicit parity boundary, not a raw endpoint-count target.

## Verification performed

- Generated the current Engine OpenAPI schema: **37 operations**; checked the two schema-hidden HEAD declarations in source.
- Focused frontend API/client/UI-model tests: **107 passed**, covering runs, assets, point clouds, Earth Engine, live weather, health, run tabs, bundled plugin, simulation-flow helpers, and settings.
- Engine tests: `tests/api/test_surface.py`, `tests/api/test_simulation_run_time_selection.py`, and `tests/api/test_forecast_data_sources.py`: **11 passed**.
- Executed the actual frontend run parser to reproduce bounded-duration, failure-field, and partial-tick mismatches.
- No production code was changed, no servers were started, and no API mutations were sent. This audit report is the only repository addition from the audit.
