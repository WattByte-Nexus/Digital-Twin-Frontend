---
title: Define the coordinated twin workspace interaction contract
type: prototype
label: wayfinder:prototype
status: open
parent: map.md
blocked_by:
  - 01-define-pilot-operator-workflow.md
mode: HITL
---

## Question

How must plan, 3D, profile, detail, search, selection, isolation, camera, lens,
timeline, and deep-link interactions coordinate so that users experience one
world with one stable object identity?

## Draft resolution

The pilot interaction contract is specified in
[`../../digital-twin-ui-spec.md`](../../digital-twin-ui-spec.md), especially
sections 5, 8, and 10.

- The pilot has one application-level selection hierarchy: region, workflow
  context, world object, evidence item, and immutable tick.
- Plan and 3D are in-place peer views that preserve stable selection, time, and
  a semantically equivalent camera target.
- Search, map/3D picking, alert rows, related-object links, and evidence links
  update the same selection model.
- Replay updates world and evidence together and displays only Engine-published
  ticks. Baseline/current comparison uses one canvas.
- Stable IDs—not names, approximate coordinates, feature indexes, or private
  artifact references—drive selection and deep links.
- Profile, schematic, lens, split-screen, and side-by-side viewports are
  deferred from the pilot.

The ticket remains open until the stable public object identities, renderer
camera mapping, and deep-link schemas are confirmed during implementation
design.
