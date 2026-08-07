# Digital Twin Production Pilot Workflow Contract

Status: Draft for cross-functional approval  
Decision owner: Product  
Primary user: Grid operations operator  
Operational decision owner: Grid operations  
Last reviewed: 2026-07-31

## 1. Contract purpose

This contract fixes the product frame for the first production pilot. It is the
scope boundary for product, design, Frontend, Engine, security, and pilot-user
work. A capability not named here is not required for the pilot unless this
contract is amended and re-approved.

The pilot's main job is live decision support. The Engine consumes current
observed weather and explicitly labeled forecast weather, evaluates the grid,
runs or updates simulations when its versioned policy requires them, and
publishes durable alert evidence. The Frontend makes that evidence visible,
inspectable, replayable, and handoff-ready for grid operations.

Grid operations decides whether a line remains energized or is de-energized.
The pilot does not connect the Frontend to SCADA, ADMS, OMS, switching controls,
crew dispatch, evacuation, or public-warning systems. It must never present an
Engine result as an automatic switching command.

## 2. Locked pilot decisions

| Decision | Pilot contract |
| --- | --- |
| Primary role | Grid operations operator monitoring an assigned region |
| Decision handoff | An operator acknowledges an Engine-owned alert, investigates its evidence, and gives grid operations a stable evidence summary for an external keep-energized or de-energize decision. The disposition and external decision reference are recorded without operating equipment. |
| Primary operating mode | Live monitoring driven by real observed weather, with forecast inputs supported only when the Engine labels their lineage and validity window explicitly |
| Supporting modes | Historical evidence replay and bounded operator-created what-if scenarios |
| Required world views | Switchable plan and 3D perspective views with one synchronized selection, time, scenario, and evidence context; accessible asset detail is always available |
| Deferred views | Profile, schematic, and side-by-side coordinated viewports |
| Delivery target | Browser application deployed in a utility-controlled non-production pilot environment behind a same-origin reverse proxy |
| Browser target | Current and previous major versions of Microsoft Edge and Google Chrome on Windows 11 |
| Identity default | Microsoft Entra ID through standards-based OIDC. A different enterprise OIDC provider may replace it without changing role semantics. No production data is exposed before Engine-enforced organization and region scope exists. |
| Reference workstation | Windows 11, 4 physical CPU cores, 16 GiB RAM, WebGL2-capable integrated GPU comparable to Intel Iris Xe, 1920x1080 display, mouse or trackpad, and keyboard |
| Expert GIS access | Hidden from the default operator product; available only to engineer, risk analyst, and administrator roles through an explicit workspace transition |
| Pilot scale | One real utility region, including at least 50,000 trees. The qualification dataset also targets 5,000 poles, 5,000 spans, and 10,000 rendered conductor segments. These line counts are validation targets until measured pilot inventory replaces them. |
| Initial delivery budgets | Asset delivery may exercise the Engine's current 64 MiB GeoJSON ceiling and result delivery its current 5 MiB GeoJSON ceiling. Failure to meet interaction targets at those limits triggers tiling, filtering, or level-of-detail work; it does not justify silently reducing the test inventory. |

## 3. Required end-to-end workflow

1. The operator authenticates and lands in the assigned live operations region.
2. The application shows Frontend, network, authentication, Engine, weather,
   asset, monitoring, and artifact readiness separately.
3. A new Engine-owned alert appears after the Engine durably publishes it. The
   alert identifies the affected region and lines, evidence time, weather
   lineage, policy version, status, and available simulation run.
4. The operator acknowledges the alert and opens it in the twin. Plan, 3D,
   search, selection, evidence, and timeline surfaces focus the same stable
   objects and run identity.
5. The operator inspects line, conductor, vegetation, clearance or contact,
   weather, physics method, wildfire progression, uncertainty, caveats, and
   provenance. Missing or stale evidence remains visible.
6. The operator may replay the autonomous run, compare its current tick with
   its baseline, or create a bounded manual what-if scenario. Manual input is
   visually distinct from monitored evidence.
7. The operator records a disposition and creates a stable evidence summary for
   grid operations. The summary supports an external operational decision but
   contains no switching control.
8. Refresh, reconnect, tab suspension, or a second authorized browser recovers
   the authoritative alert, acknowledgement, run, replay, and disposition state.

## 4. Required product screens

