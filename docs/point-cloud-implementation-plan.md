# Point-cloud implementation plan

Date: November 5, 2026
Basis: [investigation](research/point-cloud-investigation-2026-11-05.md)

## Outcome

Make the existing MapLibre/deck.gl path fast for small clouds, correct its large-cloud refinement, and provide a deliberate path to vegetation risk coloring. Preserve native geometry and the single shared map/depth scene. Avoid a second small-cloud loader or a renderer migration.

Both repositories have unrelated ongoing edits. Each task owns separate files; integration preserves existing changes. No production deployment, dataset rebuild, or access-policy switch is part of local implementation. Changes stay uncommitted because shared files already contain other work.

## Execution order

| Task | Owner | Work | Acceptance |
| --- | --- | --- | --- |
| PC1 | Traversal subagent | Backport the upstream sibling-discovery correction to installed loaders.gl through a reproducible, pinned install patch | Eight unloaded siblings discovered together; retain parent coverage and bounded requests; patch applies on clean install and fails clearly on unexpected source |
| PC2 | Engine subagent | Allow a root leaf within existing point/payload limits; update validation and immutable build identity | Small clouds have one PNTS, no previews, zero root error; native points/RGB preserved; empty and larger hierarchies still validate |
| PC3 | Frontend lifecycle subagent | Move tileset-dependent traversal/readiness/diagnostic state into the retained layer lifecycle | Same-ID/same-URL layer updates preserve elevation, readiness and diagnostics; actual version changes reset appropriately |
| PC4 | Parent integration, then bounded subagents | Establish tree ID and risk-color contract against current analytical outputs | Tree membership survives all LODs; colors change without geometry requests; source RGB remains available; unknown scores distinct |
| PC5 | Parent | Assess and implement safe local delivery improvements using existing private CDN infrastructure where complete | Authorization, version scope, credentials and caching validated; no public caching of permission-sensitive API responses |
| PC6 | Parent and reviewer | Integrate, run focused regressions and broader checks, replay synthetic measurements, review task-specific changes | Evidence distinguishes proven improvements from production-only validation; report remaining deployment prerequisites |

PC1–PC3 run concurrently with disjoint ownership. PC4 starts after the metadata contract is established and those file owners finish. Tree-level versus point-level risk will follow the user's input; no artificial risk values enter the product. PC5 must not silently weaken the current permission contract or switch live traffic.

## Validation

- Test traversal discovery, loaded-parent coverage, nested branches and request-volume boundaries against the actual dependency.
- Test lifecycle updates with retained deck state, unchanged URLs, changed versions, repeated readiness, and diagnostic callbacks.
- Build synthetic 10k/50k/100k clouds and verify one content tile when within the current limits; exercise above-limit and empty datasets.
- Run Engine point-cloud builder/validation/publication tests and frontend point-cloud/map-surface tests, followed by relevant lint/type checks.
- For coloring, round-trip the actual encoder/decoder attributes and verify per-tree correspondence across LOD and color updates without replacing position buffers.
- Use a focused independent code review; inspect runnable browser behavior where available. Production loading/FPS requires authenticated access and rebuilt artifacts.

## Status

- Plan prepared; PC1–PC3 ready for dispatch.
- Risk-color granularity question pending; independent performance work proceeds.
