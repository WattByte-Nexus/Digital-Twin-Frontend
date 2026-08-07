# Digital Twin Pilot UI Specification

| Field | Value |
| --- | --- |
| Status | Draft for product, design, engineering, security, and pilot-user review |
| Primary experience | Live grid-operations decision support |
| Visual foundation | GeoLibre web application |
| Companion contract | [Digital Twin Production Pilot Workflow Contract](pilot-workflow-contract.md) |
| Last reviewed | 2026-07-31 |

## 1. Purpose

This document defines the pilot user interface for the Digital Twin product. It
turns the pilot workflow contract into an implementable screen, layout,
interaction, content, and visual-design contract.

The product should feel like GeoLibre has entered a focused operations mode. It
must not look like a separate dashboard embedded in GeoLibre, and it must not
expose the general GIS application to operators by merely hiding a few menu
items. The Digital Twin is a first-party product shell built on GeoLibre's map,
renderers, panels, commands, theme tokens, accessibility primitives, and expert
workspace.

The pilot's central promise is:

> Show grid operations what the Engine observed, why it requested review, what
> evidence exists, what remains uncertain, and what can be handed off—without
> pretending to operate the grid.

## 2. Experience direction: operational cartography

The visual direction is **operational cartography**: a calm, precise map with
just enough surrounding structure to support time-sensitive investigation.
Quality comes from hierarchy, state clarity, spatial continuity, and refined
interaction—not decoration.

The experience follows these principles:

1. **The world is the primary surface.** The map or 3D scene remains larger than
   either side panel. Summary information is layered around it, not arranged as
   a wall of dashboard cards.
2. **One place, one selection, one time.** Plan, 3D, search, alert, asset,
   evidence, scenario, and replay surfaces refer to the same stable identities.
3. **Evidence before conclusion.** Method, lineage, freshness, completeness,
   fidelity, uncertainty, and caveats appear before any handoff action.
4. **Operationally calm.** New alerts are noticeable without flashing, pulsing
   indefinitely, or turning the whole product red. Failures are specific and
   recoverable.
5. **Manual and monitored truth never blend.** Local scenario edits and
   synthetic weather are visibly different from observed or forecast evidence.
6. **Progressive expertise.** Operators get the required product workflow.
   Authorized specialists deliberately enter the GeoLibre expert workspace.
7. **No invented urgency.** The Frontend may display Engine-supplied priority
   and event time. It never calculates an aggregate score, risk rank, threshold,
   or switching recommendation.

## 3. Product frame

### 3.1 Default landing behavior

After authentication and access resolution:

- a grid operations operator or supervisor lands in the last authorized region
  at `/regions/:regionId/live`;
- an operator with multiple regions lands in the most recently used region and
  can change it from the header;
- an engineer or analyst lands in Digital Twin mode unless their saved start
  location is the authorized expert workspace;
- an administrator without operational scope lands in Administration, not a
  simulated operations view; and
- a deep link restores the authorized region, object, alert or run, time tick,
  and plan/3D mode after access checks pass.

No protected map, alert count, asset name, or cached screenshot appears before
identity, organization, role, and region access resolve.

### 3.2 Product modes

| Mode | Purpose | Default users | Chrome |
| --- | --- | --- | --- |
| Digital Twin | Live monitoring, alert investigation, scenarios, replay, and handoff | Operators and supervisors; also available to engineers and analysts | `DigitalTwinHeader`, operations panels, evidence footer |
| Expert GIS | Approved geospatial inspection and analysis | Engineers, analysts, administrators with an explicit grant | Existing GeoLibre toolbar, panels, status bar, and commands |

Product mode is a route- and permission-level boundary. A GeoLibre UI profile
may further reduce visible expert tools, but hiding controls is not
authorization.

### 3.3 Primary navigation

The Digital Twin header contains three stable destinations:

- **Live** — assigned-region monitoring and the durable alert inbox;
- **Scenarios** — bounded manual scenarios and their submission state; and
- **Runs** — autonomous and manual run history, status, and replay.

Handoffs are reached from their source alert or run and from a supervisor-only
filter in Live. Diagnostics and Administration live in the user/system menu.
Expert GIS appears only for an authorized role.

## 4. Information architecture and routes

| Route | Screen | Restorable state |
| --- | --- | --- |
| `/sign-in` | Sign-in and access resolution | return URL without protected labels |
| `/regions/:regionId/live` | Live operations overview and alert inbox | alert filters, map view, open panel |
| `/regions/:regionId/alerts/:alertId` | Alert investigation in the twin | selected object, plan/3D mode, evidence section |
| `/regions/:regionId/scenarios/new` | New bounded scenario | locally recoverable draft after access resolution |
| `/regions/:regionId/scenarios/:scenarioId` | Scenario review or submitted scenario | selected input, validation section |
| `/regions/:regionId/runs/:runId` | Run status and replay | immutable tick ID, selected object, plan/3D mode, baseline/current display |
| `/handoffs/:handoffId` | Stable handoff review | handoff version and audit history |
| `/diagnostics` | Product readiness and connection diagnostics | selected component |
| `/admin` | Access, region, and deployment administration | selected administrative section |
| `/workspace` | Authorized GeoLibre expert workspace | region, camera, selection, layers, return URL |

