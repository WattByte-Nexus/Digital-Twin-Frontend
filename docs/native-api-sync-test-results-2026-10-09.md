# Native API synchronization retest

Retested on 2026-10-09 following implementation. Verdict: automated native workflow checks pass; the currently running local deployment is not synchronized and cannot receive an end-to-end acceptance sign-off.

## Subsequent local synchronization

After the user requested synchronization, the Engine was restarted from the current checkout on `127.0.0.1:8000`, and Vite was restarted with forced dependency optimization on `127.0.0.1:5173`. The frontend's `.env.local` had been routing its API proxy to a remote Engine; only `DIGITAL_TWIN_API_PROXY_TARGET` was changed to `http://127.0.0.1:8000`. Vite reloaded that configuration. The local proxy now serves the same 41-operation schema as the frontend pin, verified by the exact candidate contract check.

The first real scenario-list request exposed a persistence bug masked by the original test double: `BaseStore` already owns the raw Redis client, so `ScenarioStore.list` must call `zrangebylex` directly. That was corrected and the fake now separates the service facade from raw Redis commands; a real redis-py command-boundary regression was added. After the fix, 220 API/scenario tests, scoped static checks and both contract parity checks passed. The restarted endpoint now returns 200 and the native scenario library renders its real empty state. Historical unindexed scenarios remain accessible by ID only, as designed.

Read-only checks through the frontend proxy pass for health, regions, scenario listing, Golden readiness, run history, weather datasets and Earth Engine layer descriptors. Golden reports `ready_to_simulate: true`. The native Runs screen renders 93 region-authorized historical runs from the actual API. The development UI no longer has the stale dependency blank screen.

Remaining live limitations are distinct from version synchronization:

- Golden asset reads return 500 because local physics tick 4502 references immutable line snapshot 9, while the configured authoritative store contains Golden revision 1 only (`LineSnapshotNotFoundError`). Both stores are reachable. Correct remediation requires normal physics recomputation/publication against the current authoritative snapshot, or restoration of the proven original snapshot authority; substituting revision 1 for 9 would falsify lineage. No stored records were reset or silently replaced.
- Private point-cloud reads return 401 under the configured dataset access policy. A verified hosting principal is still required; access checks were not bypassed.
- Production preview on port 4173 remains a production build requiring its host identity projection. Use port 5173 for the existing explicit local-development access flow; this task did not invent a production identity provider.

Synchronization evidence: `/tmp/dt-synced-live-checks.json`, `/tmp/dt-synced-proxy-openapi.json`, `/tmp/dt-synced-engine-fixed.log` and `/tmp/dt-synced-frontend.log`. The earlier findings below are retained as the before-state.

An additional real Redis check passed Lua create, get, idempotent replay and bounded global/regional cursor listing in a unique temporary namespace. All nine exact test-owned keys were removed and their absence verified; no production scenario IDs or jobs were touched.

## Current-source checks

| Check | Result |
| --- | --- |
| Full frontend test suite | 3,568 passed, one skipped, one failed; 3,570 total |
| Native production-bundle browser tests | 11 passed in 56 seconds |
| Engine API/state/orchestrator/service, architecture, config and documentation tests | 599 passed, one skipped, 25 subtests passed |
| Frontend production build and TypeScript | Passed |
| Frontend lint | Zero errors, 25 existing warnings |
| Generated frontend contract/types and freshly exported Engine candidate comparison | Passed |

The frontend failure remains `tests/metainfo-generated.test.ts`: the Linux metainfo generator rejects `DATE` as an invalid calendar date. It was present before the native sync changes. The optional JupyterLite prebuild cannot reach PyPI in this environment and skips; the application build itself succeeds.

Browser coverage includes scenario save/reload/retry/cancel, direct run URL recovery, denied access, dirty navigation, region creation/deletion/publication, draft asset creation, read-only permissions, COG preparation and Show/Hide, accepted survey replacement failure, actual health state changes, theme persistence, and administration with no operational region. These tests use controlled HTTP responses. Engine tests separately exercise actual route/state code with controlled dependencies.

## Live local deployment findings

### 1. Running Engine has an older contract

Read-only requests to `http://127.0.0.1:8000` confirm liveness/readiness return 200. Regions, data sources and runs also return 200. However:

- `GET /api/v1/scenarios` returns **405**.
- `GET /api/v1/regions/boulder-co/readiness` returns **404**.
- The dataset collection returns a descriptor without required `latest_build`; its one inspected dataset has status `failed`.
- Its OpenAPI has **36 operations**, compared with **41** in the current source/pinned contract.

Missing operations are root readiness, scenario list/get, regional readiness and the versioned point-cloud binary GET route. This is evidence that the running API does not match the current checkout; a green source contract check cannot validate that process. Synchronize/restart the local Engine with the reviewed current code and repeat the real-service checks before accepting the native integration.

### 2. Production preview has no working identity projection

At `http://127.0.0.1:4173`, `/api/digital-twin/access` returns **200 text/html**, the SPA response, instead of the trusted JSON access projection. A real browser displays **Identity provider unavailable** and does not mount the protected workspace. A hosting identity/access adapter is required for this preview/deployment path; the test fixtures do not establish that integration.

### 3. Existing development server cannot load its optimized dependencies

The real browser at `http://127.0.0.1:5173/regions/boulder-co/scenarios` stays blank. Network and console inspection show **504 Outdated Optimize Dep** for React/React DOM and other optimized modules. A page reload with a fresh URL does not resolve it. Restart/re-optimize the development server before repeating native UI checks against the actual Engine.

## Evidence and boundaries

Local command logs: `/tmp/dt-retest-frontend.log`, `/tmp/dt-retest-engine.log`, `/tmp/dt-retest-browser.log`, `/tmp/dt-retest-build.log`, `/tmp/dt-retest-lint.log`. Fresh Engine export: `/tmp/dt-retest-openapi.json`; running service schema: `/tmp/dt-retest-live-openapi.json`.

This retest made no production data mutations, restarted no existing service, and changed no runtime code. Real simulation jobs, authenticated hosting, GPU COG rendering and survey processing remain unverified against a synchronized live deployment. This broader Engine selection passed; it is not a claim that every test in the entire Engine repository was run.
