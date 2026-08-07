# Digital Twin First-Party Platform Plan

Status: General implementation roadmap  
Source: [Digital Twin Frontend Product Requirements](digital-twin-product-requirements.md)  
Applies to: GeoLibre fork in this repository  
Last reviewed: 2026-07-31

## 1. Destination

Convert the GeoLibre fork from a general GIS application with a bundled Digital
Twin demo plugin into a first-party Digital Twin operator platform. The twin is
the default product surface; GeoLibre remains the geospatial foundation and an
advanced workspace for authorized expert users.

The conversion is complete when the production-pilot workflow in the PRD is a
typed, tested, source-owned feature of the monorepo; the current generated
plugin bundle is no longer edited as source; and browser releases can be built,
deployed, upgraded, and validated against a compatible Digital Twin Engine.

## 2. Starting point

The fork already provides useful platform seams:

- a React application shell in `apps/geolibre-desktop`;
- a Zustand application store in `@geolibre/core`;
- a MapLibre-based primary renderer and synchronized secondary MapLibre or
  Cesium panes in `@geolibre/map`;
- shared UI primitives in `@geolibre/ui`;
- a first-party and external plugin system in `@geolibre/plugins`;
- deployer-controlled UI profiles that can hide generic GIS surfaces; and
- browser, Tauri, PWA, container, and test pipelines.

The Digital Twin proof currently lives in
`apps/geolibre-desktop/public/plugins/digital-twin-demo/dist/index.js`. That
approximately 4,000-line JavaScript bundle already contains an HTTP client,
asset conversion, ignition interaction, scenario submission, run monitoring,
replay caching, MapLibre rendering, and an imperative panel. It is valuable as
behavioral reference and migration input, but it is not an acceptable source
boundary for the platform.

The plan preserves GeoLibre's strengths while replacing the demo's internal
architecture. It does not rewrite MapLibre, Cesium, layer synchronization,
project I/O, or general GIS tooling unless a measured Digital Twin requirement
cannot be met through an extension seam.

## 3. Product and UI plan

The UI work remains at the top of the program because it defines which platform
capabilities the implementation must serve.

### Phase UI-0: Lock the pilot product frame

Resolve the PRD's open pilot choices before hardening navigation or permissions:

- primary operator role and required decision handoff;
- historical, forecast, live-monitoring, or intentionally narrower pilot mode;
- required plan, perspective, profile, and side-by-side views;
- browser, identity provider, deployment environment, and reference hardware;
- approved caveat, uncertainty, confidence, and visual-exaggeration language;
- expert GIS tools exposed by role; and
- pilot region data volumes and geometry fidelity.

Deliver a pilot workflow contract that names the required screens, role/action
matrix, visible evidence states, and success measures. Do not solve future
ranked monitoring in the frontend before the Engine owns aggregate risk truth.

Exit gate: product, design, engineering, security, and one representative user
agree on the pilot workflow and its explicit exclusions.

### Phase UI-1: Make Digital Twin the application shell

Create a first-party product mode rather than styling a plugin panel:

- Digital Twin branding, terminology, help, error vocabulary, and navigation;
- authenticated startup and organization/region context;
- a focused operator profile selected by deployment and role;
- an advanced GIS workspace entry for authorized experts;
- global readiness, freshness, active-run, and diagnostics indicators; and
- route-level loading, unauthorized, disconnected, incompatible, and recovery
  states.

The product mode should be an explicit shell configuration, not a long hidden-
menu list. UI profiles remain useful for tool visibility, but product mode also
controls navigation, startup route, panels, commands, branding, and feature
availability.

Exit gate: an authenticated user lands in a Digital Twin product, sees only
authorized regions and actions, and can deliberately enter and leave the expert
GIS workspace when permitted.

### Phase UI-2: Establish the interactive twin workspace

Build the primary workspace around one coordinated world state:

