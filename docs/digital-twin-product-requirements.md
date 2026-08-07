# Digital Twin Frontend Product Requirements

Status: Draft for product alignment  
Component: Frontend operator application  
Companion component: Digital Twin Engine  
Last reviewed: 2026-07-31

Pilot scope is governed by
[Digital Twin Production Pilot Workflow Contract](pilot-workflow-contract.md).
That contract promotes Engine-owned live monitoring and alert investigation to
the first production pilot while preserving the prohibition on autonomous grid
switching.

## 1. Product Summary

The Digital Twin product helps electric utilities understand and act on
power-line wildfire risk. It combines two components:

1. The **Digital Twin Engine** ingests versioned grid, vegetation, terrain,
   fuel, and weather data; calculates conductor movement and vegetation
   clearance; runs wildfire simulations; and persists reproducible evidence.
2. The **Digital Twin Frontend** is the interactive world through which people
   experience that evidence. It lets a person move through the modeled network,
   directly select and inspect assets, manipulate bounded scenario conditions,
   see physical behavior and wildfire progression in place, and communicate a
   decision without needing direct access to Engine internals.

These are not separate products. The Engine owns computation and durable
truth. The Frontend owns interaction, interpretation, and presentation.

The primary product surface is not a dashboard with a map attached. It is a
continuous, explorable digital twin in which the map, 3D scene, asset model,
physics state, time, scenario controls, and evidence panels remain synchronized.

The product provides decision support. It does not autonomously de-energize
power lines, dispatch crews, or issue public warnings.

## 2. Product Mission

Give utility teams timely, explainable, and reproducible evidence about two
linked questions:

1. Could wind move an energized power line close enough to vegetation to
   create contact risk?
2. If contact caused an ignition, could local fuels, terrain, and weather
   support dangerous wildfire spread?

The Frontend succeeds when an operator can enter the modeled world, move from a
regional view to a specific pole, span, conductor, tree, clearance, weather
revision, and simulation result, manipulate a safe what-if scenario in context,
understand how the world responds, and share the evidence used for a human
decision.

## 3. Problem Statement

The Engine can produce versioned assets, weather inputs, physics results,
wildfire snapshots, and provenance. Those outputs are not useful to an
operator if they remain API records, storage references, or model artifacts.

Operators need one interactive world that answers:

- Where is the current or modeled risk?
- Which line spans, trees, weather conditions, and model versions produced it?
- Is the result current, stale, incomplete, approximate, exact, failed, or
  hypothetical?
- How could conditions change under a bounded scenario?
- What happened during the run, and can the same evidence be inspected later?
- What should a human review next?
- What changes if I alter this condition, ignition, asset, or intervention?
- Can I see the modeled behavior from the most useful geographic, profile, or
  three-dimensional perspective without losing context?

The current repository proves much of the map and simulation interaction
through a bundled GeoLibre Digital Twin demo plugin. It does not yet provide a
production operator product with identity, role-based access, organization
isolation, ranked risk queues, reviewed workflows, or operational service
levels.

## 4. Product Principles

### 4.1 Evidence before recommendation

Every risk statement must link back to the exact region revision, asset
revision, weather version, model result, simulation run, and available source
metadata used to produce it.

### 4.2 Uncertainty stays visible

The Frontend must distinguish approximate screening, surrogate results, exact
finite-element results, missing evidence, and failed calculations. It must not
present every colored feature as equally authoritative.

### 4.3 The world is the decision surface, not a decorative map

The world combines geographic context, network structure, physical geometry,
time, and selection. Lists, filters, timelines, details, and comparisons add
precision without becoming a separate experience. Important facts must not be
communicated by color, animation, or geometry alone.

### 4.4 Human control

The product may rank evidence and propose review priorities. A human owns any
operational decision. The interface must not imply that a simulation result is
an automatic shutoff, dispatch, or evacuation instruction.

### 4.5 Durable server truth

The Frontend may cache presentation data, but the Engine API remains
authoritative for region state, simulation state, progress, results, and
lineage. Reloading the application must recover authoritative state.

### 4.6 Focused product, capable platform

GeoLibre supplies mapping, layers, styling, 2D and 3D visualization, local data
inspection, and cross-platform delivery. The Digital Twin deployment should
use a focused UI profile and product navigation rather than expose the full GIS
surface by default. Advanced GIS tools may remain available to expert roles.

### 4.7 The twin is the interface

The world must behave like a model a person can explore, not a picture they can
only observe. Assets are selectable objects with stable identity. Conditions,
time, scenarios, results, and camera views are coordinated lenses over the same
world. A user action in one view must remain visible and understandable in the
others.

