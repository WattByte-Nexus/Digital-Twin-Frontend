# Engine-Backed Point-Cloud LOD Subtasks

Generated: 2026-08-11

## Goal

Deliver a production-shaped point-cloud path in which:

- the Digital Twin Engine ingests dense LiDAR sources, builds immutable
  hierarchical 3D Tiles, publishes them to local or object storage, and exposes
  a safe region-owned dataset descriptor;
- the GeoLibre frontend uses the descriptor to let deck.gl perform
  camera-driven tile selection and high-detail refinement near the camera;
- dense source points remain available in leaf tiles instead of being removed
  by a global display-thinning pass;
- production tile bytes travel directly from object storage/CDN to the client,
  while the Engine API owns metadata, lifecycle, and build orchestration; and
- the existing frontend-bundled Golden dataset and build script are removed
  after the Engine path works end to end.

## Existing Artifacts Inspected

Engine repository: `/Users/luke/Documents/Digital_Twin_Engine`

- `src/api/schemas/data_sources.py`
- `src/api/catalog/data_sources.py`
- `src/api/projection/map_layer_artifacts.py`
- `src/api/routes/map_layers.py`
- `src/api/routes/assets.py`
- `src/state/region/assets.py`
- `src/services/job_queue.py`
- `src/orchestrators/region/worker.py`
- `src/app.py`
- `pyproject.toml`

Frontend repository: `/Users/luke/Documents/Digital_Twin_Frontend`

- `apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-lidar.ts`
- `apps/geolibre-desktop/src/product-modes/digital-twin/ui/DigitalTwinMapWorkspace.tsx`
- `apps/geolibre-desktop/src/lib/digital-twin-earth-engine.ts`
- `packages/plugins/src/plugins/shared-deck-overlay.ts`
- `packages/plugins/src/plugins/maplibre-3d-tiles.ts`
- `packages/plugins/src/plugins/arcgis-i3s-tiles.ts`
- `scripts/build-usgs-lidar-tiles.py`
- `apps/geolibre-desktop/public/data/usgs-lidar/golden-city/`
- `tests/digital-twin-lidar-layer.test.ts`

Current behavior and constraints:

- The frontend already renders point-cloud 3D Tiles with deck.gl
  `Tile3DLayer` and a Gaussian surfel `PointCloudLayer` subclass.
- The dedicated Digital Twin layer uses `maximumScreenSpaceError: 1`, so it is
  already asking the hierarchy for close-range detail.
- The checked-in Golden artifact is about 201 MiB and contains about 13.7
  million points selected from about 167.6 million source points.
- The frontend build script globally thins ordinary points to one sample per
  4 x 4 x 3 metre voxel. That removed detail cannot be recovered by lowering
  screen-space error.
- The Engine's `AssetStore` is a discriminated union for individual trees and
  power lines, with draft-region mutation rules. A region-wide point-cloud
  dataset does not belong in that module.
- The Engine's raster `MapLayerDescriptor` is also intentionally raster-only.
  A point-cloud descriptor should be a separate schema rather than making that
  interface shallow with many nullable raster/3D fields.
- The Engine already has Redis-backed queues, region ownership, immutable
  artifact patterns, local artifact delivery, and S3 publishing code that can
  be reused without coupling point-cloud builds to weather recomputation.
- The shared 3D Tiles path currently disables loaders.gl workers because the
  Tauri CSP blocks CDN worker loading. loaders.gl supports application-provided
  worker URLs, so dense-tile parsing must validate locally bundled workers.

## Assumptions

- The first complete dataset is the existing Golden, Colorado USGS 3DEP source.
- The first supported source types are registered EPT and local LAS/LAZ inputs;
  arbitrary user-provided remote URLs are not accepted by a public endpoint.
- The browser and Tauri desktop app are both release targets.
- Point positions and RGB are required in the first slice. Classification can
  be retained when the selected converter and renderer expose it cleanly, but
  classification styling does not block the first slice.
