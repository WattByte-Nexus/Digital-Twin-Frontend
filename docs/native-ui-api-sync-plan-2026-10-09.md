# Native Digital Twin UI / Engine synchronization plan

Date: 2026-10-09  
Status: Native implementation delivered in the working tree; deployment acceptance remains open  
Basis: [API coverage audit](frontend-api-coverage-audit-2026-10-09.md)

## Implementation checkpoint

The work below has been implemented in the custom `DigitalTwinMapWorkspace` and Engine, with the shared transport, generated contracts, scenario library, run lifecycle, Data administration, sources, survey tracking, and real Settings status connected. The obsolete bundled demo and duplicate Digital Twin shell have been removed. See [implementation and verification report](native-api-sync-implementation-2026-10-09.md) for the current evidence and remaining deployment requirements. The original phase descriptions below remain the acceptance specification, not a claim that live infrastructure validation has occurred.

## Outcome

Make the custom product rooted at `App.tsx → DigitalTwinMapWorkspace` accurately expose the current Engine's supported workflows. Preserve the native map, interaction design, Assets, Scenarios, Runs, and Settings surfaces. No workflow should require entering the old demo plugin or GeoLibre Expert GIS.

The baseline is 37 public Engine operations: 22 have native callers and 15 do not. Completion means all 37 are intentionally integrated through native workflows, the two binary HEAD routes have transport coverage where used, and connected requests/responses match the Engine contract. New endpoints introduced by this plan join the same coverage inventory.

Endpoint presence alone is insufficient: reload recovery, lifecycle transitions, failure reporting, exact inputs, and server-owned state must work end to end.

## Design decisions

1. Extend the existing custom UI; do not build another shell, plugin, or generic API console. Reuse shared `packages/ui` components and semantic tokens. Inspect existing shadcn primitives/registry patterns before implementing controls.
2. Engine owns durable scenario intent, region publication, run lifecycle, numerical results, and survey processing. Frontend owns interaction and presentation. API routes remain adapters over existing Engine stores/orchestrators.
3. Saved scenarios remain immutable. “Edit” opens an editable copy; saving creates a new scenario identity. No mutable scenario revisions, deletion API, or server-side draft subsystem is needed for the initial real library.
4. Ignitions belong to run submission under the current contract. A saved wind scenario stores environmental intent, not an invented ignition count. The UI must distinguish “Save scenario” from “Run scenario.”
5. Editable controls must affect accepted intent. Remove unsupported model controls from the editable submission flow; show authoritative configuration read-only only when the Engine supplies it. Adding numerical capabilities is a separate Engine project, not an API-field forwarding task.
6. Use the existing preference persistence for genuinely local appearance/map settings and label them as device-local. Do not promise account synchronization without an application-service contract.
7. Keep publication and operational readiness distinct. New region catalog records do not automatically provision model grids, source ingestion, or workers.
8. Replace obsolete paths after native replacements pass acceptance checks. No compatibility wrappers, old field aliases, parallel mock clients, or silent fallback to demo data.

## Ownership and sequence

Each phase should land as working vertical slices, with focused checks and a usable product after each slice. Frontend and Engine changes are separate reviewable commits/PRs tied to one phase; deploy a new Engine contract before switching its frontend consumer.

| Phase | Deliverable | Frontend work | Engine work | Depends on |
| --- | --- | --- | --- | --- |
| 0 | Honest screens and correct run fields | Required | No runtime changes | Audit |
| 1 | One contract boundary and enforceable access | Required | Contract export/tests; access enforcement where absent | 0 |
| 2 | Complete native run lifecycle | Required | Existing routes; integration tests | 1 |
| 3 | Native source layers and supported simulation inputs | Required | Existing routes; integration tests | 1–2 |
| 4 | Real immutable scenario library | Required | **New list/get endpoints and listing persistence** | 1, 3 |
| 5 | Region and asset administration | Required | **Operational-readiness projection**; existing mutations | 1, 3 |
| 6 | Dataset inspection and survey replacement | Required | Existing routes; verify version lifecycle observability | 1, 5 |
| 7 | Settings completion, legacy removal, parity acceptance | Required | Cross-repository contract/integration checks | 2–6 |

Phases 4–6 do not need to block one another beyond their stated dependencies. This is sequencing guidance, not a request to spawn agents or enqueue work.

## Phase 0 — Correct the visible contract immediately

**Frontend**