- full-size plan or 3D canvas with deterministic camera presets;
- region, feeder, span, and asset navigation;
- synchronized plan, perspective, and asset-detail views;
- stable hover preview and persistent selection;
- asset search, fit, isolate, clear isolation, and network traversal;
- a selection/evidence inspector that shows identity, version, lineage, units,
  fidelity, and available actions;
- a layer/lens surface for assets, terrain, weather, physics, fire, freshness,
  confidence, and evidence method; and
- a permission-aware deep link that restores safe workspace state.

Treat generic GeoLibre layer selection as an input adapter, not the Digital
Twin domain model. The same `WorldObjectId` must survive renderer changes,
level-of-detail changes, time changes, and 2D/3D transitions.

Exit gate: a user can find a named object, inspect the same identity in plan and
3D, isolate it, return to regional context, and reload a deep link without
selection drift.

### Phase UI-3: Productize direct interaction and scenario drafting

Make world gestures create explicit intent:

- place, move, remove, and multi-select ignition points;
- select eligible tree objects while retaining their stable asset IDs;
- manipulate bounded wind, direction, duration, and other approved conditions;
- show region bounds, units, limits, validation, and readiness in place;
- keep observed baseline, local draft, submitted scenario, and authoritative
  result visually and semantically distinct;
- provide keyboard/list/form alternatives for every map-only operation; and
- require a concise scenario review before submission.

The frontend may render a labeled preview, but it must never imply that a
gesture changed canonical infrastructure or produced authoritative physics.

Exit gate: a user can create and revise a valid draft, explain what is local
versus server-owned, and submit the logical scenario once.

### Phase UI-4: Integrate run lifecycle, timeline, and evidence replay

Unify execution and time with the workspace:

- distinguish accepted, queued, started, cancel-requested, cancelled,
  completed, and failed states;
- recover recent and active runs from server truth after refresh;
- display SSE progress with polling fallback and visible reconnect/reset state;
- coordinate selected tick, rendered artifact, labels, legends, summaries, and
  environmental state;
- provide scrub, step, play, pause, loop, speed, fit-to-result, and accessible
  status announcements;
- prevent stale frame and cross-run rendering races; and
- surface immutable input/output lineage next to the replay.

Exit gate: every positive tick can be replayed under the correct run identity,
and interruption tests cannot produce a duplicate run or mismatched artifact.

### Phase UI-5: Complete the operator workflow

After pilot validation, add the P1 experience:

- side-by-side coordinated plan, 3D, and profile views;
- measurement, clearance, and nearby-vegetation comparison;
- reversible intervention overlays with visible baseline;
- compatible run comparison and difference views;
- saved safe workspace states;
- evidence disposition, review history, sharing, and export; and
- operator evidence queues when the Engine exposes the required contracts.

Ranked decision support and continuous monitoring remain a later release gated
on Engine-owned aggregation, physics/collision evidence, orchestration, and
alerting contracts.

## 4. Implementation and platform plan

### Phase ENG-0: Establish source ownership and build boundaries

Introduce first-party packages with directional dependencies:

```text
apps/geolibre-desktop
  -> @digital-twin/feature
      -> @digital-twin/domain
      -> @digital-twin/engine-client
      -> @digital-twin/rendering
      -> @geolibre/core, @geolibre/map, @geolibre/ui

@digital-twin/rendering
  -> renderer adapters (MapLibre, Cesium, deck.gl/Three where justified)

generated digital-twin-demo bundle
  <- compatibility entry importing the same first-party source
```

Recommended workspace layout:

```text
packages/digital-twin-domain/
packages/digital-twin-engine-client/
packages/digital-twin-rendering/
packages/digital-twin-feature/
apps/geolibre-desktop/src/product-modes/digital-twin/
apps/geolibre-desktop/public/plugins/digital-twin-demo/dist/  # generated only
```

Use `digital-twin-*` npm package names if publishing under a private scope is
not desired; the important constraint is dependency direction, not spelling.