Transient dialog state does not belong in the URL. Consequential investigative
state does. Use stable IDs, not display labels, raw array indexes, or private
artifact paths.

## 5. Shell anatomy

### 5.1 Desktop reference layout

The reference layout is designed first for a 1920 × 1080 Windows workstation.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ GeoLibre | Digital Twin   Live  Scenarios  Runs      Region  Health  User  │ 48
├────┬──────────────────────┬───────────────────────────┬──────────────────────┤
│rail│ Operations panel     │                           │ Evidence inspector   │
│ 44 │ 320 px               │   Plan or 3D world       │ 376 px               │
│    │ alert list / inputs  │   search + map controls  │ summary / lineage    │
│    │ workflow context     │   one active selection   │ caveats / audit      │
│    │                      │                           │                      │
│    │                      ├───────────────────────────┤                      │
│    │                      │ Replay dock when active  │                      │
├────┴──────────────────────┴───────────────────────────┴──────────────────────┤
│ Decision support only · no equipment controls        freshness · diagnostics│ 28
└──────────────────────────────────────────────────────────────────────────────┘
```

The map owns all remaining width. Panels are resizable within their limits and
collapse to the existing 44-pixel GeoLibre rail behavior. There is never a
second application frame inside the map.

### 5.2 Header

The `DigitalTwinHeader` replaces `TopToolbar` only in Digital Twin mode. It is
48 pixels high, uses `bg-card`, a one-pixel bottom border, and the existing
GeoLibre focus, menu, button, tooltip, and dark-mode treatments.

Left to right:

1. GeoLibre map mark and `Digital Twin`, separated by a quiet divider;
2. primary destinations: Live, Scenarios, Runs;
3. flexible space;
4. assigned-region selector;
5. monitoring summary such as `Current · 2 min ago` or `Degraded`;
6. command search, help, theme, and user/system menu.

The header must not display the full Project/Edit/View/Add Data/Processing menu
set. Those commands belong to Expert GIS. On narrower screens, region and
monitoring labels shorten before the primary destinations move into an overflow
menu.

Brand treatment is typographic and restrained. Do not add a large hero logo,
gradient wordmark, or separate Digital Twin color system. Utility co-branding,
if approved, appears as the organization name in the region/user context rather
than replacing GeoLibre's product identity.

### 5.3 Operations panel

The left panel is 320 pixels by default, resizable from 280 to 420 pixels. It
contains the list or form that drives the current workflow:

- Live: monitoring summary, filters, and alert inbox;
- Alert: alert identity, workflow status, investigation checklist, and related
  objects;
- Scenario: input editor and validation steps; and
- Run: run identity, event log, and related evidence.

The panel header is sticky. Search and filters remain visible while long lists
scroll. Collapsing the panel preserves filters, scroll position, and selection.

### 5.4 World canvas

The center surface renders exactly one plan or 3D view in the pilot. A compact
segmented control labeled `Plan` and `3D` sits at the top center. Switching view
preserves region, stable selection, investigation state, time tick, and a
semantically equivalent camera target.

Native GeoLibre/MapLibre controls stay grouped at the upper-right edge. Product
search sits at the upper-left edge and searches only authorized regions, lines,
assets, alerts, and runs. Results include type, human label, stable identifier,
and region; selecting a result focuses the shared world state.

A small legend at the lower-left explains only visible operational encodings.
It collapses to a button but automatically reopens when an unfamiliar evidence
state first appears.

### 5.5 Evidence inspector

The right panel is 376 pixels by default, resizable from 320 to 480 pixels. It
is closed until an alert, run, line, conductor, tree, weather input, or result is
selected. Its sections are:

1. **Summary** — identity, workflow state, evidence time, and affected objects;
2. **Evidence** — method, values, units, inputs, uncertainty, completeness, and
   geometry fidelity;
3. **Lineage** — observed/forecast/synthetic source, versions, issue and validity
   times, policy, model, and run identity;
4. **Caveats** — approved caveat copy and missing evidence; and
5. **Audit** — acknowledgements, assignments, submissions, dispositions, and
   handoff versions.

Use a single scroll surface with anchored section links on desktop. Do not hide
required evidence behind unrelated tabs. The panel's sticky footer contains at
most one primary and one secondary action.

### 5.6 Replay dock

The replay dock appears only for a run or historical evidence context. It is 96
pixels tall when open and 36 pixels when collapsed. It contains:

- play/pause and one-tick step controls;
- replay speed;
- current immutable tick time and ordinal;
- model time and presentation speed as separate values;
- labeled event markers;
- `Baseline` / `Current tick` single-canvas toggle; and
- `Return to live` when a newer authoritative state exists.

The UI displays only Engine-published ticks. It does not interpolate missing
physics or animate beyond available evidence. Baseline comparison uses the same
canvas because side-by-side and split-screen views are deferred.

### 5.7 Evidence footer

Digital Twin mode replaces the coordinate-heavy expert status bar with a
28-pixel evidence footer using the same `bg-muted/40`, border, and compact type.

Persistent left copy:

> Decision support only · Equipment controls unavailable

Right-side items show observed/forecast freshness, connection state, and a
diagnostics entry. Each is keyboard reachable and expands to the exact
component state. The expert workspace restores GeoLibre's existing coordinate,
zoom, bearing, pitch, bounding-box, and diagnostics status bar.

## 6. Responsive and display behavior

| Width | Default behavior |
| --- | --- |
| 1440 px and above | Operations and evidence panels may both remain open; center world keeps at least 640 px |
| 1100–1439 px | Operations panel opens by default; evidence inspector opens as a mutually exclusive panel when selected |
| 768–1099 px | One panel at a time over the map; rail remains; replay dock uses two compact rows |
| Below 768 px | Not pilot-qualified; provide a safe read-only degradation or a desktop-required message, never a partially usable scenario or handoff form |

The supported pilot remains Chrome and Edge on Windows 11. At 200% browser zoom
on a 1920 × 1080 display, the required workflow must remain operable with one
panel at a time and without two-dimensional page scrolling.

## 7. Required screens

### 7.1 Sign-in and access resolution

Use a centered, narrow surface on the normal GeoLibre background. Show product
identity, enterprise sign-in action, and a short privacy/security statement.
Do not show decorative maps or sample grid data behind authentication.

States:

- **Resolving access:** spinner plus `Checking your organization and regions…`;
- **Unauthorized:** name the missing access class and the correct support path;
- **Session expired:** preserve a safe return route and offer `Sign in again`;
- **Provider unavailable:** show retry and incident/support reference without
  exposing protocol details; and
- **No assigned region:** explain that authentication succeeded but operational
  scope is absent.

### 7.2 Live operations overview and alert inbox

The Live screen is a map-led monitoring surface, not a KPI dashboard.

The operations panel begins with one compact monitoring row:

`Monitoring current as of 10:42 MDT · Observed weather · Policy v3.2`

Below it, a filter row supports workflow state, assignment, time window, and
Engine-supplied priority when available. A text search matches durable IDs and
approved human labels. Filters are reflected in the URL only when a copied link
would remain meaningful to another authorized user.

Each alert row is at least 64 pixels tall and contains:

- workflow icon and text such as `New` or `Investigating`;
- affected line or region label;
- `Review required` and any verbatim Engine priority category;
- published time and evidence freshness;
- assignee or `Unassigned`; and
- a visible open action or whole-row link with a clear focus state.

The default order is newest durable publication first. If the Engine provides a
categorical priority and ordering contract, the UI may group or sort by those
server fields and must label that mode. It never derives a rank from map
geometry, weather, alert contents, or simulation results.

The map shows alert locations or affected line geometry for the visible list.
Clicking a row and clicking its map representation produce the same preview.
Low-zoom asset counts may be spatially clustered for rendering, but those
clusters are labeled counts and never presented as aggregate risk.

Important states:

- healthy/current;
- degraded or stale with last successful evaluation time;
- disconnected while preserving and labeling the last valid scene;
- no alerts with monitoring health still visible;
- partial list or partial map evidence;
- failed list with component-specific retry; and
- a new alert announcement that does not steal focus or change the map while
  the operator is investigating another object.

### 7.3 Alert investigation

Opening an alert uses the same shell and URL; it does not launch a modal
dashboard. The world focuses the affected corridor, the left panel shows alert
workflow context, and the right inspector opens to Summary.

The initial viewport must show the full affected extent with padding for open
panels. Selection then supports line → span/conductor → tree/contact/clearance
evidence without losing the parent alert context.

Actions:

- `Acknowledge` is the primary action for a new alert. It records receipt, not
  agreement, and does not need a confirmation dialog.
- `Assign` or `Take assignment` is available according to server permission.
- `Start investigation` changes workflow state without changing evidence.
- `Create scenario` carries only explicitly allowed alert context into a local
  draft.
- `Record disposition` opens the handoff composer after required evidence has
  been visited or explicitly marked unavailable.

There is no `Shut off`, `Keep energized`, `Safe`, or `Unsafe` action. A
supervisor may record an external decision reference in the handoff, but the
application cannot issue or simulate a switching command.

### 7.4 Evidence inspector states

Every consequential object shows:

- stable identity and human label;
- source and revision;
- evidence or effective time;
- units beside every value;
- input lineage;
- method and model/policy version;
- completeness and freshness;
- geometry fidelity;
- uncertainty or `Not supplied`;
- visual-exaggeration factor when applicable; and
- related alert, run, line, conductor, tree, and weather identities.

Missing data occupies the expected row with `Missing evidence` or `Not
supplied`; it is not removed from the layout. Approximate and exact results use
the approved labels in the pilot contract. Long identifiers are selectable and
copyable but visually subordinate to human labels.

### 7.5 Scenario builder and review

Scenario mode adds a persistent amber-outlined context banner:

`Local draft · Synthetic changes are not monitored evidence`

The left panel uses three explicit steps:

1. **Inputs** — select allowed lines/assets and modify bounded weather or
   scenario parameters;
2. **Review** — show the complete normalized request, units, defaults, changed
   fields, warnings, and validation results; and
3. **Submit** — send once with an idempotency key, then replace local state with
   the accepted Engine identity.

Observed context remains visually separate from synthetic changes. On the map,
local draft geometry uses an amber outline plus a dash or hatch pattern; it
never recolors the full network as if the Engine had validated it. Dirty state,
autosave state, validation errors, conflict, submission, acceptance, and
failure are explicit text states.

The primary action progresses from `Review scenario` to `Submit run`. Use
`Discard local draft` as a secondary destructive action with confirmation when
unsaved changes exist. Never label a manual scenario as live monitoring.

### 7.6 Run status and replay

The run screen distinguishes `Autonomous run` and `Manual scenario run` next to
the run identity. The operations panel shows accepted, queued, started,
cancel-requested, cancelled, completed, failed, and reconnecting states from the
Engine.

Progress is determinate only when the Engine supplies a meaningful denominator.
Otherwise show the latest stage and update time, not a fake percentage. A
cancel action appears only when the Engine says the run is eligible and the
role is authorized.

On completion, replay opens at the first relevant published tick or the latest
tick according to the deep link. A single-canvas baseline/current toggle
preserves camera and selection. View changes, replay changes, and evidence
selection remain synchronized.

### 7.7 Decision handoff

The handoff composer is a routed sheet or full panel so refresh and deep linking
are safe. It contains:

- alert and run identities;
- evidence time and weather lineage;
- affected lines and selected evidence;
- method, uncertainty, caveats, missing evidence, and visual treatment;
- operator disposition using approved vocabulary;
- free-text operational notes with a defined length limit;
- supervisor-only external decision reference; and
- immutable preview of the evidence summary that will be recorded.

The final action is `Record handoff`, never `Approve shutoff`. After recording,
show version, author, time, share/export availability, and audit history. The
recorded version is read-only; corrections create a new version.

### 7.8 Diagnostics

Diagnostics shows independent rows for Frontend, network, identity, Engine,
weather, assets, monitoring, event stream, and artifacts. Each row includes:

- healthy, degraded, unavailable, stale, or incompatible text;
- last successful check;
- user-safe explanation;
- retry or support action when available; and
- copyable correlation ID when the backend provides one.

Do not expose credentials, tokens, internal paths, private artifact references,
raw stack traces, or organization data outside the current scope.

### 7.9 Administration

Administration uses the GeoLibre visual foundation but is not an operational
map screen. It supports identity/role/region assignments and deployment
readiness according to backend authorization. Administrative access does not
imply alert acknowledgement or decision authority.

## 8. Shared world interaction contract

### 8.1 Stable selection

There is one application-level selection model:

```text
region → alert/run/scenario context → world object → evidence item → tick
```

Map click, 3D click, search result, alert row, related-object link, and evidence
link all update that model. A child selection retains visible parent context.
Closing the inspector clears only the leaf selection, not the alert or run.

Object identity comes from Engine/public asset contracts. The Frontend must not
join objects by display name, approximate coordinate, array position, or layer
feature index.

### 8.2 Plan and 3D

- Plan and 3D are peer views, not separate products.
- Switching views is in-place and never opens a second viewport.
- The chosen view is represented by text and icon, not icon alone.
- A selected object remains selected when both renderers can represent it.
- If a selected object has no 3D representation, 3D keeps the parent extent and
  explains the missing representation in the inspector.
- Camera conversion preserves target and useful scale rather than raw renderer
  matrices.
- `Reset view` returns to the active alert/run extent; `Regional context`
  returns to the assigned region.

### 8.3 Time and replay

Live time, evidence time, weather observation time, forecast issue/validity
time, model time, and presentation speed are distinct fields. The UI never
collapses them into one ambiguous `Current` label.

Changing a replay tick updates the world and evidence together. If an object is
not present at that tick, preserve its identity in the inspector and state why
it is unavailable. Reconnecting reconciles against authoritative REST state
before replay resumes.

### 8.4 Deep links

A deep link may include:

- stable region, alert, scenario, run, object, and tick IDs;
- `view=plan|3d`;
- the open evidence section; and
- a safe return target for Expert GIS.

It must not include access tokens, private state references, raw weather
payloads, handoff free text, or canonical asset edits. Unauthorized targets use
the normal access-denied screen without confirming that the object exists.

## 9. Visual system

### 9.1 Foundation

Digital Twin inherits GeoLibre's current CSS variables and component language:

- `background`, `card`, and `popover` for surfaces;
- `foreground` and `muted-foreground` for hierarchy;
- `border` and `input` for structure;
- `primary` and `ring` for interaction and focus;
- `destructive` for destructive actions and failures; and
- the existing 8-pixel base radius, light/dark neutrals, and blue default accent.

Use components from `@geolibre/ui` before creating a product-local primitive.
New Digital Twin components may compose those primitives but must not fork
button, menu, dialog, input, tooltip, focus, or theme behavior.

### 9.2 Color semantics

The selected GeoLibre accent remains the interaction color. Pilot deployments
default to blue; administrators may lock a theme. Semantic status colors do not
change when the accent scheme changes.

| Meaning | Treatment | Rules |
| --- | --- | --- |
| Selected / actionable | GeoLibre `primary` blue by default | links, selected lines, primary buttons, focus |
| Healthy / complete | accessible emerald text, icon, and quiet surface | never means operationally safe |
| Review / stale / local draft | accessible amber text, icon, border, and pattern | never means Engine severity unless labeled |
| Failure / destructive | `destructive` red with icon and text | errors and destructive actions, not every alert |
| Neutral / unavailable | muted foreground and hatched or outlined treatment | retain legible labels |

Every semantic color requires a text label and, on the map, a shape, pattern, or
icon distinction. Do not use red/amber/green as an unlabeled traffic-light risk
score. Do not add gradients, translucent glass panels, neon glows, or decorative
color washes.

Suggested additive semantic tokens are role-based triplets rather than raw
one-off hex values:

```css
--dt-status-ok-{surface,border,text}
--dt-status-review-{surface,border,text}
--dt-status-failed-{surface,border,text}
--dt-lineage-observed-{surface,border,text}
--dt-lineage-forecast-{surface,border,text}
--dt-lineage-synthetic-{surface,border,text}
```

Light and dark values must be contrast-tested independently before they are
added to the shared token layer.

### 9.3 Typography

Keep GeoLibre's existing system sans stack. Do not introduce a pilot-only web
font. Use weight, spacing, and tabular numerals to create polish.

| Use | Size / line height | Weight |
| --- | --- | --- |
| Screen or panel title | 18 / 24 px | 600 |
| Section title | 14 / 20 px | 600 |
| Primary UI/body | 14 / 20 px | 400–500 |
| Dense list metadata | 12 / 16 px | 400–500 |
| Overline/status label | 11 / 16 px | 600; restrained tracking |

Times, measurements, counts, and changing values use tabular numerals. Monospace
is reserved for stable IDs, correlation IDs, coordinates in Expert GIS, and
code-like values—not whole panels.

### 9.4 Spacing, shape, and elevation

- Base spacing unit: 4 pixels.
- Common component gaps: 8 and 12 pixels.
- Panel padding: 16 pixels; dense list horizontal padding: 12 pixels.
- Touch/click target: 40 pixels visible where practical, with a minimum
  44-pixel hit area for primary workflow controls.
- Alert row: minimum 64 pixels.
- Radius: existing `sm`, `md`, and `lg` tokens; no pill-shaped containers except
  short status badges and the Plan/3D segmented control.
- Borders: one pixel and low contrast; use separators instead of nested cards.
- Shadows: only popovers, dialogs, floating map controls, and overlay panels.

Avoid a card for every field. Prefer labeled rows, grouped sections, and one
dominant surface per panel.

### 9.5 Iconography

Use the existing Lucide icon set at 16 pixels in dense controls and 18–20 pixels
for navigation. Icons support text; they do not replace unfamiliar labels.
Status icons have stable meanings across screens. Avoid illustrations and emoji
in the operations workflow.

### 9.6 Motion

- Panel and disclosure transitions: 120–180 ms, ease-out.
- Selection change: short outline/fill transition, no camera bounce.
- New alert: one non-flashing emphasis transition plus an accessible live-region
  announcement; no persistent pulse.
- Map fly-to: 250–500 ms based on distance; respect reduced motion by using an
  immediate or very short transition.
- Replay never starts automatically.
- Loading skeletons do not shimmer under reduced motion.

## 10. Operational map language

### 10.1 Layer hierarchy

From lowest to highest visual emphasis:

1. contextual basemap and terrain;
2. regional boundaries and contextual structures;
3. network corridors;
4. lines, spans, conductors, poles, and vegetation appropriate to zoom;
5. current alert/run evidence;
6. selected object and measurement annotation; and
7. local draft geometry, always visibly labeled as draft.

The basemap is slightly quieter than stock GeoLibre styles so infrastructure
remains legible in light and dark modes. It must retain road, place, and terrain
context needed to orient operators.

### 10.2 Scale and density

The qualification dataset includes at least 50,000 trees plus the provisional
line inventory in the pilot contract. Rendering uses progressive detail:

- regional zoom: corridors, alert extents, and labeled count clusters;
- corridor zoom: lines, poles, spans, and generalized vegetation;
- inspection zoom: conductor and individual-tree geometry; and
- detail zoom/3D: source-supported geometry and Engine evidence.

Spatial clustering and level of detail are presentation optimizations only.
They must not change stable identity, evidence values, selection, or risk
meaning. The UI exposes `Loading detailed geometry…` when a coarser
representation is temporarily visible.

### 10.3 Evidence encodings

| Dimension | Map encoding | Required adjacent label |
| --- | --- | --- |
| Observed input | solid blue outline/marker | `Observed` plus observation time |
| Forecast input | violet outline with dash pattern | `Forecast` plus issue and validity time |
| Synthetic input | amber outline with dot/dash or hatch | `Synthetic` and `Local draft`/submission state |
| Partial/missing evidence | neutral hatch or broken outline | `Partial evidence` or `Missing evidence` |
| Selected object | primary outline and selection halo | object type, label, and stable ID in inspector |
| Visually exaggerated geometry | persistent corner label | `Visually exaggerated [factor]x` plus reset action |

Forecast violet is a data-lineage encoding, not a selectable product theme.
Mixed lineage uses a labeled multi-source icon or stacked marks, not an
unexplained blended color.

Alert workflow state is primarily expressed in the list and inspector. The map
does not invent a red-to-green severity ramp. If the Engine later publishes a
bounded priority vocabulary, that vocabulary needs a separately approved
legend and contract before map styling uses it.

## 11. Visible state and component patterns

### 11.1 State badges

Badges are short, sentence-case labels with an icon when the state matters
outside its immediate row. Use filled quiet surfaces for stable states and
outlined badges for provenance or draft ownership. Do not stack more than three
badges in a summary; move additional metadata into labeled rows.

Required vocabularies come directly from the pilot workflow contract:

- lineage: Observed, Forecast, Synthetic, Mixed;
- ownership: Local draft, Submitted input, Engine-validated evidence;
- method: Screening estimate, Surrogate result, Exact model result;
- completeness: Complete, Partial evidence, Missing evidence, Calculation
  failed;
- fidelity: Schematic, Approximate, Source-derived, Survey-grade;
- workflow: New, Acknowledged, Investigating, Handed off, Resolved, Dismissed,
  Superseded; and
- visual treatment: True scale or Visually exaggerated `[factor]x`.

### 11.2 Banners

Use an inline banner only for state that affects interpretation of the whole
current surface: disconnected data, stale monitoring, local draft, partial
evidence, or visual exaggeration. Banners name the state, affected data, as-of
time, and available action. They do not obscure map controls or stack more than
two high; additional issues consolidate into Diagnostics.

### 11.3 Loading and stale data

- Preserve the last valid scene when safe and mark it with its as-of time.
- Skeleton only the surface being fetched; do not blank the whole application.
- Never show `0 alerts`, `0 assets`, or `Healthy` while the source is unknown.
- A stale surface remains inspectable but disables actions whose preconditions
  cannot be revalidated.
- Retry actions are component-specific and idempotent.

### 11.4 Destructive and consequential actions

- Acknowledge and assign do not use confirmation dialogs; provide audit state
  and appropriate undo/reassignment behavior from the backend contract.
- Scenario submission always has an explicit review step.
- Cancelling an eligible run confirms the exact run and consequence.
- Discarding a dirty local draft confirms loss.
- Recording a handoff presents a final immutable preview.
- No control is styled or worded like grid equipment operation.

### 11.5 Empty states

Empty states remain compact and explain whether the reason is no data, current
filters, no permission, or unavailable service. A no-alert state says
`No alerts match these filters` or `No published alerts in this period`, never
`The region is safe`.

## 12. Role-aware UI exposure

The backend remains authoritative. The shell applies the workflow contract as
follows:

| Surface or action | Operator | Supervisor | Engineer / analyst | Administrator |
| --- | --- | --- | --- | --- |
| Live destination | Yes | Yes | Read-only evidence | Scoped diagnostics only unless separately granted |
| Alert acknowledgement / assignment | Yes | Yes | No | No |
| Scenario and run workflow | Yes | Yes | Yes | No |
| Record disposition | Yes | Yes | Comment only | No |
| External decision reference | No | Yes | No | No |
| Expert GIS transition | No | Grant only | Yes | Grant only |
| Administration | No | No | No | Yes |

When an action is not allowed and explaining it helps the workflow, show a
disabled control with the reason or a read-only state. When exposing it would
leak capability or protected data, omit it. All mutation failures from changed
permissions are handled without losing current evidence context.

## 13. Expert GIS transition

Authorized users select `Open Expert GIS workspace` from the user/system menu.
The transition:

1. checks the server-granted expert capability;
2. preserves the current region, camera target, stable selection, and evidence
   context;
3. changes the route to `/workspace`;
4. replaces the Digital Twin header and evidence footer with GeoLibre's existing
   toolbar and status bar;
5. applies the role's approved GeoLibre UI profile and data/export grants; and
6. shows a persistent `Expert GIS` mode label plus `Return to Digital Twin`.

Returning restores the Digital Twin route and shared context. Unsupported
expert layers may remain in the expert project but cannot silently become
operational evidence.

The pilot disables Python, Jupyter, unrestricted SQL, arbitrary plugins,
unapproved uploads, direct storage browsing, and unapproved export exactly as
defined in the workflow contract.

## 14. Accessibility and keyboard contract

The required workflow targets WCAG 2.2 AA.

- Provide skip links to primary navigation, operations panel, world, and
  evidence inspector.
- Use header, nav, main, complementary, and footer landmarks with unique labels.
- Keep focus order consistent with the visual order: header → left panel → map
  controls/world summary → right inspector → replay → footer.
- Opening a selected object moves focus only when the user invoked an explicit
  open action; passive map/list synchronization does not steal focus.
- Every map-only result has an equivalent list, search result, or evidence row.
- Use `aria-live="polite"` for new alert and connection announcements. Do not
  repeatedly announce replay ticks while playback is running.
- Tooltips supplement, not replace, accessible names.
- Maintain 4.5:1 text contrast and 3:1 meaningful non-text contrast.
- Preserve GeoLibre's two-pixel theme-aware focus ring.
- Support reduced motion, high browser zoom, Windows high-contrast/forced-color
  checks, keyboard-only use, and screen-reader review.
- Map keyboard help is reachable from the canvas and the global help menu.

Suggested shortcuts, subject to collision review with GeoLibre:

| Shortcut | Action |
| --- | --- |
| `/` | Focus product search |
| `g l` | Go to Live |
| `g s` | Go to Scenarios |
| `g r` | Go to Runs |
| `[` / `]` | Previous / next published tick when replay is focused |
| `Space` | Play/pause only when replay controls own focus |
| `Esc` | Close transient overlay or clear leaf selection, one layer at a time |

Do not override browser, assistive technology, or existing GeoLibre global
shortcuts without an explicit migration.

## 15. Content style

Use direct, factual sentences. Prefer `The Engine has not supplied uncertainty`
to `N/A`, and `Monitoring has been stale since 10:42 MDT` to `Warning 42`.

Approved persistent and repeated copy:

- `Decision support only. This application does not operate grid equipment or
  replace utility switching procedures.`
- `Review required. The Engine produced this alert using policy [version]; a
  person must evaluate the evidence and current field conditions.`
- `Synthetic changes are not monitored evidence.`
- `No alerts match these filters.`
- `Evidence is incomplete. Missing components are listed.`

Use sentence case for buttons, tabs, titles, and badges. Use local time with time
zone for operator-facing timestamps and make UTC available in details/copy.
Relative time always sits beside or reveals an absolute time.

Prohibited without a later approved Engine contract:

- safe / unsafe;
- must shut off / should shut off;
- will ignite;
- exact fire perimeter; and
- client-authored low / medium / high risk.

## 16. Performance and resilience design

The UI is designed around the complete pilot inventory, not a reduced demo.

- The overview becomes interactive within 3 seconds on the qualified network
  and workstation.
- Normal navigation targets 60 FPS with a 30 FPS hard floor.
- Lists use virtualization when durable rows exceed a measured threshold.
- Asset geometry streams progressively by region, extent, zoom, and fidelity.
- Selection, alert geometry, and evidence load ahead of low-value context.
- Panel opening does not rebuild the map or duplicate renderer state.
- Plan/3D switching may show a bounded transition state while retaining the
  previous evidence panel.
- Event-stream reconnect uses resumable identity plus authoritative REST
  reconciliation; the UI never fabricates continuity.
- Long work exposes stage and last update without fake progress.

## 17. Implementation seams in the current GeoLibre codebase

This design should be implemented as first-party React code, not another
imperative demo plugin.

| Current GeoLibre seam | Digital Twin use |
| --- | --- |
| `DesktopShell` | Extract or inject shell regions so Digital Twin and Expert GIS share one map/workspace foundation |
| `TopToolbar` | Keep for Expert GIS; use a dedicated `DigitalTwinHeader` in product mode rather than adding more conditionals to the 1,200+ line toolbar |
| `SharedSidebar` and right-panel sizing | Reuse the 44-pixel rail, mutual exclusion, resize limits, and state preservation for typed first-party operations/evidence panels |
| `MapCanvas`, `CesiumCanvas`, `MapGrid` | Reuse renderers; keep the pilot at one pane and provide an in-place Plan/3D switch |
| `StatusBar` | Keep for Expert GIS; compose a matching `DigitalTwinStatusBar` for caveat, freshness, connection, and diagnostics |
| `@geolibre/ui` | Reuse buttons, inputs, menus, dialogs, tables, tooltips, labels, scroll areas, and focus behavior |
| theme schemes and `globals.css` | Inherit light/dark and accent tokens; add a small semantic status-token layer only |
| UI profiles | Limit authorized expert-workspace tools; do not use profiles as security or as the Digital Twin product boundary |
| command registry/palette | Expose a product-scoped command set in Digital Twin mode and the existing expert set in Expert GIS |

Recommended component boundary:

```text
AppRouteBoundary
├── AccessResolution
├── DigitalTwinShell
│   ├── DigitalTwinHeader
│   ├── OperationsPanel
│   ├── TwinWorldViewport
│   ├── EvidenceInspector
│   ├── ReplayDock
│   └── DigitalTwinStatusBar
└── ExpertGeoLibreShell
    └── existing DesktopShell composition