### 4.8 Direct manipulation creates intent, not hidden truth

Dragging an ignition point, choosing a tree, changing wind, scrubbing time, or
testing an intervention creates explicit scenario intent. The Frontend may show
a clearly labeled local preview, but only Engine-validated results become
authoritative evidence. Editing a canonical asset requires a versioned working
copy, validation, review, and publication contract. Moving a rendered pole must
never silently rewrite the real network.

## 5. Users and Jobs

### Primary user: Wildfire risk operator

Monitors assigned regions, investigates emerging risks, starts or reviews
scenarios, follows simulations, and records why evidence was escalated or
dismissed.

Key jobs:

- identify regions and assets that need attention;
- inspect current inputs and data freshness;
- understand the evidence behind a risk finding;
- run a bounded what-if scenario;
- compare progression across time or scenarios; and
- hand evidence to the team responsible for an operational decision.

### Secondary user: Vegetation management or grid engineer

Investigates a specific span or tree, verifies asset context, reviews clearance
and physics provenance, and uses results to prioritize inspection or mitigation
planning.

### Secondary user: Wildfire model or risk analyst

Validates scenario inputs, reviews weather and fuel layers, inspects wildfire
progression, compares results, and identifies data or model limitations.

### Supporting user: Product administrator

Manages organization access, role assignments, deployment configuration,
region visibility, and operational diagnostics. Region and asset publication
may remain a separate data-administration workflow until explicitly brought
into the Frontend.

## 6. Core User Journeys

### 6.1 Review regional risk

1. The operator signs in and sees the regions they are allowed to access.
2. The overview communicates Engine readiness, input freshness, active runs,
   unresolved failures, and risk evidence that needs review.
3. The operator filters or sorts by severity, confidence, freshness, region,
   and evidence type.
4. Selecting an item enters the twin at that location, focuses every active
   view, highlights the same object in 2D and 3D, and opens its evidence view.
5. The operator can inspect the line, nearby vegetation, weather, model
   provenance, wildfire consequence, and prior related runs.

### 6.2 Explore and interrogate the world

1. The user moves continuously between regional, feeder, span, and individual
   asset scale in plan, profile, and 3D perspective views.
2. Hovering or selecting an object exposes its identity and current modeled
   state without forcing the user to hunt through a separate layer table.
3. The user searches for an asset, follows network relationships, isolates a
   selection, measures a clearance, or switches to a risk or provenance lens.
4. The same selection, time, scenario, visibility state, and camera target stay
   synchronized across views and evidence panels.
5. The user can copy a permission-aware deep link that returns another user to
   the same world state and highlighted evidence.

### 6.3 Run a bounded wildfire scenario

1. The operator selects a published region and an exact weather revision.
2. The operator chooses one or more ignition points or selects eligible tree
   assets directly in the world, then manipulates bounded scenario inputs such
   as wind, direction, and duration while seeing their scope in place.
3. The Frontend validates geometry, limits, units, and readiness before submit.
4. The Engine accepts the run durably and returns its public run identity.
5. The Frontend streams progress, falls back to polling when needed, and
   supports cancellation.
6. On completion, the Frontend plays the modeled response in the world and
   makes all input and output lineage inspectable.

### 6.4 Replay and compare evidence

1. The operator opens a completed run.
2. The Frontend loads immutable positive-tick artifacts and provides scrub,
   play, pause, step, and speed controls.
3. The operator can compare the final footprint, selected intermediate ticks,
   and a second compatible run without confusing their inputs or legends.
4. The operator exports or shares a stable evidence summary.

### 6.5 Recover interrupted work

1. The browser refreshes, reconnects, or opens on another supported device.
2. The Frontend reloads recent and active runs from the Engine.
3. Active progress resumes from durable state. A stale event cursor resets to
   the current server snapshot.
4. Terminal results remain available by stable run identity.

## 7. Functional Requirements

Priority definitions:

- **P0**: required for the first production pilot.
- **P1**: required for a complete operator workflow after pilot validation.
- **P2**: valuable expansion after the Engine exposes the needed evidence.

### 7.1 Application shell and access

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-001 | P0 | The application must present Digital Twin product branding, navigation, terminology, and help rather than a demo-only identity. |
| FR-002 | P0 | The deployment must use a focused UI profile that exposes the operator workflow first and hides unrelated GIS tools by default. |
| FR-003 | P0 | The application must support authenticated sessions and organization-scoped access before production data is exposed. |
| FR-004 | P0 | The application must enforce role-based access for viewing evidence, submitting or cancelling runs, exporting data, and administering product settings. |
| FR-005 | P0 | Authorized engineer, risk-analyst, and administrator roles may enter an advanced GIS workspace without changing the default operator experience. Grid operations operators do not receive expert GIS access by default. |

