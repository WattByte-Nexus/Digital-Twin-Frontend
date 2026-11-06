# Point-cloud rendering options for vegetation risk

Research date: November 5, 2026. Scope: external technology and product evidence, not a measured benchmark of this repository. This note uses project documentation, source, specifications, and first-party Neara material. Context7 was queried for deck.gl, CesiumJS, and Potree; current upstream documentation and source were then checked directly. Recommendations and proposed targets are explicitly engineering judgments.

## Recommendation

**Keep the existing MapLibre/deck.gl map as the first candidate, remove unnecessary subdivision for small clouds, and establish a point/scalar/identity contract before replacing the renderer.** A red-to-yellow vegetation risk gradient is a normal per-point attribute rendering problem; it does not itself require a new engine. The decisive questions are whether the current path preserves useful attributes, how many requests and duplicated LOD points it creates, whether it rebuilds unchanged data, and whether larger clouds are spatially streamed.

The accompanying repository audit found an existing typed-array PNTS path and forced subdivision even when a cloud fits in a single leaf. For that system, **a one-root-leaf tileset is the simplest first comparison**: retain the same renderer and format while removing avoidable requests/traversal. A separate small-cloud loader is unnecessary to prove this improvement. That audit also found very cheap parsing in isolation; the general worker/allocation advice below is not a finding that this parser is slow.

For large surveys, keep a hierarchy and bounded working set. COPC is a useful future storage candidate because it preserves LAS semantics and supports spatial range reads. It is not a complete rendering engine. If operating a custom streaming scheduler proves too costly, benchmark **Potree with COPC** and **Giro3D with COPC** in a dedicated 3D inspection view. CesiumJS is attractive when a globe/terrain/3D Tiles scene is the product direction, but changing the map engine solely for risk colors is disproportionate.

This recommendation does not promise Neara performance or visual parity. Those require a common dataset, camera, device, pixel density, and acceptance screenshots.

## What Neara publicly demonstrates

Neara's point-cloud help documents selective area loading, a configurable load radius, metadata loaded on demand, per-class density/visibility controls, and coloring by classification, map imagery, or capture time. That is evidence for controlling the working set and the displayed information. It is not evidence that Neara displays entire surveys at full density or that a particular proprietary renderer is necessary. [Neara point-cloud display settings](https://knowledge.neara.com/en/articles/8942752-point-cloud-display-settings)

