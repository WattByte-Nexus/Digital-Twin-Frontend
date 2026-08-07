---
title: Choose the generated-plugin build and strangler migration strategy
type: grilling
label: wayfinder:grilling
status: open
parent: map.md
blocked_by:
  - 05-choose-package-and-host-boundaries.md
  - 07-select-engine-contract-strategy.md
  - 08-select-renderers-and-scene-budgets.md
mode: HITL
---

## Question

How will typed first-party source generate the compatibility plugin, will built
artifacts be committed or release-only, which characterization tests freeze the
demo behavior, and what incremental cutover retires duplicated client, state,
panel, and renderer code without a big-bang rewrite?
