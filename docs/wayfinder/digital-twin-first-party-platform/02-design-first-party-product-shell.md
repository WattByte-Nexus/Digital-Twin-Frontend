---
title: Design the first-party Digital Twin shell and expert-workspace transition
type: prototype
label: wayfinder:prototype
status: open
parent: map.md
blocked_by:
  - 01-define-pilot-operator-workflow.md
mode: HITL
---

## Question

What information architecture, startup route, global status, navigation,
branding, role-aware tool visibility, and transition into the advanced GeoLibre
workspace make Digital Twin the primary product rather than a decorated plugin?

## Draft resolution

The first-party shell is specified in
[`../../digital-twin-ui-spec.md`](../../digital-twin-ui-spec.md), especially
sections 3–7, 12–13, and 17.

- Digital Twin is the default product mode for operational roles, with Live,
  Scenarios, and Runs as its primary navigation.
- The product replaces the general GeoLibre toolbar with a compact operations
  header while reusing the map, rails, panels, tokens, primitives, and
  accessibility behavior.
- A 28-pixel evidence footer keeps the decision-support caveat, freshness,
  connection, and diagnostics visible.
- Expert GIS is an explicit route- and permission-level transition that
  preserves region, camera target, stable selection, and return context.
- UI profiles constrain the expert workspace but are neither authorization nor
  the Digital Twin product boundary.

The ticket remains open until the high-fidelity validation matrix and
cross-functional approval gate in the UI specification are complete.