- One active immutable point-cloud dataset version is selected per region. Old
  versions may remain addressable until retention removes them.
- Camera state is never sent to the Engine for ordinary LOD traversal.
- Initial performance targets are calibrated on the Golden benchmark fixture
  and then recorded in the ADR; they are not exposed as user configuration.

## Architectural Decisions to Preserve

1. **Separate dataset module:** create a point-cloud dataset catalog rather than
   adding point clouds to tree/power-line `AssetStore` or raster
   `MapLayerDescriptor`.
2. **Small public interface:** the frontend learns one active dataset descriptor
   and one `tileset_url`; tiling layout, source references, build tooling, and
   storage keys stay private to the Engine.
3. **Client-side LOD:** deck.gl/loaders.gl traverses the tileset from the current
   viewport. The Engine does not process camera updates.
4. **Direct byte delivery:** production `tileset_url` points to object
   storage/CDN. The API does not proxy every `.pnts`/tile request.
5. **Immutable versions:** a completed build is published under a versioned
   prefix. Promotion changes the region's active pointer atomically; published
   tile content is never mutated in place.
6. **No compatibility layer:** once Engine delivery passes integration tests,
   remove the checked-in Golden tile tree, its frontend build command, and its
   hard-coded `/data/usgs-lidar/...` path.

## Draft Shared Contract

The Engine owns this contract; the frontend consumes it. Final names are locked
in E1 before implementation spreads across repositories.

### Read endpoints

- `GET /api/v1/regions/{region_id}/point-cloud-datasets`
- `GET /api/v1/regions/{region_id}/point-cloud-datasets/{dataset_id}`

The collection response includes `active_dataset_id` so the frontend never
guesses which of several versions to render.

### Descriptor fields

| Field | Shape | Rule |
| --- | --- | --- |
| `dataset_id` | string | Stable logical dataset identity |
| `region_id` | string | Must match the owning region |
| `name` | string | User-facing label |
| `status` | `queued \| building \| ready \| failed` | Only `ready` is renderable |
| `format` | `3d-tiles-point-cloud` | Explicit renderer dispatch |
| `tileset_url` | string or null | Non-null only when ready; relative to Engine base or absolute CDN URL |
| `bounds` | `[west, south, east, north]` | WGS84 public extent |
| `bounds_crs` | `EPSG:4326` | Fixed interpretation of bounds |
| `point_count` | integer or null | Published point count |
| `source_point_count` | integer or null | Pre-hierarchy source count |
| `minimum_spacing_m` | number or null | Dense-leaf sampling floor |
| `attributes` | string array | At least `position`; `rgb` when present |
| `version` | string | Immutable build/content version |
| `attribution` | string | Safe source attribution |
| `updated_at` | UTC datetime | Lifecycle timestamp |
| `failure_code` | string or null | Safe operator-facing category; never raw source details |

Do not add client rendering policy such as screen-space error, point size, GPU
memory budget, or request concurrency to this descriptor. Those values depend
on the client/runtime rather than the dataset contract. Geometric error remains
inside the standard tileset hierarchy.

## Minimum Complete Slice

1. Run one Engine command against the registered Golden EPT source.
2. Build a versioned 3D Tiles hierarchy whose dense leaves preserve no worse
   than 0.5 metre display spacing for ordinary surfaces.
3. Publish it through the Engine's local artifact adapter.
4. Return it as the active `ready` dataset for the Golden region.
5. Let the frontend load the descriptor and render it with `Tile3DLayer`.
6. Demonstrate that an overview loads first and that deeper tile URLs are
   requested when zooming to street level.
7. Remove the hard-coded frontend URL and checked-in 201 MiB tile tree.

Object storage/CDN publication, durable asynchronous builds, and Tauri worker
packaging are added on top of this working vertical slice and must be completed
before production release.

## Execution Shape