Add a dedicated build command that typechecks, tests, and bundles the
compatibility plugin from a source entry. Mark generated files in repository
metadata, add a clean-build equivalence check, and fail CI when a committed
bundle differs from its source build. Decide separately whether generated
artifacts remain committed for drop-in deployments or are attached to releases.

Exit gate: no normal change is made directly in `dist/index.js`; a clean clone
can generate the same plugin artifact from typed source.

### Phase ENG-1: Define the domain model and stable identity

Create a renderer-independent model for:

- `WorldObjectId` and object kinds: region, pole, span, conductor, tree,
  terrain, weather field, ignition, physics result, fire artifact, and run;
- authoritative identity versus local draft identity;
- revision, source, timestamp, CRS, units, fidelity, and lineage metadata;
- topology and related-object references;
- renderable descriptors without MapLibre/Cesium object leakage; and
- selection eligibility and supported actions.

Engine public IDs are authoritative where supplied. For derived render
fragments, use deterministic composite IDs scoped by source identity, revision,
and semantic part; never use array position, layer index, or random runtime IDs
for authoritative objects. Local scenario objects may use client-generated IDs
until the Engine returns public identities.

Exit gate: contract fixtures prove stable IDs across plan/3D, LOD, lens, and
timeline transformations.

### Phase ENG-2: Implement the typed Engine client

Build a single API boundary under `/api/v1`:

- generated or hand-maintained request/response schemas validated at runtime;
- typed readiness, regions, assets, weather, descriptors, scenarios, runs,
  cancellation, final results, tick artifacts, and SSE events;
- safe API-problem normalization and unsupported-enum handling;
- organization/session propagation without logging credentials;
- request cancellation, timeouts, stale-response suppression, and conditional
  artifact caching;
- idempotency-key lifecycle tied to normalized logical scenario input;
- SSE resume/reset semantics with authoritative REST reconciliation; and
- explicit frontend/Engine version compatibility reporting.

Keep fetch mechanics, runtime validation, retries, and transport errors out of
React components and render adapters. Generate types from an Engine OpenAPI
contract when its stability is sufficient, while retaining frontend-owned
normalizers and fixtures for compatibility behavior.

Exit gate: the client passes versioned contract fixtures and reconnect,
cancellation, redaction, additive-field, and incompatible-enum tests.

### Phase ENG-3: Introduce feature state and the interaction state machine

Keep Digital Twin state separate from generic project/layer state while
bridging the two intentionally. Suggested slices:

- session and organization context;
- region and data-catalog state;
- normalized world-object registry;
- hover, selection, isolation, focus, and related-object state;
- camera, viewport layout, and coordinated-view state;
- scenario draft, validation, dirty state, and submission identity;
- authoritative run lifecycle and progress state;
- timeline, replay request, cache, playback, and comparison state;
- visible lenses, render status, legends, and diagnostics; and
- safe shareable workspace state.

Model interaction explicitly. A minimum statechart should cover modes such as
`explore`, `select`, `placeIgnition`, `moveDraftObject`, `measure`, and
`compare`, with substates for pointer idle/hover/drag, submission, and replay.
Events, guards, and effects must define which gestures are legal and how Escape,
selection changes, view switches, or run changes cancel an interaction.

Use server snapshots as authoritative run truth. Persist only safe presentation
preferences and deep-link state in the browser; recover runs, scenarios, and
evidence from the Engine.

Exit gate: transition tests cover conflicting gestures, cancellation, view
switches, stale async results, and refresh recovery without impossible states.

### Phase ENG-4: Create rendering adapters

Define small lifecycle contracts rather than one universal renderer:

- asset adapter for poles, spans, conductors, and trees;
- terrain adapter;
- weather adapter;
- physics adapter for conductor movement, clearance, collision, and method
  provenance when public data exists;
- fire adapter for final footprints and immutable tick artifacts; and
- overlay adapter for draft ignitions, interventions, selection, hover, and
  measurements.