| Screen | Required outcome | Required states |
| --- | --- | --- |
| Sign-in and access resolution | Establish identity, organization, role, and allowed regions before protected data loads | loading, authenticated, unauthorized, session expired, provider unavailable |
| Live operations overview | Show assigned regions, readiness, weather freshness, monitoring state, active autonomous runs, and Engine-owned alerts | healthy, degraded, stale, disconnected, empty, partial, failed |
| Alert inbox | Present durable alerts without client-derived risk scores; support filters, acknowledgement, assignment, and open-in-twin | new, acknowledged, investigating, handed off, resolved, dismissed, superseded |
| Interactive twin | Investigate one synchronized region, line, asset, alert, run, and time in plan or 3D | baseline, monitored, draft scenario, submitted, authoritative result, loading, unavailable |
| Evidence inspector | Explain identity, versions, units, fidelity, method, confidence, caveats, policy, lineage, and related objects | approximate, exact, incomplete, stale, failed, visually exaggerated |
| Run and replay workspace | Follow autonomous or manual run state and replay immutable positive ticks | accepted, queued, started, cancel requested, cancelled, completed, failed, reconnecting |
| Scenario builder and review | Create bounded what-if intent, validate it, review exact inputs, and submit once | clean, dirty, invalid, ready, submitting, accepted, conflict |
| Decision handoff | Record disposition and produce a stable evidence summary plus external decision reference | draft, recorded, exported/shared, unavailable |
| Diagnostics | Separate user-correctable readiness and connectivity problems without exposing secrets or internal paths | component-specific healthy, degraded, unavailable, incompatible |
| Administration | Manage access, role assignments, region visibility, and deployment diagnostics | administrator-only; no operational decision authority implied |

The live operations overview and alert inbox may share one route if each outcome
and state remains independently testable.

## 5. Role and action matrix

Legend: `Yes` is allowed, `No` is forbidden, and `Scoped` means allowed only for
assigned organizations and regions.

| Action | Grid operations operator | Grid operations supervisor | Grid/vegetation engineer | Risk/model analyst | Product administrator |
| --- | --- | --- | --- | --- | --- |
| View monitored regions and evidence | Scoped | Scoped | Scoped | Scoped | Scoped diagnostics only |
| Receive and acknowledge operational alerts | Scoped | Scoped | No | No | No |
| Assign an alert for investigation | Scoped | Scoped | No | No | No |
| Inspect plan, 3D, lineage, and replay | Scoped | Scoped | Scoped | Scoped | Scoped diagnostics only |
| Create a manual scenario | Scoped | Scoped | Scoped | Scoped | No |
| Submit or cancel an eligible manual run | Scoped | Scoped | Scoped | Scoped | No |
| Record investigation disposition | Scoped | Scoped | Comment only | Comment only | No |
| Record external keep-energized/de-energize decision reference | No | Scoped | No | No | No |
| Generate or share evidence summary | Scoped | Scoped | Scoped | Scoped | No |
| Enter expert GIS workspace | No | Optional by explicit grant | Yes | Yes | Yes |
| Export raw or advanced GIS data | No | No | By explicit grant | By explicit grant | By explicit grant |
| Manage users, roles, regions, or deployment configuration | No | No | No | No | Yes |
| Send a switching command to grid equipment | No | No | No | No | No |

Every permission is enforced by the Engine or trusted application backend. A
hidden or disabled Frontend control is not authorization.

### 5.1 Expert GIS tool allowlist

The expert workspace is an explicit role transition, not a second set of menus
inside the operator workflow.

| Tool group | Grid/vegetation engineer | Risk/model analyst | Product administrator |
| --- | --- | --- | --- |
| Layer catalog, visibility, ordering, opacity, and approved styling | Yes | Yes | By separate expert grant |
| Attribute table, filtering, search, box/lasso selection | Yes | Yes | By separate expert grant |
| Distance, area, and clearance measurement | Yes | Yes | By separate expert grant |
| Network traversal and nearby-vegetation inspection | Yes | Yes | By separate expert grant |
| Raster, terrain, point-cloud, and temporal inspection | View | View and analyze | By separate expert grant |
| Approved evidence and data export | By explicit export grant | By explicit export grant | By explicit export grant |
| Product access and deployment diagnostics | No | No | Yes |

The pilot disables the Python console, Jupyter, arbitrary plugin installation,
unrestricted SQL, unapproved file upload, direct storage browsing, and any tool
that bypasses organization, region, export, or evidence controls. Enabling one
of those tools requires a separate security review and contract revision.

## 6. Engine-owned live monitoring contract

Live monitoring is a pilot dependency, not Frontend business logic. Before the
Frontend live overview can pass its gate, the Engine must expose public,
organization-scoped resources for:

- monitoring readiness and last successful observed-weather evaluation;
- current and recent alert evidence;
- durable alert identity and lifecycle;
- affected region, power-line, conductor, and tree identities;
- exact observed or forecast weather version and validity time;
- threshold policy version and a safe explanation of the outcome;
- evidence method, fidelity, uncertainty, and exact-versus-surrogate status;
- linked autonomous simulation run, progress, ticks, result, and failure;
- acknowledgement, assignment, disposition, and audit history; and
- resumable alert events with authoritative REST reconciliation.

The Engine already owns internal threshold decisions and autonomous run
delivery. Those internal models include private references and delivery-claim
state and must not be returned directly. The Engine must define a bounded public
projection. The Frontend may sort by Engine-supplied event time and categorical
priority, but it must not calculate aggregate risk, thresholds, alert priority,
or shutoff recommendations.

If these public contracts are unavailable, the live pilot is blocked. A manual
scenario demo is not an acceptable substitute and must not be labeled as the
production pilot.

## 7. Visible evidence language

### 7.1 Required labels

Every consequential view displays the applicable labels in text, not only by
color, animation, or geometry:

| Dimension | Approved labels |
| --- | --- |
| Input lineage | Observed, Forecast, Synthetic, Mixed |
| Ownership | Local draft, Submitted input, Engine-validated evidence |
| Calculation method | Screening estimate, Surrogate result, Exact model result |
| Completeness | Complete, Partial evidence, Missing evidence, Calculation failed |
| Freshness | Current as of `[time]`, Stale since `[time]`, Valid `[start]` to `[end]` |
| Workflow | New, Acknowledged, Investigating, Handed off, Resolved, Dismissed, Superseded |
| Geometry fidelity | Schematic, Approximate, Source-derived, Survey-grade |
| Visual treatment | True scale, Visually exaggerated `[factor]x` |

### 7.2 Approved caveats

- **Global:** "Decision support only. This application does not operate grid
  equipment or replace utility switching procedures."
- **Automated alert:** "Review required. The Engine produced this alert using
  policy `[version]`; a person must evaluate the evidence and current field
  conditions."
- **Screening or surrogate:** "Approximate screening result. Use the displayed
  method, inputs, and uncertainty before relying on this evidence."
- **Exact model:** "Exact model result for the identified inputs and model
  version. It is not a guarantee of present field conditions."
- **Forecast:** "Forecast input valid for the displayed period. Forecasts may
  change; observation and issue times are shown separately."
- **Synthetic:** "What-if input created for this scenario. It is not an
  observation or forecast."
- **Incomplete:** "Evidence is incomplete. Missing components are listed; no
  operational conclusion should be inferred from absence."
- **Visual exaggeration:** "Motion or geometry is exaggerated `[factor]x` for
  visibility. Displayed measurements retain their original units and scale."

The product must not use "safe," "unsafe," "must shut off," "will ignite," or
"exact fire perimeter" unless an approved Engine contract gives that phrase a
specific meaning. Alerts use "review required," not a switching command.

## 8. Geometry fidelity and scene budget

The pilot accepts mixed fidelity only when each selected object exposes its
source, revision, capture or effective time, horizontal and vertical accuracy
when known, and one of the approved geometry-fidelity labels.

| Object | Pilot minimum representation | Prohibited implication |
| --- | --- | --- |
| Pole | Stable location and identity; source-derived height when available | Decorative model is survey-grade |
| Span/conductor | Stable topology and line identity; source-derived or explicitly approximate catenary | Rendered curve is authoritative clearance geometry without Engine evidence |
| Tree | Stable identity, WGS84 location, and canopy radius for published calculation inventory | Generic symbol proves exact crown shape or height |
| Terrain | Versioned terrain source with displayed resolution | Visual mesh is a field survey |
| Structures | Optional contextual geometry labeled by source and fidelity | Context geometry participates in risk calculation unless Engine lineage says so |
| Point clouds | Expert-role, on-demand layer with level of detail and memory limits | Full point cloud must be loaded for the operator workflow |

Approved in-world animation is limited to Engine-provided conductor movement,
weather direction or magnitude, and wildfire progression. Clearance
measurements and alert geometry remain true scale. Conductor displacement may
be exaggerated up to 10x only with a persistent factor label and a one-action
return to true scale. Terrain is true scale by default and may be exaggerated
up to 2x in the expert workspace with the same disclosure. Replay speed changes
time presentation, not model time, and always displays both values.

Qualification uses the complete real-region inventory. The target is 60 frames
per second and the hard usability floor is 30 frames per second during normal
navigation on the reference workstation. The first overview becomes interactive
within 3 seconds on the supported pilot network. Progressive loading and visible
level-of-detail transitions are allowed. If the single-source GeoJSON path misses
these targets, tiled or filtered delivery becomes required before pilot approval.

