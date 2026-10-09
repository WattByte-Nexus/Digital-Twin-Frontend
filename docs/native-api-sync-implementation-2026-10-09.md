# Native API synchronization implementation

Date: 2026-10-09. Scope: the custom product rooted at `App.tsx → DigitalTwinMapWorkspace`, plus the Engine boundaries needed by its native workflows. Changes are in the working trees; this task did not commit or deploy them. Pre-existing frontend asset, physics, and map changes were preserved.

Follow-up: the [fresh retest](native-api-sync-test-results-2026-10-09.md) passed all 11 native browser checks and a broader 599-test Engine selection, but found that the running local Engine is older than this contract, the preview lacks its identity projection, and the development server has stale optimized dependencies.

## Delivered behavior

| Boundary | Frontend delivery | Engine delivery |
| --- | --- | --- |
| Contract and transport | Shared authenticated same-origin transport, structured failures, aborts, idempotency, cursor handling, generated wire types, exact schema drift check | Deterministic OpenAPI export and current-model fixtures; normal CI artifact parity; separate cross-repository compatibility workflow |
| Scenarios | Real library, explicit save without running, reload, run saved intent, edit/duplicate as new, dirty navigation protection; no fake records or autosave claims | Immutable list/get endpoints and atomic regional listing index |
| Simulation inputs | Synthetic wind, bounded-time, and present-forecast requests; explicit weather version, extent, timestep, forecast resolution and run ignition inputs | Existing numerical request semantics retained; unsupported numerical settings were removed from UI |
| Run lifecycle | Idle catalog discovery, direct run URL recovery, cancellation races, named SSE events/replay/reset, authoritative snapshot recovery, partial tick results and stale update state | Existing lifecycle endpoints protected by resource/action authorization |
| Regions and assets | Native Data administration, draft creation/edit/delete, publication, single/batch/CSV intake and draft-only asset editing | Safe publication/configuration/hydration/source readiness projection; existing mutations protected |
| Sources and raster | Source inventory, Earth Engine/weather layer descriptors, COG HEAD preparation, controlled Show/Hide, scalar style/nodata rendering in shared native map | Existing source/artifact endpoints protected; binary contracts retained |
| Point clouds | Dataset inspection/selection, reviewed PLY metadata upload, polling exact accepted replacement version, previous ready tiles retained on build/failure | `latest_build` exposes replacement state separately from the current viewable version |
| Settings and shell | Real health/endpoint/check time, persisted local light/dark mode, saved-scenario navigation, administration without operational region scope | No fabricated membership, routing, diagnostics or preference service added |

The bundled demo plugin, duplicate Digital Twin workspace/header, fake scenario models, and obsolete implementation-specific tests were removed. Authored network reference data moved to `public/data/reference-networks`; unrelated GeoLibre Expert GIS remains available through its existing boundary. Shared UI primitives and semantic themes remain the component foundation.

## Coverage and provenance

The baseline audit counted 37 public operations. This task added scenario list/get and region readiness; a concurrent Engine change exposed the root readiness alias. The pinned schema therefore contains **41 operations: 40 `/api/v1` operations assigned to native workflows and one infrastructure root readiness alias**. Two schema-hidden binary HEAD methods are separately recorded. The [coverage manifest](../tests/fixtures/digital-twin-endpoint-coverage.json) checks completeness against OpenAPI and points to owning clients, native surfaces and tests. Caller presence is not proof of live-service operation.

Frontend base: `90629113e1997e68ffce2e976f495d72e3666c82`. Engine HEAD at final export: `c4f3df8456f88f3ac22c25343a6ecb259eb3d284`, including this task's uncommitted changes. The exact schema fingerprint is in [contract metadata](../tests/fixtures/digital-twin-engine.contract.json); the commit alone does not reproduce this working-tree contract. Frontend examples are copied from the Engine's model-validated fixture export, not handwritten alternate wire contracts.

To verify the current pair:

```sh
npm run check:digital-twin-contract
node scripts/digital-twin-contract.mjs --check --engine-schema ../Digital_Twin_Engine/docs/reference/openapi.json
```

## Verification

- Frontend full suite: **3,568 passed, one skipped, one pre-existing failure** out of 3,570 tests. The existing Linux metainfo generation test rejects the environment's `DATE` value; the same failure was recorded before implementation.
- Frontend TypeScript and production build: passed. The optional JupyterLite prebuild could not reach PyPI in the restricted environment and skipped; native app compilation and bundling succeeded.
- Frontend lint: zero errors, 25 existing warnings. All three worker typechecks passed.
- Engine focused API, scenario/point-cloud stores, configuration, architecture and documentation checks: **280 tests plus nine subtests passed**. Scoped Ruff/formatting and targeted mypy passed.
- Pinned frontend types, Engine OpenAPI/model fixtures, operation inventory, and comparison of the current repository pair: passed.
- Native browser regressions: **11 passed** against the final production bundle. Coverage includes scenario save/reload/frozen retry/cancellation, direct run URLs, denied access, dirty navigation, region and asset authoring, publication/readiness, non-administrator controls, COG Show/Hide, exact survey-version failure tracking, actual health changes, theme reload and administrator-only empty-region setup. Tests run the production frontend with controlled HTTP responses; Engine API tests separately exercise actual routes with controlled stores. These are complementary checks, not a claim of testing a deployed Engine through the real host.
- Final shell/theme/operation-inventory checks after integration: **28 passed**; whitespace checks passed. The browser pass caught and verified a fix for returning from Data to an already-selected Live destination.

The earlier broader Engine run had 1,100 passes, one skip, 79 subtests and five failures amid concurrent point-cloud execution-ID/worker changes outside this task. Whole-repository Engine success is not claimed; those external edits were preserved.

## Remaining deployment requirements and limits

1. **Verified host integration:** Engine `verified_host` mode fails closed unless a trusted host injects typed identity and regional action grants. No production session/grant adapter exists in the available implementation. Complete that hosting boundary before protected rollout. `local_network` is an explicit network-trust policy, not user authentication. Native mutation visibility currently uses the host's coarser administration capability; Engine action checks remain authoritative.
2. **Hosted compatibility gate:** publish reviewed frontend and Engine revisions, then configure the private repository read token and exact frontend revision for the Engine compatibility workflow. Local candidate parity passes; the hosted workflow was not dispatched against unpublished work.
3. **Runtime acceptance:** provision configured regions, hydrated grids, weather/source data, storage, Redis and workers. Region publication intentionally does not create that infrastructure. Validate representative real simulations, reconnection, COG/range/GPU rendering and PLY replacement processing through the actual authenticated deployment. This task did not execute those live jobs or mutate production data.
4. **Scenario index policy:** new scenarios are indexed atomically. Historical records created before the index remain retrievable by ID but are not migrated into the list. No compatibility migration was added, consistent with repository instructions.
5. **Separate product scope:** alert inbox/routing, account membership/preferences and unsupported numerical controls still require their own owning backend contracts. Endpoint integration does not complete the entire production pilot.

No claim of zero possible regressions is made. Baseline comparisons, focused behavioral tests, browser workflows and contract gates provide specific evidence; the deployment checks above remain necessary.