```

World selection, route state, alert/run/scenario resources, and authorization
should be typed application services. React components render those services;
they do not parse private Engine references or infer business decisions.

## 18. Design validation matrix

Before implementation sign-off, produce high-fidelity prototypes for:

1. Live operations, healthy, with no selected alert;
2. Live operations with new alerts and one Engine-supplied priority category;
3. disconnected/stale monitoring while last valid data remains visible;
4. alert investigation in plan view with complete exact evidence;
5. alert investigation in 3D with partial/approximate and exaggerated evidence;
6. local scenario draft, invalid review, and ready-to-submit review;
7. queued, active, failed, and completed run states;
8. replay with baseline/current toggle and a missing tick/object state;
9. handoff composer and recorded read-only handoff;
10. operator, supervisor, engineer/analyst, and administrator navigation;
11. Digital Twin ↔ Expert GIS transition;
12. light and dark themes at 1920 × 1080 and 1366 × 768;
13. 200% browser zoom, keyboard-only, reduced motion, and screen-reader paths;
14. 50,000-tree qualification data at regional and inspection zooms; and
15. loading, empty, partial, failed, expired-session, and unauthorized states.

Moderated pilot-user validation must confirm that at least 90% of participants
can:

- acknowledge a new alert within 30 seconds;
- locate the affected line and return to regional context;
- distinguish observed, forecast, synthetic, approximate, exact, incomplete,
  and failed evidence;
- distinguish an Engine alert from a switching command;
- identify grid operations as the decision owner; and
- record a stable handoff within 2 minutes after completing review.

## 19. Explicit exclusions

- Ranked or scored monitoring invented in the Frontend.
- Switching, SCADA, ADMS, OMS, crew dispatch, evacuation, or public-warning
  controls.
- Profile, schematic, split-screen, swipe, or side-by-side viewports.
- A default general-purpose GIS menu for operators.
- Mobile/tablet qualification or native desktop-specific UI.
- Canonical asset editing from the operator workflow.
- Decorative 3D geometry presented as evidence.
- Unlabeled color-only status, risk, lineage, or fidelity.
- A separate Digital Twin font, gradient brand, glassmorphism theme, or card-grid
  dashboard.
- Demo fallback data presented as live monitoring.

## 20. Spec approval gate

This UI specification is ready to implement only when:

- product confirms workflow, vocabulary, and explicit exclusions;
- design approves the high-fidelity validation matrix in light and dark modes;
- engineering confirms the first-party shell and shared-world state boundaries;
- security approves role exposure, deep-link behavior, diagnostics, and Expert
  GIS transition;
- the Engine team supplies or schedules the public alert/evidence contracts
  required by the pilot workflow contract; and
- one representative grid operations user completes the moderated core flow
  without mistaking the product for a switching control.
