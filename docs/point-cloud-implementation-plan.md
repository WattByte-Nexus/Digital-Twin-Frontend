# Point-cloud implementation plan

Date: November 5, 2026
Basis: [investigation](research/point-cloud-investigation-2026-11-05.md)

## Outcome

Make the existing MapLibre/deck.gl path fast for small clouds, correct its large-cloud refinement, and provide a deliberate path to vegetation risk coloring. Preserve native geometry and the single shared map/depth scene. Avoid a second small-cloud loader or a renderer migration.

Both repositories have unrelated ongoing edits. Each task owns separate files; integration preserves existing changes. The initial phase covered local implementation. The user subsequently authorized deployment and rebuilding the selected survey; isolated release checkouts preserved concurrent role and development work. See the [release record](research/point-cloud-release-2026-11-06.md) for verified deployment identities, completed rebuild evidence, and the remaining authenticated browser check.

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

## Risk-coloring phase: contract required before implementation

The existing geometry contains XYZ/RGB only. Segmentation computes tree instances
but drops membership when writing the point spool. The current frontend risk
display uses demonstration values; no production per-tree or per-point score
endpoint has been identified. Adding invented scores or an unused public schema
would not deliver the requested feature.

Confirm tree-level versus within-tree point-level scores and the authoritative
score producer before PC4 starts. For tree-level scores, the implementation is:

1. Carry a compact tree index through segmentation, leaf partitioning and preview
   sampling. Define an explicit unclassified value and a versioned lookup to the
   published tree asset ID. Check exact correspondence in both views and every LOD.
2. Coordinate the tile profile and decoder. The installed PNTS decoder's
   `BATCH_ID` path assumes a `dimensions` batch-table field, so simply adding
   tree IDs is insufficient. Round-trip the chosen profile through the actual
   browser decoder before extending publication contracts.
3. Connect a real score map keyed by dataset/version/tree identity. Preserve
   native RGB and use a score lookup/color ramp so changing thresholds or scores
   does not reload positions. Define absent scores explicitly rather than
   silently treating them as low risk.
4. Add the product control and legend through shared UI primitives. Verify
   identical tree colors across parent/child transitions, unchanged geometry
   requests when recoloring, and no stale scores across dataset versions.

Point-level scores instead require stable point identity or a spatially defined
score function; tree membership alone cannot represent within-crown variation.

## Delivery assessment

PC5 inspection confirmed the existing signed-cookie path and version-scoped
policy issuer. The checked configuration uses `api_proxy`, whose per-request
authorization and `private, no-store` responses are intentional. The production
CDN/domain/key configuration needed for direct signed delivery is outside the
verified local implementation. No cache-header or authorization relaxation is
appropriate here.

Enable direct delivery only after verifying the CDN trusted key, private S3
origin, shared cookie domain, credentialed requests/CORS and expiry refresh.
Acceptance must include allowed/denied principals, version-prefix confinement,
expired grants, fresh-object caching and revoked-user behavior. Changing this
mode is an infrastructure rollout, separate from the completed local LOD fixes.

## Status

- PC1: implemented and independently reviewed. Pinned install patch is
  idempotent and validates source/version; 13 focused tests pass.
- PC2: implemented and independently reviewed. Root admission respects point,
  payload and measured coordinate-precision limits. Builder recipe is 12;
  71 focused regressions pass after the additional partition recovery below.
- PC3: implemented and independently reviewed; 12 lifecycle tests pass, including
  real deck state transfer and the initial tileset-load callback.
- PC4: explicitly deferred by the user; no risk UI or score schema has been added.
- PC5: assessment complete; production signed-delivery prerequisites remain.
- PC6: focused integration and TypeScript/lint checks pass. Full frontend suite:
  3,607 passed, one skipped, one unrelated Linux AppStream generation failure
  because its script requires GNU `date -d` on this macOS host. Engine delivery,
  catalog, workflow and state regressions: 79 passed (some overlap with the
  Engine agent's related regression run). Ruff and formatting checks pass.

## Measured result and rollout

The [saved after measurements](research/point-cloud-evidence-2026-11-05/octree-after-result.json)
use the same deterministic synthetic 20 m cube and production point caps.

| Native points | PNTS files before → after | PNTS bytes before → after |
| --- | --- | --- |
| 10,000 | 9 → 1 | 301,656 → 150,184 |
| 50,000 | 9 → 1 | 1,501,648 → 750,184 |
| 100,000 | 9 → 1 | 2,251,680 → 1,500,184 |
| 250,000 | 9 → 9 | unchanged |
| 1,000,000 | 73 → 73 | unchanged |

The traversal reproduction requests eight cold siblings in the first pass and
settles in pass two, versus pass nine previously. These are deterministic
structural improvements, not production wall-clock or FPS claims. Native points
and RGB are retained. No new renderer or alternate small-cloud code path was added.

Install the frontend normally so postinstall applies the verified dependency
patch, then deploy the frontend and recipe-12 Engine through the normal release
process. Re-enqueue registered captures to publish new immutable versions; old
artifacts will retain their old subdivision. Verify the actual full-scan and
crown views separately, including a small capture, a wide sparse capture and a
large survey. Record first draw, target-detail time, network concurrency,
frame-time distribution and parent retirement with authenticated access. No
production rendering/FPS claim is supported by the local measurements alone.

## November 6 deployment and partition recovery

The prior 50.9-million-point recipe-11 build was confirmed failed by its two-hour
Batch timeout. Its last milestone was crown partition selection. Partitioning
performed a full-chunk equality mask for every occupied fine cell. Replacing
that repeated work with stable grouping preserves chunk order, lexicographic
cell order and source order within each cell, including cells sharing a leaf.

The [partition benchmark](research/point-cloud-evidence-2026-11-05/partition-recovery-benchmark.json)
measured 25.03s to 4.10s on a local 250k-point/14,336-cell chunk, with identical
leaf bytes. A complete 5k-point hierarchy matched all 52 artifact files. The
change passed 71 focused regressions and independent review; memory remains
bounded by the configured chunk. The production Batch job subsequently succeeded on its first attempt in 44m01s; full-scan partitioning took 179.14s.

Frontend PR16 and Engine PR12 are merged. The frontend, API and Batch recipe12
are deployed; public deployment smoke checks pass. The currently selected
whole survey has been rebuilt and its recipe-12 publication is active. Independent
verification counted all 50,878,574 full-scan points and 6,054,638 crown points
from every leaf PNTS header. All 243 crown PNTS files match the previous
publication byte-for-byte. The inactive older survey stays unchanged because
publication would otherwise select it. Authenticated browser rendering and
FPS checks remain unverified: the dedicated browser tab still awaits login.
Coloring and CDN configuration remain deferred.