### 7.2 Readiness and regional overview

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-010 | P0 | The Frontend must distinguish application availability from Engine readiness and disable actions whose dependencies are not ready. |
| FR-011 | P0 | The user must be able to select among authorized published regions and see region bounds on the map. |
| FR-012 | P0 | The overview must show weather, Earth Engine, asset, and result availability separately. A source that exists but has no renderable artifact must not be labeled as rendered or ready for display. |
| FR-013 | P0 | Every time-sensitive dataset must display observation or forecast time, version, source, and freshness state. |
| FR-014 | P0 | The overview must surface active autonomous and manual runs, recent failures, stale inputs, and durable Engine-owned alerts requiring review. |
| FR-015 | P0 | The pilot alert queue must consume durable Engine-owned alert priority and evidence. The Frontend may sort that truth but must not calculate aggregate risk, thresholds, or shutoff recommendations. |
| FR-016 | P0 | An authorized grid operations operator must be able to acknowledge, assign, investigate, hand off, resolve, dismiss, or identify a superseded Engine-owned alert according to its public lifecycle. |
| FR-017 | P0 | Every alert must identify its organization, region, affected line identities, weather version, policy version, evidence method, uncertainty, and linked autonomous run when present. |
| FR-018 | P0 | Alert events must support resumable delivery with authoritative REST reconciliation; refresh or reconnect must not duplicate alerts, acknowledgements, dispositions, or runs. |
| FR-019 | P0 | The application must state that alerts require human review and must not expose an action that operates grid equipment. |

### 7.3 Interactive twin workspace

| ID | Priority | Requirement |
| --- | --- | --- |
| TWIN-001 | P0 | The default workspace must open into the interactive twin, with the modeled network occupying the primary canvas and supporting controls arranged around it. |
| TWIN-002 | P0 | The world must support fluid pan, orbit, tilt, zoom, and fit-to-selection navigation with mouse, trackpad, touch, and keyboard alternatives. |
| TWIN-003 | P0 | Users must be able to switch among synchronized plan, 3D perspective, and asset-detail views without losing selection, scenario, time, or visible evidence. A longitudinal or transverse profile view is P1. |
| TWIN-004 | P0 | Poles, spans, conductors, trees, terrain, ignitions, weather layers, and simulation artifacts must be independently selectable where public Engine identity exists. |
| TWIN-005 | P0 | Hover must provide a lightweight identity preview. Selection must provide a stable highlight, properties, available actions, lineage, and related evidence. |
| TWIN-006 | P0 | The same asset or evidence selection must stay synchronized across the world, layer tree, search results, run timeline, and detail panels. |
| TWIN-007 | P0 | The workspace must provide asset search, zoom-to-selection, isolate, clear isolation, and deterministic camera presets such as top-down, oblique, and line-aligned. |
| TWIN-008 | P0 | Users must be able to place, move, remove, and multi-select scenario ignition points directly in the world, subject to visible Engine bounds and validation. |
| TWIN-009 | P0 | Scenario state must be visually distinct from observed state and completed evidence. The selected scenario, baseline, and result may be compared without visually merging their identities. |
| TWIN-010 | P0 | Time controls must coordinate simulation artifacts, environmental state, labels, legends, and summaries. Scrubbing time must not leave a layer or panel describing a different tick. |
| TWIN-011 | P0 | Physics and wildfire behavior must be shown from Engine outputs or clearly labeled preview data. Animation must preserve units, scale, time, and provenance and must not imply unsupported fidelity. |
| TWIN-012 | P0 | Users must be able to apply visual lenses such as asset type, data freshness, clearance state, evidence method, run status, and wildfire progression when the corresponding public data exists. |
| TWIN-013 | P0 | A permission-aware deep link must restore region, camera target, selected object or run, active time, and relevant view mode without placing sensitive data in the URL. |
| TWIN-014 | P1 | The workspace must support multiple coordinated viewports, including plan and 3D or profile side by side, with linked selection and optional linked cameras. |
| TWIN-015 | P1 | Expert users must be able to measure distance and clearance, follow connected network assets, select by box or lasso, and compare an asset with nearby vegetation in context. |
| TWIN-016 | P1 | Users must be able to save named workspace states containing safe view, lens, panel, selection, and scenario-draft configuration. Authoritative evidence remains server-owned. |
| TWIN-017 | P1 | Proposed asset or vegetation interventions must appear as reversible scenario overlays. Persisting them requires an Engine-owned version, validation, review, and publication workflow. |
| TWIN-018 | P2 | When the Engine supports fast incremental evaluation, manipulating an intervention or environmental condition should request updated physical behavior and risk deltas without leaving the workspace. |