- Critical path: E1 -> E2 -> E3 -> E4 -> E5 -> F3 -> I1
- Parallel after E1: E2 and F1
- Parallel after E2: E3 and F2 (F2 uses the contract fixture)
- Integration point: F3 combines E5's active dataset endpoint with F2's generic
  renderer.
- Riskiest assumption: the chosen converter can retain dense Golden leaves,
  produce deck.gl-compatible progressive content, and stay within practical
  peak memory/build time.
- Second risk: loaders.gl parsing workers can be packaged locally under the
  desktop CSP; otherwise dense tile parsing may cause main-thread stalls.

## Engine Plan

### E1: Lock the point-cloud dataset interface

**Outcome:** An Engine-owned schema, lifecycle, route contract, and ADR that the
frontend can implement against without knowing storage or conversion details.

**Scope:** Define the read contract above, immutable version behavior, active
dataset selection, safe failure reporting, and the distinction between semantic
assets, raster map layers, and point-cloud datasets. Do not implement conversion
or tile delivery.

**Context packet:**

- `/Users/luke/Documents/Digital_Twin_Engine/src/api/schemas/data_sources.py`
- `/Users/luke/Documents/Digital_Twin_Engine/src/api/catalog/data_sources.py`
- `/Users/luke/Documents/Digital_Twin_Engine/src/state/region/assets.py`
- `/Users/luke/Documents/Digital_Twin_Engine/src/api/routes/assets.py`
- Draft shared contract in this plan

**Agent instructions:**

1. Add a focused `point_clouds` schema module instead of widening the raster
   descriptor or tree/power-line union.
2. Define collection and item responses, lifecycle values, URL invariants, and
   active-version rules.
3. Add route skeletons backed by a fake/in-memory catalog so OpenAPI and
   frontend fixture work can begin.
4. Record an ADR explaining client-side LOD, direct byte delivery, immutable
   publication, and why this is a separate module.
5. Include an OpenAPI example for queued, ready, and failed datasets. Keep raw
   source URIs, filesystem paths, S3 keys, and exception text private.

**Acceptance criteria:**

- Pydantic rejects a ready descriptor without `tileset_url` and rejects a
  non-ready descriptor that claims published counts/URL.
- A collection explicitly identifies zero or one active ready dataset.
- Region and dataset identity mismatches return typed 404/409-class errors.
- Existing asset and raster schemas do not acquire point-cloud-only nullable
  fields.
- Schema, route, and OpenAPI tests pass.

**Validation:** Run focused pytest tests, Ruff, and mypy for the new modules.

**Dependencies:** None.

**Handoff:** ADR, exact JSON fixtures, OpenAPI diff, and the final Pydantic
models consumed by F1.

### E2: Select and benchmark the hierarchy builder

**Outcome:** A source-grounded converter decision and a reproducible Golden
sample proving that dense progressive LOD is feasible before production code is
built around a tool.

**Scope:** Compare the existing `py3dtiles` path with credible maintained
alternatives or compositions such as PDAL-backed extraction plus a 3D Tiles
builder. Cover EPT and LAS/LAZ input, RGB, hierarchy quality, build memory,
deployment complexity, and deck.gl compatibility. Do not build a general
pipeline yet.

**Context packet:**

- `/Users/luke/Documents/Digital_Twin_Frontend/scripts/build-usgs-lidar-tiles.py`
- `/Users/luke/Documents/Digital_Twin_Frontend/apps/geolibre-desktop/public/data/usgs-lidar/golden-city/source.json`
- `/Users/luke/Documents/Digital_Twin_Frontend/apps/geolibre-desktop/public/data/usgs-lidar/golden-city/tileset.json`
- deck.gl `Tile3DLayer` and loaders.gl `Tileset3D` current documentation

**Agent instructions:** Before implementing custom code, use `$deep-dive` to
check current converter/tool documentation and releases. Adopt a tool only when
it reduces total conversion, packaging, and maintenance complexity after
integration cost.

Build a bounded Golden fixture and compare:

- hierarchy/refinement correctness and geometric errors;
- point count at overview and dense leaf levels;
- largest and median tile payload;
- total bytes and tile count;
- time to first usable overview tile in the frontend;
- peak converter memory and wall time;
- local/offline reproducibility; and
- ability to use application-hosted parsing workers where relevant.

Do not accept the existing fixed 4 x 4 x 3 metre global thinning as the dense
leaf representation. Overview decimation is expected; leaf decimation must be
explicitly tied to the 0.5 metre first-slice target and source density.

**Acceptance criteria:**

- The fixture renders in the current frontend with no renderer fork.
- Zooming in selects deeper content and visibly increases density.
- Dense leaves meet the recorded spacing target or the ADR explains a measured
  source/tool limitation and selects the best attainable value.
- The chosen approach has a maintained upstream, compatible license, pinned
  version strategy, and reproducible command.
- One ADR records the decision and rejects the alternatives with measured data.

**Validation:** Run the converter twice and compare manifest/statistics output;
open the fixture in the web app and capture the tile-request waterfall.

**Dependencies:** E1 contract draft, but can begin benchmark preparation in
parallel.

**Handoff:** ADR, benchmark table, fixture source recipe, generated statistics,
and the chosen tool/version.

### E3: Implement the Engine point-cloud build module

**Outcome:** A deterministic Engine module that converts one registered source
into a validated, versioned point-cloud artifact without loading the entire city
into application memory.

**Scope:** Implement registered EPT and local LAS/LAZ source resolution, bounded
or chunked extraction, optional existing imagery colorization, conversion,
manifest normalization, validation, and build statistics. Start with the one
production density policy selected in E2; do not add speculative quality
profiles.

**Context packet:**

- E2 ADR and fixture
- `/Users/luke/Documents/Digital_Twin_Frontend/scripts/build-usgs-lidar-tiles.py`
- `/Users/luke/Documents/Digital_Twin_Engine/src/data/`
- `/Users/luke/Documents/Digital_Twin_Engine/src/config/config.py`
- Existing Engine temporary-file and artifact-manifest patterns

**Agent instructions:**

1. Move useful source query, boundary, colorization, and metadata logic into the
   Engine; do not leave two maintained builders.
2. Separate source reading, hierarchy building, validation, and publication
   preparation into focused internal modules.
3. Process spatial chunks or converter-supported streams. Bound memory and
   clean partial temporary output on failure.
4. Make the content version a hash of source lineage, region bounds, converter
   version, and build policy.
5. Validate `tileset.json`, every referenced content URI, bounds, nonzero point
   counts, geometric-error monotonicity, maximum leaf payload, and required
   attributes before returning a publishable artifact.
6. Emit a compact manifest with source count, published count, spacing,
   converter version, build duration, output bytes, and checksum. Do not expose
   private source credentials or signed URLs.

**Acceptance criteria:**

- Two builds from identical inputs produce the same logical version and
  equivalent normalized manifests.
- The Golden fixture retains dense leaves at the E2 target and a lightweight
  overview.
- Peak memory stays below the E2 budget and does not scale as one in-memory
  array of all source points.
- Invalid CRS, empty coverage, missing RGB when required, corrupt output, and
  disk exhaustion fail before publication with typed errors.
- Unit tests use small generated LAS/EPT fixtures; one marked integration test
  exercises the bounded Golden fixture.

**Validation:** Focused pytest, Ruff, mypy, deterministic-manifest comparison,
and the marked converter integration test.

**Dependencies:** E2.

**Handoff:** Build module, CLI-callable application method, validation report,
tests, and generated artifact manifest.

### E4: Publish immutable tiles through local and object-storage adapters

**Outcome:** Validated builds are atomically published and directly fetchable
from either local development storage or production object storage/CDN.