- Remove hard-coded scenario rows, owners, statuses, location-generated ignitions, and fake saved/updated timestamps from the real library. Keep the real create-and-run path usable while the read endpoints are built; display an honest unavailable library state.
- Remove “Draft autosaved just now.” Unsaved builder changes remain explicit local state with a dirty-state indicator and a discard warning. A successful Engine save is the only server-saved confirmation.
- Remove editable fuel-moisture, spotting, crown-fire, grid-size, and output-interval controls that currently have no accepted Engine inputs. Keep visual weather/lighting settings clearly separate from simulation inputs.
- Replace fabricated Settings health, endpoint, queue, storage, and last-check values. Reuse the real liveness/readiness results, configured endpoint, and actual check timestamp; omit unavailable diagnostic fields.
- Parse `failure.error_type` and `failure.error_message` without obsolete aliases. Derive bounded duration from UTC start/end. Match Engine tick arithmetic, including floating-point whole-tick tolerance and partial final ticks; count completed positive ticks, not initialization snapshots.
- Fix retry intent: freeze weather version, scenario geometry, and request body with the idempotency key. Reuse that exact intent after a network failure; allocate a new key when the user changes inputs.

**Engine:** no runtime change. Use current request/response models and `simulation_tick_count` as the test oracle.

**Acceptance**

- A two-hour bounded run shows two hours and correct tick progress; a 1.2-hour run at one-hour steps expects two ticks.
- A failed run displays the Engine's safe failure message.
- Every currently editable numerical input appears in accepted intent; visual-only changes do not masquerade as simulation changes.
- Offline Engine status never says Connected/Ready, and no screen claims a draft was saved without persistence.
- Retrying after weather advances does not silently change the submitted scenario.

## Phase 1 — Establish one maintained API boundary

**Frontend**

- Consolidate Engine transport and contract types at the existing Digital Twin client boundary under `apps/geolibre-desktop/src/lib`; keep resource-specific clients focused. Remove the duplicate run wire types in `ui/digital-twin-run-api.ts` while retaining its presentation/query composition separately.
- Generate wire types from the Engine's exported OpenAPI using a maintained generator. Inspect current dependencies before choosing one; add only the smallest necessary tool. Keep application view models separate from transport types.
- Standardize same-origin authentication, cancellation, problem-details handling, request correlation, idempotency, URL encoding, and cursor pagination. Do not force binary, multipart, and SSE through a JSON-only request helper.
- Commit a machine-readable coverage manifest mapping method/path to native workflow, adapter, and acceptance test. Keep the 37 current operations and schema-hidden transport routes explicit.
- Add a reproducible command to refresh the pinned Engine schema/types and a CI check for stale generated output. Preserve Engine build/commit identity with the contract artifact.

**Engine**

- Export deterministic OpenAPI without starting Redis, workers, or numerical engines. Publish it with Engine revisions and provide request/response fixtures validated by current models.
- Add cross-repository validation of the current frontend contract against the candidate Engine contract. Use a pinned revision for reproducible frontend builds; Engine contract changes must trigger the compatibility check against the supported frontend revision rather than relying only on a static snapshot.
- For protected rollout, extend the hosting-verified identity/region-access boundary to routes that currently lack it. Point-cloud access already checks a verified principal; that does not establish enforcement for regions, assets, scenarios, runs, or sources. Reuse the existing access authority rather than create a second identity system.
- Enforce resource ownership and action permissions server-side, including collection filtering, binary URLs, run SSE, cancellation, and new scenario reads. The frontend's authorized-region filter is presentation, not the enforcement boundary.

**Acceptance**

- Contract changes cannot pass both repositories' integration gates with stale frontend fields.
- Tests reject unauthorized region/resource IDs and filter collection results; direct API requests cannot bypass disabled controls.
- One canonical run contract drives catalog, detail, replay, and submission.

## Phase 2 — Complete native run lifecycle

**Frontend**

- Add Cancel to eligible native run details, with pending submission and `CANCEL_REQUESTED` states. Preserve partial tick results on cancellation and handle completion racing with the cancel request.
- Integrate `/simulation-runs/{run_id}/events` with one subscription per selected active run. Handle the Engine's named events, durable IDs, reconnect/replay, `stream_reset`, duplicate delivery, and terminal closure.
- Fetch an authoritative snapshot on open and after reset/reconnect as required. Do not reconstruct durable truth solely from transient events.
- Continue catalog discovery while idle: an initial target is a 15-second visible-tab refresh, immediate refresh on visibility/network recovery, and the existing two-second cadence while active runs need catalog updates. Per-run SSE does not discover unknown runs.
- Expose last successful update and stale/disconnected states. A failed request must not leave old results looking current.
- Recover run-detail routes directly from the run ID and authorized region rather than requiring the record to be present in a previously loaded catalog.

