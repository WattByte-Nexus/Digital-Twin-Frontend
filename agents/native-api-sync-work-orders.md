# Native API synchronization — agent work orders

User authorization: implement the approved native UI/API synchronization plan using GPT-6.1 Sol agents at high reasoning, including Engine changes. This file defines active work, not a follow-up queue.

Status: all three agent implementations are integrated and verified in the working trees. See the [final implementation report](../docs/native-api-sync-implementation-2026-10-09.md) for results, preserved baseline failures, and outstanding deployment requirements. The scope definitions below record the instructions issued before delegation.

## Shared scope and rules

- Read `docs/native-ui-api-sync-plan-2026-10-09.md` and `docs/frontend-api-coverage-audit-2026-10-09.md` before implementing. The target is `App.tsx → DigitalTwinMapWorkspace`, not a demo plugin or Expert GIS.
- Frontend root: `/Users/luke/Documents/Digital_Twin_Frontend`. Engine root: `/Users/luke/Documents/Digital_Twin_Engine`.
- Read each repository's AGENTS.md and `/Users/luke/.codex/RTK.md`. Prefix shell commands with `rtk`. Engine edits require its ARCHITECTURE.md and nearest README, logging/docstring rules, and targeted tests. Graph tools are not exposed in this session; source-search fallback is available.
- Work in the shared canonical checkouts. Do not reset, stash, clean, overwrite another agent's files, commit, deploy, or publish. Preserve the frontend's pre-existing asset/physics/map modifications; baseline diff and LivePhysicsPopover are saved under `/tmp/dt-native-sync-baseline`.
- No compatibility aliases, silent demo fallback, invented API values, speculative frameworks, or new numerical-model features. Keep immutable scenarios; ignitions remain run input. Local appearance is device-local, not account-synchronized.
- Use existing shared shadcn/UI primitives and semantic theme tokens, with light/dark/portalled themes, keyboard/reduced-motion support. Inspect registry/docs through Context7 when library-specific implementation requires it. Never expand the raw-color exception list.
- Each agent must run focused meaningful tests and its relevant lint/type/build checks, report exact results, and fix introduced regressions. Do not weaken or delete useful tests simply to pass; update obsolete assertions only with evidence of intentional behavior replacement.
- Communicate proposed contract shapes before implementing consumers. Send contract decisions and file ownership conflicts to root immediately. Root will relay to peers and integrate the shell. Agents may directly message teammates using collaboration tools.
- Do not claim full completion from source inspection or mock tests. Report external-service verification limitations explicitly. No live production API mutations.

## Agent: engine_contracts — Engine implementation

Own all Engine changes; do not modify frontend runtime files. Read the full plan, particularly phases 1, 4, 5, 6, and cross-boundary tests.

Implement:

1. Immutable scenario `GET /api/v1/scenarios` (region filter, bounded cursor pagination) and `GET /api/v1/scenarios/{scenario_id}`. Maintain a deterministic region index atomically at scenario creation; no raw route-level scans. Preserve idempotency and immutability.
2. Safe `GET /api/v1/regions/{region_id}/readiness` with publication, configured/hydrated grid, source readiness and reason codes. Tell frontend agents exact schema immediately. It must not claim workers are provisioned by publication.
3. Inspect existing hosting principal/access authority and implement missing resource/action authorization for protected routes using that boundary, including scoped collections, SSE, results, raster delivery, and scenario reads. Preserve intentional public health probes and existing local-development configuration through explicit documented policy, not hidden bypass. Coordinate any host requirements with root rather than fabricate identity infrastructure.
4. Verify survey item/collection visibility for an accepted replacement version while old ready tiles remain usable; extend the existing projection only if needed. Send exact status polling contract to data_surfaces.
5. Deterministic OpenAPI export and current-model fixtures without external-service startup; provide a local schema artifact path and command to root. Add Engine contract comparison/integration checks and suitable docs/ADR for major boundary changes.

Acceptance: scoped list/item/mutation/stream tests; unauthorized IDs rejected; creation/list pagination/retry and retrieval pass; configured/unconfigured region readiness matches submission prerequisites; survey replacement completion/failure is observable; existing API and architecture suites continue passing. Run broader Engine tests if feasible and explain any baseline/environment failures. Do not build model-control, dynamic-provisioning, alerts, membership, or notification epics excluded from this plan.

Coordination: scenario_runs will consume your scenario/readiness contracts; data_surfaces consumes readiness and dataset build lifecycle. Root owns frontend generation and integration. Announce initial schema decisions before long implementation; send final schema/export and verification when ready.

## Agent: scenario_runs — Native scenarios and run lifecycle

Own: `src/lib/digital-twin-runs.ts`; new scenario/run-specific client modules; `ui/simulation-flow.ts`; `ui/digital-twin-run-api.ts`; views `ScenariosView`, `ScenarioBuilder`, `RunsView`, `RunDetailView`, `RunDetailTabs`, `RunPlaybackWorkspace`; focused run/scenario tests and new focused child components. Paths are under `apps/geolibre-desktop/src/product-modes/digital-twin` unless stated otherwise.