**Scope:** Create one storage seam with two real adapters: local filesystem and
S3-compatible object storage. Implement versioned prefixes, promotion, URL
resolution, caching headers, CORS requirements, cleanup, and failure rollback.
Do not proxy production tile bodies through ordinary FastAPI route handlers.

**Context packet:**

- `/Users/luke/Documents/Digital_Twin_Engine/src/data/normalization/weather_artifacts.py`
- `/Users/luke/Documents/Digital_Twin_Engine/src/api/projection/map_layer_artifacts.py`
- `/Users/luke/Documents/Digital_Twin_Engine/src/config/config.py`
- E3 publishable artifact result

**Agent instructions:**

1. Publish under
   `point-clouds/{region_id}/{dataset_id}/{version}/...`.
2. Upload/copy into a staging prefix, verify size/checksum/reference closure,
   then atomically mark the version available to the catalog.
3. Configure `.json` and binary tile content types, immutable cache headers for
   versioned content, `GET`/`HEAD`, byte-range support where the adapter offers
   it, and the frontend origins required by CORS.
4. Return a public base URL/tileset URL; never return bucket credentials or
   internal source locations.
5. Provide a local development delivery adapter with the same URL semantics and
   cache behavior. Keep the adapter narrow: publish, verify, resolve URL, and
   delete an unreferenced version.

**Acceptance criteria:**

- A failed upload cannot become active and leaves no catalog-visible partial
  version.
- All URIs reachable from `tileset.json` return 200 from local delivery and the
  S3 fake/integration adapter.
- Versioned objects carry immutable caching and correct content types.
- A production descriptor resolves directly to the configured public/CDN base,
  not an API byte-proxy URL.
- Retention deletes only versions proven not to be active or referenced.

**Validation:** Temporary-directory tests, mocked S3 tests, manifest closure
test, HTTP header test, and one optional real-bucket smoke test.

**Dependencies:** E3.

**Handoff:** Storage interface, two adapters, configuration, publication tests,
and example deployment headers.

### E5: Add durable build orchestration and the region dataset catalog

**Outcome:** Operators can enqueue an idempotent point-cloud build, observe its
lifecycle, and retrieve the active ready dataset through the E1 read contract.

**Scope:** Implement a point-cloud dataset store, build command, worker handler,
active-version promotion, list/get routes, safe failure state, logs, and metrics.
Use registered source references. Do not reuse the weather-specific
`RegionUpdateCommand` or make point-cloud builds trigger physics updates.

**Context packet:**

- `/Users/luke/Documents/Digital_Twin_Engine/src/services/job_queue.py`
- `/Users/luke/Documents/Digital_Twin_Engine/src/orchestrators/region/worker.py`
- `/Users/luke/Documents/Digital_Twin_Engine/src/state/region/catalog.py`
- `/Users/luke/Documents/Digital_Twin_Engine/src/app.py`
- E1 schemas, E3 builder, and E4 publisher

**Agent instructions:**

1. Add a dedicated command/handler whose idempotency identity includes region,
   logical dataset, source fingerprint, and build policy.
2. Persist `queued -> building -> ready|failed` transitions and exact immutable
   versions. Retry of the same command must return the same lineage rather than
   publish a duplicate.
3. Promote the active dataset pointer only after E4 verification completes.
4. Keep a previous ready version active when a replacement build fails.
5. Expose list/get routes from E1 and an operator CLI that enqueues only
   configured source references. Add a network authoring route only if the
   Engine's authentication and source-allowlist policy are in scope.
6. Emit build duration, source/published points, output bytes, tile count,
   failure code, and active version as structured metrics/logs.

**Acceptance criteria:**

- Concurrent identical enqueues create one build lineage.
- Worker crash/retry cannot expose partial output or corrupt the active pointer.
- Failed replacement leaves the previous ready descriptor renderable.
- Region deletion/retention behavior is explicit and tested.
- List/get endpoints match the E1 fixtures byte-for-byte after JSON
  normalization and never expose registered source refs.
- Application dependency wiring and readiness tests cover both adapters.