### 7.4 Asset and environmental visualization

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-020 | P0 | The Frontend must render Engine-published power-line and tree assets in WGS84 without reading private state-store or object-store locations. |
| FR-021 | P0 | Selecting a map feature must open its stable asset identity and available attributes in an accessible detail view. |
| FR-022 | P0 | The Frontend must consume browser-safe map-layer descriptors and support each declared format through a matching renderer. |
| FR-023 | P0 | Environmental layers must show their coverage, units, source time or version, attribution, and readiness. |
| FR-024 | P0 | Layer controls must support visibility, opacity, ordering, and clear display names without altering authoritative data. |
| FR-025 | P0 | The product must visually distinguish asset type, evidence status, severity, confidence, and data freshness without relying on color alone. |
| FR-026 | P0 | The qualification region must remain usable with at least 50,000 trees and the line-asset targets in the pilot workflow contract through measured aggregation, tiling, filtering, or level-of-detail strategies. |
| FR-027 | P0 | Three-dimensional asset geometry must preserve real geographic placement and meaningful relative dimensions. Decorative geometry must not be presented as survey-grade truth. |
| FR-028 | P1 | Terrain, point clouds, imagery, vegetation, structures, conductors, and analysis overlays must be independently controllable so a user can reveal the physical relationship under investigation. |

### 7.5 Scenario authoring

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-030 | P0 | An authorized user must be able to create a bounded scenario from a published region, an exact ready weather version, wind speed and unit, wind direction, duration, and one to one hundred ordered ignition points. |
| FR-031 | P0 | The Frontend must validate coordinate order, region containment, scenario bounds, supported units, required values, and Engine limits before submission. |
| FR-032 | P0 | Ignition points may be placed freely on the map. When an Engine tree is selected, the Frontend must retain its `asset_id` for presentation and audit context even if the current run contract submits coordinates. |
| FR-033 | P0 | The interface must use a new idempotency key only when logical request inputs change and must prevent duplicate submissions from repeated user actions. |
| FR-034 | P0 | The user must review a concise scenario summary before submission, including whether the scenario is historical, forecast, synthetic, or mixed according to Engine metadata. |
| FR-035 | P1 | Saved scenario templates and scenario reuse require Engine-supported query and authorization contracts. They must not be implemented as browser-only truth. |
| FR-036 | P1 | Scenario controls should support direct manipulation and immediate visual feedback. Any result shown before Engine validation must be labeled as a draft preview and replaced atomically by authoritative evidence. |
| FR-037 | P1 | An intervention scenario must preserve a visible baseline and a reversible change set so users can understand exactly what they altered in the world. |

### 7.6 Run lifecycle

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-040 | P0 | Run submission must display durable acceptance separately from execution start. |
| FR-041 | P0 | The Frontend must represent `QUEUED`, `STARTED`, `CANCEL_REQUESTED`, `CANCELLED`, `COMPLETED`, and `FAILED` without collapsing distinct states. |
| FR-042 | P0 | Live progress must use the Engine SSE resource when available, resume with the last event ID, handle stream reset, and fall back to authoritative REST polling. |
| FR-043 | P0 | Tick zero must not be presented as a completed compute tick or public replay frame. |
| FR-044 | P0 | Run cancellation must be available only for cancellable states and must show a request as pending until the Engine acknowledges a terminal state. |
| FR-045 | P0 | Safe public failure codes must produce corrective guidance. Unknown internal failures must remain generic and must not expose logs, paths, keys, credentials, or stack traces. |
| FR-046 | P0 | Region or idempotency conflicts must provide a path to refresh and open the conflicting active run. |
| FR-047 | P0 | Reloading the application must recover active and recent runs from the Engine rather than trust stale browser state. |

### 7.7 Results, replay, and evidence

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-050 | P0 | A completed run must render its bounded final GeoJSON result with a stable run-specific name and fit-to-result action. |
| FR-051 | P0 | The result summary must show region, scenario or input mode, exact weather version, requested duration, completed tick count, ignition points, timestamps, and available artifact lineage. |
| FR-052 | P0 | Completed runs must support replay of immutable positive-tick artifacts with scrub, step, play, pause, loop, and speed controls. |
| FR-053 | P0 | Replay requests must be cancellable and ordered so a slower prior request cannot overwrite the frame the user most recently selected. |
| FR-054 | P0 | Cached replay frames must remain bounded. A cache miss must never change the selected tick or show a stale frame as current. |
| FR-055 | P1 | Users must be able to compare two compatible runs while keeping inputs, timestamps, map layers, legends, and results clearly separated. |
| FR-056 | P0 | The Frontend must provide a stable evidence summary suitable for the grid-operations handoff. The summary must identify the exact alert, run, inputs, and revisions rather than embed private storage references. |
| FR-057 | P0 | The live pilot depends on a bounded public Engine projection for physics, collision, threshold, and alert evidence. The detail view must show screening, surrogate, exact-solve, collision, threshold, uncertainty, and failure provenance without exposing internal delivery state or private references. |
| FR-058 | P1 | The user must be able to move from a result summary to the exact affected objects in the world and from an object back to every compatible result that references it. |
| FR-059 | P1 | Baseline and scenario results must support spatial before-and-after comparison through synchronized views, swipe, difference overlays, or another interaction that preserves both identities. |