Do not edit `DigitalTwinMapWorkspace.tsx`, `App.tsx`, global package/lock/CI files, generated contracts, or data/settings/asset surfaces. Supply exact shell integration props/callbacks to root. Root owns shared transport `src/lib/digital-twin-api.ts` and generated wire types; coordinate before duplicate abstractions.

Implement phases 0, 2, scenario/input parts of 3, and 4:

1. Correct run duration, tick arithmetic/positive-tick counts, current error fields, and canonical wire types. Remove fake simulation results and obsolete mock helpers once consumers/tests are deliberately updated.
2. Native cancellation with races/pending state, SSE with named events/replay/reset/terminal cleanup, snapshot recovery, stale/disconnected UI, direct run-ID recovery. Provide root a focused catalog refresh hook/controller for active and idle discovery rather than editing shell.
3. Present/forecast and bounded direct submissions (one ignition, explicit timestep), and immutable synthetic scenario submissions (1–100 ignitions, current Engine timestep). Exact weather and rectangular bounds selection; preview forecast availability using existing resolve endpoint. Coordinate any shared source client with data_surfaces.
4. Replace fixture scenario table with Engine list/get, real save, edit-as-new/duplicate, run saved scenarios; no invented owner/status/time/ignitions. Remove false autosave; implement dirty/discard behavior.
5. Remove unsupported editable numerical controls; separate visual weather from accepted run intent. Freeze reviewed request+weather+idempotency key across retries and rotate on changed intent.

Acceptance: native real list→save→reload→run path; no fixture truth; bounded/forecast validation; retry invariance; cancel/reconnect/replay progress correctness; stale failures visible; refreshed URL recovery; tests using current Engine shapes. Run focused tests, lint of owned files, and report required integration precisely.

Engine coordination: engine_contracts is adding list/get scenarios and readiness, not mutable scenario editing. Read their messages/contracts before pinning response types. Current POST endpoints remain authoritative. Root will generate OpenAPI types and wire shell callbacks.

## Agent: data_surfaces — Native sources, administration, surveys, settings

Own: resource clients `digital-twin-assets.ts`, `digital-twin-earth-engine.ts`, `digital-twin-point-cloud.ts`; new region/source/survey clients; `ui/assets/AssetsView.tsx`; new native source/region/dataset administration components; `views/SettingsView.tsx`, `settings-view-pages.tsx`, `settings-view-model.ts`, `settings-view-components.tsx`; focused tests. Preserve existing user asset/physics changes.

Do not edit shell `DigitalTwinMapWorkspace.tsx`, App/access, package/lock/CI/generated files, scenario/run-owned files, or shared primitive files without coordination. Request root shell wiring through a precise component API. Root owns transport `src/lib/digital-twin-api.ts` and generated contracts. Do not duplicate scenario/forecast submission logic owned by scenario_runs.

Implement data portions of phases 0, 3, 5, 6, 7:

1. Native configured-source inventory, Earth Engine metadata/layers, COG descriptor preparation/display callbacks, correct pagination/readiness/errors. Supply root native map layer adapter requirements; reuse existing rendering libraries/components, not Expert GIS navigation.
2. Native region create/patch/delete/publish and draft-status propagation. Single tree/line creation, bounded JSON batch preview/import, existing CSV/edit/delete with published read-only behavior. No pole mutation or speculative region revisions. Display Engine readiness separately from publication.
3. Dataset list/item viewing and PLY+reviewed metadata upload. Track accepted version through queued/building/ready/failed, preserve old ready tiles during replacement, support recovery and authorization/type/size/validation/conflict errors. Coordinate version observability with engine_contracts; don't treat old ready as upload success.
4. Replace fake settings status with real health/config and remove invented queue/storage/member/routing values. Wire local preferences to actual existing persistence/consumers or remove ineffective controls; label local semantics. Real saved scenarios replace disconnected presets through navigation to scenario UI.

Acceptance: reachable native components can complete administrative lifecycle, source readiness/layers, survey status, and honest settings; correct disabled permissions/draft controls; focused API/error/lifecycle tests and lint pass. Provide root exact navigation/map/capability props and any gaps needing integration.

Engine coordination: engine_contracts supplies scenario list/get (scenario_runs uses those), regional readiness (you use it), and possible dataset-version polling enhancements. No new Engine endpoints are expected for existing CRUD, sources, COGs, or survey submission.

## Root ownership — integration, contract tooling, and final regression review

- Own `DigitalTwinMapWorkspace.tsx`, App/access and navigation integration, shared transport, generated contracts/export/import tooling, package/lock/CI changes, machine-readable endpoint coverage manifest, browser acceptance, and final code review.
- Coordinate cross-agent response contracts and shared resources. Run baseline checks early; integrate one complete workflow at a time. Do not overwrite user changes in shell.
- Remove old Digital Twin plugin/duplicate entry paths only once native replacements pass and references are understood; retain reusable/unrelated GeoLibre functionality.
- Run frontend lint/build/full tests, worker/backend/Rust checks as appropriate, Engine verification, and native browser checks. Separate baseline/environment failures from introduced defects and fix introduced regressions before handoff.
- Update the plan/audit with actual delivered evidence. Engine major changes require its quiz workflow at final handoff; handle after implementation verification.