**Validation:** Focused state/route/worker tests with fakes, Redis integration
test, mypy, Ruff, and one CLI-to-ready local artifact smoke test.

**Dependencies:** E1, E3, E4.

**Handoff:** Durable workflow, catalog routes, operator command, OpenAPI update,
and a ready Golden descriptor for frontend integration.

## Frontend Plan

### F1: Implement the Engine point-cloud client and runtime validation

**Outcome:** The frontend can fetch, validate, and resolve the active dataset
without depending on the Engine's storage layout or the current page origin.

**Scope:** Add TypeScript contract types, runtime validation using existing
frontend conventions, URL resolution against the configured Digital Twin API
base, request cancellation, and typed empty/loading/failed/ready results. Do not
render tiles yet.

**Context packet:**

- E1 JSON/OpenAPI fixtures
- `/Users/luke/Documents/Digital_Twin_Frontend/apps/geolibre-desktop/src/lib/digital-twin-earth-engine.ts`
- `/Users/luke/Documents/Digital_Twin_Frontend/apps/geolibre-desktop/src/product-modes/digital-twin/`
- Existing Digital Twin API URL persistence and dev proxy behavior

**Agent instructions:**

1. Add a small client method: region id in, active point-cloud result out.
2. Resolve relative `tileset_url` values against the Engine API origin; retain
   absolute CDN URLs unchanged.
3. Reject inconsistent status/URL/count combinations at the client seam and
   return actionable typed errors.
4. Abort stale requests when region, API base, workspace, or mode changes.
5. Use E1 fixtures for contract tests; do not hand-maintain a divergent mock
   shape in multiple test files.

**Acceptance criteria:**

- Tests cover no datasets, queued/building, active ready, failed, malformed,
  relative URL, absolute CDN URL, abort, and non-2xx responses.
- No point-cloud code constructs URLs from `window.location.origin`.
- Consumers do not need to know collection selection or URL normalization
  rules.

**Validation:** Frontend unit tests, lint, and TypeScript build.

**Dependencies:** E1. Can proceed against fixtures while E2-E5 run.

**Handoff:** Client module, stable result type, fixtures, and tests for F3.

### F2: Build a reusable high-detail point-cloud renderer module

**Outcome:** One focused renderer turns a ready Engine descriptor into a
`Tile3DLayer`, owns its lifecycle callbacks, and automatically refines to dense
leaf tiles near the camera within a bounded resource budget.

**Scope:** Generalize the current Golden-specific layer factory while retaining
the Gaussian surfel presentation. Configure a single measured quality policy,
memory/request limits, tile errors, and worker delivery. Do not add a user-facing
quality-settings system in the first slice.

**Context packet:**

- `/Users/luke/Documents/Digital_Twin_Frontend/apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-lidar.ts`
- `/Users/luke/Documents/Digital_Twin_Frontend/packages/plugins/src/plugins/shared-deck-overlay.ts`
- `/Users/luke/Documents/Digital_Twin_Frontend/packages/plugins/src/plugins/arcgis-i3s-tiles.ts`
- `tests/digital-twin-lidar-layer.test.ts`
- E2 benchmark fixture and current deck.gl/loaders.gl documentation

**Agent instructions:**

1. Replace `createGoldenUsgsLidarLayer` with a descriptor-driven factory whose
   small interface accepts `id`, `tilesetUrl`, and lifecycle callbacks.
2. Start with measured defaults: a one-pixel screen-space-error target for the
   high-detail Digital Twin view, a 512 MiB tileset budget, memory-adjusted SSE,
   and request throttling. Change these only with benchmark evidence.
3. Preserve point size in metres and Gaussian surfel rendering. Keep visual
   shader concerns separate from dataset fetching and layer lifecycle.
4. Confirm whether the 3D Tiles point-content loader has a prebuilt worker that
   Vite can import with `?url`. If it does, package and reference that local URL,
   update the Tauri CSP narrowly, and assert that no worker script is fetched
   from a CDN. If it does not, record the exact parser path and benchmark
   main-thread parsing before accepting it.