Neara also publishes vegetation clearance and treatment-prioritization demos. These establish the product use case; the pages inspected do not document the internal renderer, GPU architecture, or a public arbitrary per-point risk-color API. Treat the user's observed gradient behavior as the desired product behavior, without guessing Neara's implementation. [Neara demo library](https://neara.com/how-it-works), [clearance-violation demo](https://neara.com/resources/demo-videos/where-are-your-most-consequential-clearance-violations/)

## Separate the decisions

| Concern | Examples | What it does not solve by itself |
| --- | --- | --- |
| Source/archive and spatial transport | COPC, Potree octree files, 3D Tiles | Camera integration, frame time, risk calculations |
| Decoder/data access | copc.js, laz-perf, loaders.gl | Visibility selection, cache budgets, rendering |
| Renderer and scene | deck.gl, Potree, Giro3D, CesiumJS | Correct tree segmentation or reliable risk metrics |
| Offline processing | PDAL, PotreeConverter, py3dtiles | Interactive application integration |
| Product attributes | classification, tree ID, clearance, risk, scenario/version | Automatically inferred from RGB alone |

Comparing COPC against CesiumJS as direct alternatives would mix two different layers. Likewise, adding a decoder does not supply a production-quality level-of-detail scheduler.

## Candidate comparison

| Candidate | Verified capabilities | Main integration cost / limitation | Assessment |
| --- | --- | --- | --- |
| deck.gl PointCloudLayer | Position, normals, per-point colors; binary attributes through deck's data model | No built-in whole-survey hierarchy in this layer; dynamic scalar coloring needs color buffers or a shader extension | Best initial control implementation and smallest change to an existing deck map |
| deck.gl Tile3DLayer + loaders.gl | Traverses supported 3D Tiles/I3S; documented point-cloud sublayer for `.pnts` | Requires a real tiling pipeline; generic `getPointColor` is not arbitrary risk styling; verify installed glTF point/metadata support | Good only if tile interoperability and the exact supported pipeline justify conversion |
| Potree + COPC or Potree octree | Purpose-built point budgets, octree visibility, adaptive points, scalar gradients, Eye Dome Lighting (EDL); direct COPC in 1.8.2 | Viewer/camera/render loop integration; older packaging conventions; validate extra-attribute support on the chosen input path | Strong specialist baseline for a dedicated point-cloud inspection view |
| Giro3D + COPC | Point-cloud sources, scalar color maps, point budget, subdivision threshold, EDL, projected coordinates | Own Three.js scene and controls; not an existing deck layer | Strong candidate when simplifying a dedicated 3D scene is preferable to maintaining a custom loader |
| CesiumJS + 3D Tiles | Geospatial scene, point attenuation, EDL, feature/property styling | Larger scene migration and tiling/metadata work; Cesium ion hosting is a separate product | Best when the broader application needs a Cesium globe/3D Tiles ecosystem |
| maplibre-gl-lidar | MapLibre/deck plugin; LAS/LAZ/COPC, EPT, streamed loading, classification/intensity/elevation/RGB coloring | Custom risk attribute path and update performance need source audit and measurement | Useful integration prototype/reference; not yet a justified production replacement |

The following sections provide evidence and important qualifications for this assessment.

## deck.gl: retain rendering, fix data ownership first

PointCloudLayer accepts point positions and colors, with a pixel-size setting and optional normals. It already supplies the fundamental drawing primitive needed for vegetation. Its documentation also shows a LASLoader integration, but that example alone does not establish LAS 1.4 or hierarchical streaming support. [PointCloudLayer](https://deck.gl/docs/api-reference/layers/point-cloud-layer)

deck's performance guidance explicitly recommends binary data, worker processing, transferable typed arrays, and avoiding reconstruction of binary input into large JavaScript object arrays. These are particularly relevant to small-cloud latency, where parsing, allocation, and repeated attribute generation can dominate before GPU work. Preserve stable data references and update only attributes whose inputs changed. The performance conclusion is an inference to test in this application. [deck.gl performance guidance](https://deck.gl/docs/developer-guide/performance)

MapLibre integration supports sharing the WebGL2 context for correct interleaved depth/ordering, or using a separate overlay canvas. Current docs name `MapLibreOverlay` from `@deck.gl/maplibre`; this is **not an instruction to copy that import into an older installed deck version**. Confirm the repository's package versions and matching API. [MapLibre integration](https://deck.gl/docs/developer-guide/base-maps/using-with-maplibre)

Tile3DLayer's documented `.pnts` path renders a PointCloudLayer sublayer. Its `getPointColor` is used only for `.pnts` without color properties in the tile, and picking normally returns a tile header. Do not mistake that accessor for a general per-point risk-expression engine or point-identity API. A risk implementation must deliberately pass attributes/color buffers to a suitable sublayer or shader. [Tile3DLayer API](https://deck.gl/docs/api-reference/geo-layers/tile-3d-layer)

The accompanying repository audit additionally reproduced an installed-loader failure when introducing `BATCH_ID`: its batch-color normalization assumes a `dimensions` property and ignores the ordinary RGB path. Consequently, adding tree IDs to PNTS is **not** a schema-only change. Validate or replace that exact decoder integration before selecting the metadata encoding; preserve point/tree IDs through preprocessing as well as rendering.

### Upstream confirmation of the LOD request bottleneck

The repository investigation reproduced sibling requests becoming serial in installed loaders.gl 4.4.3: replacement traversal stops scanning children at the first unavailable child. **Upstream has fixed this exact behavior.** PR #4089, merged October 8, 2026 as commit `09b1dca9c241a42fb8d5db92e59d548326f48c61`, changes discovery to visit all siblings while retaining the readiness guard for replacement. Its description records regression coverage for nested discovery, parent retention, request-volume boundaries, concurrency, and cancellation. [Upstream fix](https://github.com/visgl/loaders.gl/pull/4089)

Direct reads of version-tagged source found the early return still present in **4.4.6 and 4.5.4**, while **5.0.0-alpha.12** contains the fix. Therefore, an ordinary stable-version bump is not an established remedy. The fix is also in current master, under the reorganized `tiles-3d` module. [4.4.6 source](https://github.com/visgl/loaders.gl/blob/v4.4.6/modules/tiles/src/tileset/tileset-traverser.ts), [4.5.4 source](https://github.com/visgl/loaders.gl/blob/v4.5.4/modules/tiles/src/tileset/tileset-traverser.ts), [fixed alpha source](https://github.com/visgl/loaders.gl/blob/v5.0.0-alpha.12/modules/tiles/src/tileset-3d/common/tileset-traverser.ts)

Recommended action: evaluate an upstream-backed, tested backport of this narrow correction, or a deliberate compatible dependency upgrade that contains it. Do not change `REPLACE` to `ADD` or blindly enable skip-LOD to mask the problem; those change selection semantics. The one-root-leaf optimization additionally removes this scheduling cost entirely for small clouds without abandoning hierarchical LOD for larger surveys.

The current LASLoader docs warn that it supports LAS through 1.3, not 1.4, and list no streaming support. COPC is LAS 1.4-based, so using the generic LASLoader is not a COPC streaming solution. [LASLoader limitations](https://loaders.gl/docs/modules/las/api-reference/las-loader)

`@loaders.gl/copc` is separate and derives from copc.js. Its public COPCSource API page is currently marked under construction with `TBA`, so inspect the installed source/types and actual examples before committing to an integration. Documentation availability is a concrete adoption concern, not proof that the module is unusable. [COPC module](https://loaders.gl/docs/modules/copc), [COPCSource documentation](https://loaders.gl/docs/modules/copc/api-reference/copc-source)

## COPC, copc.js, laz-perf, and PDAL

COPC stores a spatial octree inside a single compressed LAZ 1.4 file. Hierarchy entries identify offsets and sizes for point chunks, making selected nodes fetchable without downloading the entire survey. Web hosting needs HTTP Range support and appropriate CORS. The format requires point record formats 6, 7, or 8. [COPC 1.0 specification](https://copc.io/)

copc.js provides TypeScript access to the header, hierarchy, and point views. laz-perf provides browser-capable WASM LAZ decoding, including a chunk-decoder API. Their roles are complementary: use established decoding instead of writing a LAS/LAZ parser. Neither library claims to own the whole interactive scene. [copc.js](https://github.com/connormanning/copc.js), [laz-perf](https://github.com/hobuinc/laz-perf)

If assembling this under deck, the application still owns camera-dependent node selection, cancellation, request/decode concurrency, CPU/GPU cache limits, stale-result handling, coordinate transformation, and buffer lifetime. That is substantial work. Reuse an adequate existing implementation if these concerns currently account for much of the complexity.

PDAL's COPC writer supports `extra_dims`, including explicit dimension names/types or all extra dimensions. This offers a standard way to preserve a static `TreeId` or `Risk` field through ingestion, subject to an end-to-end reader/converter round-trip test. Do not overload LAS classification or intensity to carry unrelated risk. [PDAL COPC writer](https://pdal.io/en/stable/stages/writers.copc.html)

Operational checks for any proposed COPC path: verify a real `206` response with the expected range, byte counts and caching under the application's actual authorization/CDN setup; confirm workers decode off the main thread; test cancellation during fast pans; and verify that re-entering an area reuses cached data. These are proposed acceptance checks, not findings about the current deployment.

## Potree and PotreeConverter

Potree's visibility source selects nodes using a point budget and asynchronous loading, and its shader supports adaptive point sizes and gradient lookup for extra scalar attributes. Those are capabilities closely matched to vegetation shape and risk visualization. EDL is available in the viewer to make depth changes more legible. [Potree visibility source](https://github.com/potree/potree/blob/develop/src/Potree_update_visibility.js), [point-cloud shader](https://github.com/potree/potree/blob/develop/src/materials/shaders/pointcloud.vs), [EDL example](https://github.com/potree/potree/blob/develop/examples/lion_laz.html)

Potree 1.8.2 explicitly added COPC support. Therefore, choosing Potree does **not** automatically require a second conversion from COPC into Potree's own format. Its `package.json` still describes a private package with a Gulp build and bundled viewer output; embedding it in this application deserves a real packaging/camera prototype. [Potree releases](https://github.com/potree/potree/releases), [package manifest](https://github.com/potree/potree/blob/develop/package.json)

PotreeConverter is an offline octree builder, not a renderer. Its 2.x format uses three output files, with support for standard and extra LAS attributes. The README's old compression-roadmap wording is stale relative to release notes: 2.1.4 lists an option for Brotli-compressed chunks, and 2.1.5 lists NIR/compilation fixes. Prefer versioned release/source evidence over that roadmap when selecting options. [PotreeConverter README](https://github.com/potree/PotreeConverter), [release notes](https://github.com/potree/PotreeConverter/releases)

Adoption gate: prove the chosen COPC or converted input retains the required scalar types and IDs, then compare output against the same dataset/camera in deck. Do not carry a custom MapLibre/Potree synchronization layer merely to avoid making a clear product choice between a map overlay and a dedicated inspection scene.

## Giro3D

Giro3D is a TypeScript geospatial viewer built on Three.js. Its current PointCloud API exposes point budgets, subdivision thresholds, attribute selection, and attribute color maps. The published COPC example includes EDL, inpainting, classification filtering, and scalar color ramps. It provides more of the point-cloud application machinery than a bare decoder and is a useful direct-COPC benchmark. [PointCloud API](https://giro3d.org/latest/apidoc/classes/entities_PointCloud.PointCloud.html), [COPC example](https://giro3d.org/latest/examples/copc.html)

The integration tradeoff is scene ownership: this is a different geospatial scene framework, not a PointCloudLayer replacement. It is attractive for a dedicated inspection view, or if a broader 3D-view redesign is already warranted. The current public API identifies version 2.0.6; pin the evaluated version because `/latest/` will change. The project documents React/Vue integration, but that does not imply automatic MapLibre camera/context interleaving. [Giro3D repository and integration information](https://github.com/giro3d-org/giro3d)

## CesiumJS, 3D Tiles, and metadata

Cesium3DTileStyle supports color and visibility expressions over feature properties. Its styling language includes interpolation and clamping, so a properly encoded risk scalar can drive a continuous gradient. An illustrative expression is `mix(color('yellow'), color('red'), clamp(${risk}, 0.0, 1.0))`; this requires the tile content and renderer path to expose `risk` at the correct granularity. A metadata property on the entire tile is not a different value for every point. [Cesium3DTileStyle](https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileStyle.html), [3D Tiles styling specification](https://github.com/CesiumGS/3d-tiles/blob/main/specification/Styling/README.adoc)

Cesium also has geometric-error-based point attenuation and EDL. These can improve perceived density/depth, but do not recover branches missing from a sampled source. [PointCloudShading](https://cesium.com/learn/cesiumjs/ref-doc/PointCloudShading.html)

For a new pipeline, evaluate 3D Tiles 1.1 glTF content and structural metadata. The standard deprecates `.pnts`, `.b3dm`, `.i3dm`, and `.cmpt` in favor of glTF; compatibility still exists, but selecting an obsolete format as a new permanent architecture needs a concrete reason. This does not make a format rewrite a prerequisite to fixing the existing PNTS hierarchy. Validate the exact converter/renderer/metadata combination rather than assuming that “supports 3D Tiles” covers every feature. [3D Tiles specification/version history](https://github.com/CesiumGS/3d-tiles)

py3dtiles is an open-source conversion option whose public site still advertises `.pnts` output. An upstream issue documents arbitrary field preservation as a development area, with intensity/classification historically special-cased. The rendered issue did not establish its current merge status. Thus arbitrary `TreeId`/`Risk` preservation must be tested in a pinned version before choosing it; do not equate conversion of XYZ/RGB with preservation of risk data. [py3dtiles](https://py3dtiles.org/), [arbitrary-fields issue](https://gitlab.com/py3dtiles/py3dtiles/-/issues/222)

## Smaller MapLibre-specific option

`maplibre-gl-lidar` documents COPC/EPT streaming, a point budget, React bindings, and built-in elevation/intensity/classification/RGB schemes. It is MIT-licensed and may shorten a prototype considerably. Its documented schemes do not demonstrate an arbitrary per-point business-risk attribute API. Before adoption, inspect whether stream updates recreate all visible buffers, whether identity survives filtering, and how custom fields reach the layer. No performance claim about this plugin was independently measured here. [Project documentation and API](https://github.com/opengeos/maplibre-gl-lidar)

## Risk colors: suggested data contract

This is an architectural recommendation, not an assertion about the current code.

1. Keep positions, source color, classification, stable tree identity, and optional per-point metrics as separate typed attributes. Do not encode business meaning only in the display RGB.
2. Distinguish **per-tree risk** (every point in one crown shares a value) from **per-point risk** (e.g. branch clearance varies within a crown). A per-tree value can be expanded to a color buffer initially; frequent scenario changes can justify an ID-to-risk GPU lookup. Start with the measured simpler path.
3. Use a fixed domain such as risk `[0,1]`, with yellow at low and red at high values, and a visibly distinct unknown value. Include a legend and numeric hover information. Per-tile autoscaling would make equal colors mean different risks across the scene.
4. Updating risk must not refetch or reproject unchanged geometry. For infrequent changes, regenerate only the small color/scalar buffer. For continuously adjusted thresholds, a shader scalar plus color ramp/uniforms avoids repeated CPU mapping.
5. Preserve identity and metrics through every sampled LOD. Never numerically average categorical tree IDs. If a coarse node represents many points, explicitly define how dangerous local outliers remain visible; an average risk can hide the worst branch.
6. Treat dynamic scenario risk as versioned analytical data. Rebuilding a large compressed geometry file for every scenario change is usually the wrong update boundary. Static tree IDs can live in the geometry, while scenario metrics can be looked up separately when that capability is needed.

Memory arithmetic helps set expectations: XYZ as three Float32 values is 12 bytes/point; RGBA8 adds 4, a Float32 risk adds 4, and a Uint32 tree ID adds 4. That is **24 MB per million points** for these attributes alone, before duplicated CPU/GPU copies, decoded source data, picking buffers, renderer overhead, or alignment. This is a layout calculation, not a browser memory measurement. Use local coordinates with a stable origin if choosing Float32 positions; verify world-space precision against the application's measurement needs.

## Fidelity and evaluation gates

Moderate fidelity should be specified as useful structure at a working distance: crown silhouette, thin branches near conductors, clear conductor/pole separation, depth ordering, readable risk colors, and stable detail while navigating. More points are not automatically more useful. EDL and adaptive sizes are candidates for depth legibility; benchmark their fragment/postprocessing cost, particularly on high-DPI displays. Do not use hole-filling/inpainting as evidence of measured clearance.

Proposed benchmark matrix: the same local vegetation crop at 100k, 1M, and 5M points, plus one large survey requiring spatial streaming. These are diagnostic scales, not product limits. Use a fixed device, browser, viewport, pixel ratio, camera route, and source attributes. Compare cold/warm loading, time to first useful image, time to target detail, transferred bytes, main-thread long tasks, p50/p95 frame time, peak memory, and latency of changing risk colors. Include camera movement during loading and repeated load/unload cycles.

Useful initial acceptance targets to negotiate: a locally cached 100k-point crop usable within 500 ms, navigation p95 frame time below 33 ms on the selected reference laptop, and a risk-palette change visible within 100 ms without a geometry network request. These are proposed engineering targets, not published Neara numbers or results obtained in this investigation.

## Licensing and maintenance evidence

| Project | Verified license / evidence | Adoption implication |
| --- | --- | --- |
| deck.gl | MIT; release page lists 9.4.1 and 9.3.12 fixes; OpenJS Foundation project | Established ecosystem; match package versions before adopting current examples. [Repository](https://github.com/visgl/deck.gl), [releases](https://github.com/visgl/deck.gl/releases) |
| Potree | BSD 2-clause text; release page lists 1.8.2 with COPC | Established specialist implementation; older build conventions need deliberate packaging. A version number alone does not prove inactivity. [License](https://github.com/potree/potree/blob/develop/LICENSE), [releases](https://github.com/potree/potree/releases) |
| PotreeConverter | BSD-2-Clause; 2.1.4/2.1.5 documented changes | Versioned releases are better evidence than the stale README roadmap. [Repository](https://github.com/potree/PotreeConverter), [releases](https://github.com/potree/PotreeConverter/releases) |
| copc.js / laz-perf | MIT / Apache-2.0 respectively | Focused reusable reader/decoder components; do not treat them as full viewer support. [copc.js](https://github.com/connormanning/copc.js), [laz-perf](https://github.com/hobuinc/laz-perf) |
| Giro3D | Source/example code MIT; docs/images CC BY-SA; current API labeled 2.0.6 | Plausible maintained specialist candidate; use primary GitLab project for issue/release assessment, not GitHub-mirror star counts. [Repository/license information](https://github.com/giro3d-org/giro3d), [API](https://giro3d.org/latest/apidoc/classes/entities_PointCloud.PointCloud.html) |
| CesiumJS | Apache-2.0; 1.147 release explicitly dated 2026-11-02 | Strong maintenance signal; open renderer and commercial Cesium ion services are separate choices. [Repository](https://github.com/CesiumGS/cesium), [releases](https://github.com/CesiumGS/cesium/releases) |

No package installation, production change, conversion job, or comparative browser benchmark was performed for this external-options note. The next decision should combine this evidence with the repository-specific bottleneck investigation and one controlled rendering comparison.