**Engine:** cancellation, SSE, snapshots, and results already exist. No new catalog event feed is necessary for this phase. Add integration assertions for the contracts consumed by the native UI.

**Acceptance**

- Start, observe, cancel, reconnect, reload, and replay a real Engine run entirely in the native UI.
- A run created by a second client or Engine automation appears within the visible-tab discovery interval.
- Event replay cannot duplicate ticks or regress progress; completion/cancellation races settle to the Engine's state.

## Phase 3 — Connect sources, layers, and all supported input modes

**Frontend**

- Add native regional source inspection using `/data-sources`, Earth Engine metadata, and map-layer descriptors. Show source readiness separately from generated-artifact readiness.
- Render returned COG URLs through the existing map-layer implementation inside the native map. Support preparation, cancellation, range delivery, failures, layer visibility, and descriptor styling without navigating to Expert GIS.
- Reuse complete region pagination; add paginated historical weather selection. Display observed/analysis/forecast lineage, validity, units, and exact selected version.
- Provide three explicit run input modes: saved/new synthetic wind scenario; present/forecast duration; bounded UTC interval. Direct modes submit the Engine's direct request shape and its single ignition point; scenario mode supports the existing ordered 1–100 ignitions.
- Direct modes expose `delta_t_hours` with Engine-compatible interval validation. Synthetic scenarios currently use an Engine-owned one-hour step (`simulation_commands.py:222`); do not pretend the removed output-interval selector controls it.
- Use forecast resolution with `issue_at_or_before` and `valid_at` for availability/evidence inspection. A preflight is informative, not a reservation or guarantee that a later run succeeds; Engine submission remains authoritative.
- Allow exact base-weather selection and a valid rectangular scenario extent within published region bounds. Persist the reviewed values through submission and retries.
- Display runtime/model availability before allowing submission; Phase 5 supplies the missing per-region readiness projection.

**Engine:** all 5 missing source/layer operations and both direct-time request modes already exist. Numerical engines and source selection remain unchanged. Add tests for their native consumers.

**Acceptance**

- Each mode produces the intended request and can run on a configured test region.
- A bounded interval preserves the same instants through local display, UTC serialization, reload, and replay.
- Historical data beyond the first page is selectable; COG layers load on the native map; missing forecasts/source artifacts produce actionable states.

## Phase 4 — Replace the scenario fixture library with durable records

**Required Engine changes**

- Add proposed `GET /api/v1/scenarios?region_id=...&cursor=...&limit=...`, following existing `Page` and cursor conventions, with authorized-region filtering.
- Add proposed `GET /api/v1/scenarios/{scenario_id}` using the existing `ScenarioStore.get` and consistent not-found/problem responses.
- Add bounded, deterministic listing/index ownership to `src/state/scenario/store.py`. Maintain the region listing atomically with scenario creation; routes must not scan Redis directly. Define pagination ordering from actual persisted fields, not invented modification dates.
- Preserve the current immutable `SyntheticWindScenario` contract and idempotent create behavior. Add an ADR only if implementation changes that lifecycle or another public boundary materially.

**Frontend**

- Fetch and filter real scenarios; provide loading, empty, error, and pagination states.
- Support “Save scenario” independently of “Run.” After save, use the returned Engine identity; after reload, fetch it by ID.
- Support “Edit as new” and “Duplicate” by pre-filling real persisted fields and creating a new immutable record. Never mutate an input referenced by an existing run.
- Display only authoritative fields. Remove invented owner, workflow status, update time, and ignition count when the API does not provide them. Run ignitions are selected in the run flow, not synthesized from names or locations.

**Acceptance**

- Create a scenario, refresh/open another authorized browser, retrieve it, and run it with chosen ignitions.
- Editing a copy leaves the original scenario and historical run lineage unchanged.
- A scenario created outside this UI appears through the same catalog.

## Phase 5 — Complete region/asset administration and readiness

**Frontend**