## 9. Success measures

The general PRD measures remain in force. The live pilot adds these release
criteria:

1. One real observed-weather update completes the deployed Engine monitoring
   path, produces a durable decision, starts or updates the correct autonomous
   simulation when policy requires it, and publishes the corresponding alert.
2. The Frontend displays a durably published alert within 5 seconds under normal
   pilot network conditions. Engine computation duration is measured separately.
3. Every alert shown in release tests has the correct organization, region,
   affected line identities, weather version, policy version, evidence method,
   and linked run. Cross-alert or cross-run attribution defects are zero.
4. One hundred percent of refresh, reconnect, and tab-suspension cases recover
   the authoritative alert acknowledgement, run state, and disposition without
   duplicating an alert or run.
5. At least 90 percent of moderated operators can open a new alert, locate an
   affected line, identify whether evidence is observed, forecast, synthetic,
   approximate, exact, incomplete, or failed, and return to regional context
   without assistance.
6. At least 90 percent of moderated operators can distinguish an Engine alert
   from a switching command and identify grid operations as the decision owner.
7. An authorized operator can acknowledge an alert in under 30 seconds and
   create a stable evidence handoff in under 2 minutes after completing review.
8. The complete qualification dataset meets the 3-second overview target and
   the 30-frames-per-second interaction floor on the reference workstation.
9. No critical or serious automated accessibility violations remain in the
   required workflow, followed by keyboard, reduced-motion, and screen-reader
   manual checks.
10. No Frontend route, URL, log, diagnostic, export, or analytics event exposes
    credentials, internal state references, model paths, or private artifacts.
11. No pilot screen can send or simulate a grid switching command.

## 10. Explicit exclusions

- Autonomous or Frontend-initiated line shutoff, switching, dispatch,
  evacuation, or public warning.
- Client-side aggregate-risk calculation, threshold policy, alert generation,
  or severity inference.
- A Frontend-authored ranked monitoring queue when the Engine has not supplied
  durable priority truth. Sorting durable Engine alerts by time or an
  Engine-provided categorical priority is allowed.
- Profile, schematic, split-screen, or multi-viewport workflows.
- Default access to the full GeoLibre GIS surface for operators.
- Mobile, tablet, Tauri desktop, Safari, and Firefox qualification.
- Persistent canonical asset editing, region authoring, or intervention
  publication from the operator workflow.
- Survey-grade claims for decorative or approximate world geometry.
- Using a fallback or precomputed demonstration as evidence of live-pilot
  readiness.

## 11. Verified current-state basis

This contract was checked against the Engine repository on 2026-07-31:

- `src/orchestrators/region/threshold_monitor.py:74` persists policy evidence
  and selects a delivery action after exact collision evaluation.
- `src/orchestrators/region/threshold_monitor.py:602` can idempotently start an
  autonomous wildfire run or attach new weather and ignition evidence to the
  active run.
- `src/schemas/threshold_decisions.py:110` owns deterministic internal decision
  identity, affected lines and trees, policy version, weather version, and
  delivery lifecycle.
- `src/api/architecture.md` keeps threshold decisions internal and requires a
  deliberate future public risk-evidence projection. The current public API is
  centered on manual scenario runs and does not yet expose an alert resource.
- `docs/decisions/0012-promote-public-trees-at-region-publication.md` records a
  measured Boulder inventory of roughly 50,000 trees and the current 64 MiB
  asset GeoJSON ceiling.

These facts justify making the public alert/evidence projection a pilot blocker
without moving monitoring policy into the Frontend.

## 12. Approval and change control

The pilot workflow is locked only after all required approvers sign the same
revision and the representative user completes a moderated walkthrough.

| Approver | Required confirmation | Status |
| --- | --- | --- |
| Product | Primary job, pilot scope, measures, and exclusions | Pending |
| Design | Screens, evidence language, accessibility, and decision clarity | Pending |
| Frontend engineering | Feasibility, state boundaries, performance targets, and no client-owned risk truth | Pending |
| Engine engineering | Public alert/evidence contracts, monitoring lineage, identity, and recovery | Pending |
| Security | OIDC, organization/region enforcement, audit, export, and deployment controls | Pending |
| Representative grid operations user | Workflow matches alert investigation and external switching-decision practice | Pending |

Any change to the primary role, switching boundary, monitoring mode, required
views, alert semantics, Engine ownership, browser target, identity model, data
scale, or success measures requires a new contract revision and approval from
the affected disciplines.