### 7.8 Review and collaboration

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-060 | P0 | A grid operations operator must be able to record an investigation disposition and note against a stable alert and evidence identity. |
| FR-061 | P0 | Review history must identify actor, organization, timestamp, alert and evidence revisions, acknowledgement, assignment, disposition, and changes. |
| FR-062 | P0 | A shared link must open the same authorized region, alert, run, map extent, and selected evidence without copying sensitive result data into the URL. |
| FR-063 | P0 | Evidence summaries must identify generated time, alert and run identity, inputs, lineage, visible caveats, and the fact that the product provides decision support rather than an autonomous control instruction. A grid operations supervisor may attach an external keep-energized or de-energize decision reference; the Frontend must not execute that decision. |

### 7.9 Administration and diagnostics

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-070 | P0 | Deployment configuration must provide the Engine API origin without requiring a rebuild. Production should prefer a same-origin reverse proxy. |
| FR-071 | P0 | Diagnostics must separate Frontend, network, authentication, Engine readiness, source readiness, artifact readiness, and run failures. |
| FR-072 | P0 | Client diagnostics must redact credentials, authorization headers, signed URLs, private storage locations, internal state references, and unsafe Engine details. |
| FR-073 | P1 | Administrators must be able to inspect version compatibility between the Frontend and Engine public API. |

## 8. Frontend and Engine Ownership

| Concern | Frontend owns | Engine owns |
| --- | --- | --- |
| User interaction | navigation, forms, selection, map state, accessible feedback | input constraints expressed through public schemas and errors |
| Computation | no domain model calculations | physics, collision, wildfire, aggregation, trigger policy |
| Workflow truth | presentation of current state | durable commands, idempotency, lifecycle, progress, cancellation |
| Data | bounded browser caches and presentation preferences | assets, revisions, snapshots, results, artifact catalog, provenance |
| Visualization | rendering, styling, comparison, replay controls | safe GeoJSON, COG, XYZ, and descriptor contracts |
| World interaction | camera, selection, coordinated views, reversible scenario gestures, visual previews | stable object identity, topology, geometry lineage, validation, authoritative scenario results |
| Security | session handling, route guards, safe client storage | authentication verification, authorization enforcement, tenant isolation |
| Audit | display and capture of user review intent | durable audit records and immutable evidence identity |

The Frontend must never:

- construct Redis keys or read Redis directly;
- call Engine workers or RPC channels directly;
- read local, S3, Zarr, or other private artifact paths;
- recalculate or reinterpret domain results as authoritative truth;
- infer completion from animation or client-side elapsed time; or
- persist a directly manipulated object as canonical infrastructure without an
  Engine-owned version and validation workflow; or
- turn a risk result into an automatic operational command.

## 9. Public Integration Contract

The first production pilot depends on the Engine's versioned HTTP surface under
`/api/v1`:

- readiness;
- published regions and region detail;
- region assets and bounded asset GeoJSON;
- exact weather inventory and Earth Engine metadata;
- browser-safe map-layer descriptors and artifact bytes;
- immutable scenario creation;
- simulation submission, recent-run recovery, status, cancellation, and final
  result GeoJSON;
- durable simulation progress through SSE; and
- immutable positive-tick result GeoJSON for replay.

Contract rules:

1. The Frontend consumes public identifiers and links returned by the Engine.
   It does not derive private identifiers or URLs.
2. GeoJSON presented to the browser uses WGS84 longitude and latitude unless a
   future descriptor explicitly declares another supported CRS.
3. Map-layer URLs are bounded catalog entries, not caller-supplied paths.
4. REST status and result resources remain authoritative even when SSE is used.
5. The Frontend must tolerate additive response fields and reject unsupported
   enum values safely.
6. Breaking contract changes require a versioned migration and a visible
   compatibility failure, not silent degradation.

## 10. Non-Functional Requirements

### Performance