- Build native data-administration views using the existing region POST/PATCH/DELETE/publish routes. Operators retain the current investigation experience; authoring belongs to users with the appropriate action permissions.
- Preserve region draft/published status and revision identity in shared view models. Disable invalid mutations before submission, while still handling server conflicts after concurrent changes.
- Add individual tree/power-line creation and bounded JSON batch import, alongside the existing CSV import. Preview validation and report partial workflow progress accurately; do not imply a multi-request import is atomic.
- Complete draft edit/delete → asset import → publication → readback. Published geometry remains immutable; no speculative clone/revision API is introduced.
- Render “Published” and “Ready to simulate” separately. Publication failures about missing tree lineage or invalid line geometry must remain visible.

**Required Engine changes**

- Add a safe regional readiness projection, proposed `GET /api/v1/regions/{region_id}/readiness`, returning publication state, configured/hydrated model-grid availability, source readiness, and public reason codes. Derive it from existing catalog/runtime owners; do not expose paths, storage references, or credentials.
- Test its consistency with submission acceptance. Publication currently writes calculation inventory, while submission still needs a configured grid (`simulation_commands.py:279`) and weather enumeration depends on configured regions (`api/catalog/data_sources.py:307`).
- Keep runtime region/source provisioning configuration-owned for this plan. Publishing an arbitrary catalog region must not claim to provision a worker or weather ingestion. Dynamic provisioning would require a separate Engine orchestration workflow.
- Existing CRUD/publication endpoints need no redesign, but their action/region enforcement is a prerequisite from Phase 1.

**Acceptance**

- An authorized user completes draft creation, single/CSV/batch ingestion, edits, deletion of a separate draft, and publication without scripts.
- Published assets cannot be edited; publication rejection explains the blocking input.
- A published but unconfigured region is explicitly not runnable. A configured, hydrated region passes readiness and run acceptance.

## Phase 6 — Connect point-cloud dataset and survey lifecycle

**Frontend**

- Add native dataset collection/item inspection and view selection. Selecting a dataset to view does not change the Engine's active dataset; no active-dataset mutation endpoint exists.
- Add PLY + reviewed metadata import for authorized users. Use the current metadata schema: patch identity, acquisition time, projected CRS, vertical datum, units, 4×4 placement transform, replacement footprint/Z range, registration method, and measured error. Support a reviewed metadata file plus a readable placement summary; do not invent a browser registration algorithm.
- Submit multipart data to the existing survey endpoint and retain its dataset, patch, parent version, and accepted version. Show actual uploading/accepted/building/ready/failed states, without simulated progress percentages.
- Track the accepted version rather than treating an unrelated old ready descriptor as completion. Keep the last ready tiles visible while a replacement builds; replace map data only after the new version is ready.
- Surface authentication, ownership, type/size, invalid metadata, and version-conflict errors. Verify same-origin credentials and Engine-returned immutable tile URLs.

**Engine**

- Existing item and survey routes are the starting contract. Verify that item/collection responses make the accepted replacement version and terminal failure observable while retaining the previous ready version.
- If current projection hides that accepted build behind the last-ready descriptor, extend the existing dataset lifecycle projection to expose the accepted version's state. This is a conditional Engine contract fix with a concrete acceptance test, not a speculative job service.

**Acceptance**

- Submit a valid test survey, refresh, observe the accepted version become ready, and render its actual tiles.
- A failed replacement leaves the previous ready dataset usable and reports the failure for the submitted version.
- Unauthorized and invalid uploads fail without changing the active rendered version.

## Phase 7 — Finish settings, remove obsolete paths, verify parity

**Frontend**

- Wire device-local appearance/map preferences to the existing persistence and actual consumers. Remove local-only controls that do not affect the application; do not label them account-synchronized.
- Use saved Engine scenarios for reusable supported simulation conditions rather than introducing a second disconnected preset store. Direct-run defaults can be explicitly device-local when that is all they are.
- Keep only verified health/readiness information in Engine settings. Remove fake member rows, routing policy, and unsupported administration actions from the operational product until their owning service exists.
- Remove the obsolete bundled demo-plugin registration/assets and duplicated Digital Twin shell/client/model fixtures once caller inspection and native acceptance prove they are no longer needed. Preserve unrelated GeoLibre functionality and reusable map/UI components. Update old product docs that still describe a demo-plugin product.
- Use shadcn/shared UI primitives, semantic tokens, matching portalled themes, keyboard access, and reduced-motion behavior for all new native views. Preserve the persistent map during navigation.

