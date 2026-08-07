---
title: Define the pilot operator workflow and product frame
type: prototype
label: wayfinder:prototype
status: open
parent: map.md
blocked_by: []
mode: HITL
---

## Question

Which utility role, decision handoff, operating mode, view set, data fidelity,
reference hardware, and approved evidence language define the first production
pilot, and which PRD P0 journeys must that pilot prove end to end?

## Draft resolution

The proposed product frame is documented in
[`../../pilot-workflow-contract.md`](../../pilot-workflow-contract.md).

The primary user is a grid operations operator. Live monitoring is the pilot's
main mode: the Engine evaluates real weather, owns threshold and aggregate-risk
truth, starts or updates autonomous simulations, and publishes durable alert
evidence. Manual scenarios and historical replay support investigation. Grid
operations owns any keep-energized or de-energize decision outside the
Frontend; the pilot does not issue switching commands.

This ticket remains open until the approval table in the workflow contract is
complete. In particular, the pilot is blocked on a bounded public Engine
projection for alerts and risk evidence; internal threshold-decision records
must not be exposed directly or reconstructed in the Frontend.

## Exit evidence

- [x] Primary operator and operational decision owner named.
- [x] Live, historical, and manual-scenario modes bounded.
- [x] Required and deferred views named.
- [x] Browser, identity, deployment, and reference workstation defaults named.
- [x] Visible evidence and visual-exaggeration language proposed.
- [x] Expert GIS access bounded by role.
- [x] Initial real-region qualification volume and geometry rules named.
- [x] Required screens, role/action matrix, and measurable outcomes drafted.
- [ ] Product approval recorded.
- [ ] Design and accessibility approval recorded.
- [ ] Frontend and Engine engineering approval recorded.
- [ ] Security approval recorded.
- [ ] Representative grid operations user approval recorded after walkthrough.
