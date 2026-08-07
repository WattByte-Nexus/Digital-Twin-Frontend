---
title: "Wayfinder: Convert the GeoLibre fork into a first-party Digital Twin platform"
type: map
label: wayfinder:map
status: open
---

## Destination

Produce an implementation-ready, UI-first route for converting this GeoLibre
fork into a first-party Digital Twin operator platform, with typed source
ownership, stable world interaction, Engine integration, migration gates, and
explicit pilot scope.

## Notes

- Source requirements: `docs/digital-twin-product-requirements.md`.
- General roadmap: `docs/digital-twin-first-party-platform-plan.md`.
- Child tickets live beside this file and are ordered with UI/product decisions
  first, then implementation decisions.
- Preserve GeoLibre as the geospatial foundation and authorized expert
  workspace.
- Treat `apps/geolibre-desktop/public/plugins/digital-twin-demo/dist/index.js`
  as generated migration input, not source.
- Use Wayfinder, domain modeling, and the relevant design or research skill
  while resolving tickets.
- This map plans the work. Do not implement the destination while resolving a
  decision unless a ticket explicitly calls for a throwaway prototype.
- GitHub Issues is disabled for this repository as of 2026-07-31, so this map
  uses the Wayfinder local-Markdown fallback.

## Decisions so far

- The pilot's primary user and operational decision owner are grid operations.
- Live monitoring is the primary pilot mode. Historical replay and bounded
  manual scenarios support investigation.
- The Engine owns weather-driven orchestration, threshold policy, aggregate
  risk, alert identity, and durable evidence. The Frontend must not recreate
  those decisions.
- The Frontend supports an external keep-energized or de-energize handoff but
  never sends a switching command.
- Plan and 3D perspective views with synchronized selection are required;
  profile and side-by-side views are deferred.
- The draft product frame, screens, permissions, evidence language, scale, and
  success measures live in
  [`../../pilot-workflow-contract.md`](../../pilot-workflow-contract.md).
- The draft first-party shell, information architecture, coordinated-world
  interactions, visual language, screen states, and validation matrix live in
  [`../../digital-twin-ui-spec.md`](../../digital-twin-ui-spec.md).

## Not yet specified

- Detailed implementation epics and milestone sizing after the pilot product
  frame, feature-state boundaries, Engine contract strategy, renderer strategy,
  and migration/build strategy are resolved.
- Ranked decision-support work after matching Engine aggregation and physics
  contracts exist.
- Long-term upstream synchronization policy after the required first-party host
  seams are known.

## Out of scope

- Autonomous grid control, dispatch, evacuation, or public warnings.
- Reimplementing Engine physics, collision, wildfire, aggregation, or
  authorization in the browser.
- Silent client-side editing of canonical infrastructure.
- Treating demo fallback behavior as production readiness.