- NFR-001: With a warm application and healthy Engine, the first regional
  overview should become interactive within 3 seconds on the supported pilot
  network and reference hardware.
- NFR-002: World interaction should target 60 frames per second on reference
  pilot hardware and remain usable at or above 30 frames per second during
  normal navigation of supported dense scenes. Progressive loading and visible
  level-of-detail transitions are allowed.
- NFR-003: Progress updates should appear within 2 seconds of durable Engine
  publication under normal conditions.
- NFR-004: Selecting a cached replay frame should update within 200 ms. A
  network frame should show an explicit loading state immediately.
- NFR-005: Hover feedback should begin within 100 ms and selection feedback
  within 150 ms when the target geometry is already loaded.
- NFR-006: Camera motion, selection, and direct manipulation must remain local
  and responsive while authoritative computation runs asynchronously.

### Reliability and recovery

- NFR-010: A browser refresh, SSE disconnect, tab suspension, or transient
  network failure must not create a duplicate logical run.
- NFR-011: The application must never show a nonterminal run as completed or a
  result from one run under another run's identity.
- NFR-012: Every asynchronous request tied to a region, run, or replay frame
  must support cancellation or stale-response suppression.
- NFR-013: Production deployments must define retention and availability goals
  jointly with Engine artifact and state retention. The UI must state when an
  artifact has expired or is unavailable.

### Security and privacy

- NFR-020: Production access requires authenticated, authorized, organization-
  scoped API enforcement. Hiding a control in the browser is not authorization.
- NFR-021: Tokens and sensitive deployment values must not be stored in project
  files, share URLs, logs, analytics payloads, or exported evidence.
- NFR-022: Browser-visible errors and diagnostics must use the Engine's safe
  public vocabulary.
- NFR-023: Content Security Policy, cross-origin policy, and artifact delivery
  must be validated for each supported web or desktop deployment target.

### Accessibility

- NFR-030: Pilot workflows must meet WCAG 2.2 AA for keyboard access, focus
  order, labels, contrast, status announcements, target size, and reduced
  motion.
- NFR-031: Risk, readiness, selection, and run state must never rely on color,
  animation, or map position alone.
- NFR-032: Map-only operations must have a list, form, or keyboard-accessible
  alternative.

### Geospatial and evidence correctness

- NFR-040: Coordinate order, CRS, units, temporal semantics, and coverage must
  be explicit at the API boundary and preserved in the UI.
- NFR-041: A legend must describe the exact visible layer and version. Stale
  legends must be removed when their layer changes or disappears.
- NFR-042: The UI must identify hypothetical ignition intent and synthetic
  weather separately from observed or forecast conditions.
- NFR-043: Exports and shared views must preserve run and input identities
  needed to retrieve authoritative evidence.
- NFR-044: Rendered object identity must remain stable across level-of-detail,
  2D and 3D views, timeline changes, and visual lens changes.
- NFR-045: Visual exaggeration of conductor movement, clearance, terrain, or
  wildfire progression must be disclosed and must never change the underlying
  measurement shown to the user.

### Compatibility and quality

- NFR-050: The first pilot targets the browser application. Desktop support is
  accepted only after network, certificate, and content-security behavior pass
  the same workflow suite.
- NFR-051: Supported Frontend and Engine versions must pass contract fixtures,
  unit tests, accessibility tests, and one real end-to-end run before release.
- NFR-052: A precomputed demonstration path may support sales or development
  rehearsals, but it must be visibly labeled and must not count as production
  availability.

## 11. Success Measures

Pilot targets must be validated with utility users and adjusted before a
general release.

| Outcome | Initial target |
| --- | --- |
| Investigate evidence | At least 90% of moderated pilot tasks reach the correct region, asset, weather version, and run without direct API or database access. |
| Submit a valid scenario | At least 95% of valid scenario attempts are accepted without duplicate logical runs. |
| Recover active work | 100% of tested refresh and reconnect cases recover the authoritative run state. |
| Evidence integrity | Zero cases in release tests where a layer, legend, replay frame, or summary is attributed to the wrong run or version. |
| World navigation | At least 90% of pilot users can locate a named asset, inspect its surroundings, and return to the regional context without assistance. |
| Direct interaction | At least 90% of pilot users can select an asset, place or move an ignition, alter a scenario condition, and identify which visible state is draft versus authoritative. |
| Interaction quality | Loaded-scene hover and selection meet their latency targets, with no stale selection across coordinated views in release tests. |
| Accessibility | No critical or serious automated accessibility violations in P0 workflows, followed by keyboard and screen-reader manual checks. |
| Operator comprehension | At least 80% of pilot users can correctly explain whether a result is hypothetical, approximate, exact, incomplete, or failed. |
| Decision handoff | An authorized user can create a stable evidence summary from a completed run in under 2 minutes. |