Each adapter accepts domain objects plus a render context and owns mount,
incremental update, visibility, time, highlighting, hit-testing identity, and
cleanup. It must declare supported view kinds and degradation behavior. The
adapter returns stable world-object hits; it does not own product selection or
scenario state.

Use MapLibre for the primary plan surface and existing GeoLibre layers where
their persistence and controls are beneficial. Use Cesium or deck.gl/Three only
behind adapters for capabilities that require them. Do not force all Digital
Twin objects through the generic `GeoLibreLayer` model if doing so loses stable
identity, time coordination, fidelity metadata, or efficient incremental
updates.

Define measured scene budgets and LOD thresholds for regional assets,
vegetation, terrain, and replay. GeoJSON is the pilot path only while measured
volumes satisfy interaction targets; move to filtered or tiled descriptors at
explicit thresholds.

Exit gate: adapter conformance tests, visual fixtures, and performance scenes
prove identical identity/selection semantics across supported views.

### Phase ENG-5: Integrate product mode with GeoLibre

Add explicit host extension points where the existing plugin API is too
MapLibre-control-oriented:

- product shell configuration and startup route;
- first-party dock, inspector, command, and status-surface registration;
- world-object selection and hover bridge;
- coordinated camera/view bridge;
- render-adapter host lifecycle;
- safe deep-link serialization; and
- role/capability gates.

Keep these seams generic enough for first-party features, but do not turn the
production product back into an unrestricted runtime plugin. The Digital Twin
feature should be statically owned, tree-shakeable or lazy-loadable, and visible
to TypeScript and CI. The external plugin system can continue to serve optional
GIS extensions.

Exit gate: the operator workflow is composed by the application shell without
runtime-importing the demo plugin, while the expert workspace still functions.

### Phase ENG-6: Migrate behavior out of the demo bundle

Use a strangler sequence that keeps the proof usable:

1. Freeze the current demo behavior with focused characterization tests.
2. Extract pure request builders, normalization, progress merging, replay frame
   planning, and stable-ID conversion.
3. Replace the demo fetch/SSE code with the typed Engine client.
4. Replace imperative local state with the feature store and state machine.
5. Replace asset, ignition, wildfire, and replay controllers with adapters.
6. Mount the React first-party UI alongside the compatibility entry.
7. Switch product mode to the first-party entry and keep the generated plugin
   only as a development/demo compatibility surface.
8. Remove duplicated code and eventually retire the drop-in artifact when no
   supported deployment consumes it.

At each step compare the old and new paths against the same Engine fixtures and
end-to-end scenario. Do not combine the host-shell rewrite, domain extraction,
and renderer replacement into one unreviewable cutover.

Exit gate: production builds contain one implementation of scenario and replay
semantics, and the compatibility bundle is a generated wrapper over that source.

### Phase ENG-7: Add identity, deployment, and runtime configuration

Integrate the chosen identity provider and Engine authorization model:

- session bootstrap and renewal;
- organization and region scoping;
- capability-based UI and route guards;
- Engine-side authorization for every protected action;
- same-origin reverse proxy for production where possible;
- runtime Engine origin and compatibility configuration without rebuild;
- CSP, certificate, signed-artifact, browser, and desktop validation; and
- redacted structured diagnostics.

Treat UI hiding as presentation only. Production data is not ready until the
Engine enforces tenant and role boundaries.

Exit gate: cross-organization, expired-session, deep-link, export, and desktop
network tests cannot bypass server authorization or disclose sensitive values.

### Phase ENG-8: Build the verification and release system

Create a layered release gate:

- domain and state-machine unit tests;
- Engine contract fixtures and schema compatibility tests;
- renderer adapter conformance and visual-regression scenes;
- accessibility tests plus keyboard and screen-reader checks;
- interaction latency, scene budget, memory, and replay cache tests;
- browser end-to-end workflow with a deterministic Engine fixture;
- one real deployed Engine scenario per release candidate;
- reconnect, refresh, stale-response, cancellation, and artifact-expiry tests;
- security review of auth, CSP, logs, URLs, diagnostics, and exports; and
- bundle-size and generated-artifact reproducibility checks.