5. Surface first-tile ready, tile error, loaded/unloaded tile counts, and bytes
   when available. Do not report ready merely because `tileset.json` loaded.
6. Dispose layers/overlay contribution on descriptor change or workspace exit.

**Acceptance criteria:**

- Given E2's hierarchy, moving from overview to street-level view results in
  deeper tile requests without requesting the entire dataset.
- Loaded tile memory remains bounded by the configured budget after cache
  eviction settles.
- Rapid camera movement does not cause an unbounded request queue or stale
  layer errors.
- Browser and Tauri builds make no runtime worker request to `unpkg` or another
  CDN.
- Factory, shader, lifecycle, and load-option tests pass without a real network.

**Validation:** Unit tests, frontend build, browser request waterfall, Tauri CSP
smoke test, and E2 fixture frame/long-task capture.

**Dependencies:** E1 fixture and E2 artifact. Can be developed before E5.

**Handoff:** Descriptor-driven renderer, documented measured constants,
locally packaged worker decision, lifecycle tests, and benchmark capture.

### F3: Integrate region point clouds and remove the bundled Golden path

**Outcome:** Digital Twin mode loads the Engine's active dataset for the current
region, presents clear lifecycle/error state, and contains no embedded Golden
point-cloud artifact or alternate legacy route.

**Scope:** Wire F1 and F2 into `DigitalTwinMapWorkspace`, coordinate map/region
lifecycle, provide existing-style toggle/status UI, and remove obsolete data,
scripts, constants, and tests. Keep the UI focused; do not add dataset authoring
or a quality-control panel.

**Context packet:**

- `/Users/luke/Documents/Digital_Twin_Frontend/apps/geolibre-desktop/src/product-modes/digital-twin/ui/DigitalTwinMapWorkspace.tsx`
- `/Users/luke/Documents/Digital_Twin_Frontend/apps/geolibre-desktop/src/product-modes/digital-twin/digital-twin-lidar.ts`
- `/Users/luke/Documents/Digital_Twin_Frontend/apps/geolibre-desktop/public/data/usgs-lidar/golden-city/`
- `/Users/luke/Documents/Digital_Twin_Frontend/scripts/build-usgs-lidar-tiles.py`
- `/Users/luke/Documents/Digital_Twin_Frontend/package.json`
- F1 client, F2 renderer, and E5 endpoint

**Agent instructions:**

1. Fetch the active descriptor when the selected region/API base changes and
   add the layer only after both map and descriptor are ready.
2. Distinguish `no dataset`, `building`, `loading tiles`, `ready`, and `failed`.
   Offer retry for network/tile failures; do not silently fall back to bundled
   data.
3. Keep the current LiDAR visibility toggle and accessible status text. Use
   shadcn/ui through `@geolibre/ui` for any new status primitive or tooltip.
4. On region switch or mode exit, abort metadata requests and remove/dispose the
   previous point-cloud layer before installing another.
5. After the Engine Golden smoke test passes, delete the checked-in tile tree,
   frontend build script, `build:lidar:golden` package command, Golden URL
   constants, and obsolete tests. Update tests to use E1 fixtures.

**Acceptance criteria:**

- Golden renders from the Engine-provided URL in browser and Tauri builds.
- Switching regions never leaves the prior region's point cloud visible.
- A building dataset does not issue a tileset request; a ready dataset does.
- API and tile failures are visible and retryable without remounting the app.
- Repository search finds no `/data/usgs-lidar/golden-city`,
  `GOLDEN_USGS_LIDAR_TILESET_URL`, or `build:lidar:golden` references.
- The removed 201 MiB artifact is absent from application build output.

**Validation:** Unit tests, lint, build, focused Playwright region-switch/error
tests, and browser/Tauri smoke tests against the local Engine.

**Dependencies:** F1, F2, E5.