## 12. Scope by Release

### Current proof: Interactive demo

Implemented evidence in this repository includes:

- curated region selection and visible bounds;
- Engine readiness and browser-safe input-layer discovery;
- tree and power-line visualization, including 3D network presentation;
- freely placed ignition points and synthetic-wind controls;
- idempotent scenario and run submission;
- SSE progress with REST fallback, cancellation, and recent-run recovery;
- final burn-footprint rendering; and
- positive-tick replay with bounded caching and stale-request protection.

This proves the core Engine-to-map interaction. It is not the production pilot.

### Release 1: Production pilot

The pilot includes P0 requirements and is centered on Engine-owned live
monitoring. Real observed weather, and forecast weather when its lineage is
explicit, drive Engine evaluation, autonomous simulations, and durable alerts.
The Frontend provides the alert inbox, investigation workflow, interactive plan
and 3D twin, synchronized evidence, replay, manual what-if scenarios, human
disposition, and a stable grid-operations handoff. It does not calculate risk or
operate grid equipment.

### Release 2: Complete operator workflow

Release 2 includes P1 requirements: coordinated plan, profile, and 3D views;
measurement and network traversal; reversible intervention overlays; evidence
comparison; saved workspaces; richer exports; and advanced GIS workflows.

### Release 3: Expanded decision support

Release 3 expands the Engine-owned monitoring contract across more regions,
policies, risk dimensions, notification channels, and operational integrations.
It may add richer Engine-ranked portfolios and alerting policy, but those
features must not be simulated in the Frontend before the Engine owns their
durable truth.

## 13. Out of Scope

- Autonomous shutoff, switching, dispatch, evacuation, or public-warning
  actions.
- Reimplementation of physics, collision, wildfire, aggregation, or trigger
  policy in TypeScript.
- Direct access to Redis, Engine RPC, private object stores, local artifacts,
  model tensors, raw arrays, or internal logs.
- Treating a convex-hull burn footprint as intensity, probability, or exact
  fire perimeter when the Engine does not make that claim.
- Treating decorative 3D poles, conductors, trees, terrain, or animation as
  survey-grade geometry or authoritative physics.
- Silent editing of canonical grid or vegetation assets through client-side
  object movement.
- Full region and asset authoring in the first production pilot.
- Replacing the Engine API with the GeoLibre Python sidecar.
- Supporting every GeoLibre tool in the default operator profile.
- Claiming production readiness from the fallback or precomputed demo path.

## 14. Dependencies and Risks

| Dependency or risk | Product impact | Required response |
| --- | --- | --- |
| Engine authentication and organization scope are not yet complete | Production data cannot rely on browser-only controls | Define and enforce identity and authorization in the Engine API before pilot access |
| Internal threshold monitoring and autonomous run delivery lack a bounded public alert/evidence projection | The required live pilot cannot present or recover truthful alerts yet | Make the public, organization-scoped Engine alert/evidence contract a pilot blocker; do not substitute Frontend ranking or a manual-scenario demo |
| Large asset and result layers may exceed comfortable GeoJSON rendering limits | Regional interaction may become slow or unstable | Measure pilot volumes and introduce vector tiles, PMTiles, COG, or server filtering where thresholds are exceeded |
| Engine run time and external data readiness may vary | Operators may wait without understanding progress | Show durable progress, readiness, elapsed time, cancellation, recovery, and explicit unavailable states |
| Generic GeoLibre capability can overwhelm an operator | Important risk tasks may be buried in GIS controls | Use a focused Digital Twin UI profile with advanced tools available by role |
| A visually rich 3D world can outrun the fidelity of source geometry | Users may mistake an immersive scene for engineering-grade truth | Show geometry source, accuracy, version, and visual exaggeration; distinguish schematic, approximate, and survey-grade objects |
| Direct manipulation can blur draft and authoritative state | A user may believe a local gesture changed the real network or produced validated physics | Use reversible scenario overlays, explicit draft state, Engine validation, and atomic replacement with authoritative evidence |
| Dense vegetation, point clouds, terrain, and network geometry can exceed browser budgets | The core workspace may become sluggish at the moments it is most needed | Establish pilot scene budgets, streaming and level-of-detail contracts, GPU fallbacks, and measured performance gates |
| Visual evidence can be misread as operational certainty | Users may over-trust a model result | Keep provenance, uncertainty, caveats, status, units, and human-decision language visible |
| Frontend and Engine releases may drift | Requests may fail or, worse, appear to work incorrectly | Add compatibility checks, contract fixtures, and coordinated release gates |