Track the PRD acceptance criteria directly in the release checklist. A fallback
or precomputed demonstration path is validated separately and never counts as
production availability.

Exit gate: the exact Frontend and Engine candidates pass the full pilot suite
and receive product, engineering, security, accessibility, and representative
user approval.

## 5. Recommended delivery sequence

Run the work as vertical increments rather than completing every platform layer
in isolation:

1. **Foundation increment:** pilot product contract, package skeleton, generated
   bundle pipeline, typed readiness/regions/assets client, product shell.
2. **World increment:** stable object model, asset adapters, hover/selection,
   search, camera presets, coordinated plan/3D state, deep links.
3. **Scenario increment:** scenario-draft slice, interaction state machine,
   direct ignition manipulation, validation, review, idempotent submission.
4. **Evidence increment:** run lifecycle, SSE reconciliation, recovery, fire
   adapter, timeline, replay cache, lineage inspector.
5. **Pilot hardening increment:** authentication/authorization, focused role
   profiles, diagnostics, accessibility, performance, security, deployment.
6. **Operator-workflow increment:** profile views, intervention overlays,
   comparison, review, share/export, and saved workspaces.
7. **Decision-support increment:** ranked queues and physics/collision evidence
   only after matching Engine contracts exist.

Each increment should end in a demonstrable operator task, not only a package or
refactor milestone.

## 6. Migration and governance rules

- The Engine owns computation, durable workflow truth, authorization, canonical
  assets, public evidence, and lineage.
- The Frontend owns interaction, bounded draft state, cameras, coordinated
  views, render presentation, accessibility, and safe local caches.
- `dist/index.js` is generated output. Until retirement, changes originate in
  typed source and land with generated-artifact verification.
- Generic GeoLibre behavior remains upstream-compatible where practical.
  Digital Twin product changes should prefer new first-party seams over deeply
  forking unrelated GIS features.
- Every new world object must declare identity, authority, revision, units,
  time semantics, fidelity, selection behavior, and rendering adapter.
- Every async path must define cancellation or stale-response suppression.
- Every visual result must remain attributable to the exact run and input
  revisions.
- Any client-side preview must be labeled and atomically replaced by or clearly
  separated from authoritative evidence.

## 7. Program gates and major risks

Do not call the platform pilot-ready until all of these are true:

- the UI-0 product decisions are resolved;
- Engine authentication and organization scope are enforced;
- stable public object identities exist for every required selectable object;
- measured pilot data volumes fit the selected render-delivery contracts;
- frontend/Engine version compatibility is explicit;
- generated bundle and clean-build checks pass;
- PRD pilot acceptance criteria pass against the release candidates; and
- a real deployed scenario completes without relying on demo fallback data.

The highest program risks are identity gaps between Engine objects and rendered
fragments, a product shell that remains coupled to generic GIS navigation,
unbounded scene volume, misleading 3D fidelity, draft/authoritative ambiguity,
and a big-bang rewrite of the demo. The package boundaries, state machine,
renderer adapters, explicit product mode, and strangler migration are intended
to address those risks directly.

## 8. Decisions still requiring Wayfinder tickets

The following are deliberately not fixed by this general roadmap:

- exact pilot role, handoff, operating mode, and view set;
- final shell information architecture and expert-workspace transition;
- whether Digital Twin feature state extends the global Zustand store or uses a
  separately composed store with bridges;
- OpenAPI generation versus validated hand-authored Engine schemas;
- canonical `WorldObjectId` rules for objects without one public Engine ID;
- renderer selection and LOD thresholds for each pilot data class;
- committed versus release-only compatibility bundles;
- identity provider, deployment topology, and desktop pilot scope; and
- release-candidate data volumes, hardware, and performance budgets.

These decisions form the first frontier of the accompanying Wayfinder map.