**Handoff:** Engine-backed workspace flow, deletion list, test evidence, and
before/after application bundle size.

## Integration Plan

### I1: Validate LOD, delivery, and operational budgets end to end

**Outcome:** One repeatable cross-repository test and performance report proves
that the system streams progressively, reaches the required close-range detail,
and stays bounded under realistic camera movement.

**Scope:** Run the Engine local publisher/catalog plus the frontend against the
Golden benchmark region. Test browser and Tauri. Validate contracts, network
selection, visual density, memory, workers, cache behavior, and failure modes.
Do not add new product behavior during this task; failures return to the owning
E/F task.

**Context packet:** All E1-E5 and F1-F3 handoffs.

**Agent instructions:**

1. Start from an empty artifact root, enqueue/build Golden, wait for `ready`,
   and launch the frontend against that Engine.
2. Record cold overview, street-level zoom, rapid pan, revisit, region switch,
   offline-after-cache, failed tile, and failed replacement-build scenarios.
3. Prove from network logs that overview and street view select different depth
   content and that a street view does not download the complete city dataset.
4. Record peak tileset memory, loaded tile count, requested bytes, time to first
   usable overview, time to dense street view, frame time, and parsing long
   tasks on a named reference machine/network profile.
5. Use initial release targets of: dense-leaf spacing no worse than 0.5 metre,
   tileset memory no greater than 512 MiB after settling, no tile parse long
   task above 100 ms, and a usable local overview within 2 seconds. If E2 proves
   a target infeasible, change it only in the ADR with measured justification.
6. Verify immutable cache hits on revisit, no CDN worker scripts, no raw source
   refs in API responses/logs, and continued rendering of the previous active
   version after a failed replacement.

**Acceptance criteria:**

- Contract, integration, performance, and failure reports are reproducible from
  documented commands.
- Every initial release target passes on the recorded reference setup or has an
  approved ADR adjustment backed by E2 measurements.
- Frontend CI and Engine unit/type/lint suites pass.
- The frontend repository contains no legacy Golden delivery path.
- Production deployment documentation names object storage/CDN headers,
  retention, metrics, alerts, and rollback to the prior active version.

**Validation:** Automated cross-repository smoke test plus saved browser/Tauri
performance traces and a manual visual check at fixed overview/street camera
bookmarks.

**Dependencies:** E1-E5 and F1-F3.

**Handoff:** Release-readiness report, benchmark results, trace locations,
operational runbook, and remaining non-blocking follow-ups.

## Coordination Notes

- E1 owns the shared JSON contract. Frontend code should consume its fixture;
  neither repository should invent additional fields independently.
- E2 owns converter selection and measured density/build budgets. E3 must not
  substitute a different tool or fixed thinning policy without updating the
  ADR and benchmarks.
- E4 owns storage URLs and cache/CORS semantics. E5 stores the published result
  and active pointer but does not know bucket layout.
- F1 owns Engine URL resolution. F2 receives a resolved tileset URL and must not
  know whether it came from local storage or a CDN.
- F3 deletes the old frontend artifact only after the Engine Golden fixture is
  renderable. The deletion is intentional and has no fallback/compatibility
  path.
- Do not assign E3 and E4 to agents editing the same new artifact module at the
  same time; land the E3 publishable-result interface before E4 begins.
- The frontend can implement F1 and most of F2 against fixtures while the
  Engine performs E2-E5.

## Suggested Next Dispatch

Start E1 in the Engine repository:

> Define the separate region-owned point-cloud dataset contract described in
> `agents/point-cloud-lod-subtasks.md` E1. Add focused Pydantic schemas, fake-backed
> read route skeletons, OpenAPI examples, tests, and an ADR. Do not extend the
> tree/power-line Asset union or raster MapLayerDescriptor. Return the exact JSON
> fixtures and validation commands so frontend F1 can begin.

Once E1's draft JSON shape is available, start E2 and F1 in parallel.