**Engine / both repositories**

- Verify real HTTP workflows with an Engine test application using controlled stores; do not rely exclusively on frontend `page.route` mocks.
- Run a configured integration environment for representative real jobs, COG/range delivery, SSE reconnection, survey processing, and authorization through the actual hosting boundary.
- Gate each supported workflow on request/response/lifecycle tests and contract drift checks. Retain fast mock tests for UI states, but stop treating them as deployment acceptance.

**Acceptance**

- The coverage manifest accounts for all 37 original operations, new scenario list/get and regional readiness operations, and applicable transport methods.
- All supported user workflows complete in the custom native UI without the old plugin, Expert GIS, or seed script.
- No fabricated scenarios, health results, member identities, numerical outputs, or success messages remain in production flows.
- Reload, disconnect/reconnect, region change, cancellation, validation conflict, and denied access preserve correct visible state.

## Explicit Engine work list

| Engine work | Required for this plan? | Owning boundary |
| --- | --- | --- |
| Deterministic OpenAPI export and current-model fixtures | Yes, tooling | `src/api`, `tests/api`, existing build/CI tooling |
| Enforce verified identity, resource scope, and action permissions where absent | Yes for protected rollout | Existing hosting principal/access boundary + API dependencies/routes |
| Scenario collection GET + bounded listing/index | Yes, new runtime capability | `src/api/routes/scenarios.py`, `src/state/scenario/store.py` |
| Scenario item GET | Yes, new route over existing retrieval | `src/api/routes/scenarios.py`, existing `ScenarioStore.get` |
| Per-region operational-readiness projection | Yes, new public projection | API region/catalog boundary + existing runtime metadata |
| Make accepted survey build version observable | Conditional on Phase 6 contract test | Existing point-cloud catalog/schema/state owners |
| New cancel, SSE, forecast, region CRUD, asset CRUD, raster, or survey-submit endpoints | No; already implemented | Existing route owners |
| Mutable scenario editing/deletion or server-side draft subsystem | No; immutable copies and explicit save satisfy this plan | No new implementation |
| Dynamic model/source provisioning when a region is published | No; configuration-owned and reported honestly | Separate Engine orchestration work if later required |

## Broader features that require separate backend delivery

These are not existing-endpoint hookup tasks. The synchronization pass removes misleading placeholders; it does not silently claim to implement these capabilities.

| Feature retained as a future product requirement | Backend work needed | Ownership |
| --- | --- | --- |
| Editable fuel moisture, spotting, crown fire, grid resolution, scenario timestep/output policy | Trace each control to a real numerical implementation; add validated intent, execution support, lineage, resource limits, and numerical regression tests. Merely accepting JSON is insufficient. | Engine schemas, orchestrators, normalization, numerical engines |
| Durable alert inbox, acknowledgement, disposition, and evidence handoff | Define safe public projections of existing threshold evidence plus durable user actions, identity/audit semantics, and evidence export/retrieval. Do not publish internal threshold records verbatim. | Engine domain/state/API, integrated with access authority |
| Organization members and account-synchronized preferences | Real identity/membership and preference service contracts; connect native settings to that owner. Do not put user administration into numerical Engine configuration. | Trusted application/identity service; exact repository ownership must be resolved |
| Alert routing with email/SMS delivery and escalation | Persisted policy, recipients, permissions, delivery infrastructure, and lifecycle/status contracts | Application notification service with Engine event input |
| Detailed queue/storage/version diagnostics | Safe runtime diagnostic projection if those fields remain a product requirement | Engine API/runtime owners |

The existing pilot documents include alert investigation and handoff requirements. Those remain a separate production-pilot dependency even after this API synchronization plan is complete. Completing endpoint parity must not be reported as completing the full pilot.

## Delivery checks

1. Recheck both repositories and refresh the audit baseline before each implementation slice; preserve unrelated working-tree changes.
2. Add focused tests for meaningful behavioral changes and Engine-validated contract fixtures. Run the relevant existing suites, frontend build/lint, and repository-required checks for changed boundaries.
3. End each slice with a native workflow demonstration and updated coverage-manifest evidence. Treat a client function without a reachable UI workflow as incomplete.
4. Finish with real cross-boundary verification, supported-browser/accessibility checks, and removal of obsolete Digital Twin entry paths.

Implementation was explicitly authorized after this plan. No AgentQ jobs, issues, deployments, or production simulation runs were created by this task.
