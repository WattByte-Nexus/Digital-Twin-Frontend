# Point-cloud release record

The user authorized deployment of the LOD fixes and rebuilding existing datasets.
Coloring is explicitly deferred. API endpoint/descriptor shapes are unchanged;
submission runtimes must use the same builder recipe as Batch.

## Isolated releases

- Frontend: [PR 16](https://github.com/WattByte-Nexus/Digital-Twin-Frontend/pull/16),
  checkout `/tmp/point-cloud-lod-release-frontend`. Based on the live frontend,
  then rebased onto main `8ac61b0bee565d3b35eb9c4765538ebd9bc10cc4`.
  Retains deployed deck.gl 9.4.1 and loaders.gl 4.5.4; package lock unchanged.
  The relevant traversal source is byte-identical to 4.4.3, and the install
  patch validates the deployed version plus exact TS/ESM/CJS hashes.
- Engine: [PR 12](https://github.com/WattByte-Nexus/Digital-Twin-Engine/pull/12),
  checkout `/tmp/point-cloud-lod-release-engine`. Only recipe-12 builder/schema,
  tests and documentation changes; no account-management or dev changes.

## Initial preparation (superseded by activated receipts below)

The isolated frontend passed 13 traversal/install tests, 23 lifecycle/surface
tests, TypeScript, focused ESLint and the production build. The first container
CI run found that the new patch script needed copying before `npm ci`; the
Dockerfile is corrected and CI was restarted. The optional Claude review job
cannot run because its repository API credentials are absent.

The isolated Engine passed 66 focused regressions and source-package validation.
Its source archive was built from verified live Batch baseline
`d8282b36bbb706a50a641896055cadf77fdb485e` plus the five reviewed PC2 files:

- SHA-256: `03d7cc8b69b7ae66a9016d7fc4d6fed85693bf6ce035ce2bb14fda5d1d2f28a1`.
- Local archive: `/tmp/point-cloud-lod-release-artifacts/source.zip`.
- Private release object: `point-cloud-build-source/03d7cc8b69b7ae66a9016d7fc4d6fed85693bf6ce035ce2bb14fda5d1d2f28a1.zip`.
- S3 version: `6SJCMoyBujv5Q8g1kqvw1CeO2E4aNCMV`.
- Local image: `digital-twin-point-cloud:recipe12-03d7cc8b` (Linux AMD64).

CodeBuild rejected account admission (`Cannot have more than 0 builds in queue`).
The documented local Docker fallback passed the pinned classifier, PDAL-driver,
CLI and network-isolated recipe-12 checks. This preparation image was superseded by the final image below.

## Pre-activation findings

AWS authentication was refreshed and verified. Frontend PR16 is merged; its
Amplify workflow is `42271357727`. All ten applicable PR checks passed; two
deployment/publication checks were skipped on the PR. The optional Claude review
failed because its repository credentials are absent.

Read-only live inspection found that the preceding recipe-11 whole-capture build
never published. Batch job `655f6fc6-940a-4beb-94f1-2c24c7d5ab2e` is `FAILED`
with `Job attempt duration exceeded timeout` (exit 137). Its final log milestone
was crown partition selection. The accepted whole survey still serves recipe10,
50,878,574 source points, version
`b1467b8b8af414b3b27aa877bb27e2092b369a88c8c6e1a0def2c55159bdca8a`.
The separate `golden-lidar` survey serves recipe9 with 9,024,136 source points.
No queued/building records remained at inspection. Before retrying the timed-out
workload, an exact-output-equivalent partition grouping fix was tested in PR12.

## Activation prerequisites

Other chats have concurrent hosted-role/dev releases, so reread
live revisions immediately before activation and preserve their configuration.

Keep the Batch image, submission runtime recipe identity and workflow job
definition consistent. Verify no queued/building work before the recipe switch.
Use current Aurora registrations and accepted policy/source fingerprints for
rebuilds; the local YAML registry predates the active whole-georeferenced survey
and must not be treated as authoritative for its replacement. Preserve active
survey history and selection. Verify new manifests, native point counts, leaf
structure and publication pointers before reporting dataset completion.

## Activated release receipts

- Frontend commit `6159e81d21f66b5095e9f9a46ed19edad1703ff2`; Amplify workflow
  `42271357727` completed successfully.
- Engine PR12 merged as `4cb8c6df11362a993135fae7f0924929d62c8ccd`; CI
  `42273427535` passed, including the production worker rollout.
- Final Batch source archive SHA-256
  `1e6c63043e7b856ef1bc9f33975a0c4f854222153b24e8422af3f0ff32448aca`,
  private S3 version `tbgxxSvt5Xvu4Xup7H94ZNzgidEzXhQJ`. This supersedes the
  preparation archive and includes the reviewed stable partition grouping fix.
- Batch image digest
  `sha256:d2d3e8de7ed6d770afa9920bfce703b3db2ea73d55c13317bec09a9ec48af2af`;
  active job definition revision 5. Workflow and SubmitJob IAM pin revision 5.
- API image digest
  `sha256:5c2cd655154db9f1b556b7622647a45a0696d3368ec9a08576d3a1b8eba7a6ae`,
  published by workflow `42273427304`; ECS revision 8 completed with two running
  tasks. Network-isolated execution of this exact image confirmed recipe12.
- Dispatch was paused using two reviewed Terraform updates, with no running or
  queued builds. The Batch switch updated exactly three resources. Both relay
  and dispatch are enabled again. The canonical ignored Terraform image input
  was updated without changing other applied inputs.

The grouping fix passed 71 focused tests and independent review. A local
250,000-point, 14,336-cell partition fell from 25.03s to 4.10s (6.10x), with exact
leaf bytes. All 52 files of a complete 5,000-point hierarchy also matched. This
is a local benchmark, separate from the measured production timings below.

The selected whole survey was accepted for rebuild at 18:52 UTC, lineage
`fd01e27127a27a02a67e1c25daf0a6ceba704258ffddede691486ed9c117d7c8`, retaining
the exact source, policy, request and previous active version as its parent.
The inactive historical `golden-lidar` survey was deliberately not rebuilt:
existing publication semantics would make it the selected region dataset.
The rebuild and independent native point-count verification have now succeeded.

The first attempt succeeded as execution
`ea2c106ad74048da9c90c08440b5e260`, Batch job
`a9dedce7-8a64-41c6-9349-cca31f7d082c`. Its deployed revision/image were checked,
and source preparation retained exactly 50,878,574 points. The old publication
contains 6,054,638 native crown points, 243 crown tiles and 183 leaves. S3 HEAD
confirmed that its `full/tileset.json` is absent (404), explaining why it cannot
satisfy the newer Full scan view. Recipe 12 published both views, which passed independent verification.

The final targeted Terraform plan returned exit code 0 (no changes). Public live
smoke checks passed again after the API switch. Signed-in visual verification
still requires the user's browser session; the opened Cognito tab awaits login.

### Production build milestones

- Semantics completed at 19:15:47 UTC: 6,054,638 crown points and 1,702 assets
  (1,657 trees, 44 poles, one wire), matching the prior accepted source results.
- Crown partition completed at 19:16:56 UTC in 11.61s: 183 leaves, depth 7,
  maximum 98,796 points per leaf.
- Full partition completed at 19:28:02 UTC in 179.14s: 50,878,574 native points,
  1,768 leaves, depth 8, maximum 98,915 points per leaf.

These are directly measured new phase timings. The previous failed run did not
log a separate full-partition duration, so no production phase speedup ratio is
claimed from its overall two-hour timeout. Final publication succeeded.


## Completed rebuild and independent verification

The selected whole survey is now ready and active at recipe 12. The Batch job
succeeded with exit code 0 on its first attempt in **44m01s**; manifest build
duration was **37m21s**, excluding publication. The workflow succeeded at
19:37:50 UTC. The ledger, active pointer and successful execution were confirmed
at 19:38:16 UTC on November 6, 2026.

| View | Native points | Leaf tiles | All content tiles |
| --- | ---: | ---: | ---: |
| Full scan | 50,878,574 | 1,768 | 2,233 |
| Tree crowns | 6,054,638 | 183 | 243 |

Independent verification read every referenced PNTS header and object length,
checked leaf limits and refinement structure, and confirmed the source
fingerprint and availability-marker checksum. All 243 crown PNTS files have
identical SHA-256 hashes to the previous recipe-10 publication; URI sets also
match. This preserves existing crown geometry and RGB exactly. Full-scan
payload checksums were not recomputed.

Semantic output contains 1,702 assets: 1,657 trees, 44 poles and one wire,
matching the preceding semantic result. Combined regional asset inventory also
contains other sources and therefore has different totals.

- [Independent publication verification](point-cloud-evidence-2026-11-05/production-rebuild-verification.json)
- [Completed execution and active-pointer receipt](point-cloud-evidence-2026-11-05/production-rebuild-completion.json)

All 43 monitoring snapshots preserved dataset selection and the expected active
pointer. Historical `golden-lidar` retained its active/latest version
`38e837d6ee685c4c5be8e3073b985b11fc454229d630b102e6f427bd8cc35f6d`.

Authenticated visual rendering, first-draw timing and FPS remain unverified:
the dedicated browser tab still awaits login. Artifact and algorithm
measurements do not establish Neara-equivalent visual quality or browser
performance. Public smoke checks verified the explicit Cognito flow; the
inspected account UI sign-in link omitted its required `frontendOrigin`
parameter. That separate account UI issue was not modified in this release.
Private delivery and authorization behavior were retained; CDN changes and
coloring remain deferred.