## 15. Pilot Acceptance Criteria

The production pilot is ready only when all of the following are true:

1. An authenticated user sees only authorized regions and actions.
2. The application clearly identifies itself as the Digital Twin operator
   component, not a generic demo.
3. A user can verify Engine, source, and artifact readiness independently.
4. A user can load a published region, inspect its assets, and identify the
   exact visible data versions.
5. A user can navigate from region to asset scale, select the same object in
   plan and 3D, search and isolate assets, and return through a stable deep link.
6. A user can directly place and move scenario intent while the interface keeps
   draft, baseline, and authoritative result states visibly distinct.
7. A user can create one valid bounded scenario, submit it once, follow durable
   progress, cancel when allowed, and recover after refresh.
8. A completed run renders the correct final artifact and replays every
   available positive tick without stale-frame races.
9. All error, empty, loading, stale, disconnected, cancelled, failed, and
   expired-artifact states have explicit accessible UI.
10. No client response, diagnostic, export, project, or URL exposes credentials,
   private storage paths, Redis keys, or internal snapshot references.
11. A user can retrieve a stable summary containing the run and input identities
   required to inspect authoritative evidence.
12. Contract, unit, accessibility, performance, visual-fidelity, and end-to-end
    suites pass against the exact
    Frontend and Engine release candidates.
13. A real observed-weather update completes through the deployed monitoring
    stack, produces the correct durable Engine decision and autonomous run when
    policy requires it, publishes an alert, and supports investigation and
    handoff. A manual pilot scenario also completes through the deployed stack.
    The fallback demo is tested separately and labeled as non-production.
14. Product, engineering, security, accessibility, and a representative utility
    user approve the pilot workflow and its visible caveats.

## 16. Pilot Decisions and Remaining Dependencies

The draft
[Digital Twin Production Pilot Workflow Contract](pilot-workflow-contract.md)
resolves the primary role and handoff, live-monitoring mode, required views,
browser and identity defaults, evidence language, expert-tool allowlist,
qualification scale, geometry treatment, animation limits, reference hardware,
screens, roles, and success measures. These decisions become binding when the
contract approval table is complete.

The following dependent operational decisions remain open and must be resolved
in their owning security, Engine-contract, or operations work before release:

1. The pilot utility's organization and region hierarchy.
2. Run, tick-artifact, alert, review, handoff, and export retention periods.
3. Observed-weather and forecast freshness thresholds that warn, block, or
   degrade monitoring and manual scenarios.
4. The utility's final legal, regulatory, and safety approval of the proposed
   evidence language.
5. Which future asset changes may become persistent versioned proposals. The
   pilot permits temporary scenario intent only.
6. Measured replacement of provisional line-asset counts with the selected
   pilot region's inventory before performance qualification.

## 17. Reference Experience Direction

[Neara's physics-enabled digital twin](https://neara.com/our-platform) is the
closest reference for the intended product experience. Its useful pattern is
not simply a 3D rendering. It presents the utility network as one coherent
model that relates assets to surroundings, assets to other assets, and proposed
workflows to network behavior. Users can simulate environmental and physical
conditions on the real network model and turn the results into prioritized
work.

Neara's public [project and workspace documentation](https://knowledge.neara.com/en/collections/8341422-projects-and-workspaces)
shows the interaction depth this PRD targets:

- plan, profile, and 3D perspective views;
- direct object selection and movement;
- asset search, camera presets, keyboard navigation, and deep links;
- asset coloring, terrain and point-cloud controls, and clearance markers;
- project versions, configurable workspaces, and large-project performance;
  and
- task-specific analysis panels over the same network world.

Its [demo library](https://neara.com/how-it-works) also frames simulations as
questions answered inside the twin, including vegetation encroachment,
clearance, asset interventions, severe weather, and risk reduction.

Digital Twin should pursue that class of interaction for power-line wildfire
risk without copying Neara's interface or claiming feature parity. Our
differentiation is the Engine's explicit power-line-contact-to-wildfire loop,
immutable per-tick evidence, and an open GeoLibre-based interaction surface.

## 18. Source Basis

This PRD aligns the Frontend with the companion Engine's current product and
architecture definition, particularly its root `README.md`, `ARCHITECTURE.md`,
`CONTEXT.md`, system overview, GeoLibre integration research, API route
reference, and simulation progress design. It also reflects the implemented
Digital Twin demo plugin, its tests, and the frontend integration plan in this
repository.

Where this PRD describes future ranked risk, review workflows, authentication,
organization isolation, or production service levels, it states product intent
rather than claiming those capabilities already exist.
