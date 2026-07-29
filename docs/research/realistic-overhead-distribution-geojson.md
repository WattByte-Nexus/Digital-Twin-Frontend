# Research findings: realistic overhead-distribution GeoJSON

## Purpose and limits

This note turns primary-source utility practices into a defensible synthetic fixture for the distribution-network engine and GeoLibre frontend. It is a visualization and software-test model, not an engineered design. Real pole placement, conductor selection, loading, clearances, and vegetation work require the owning utility's standards and a licensed design for the jurisdiction.

The best local fit is a Boulder/Colorado-style radial overhead feeder at a nominal **13.8 kV**. That matches the bundled pole asset and is locally plausible: Xcel's Colorado planning material lists 230/13.8 kV distribution substations. ([Xcel Energy, 2023 Rule 3206 Report](https://www.transmission.xcelenergy.com/staticfiles/microsites/Transmission/Files/PDF/2023%20Rule%203206%20Report.pdf))

## Recommended synthetic fixture

Use one connected road-following trunk with several laterals:

- **Scale:** 12–18 km of route, roughly 220–340 poles, enough to exercise rendering, picking, panning, and long-route behavior without becoming an accidental stress test only. These counts are synthetic targets, not utility standards.
- **Topology:** a three-phase radial main feeder with mostly single-phase taps, a few three-phase branches, fused lateral roots, several transformer poles, one recloser, and a normally open tie endpoint. USDA's sectionalizing guide is explicitly organized around radial systems and distinguishes line fuses on small taps from reclosers on more consequential branches. ([USDA RUS Bulletin 1724E-102](https://www.rd.usda.gov/files/UEP_Bulletin_1724E-102.pdf))
- **Nominal electrical data:** `voltage_v: 13800`, `frequency_hz: 60`, `circuits: 1`; use three phase conductors plus a neutral on the trunk and one phase plus a neutral on single-phase laterals. Under the OSM convention, `cables` counts current-carrying phase conductors and excludes ground/neutral conductors, so a trunk can use `cables: 3`, `neutral_present: true`, and `physical_conductor_count: 4`. ([OSM `voltage`](https://wiki.openstreetmap.org/wiki/Key:voltage), [OSM `cables`](https://wiki.openstreetmap.org/wiki/Key:cables))
- **Road relationship:** keep about 75–85% of the route parallel to roads, 10–20% in alleys/property-line corridors, and use only a few deliberate road crossings. Those proportions are synthetic. Colorado's current utility-accommodation rule says aboveground facilities should be as far from the traveled way as practical, preferably near the right-of-way line, in a uniform longitudinal alignment, and normally use one joint pole line rather than duplicated pole rows. ([Colorado 2 CCR 601-18](https://www.coloradosos.gov/CCR/GenerateRulePdf.do?fileName=2+CCR+601-18&ruleVersionId=9244))
- **Vegetation relationship:** deliberately follow tree-lined streets and greenway edges, but place conductors beside or above canopies rather than through their centers. Include a small, explicit set of `managed`, `conflict`, and `fall_in_risk` cases for testing. Xcel says distribution vegetation is normally revisited on a three-to-five-year cycle and evaluates hazard trees using both tree height and distance from the line. ([Xcel Energy distribution vegetation brochure](https://www.xcelenergy.com/staticfiles/xe/Corporate/Corporate%20PDFs/Distribution_Brochure.pdf))

## Pole distribution

The fixture should feel regular without looking mathematically perfect.

| Context | Synthetic spacing target | Placement behavior |
|---|---:|---|
| Urban/suburban road | 45–65 m, median about 52 m | Keep most spans within ±10% of the local median; move poles to sensible lot boundaries and away from driveways. |
| Rural/perimeter road | 80–110 m, median about 98 m | Use gentle variation and shorten before bends, crossings, or equipment. |
| Curve, branch, switch, transformer, crossing | 25–45 m where necessary | Treat these as explainable exceptions and tag the reason. |

These ranges are fixture defaults inferred from multiple design references, not prescribed code spacing. USDA worked examples use ruling spans of 325–375 ft (about 99–114 m). Ausgrid uses representative design wind spans of 50 m urban and 125 m rural and says designers should keep adjacent spans reasonably similar, avoid very short spans below 10 m, place urban poles near alternate lot boundaries, avoid vehicle-strike-prone curve locations, and avoid poles within 1.5 m of driveways where practicable. ([USDA RUS Bulletin 1724E-154](https://www.usda.gov/sites/default/files/guidance-documents/RUS%20Bulletin%201724E-154%20Distribution%20Conductor%20Clearances%20and%20Span%20Limitations.pdf), [Ausgrid NS220](https://aopt-p-001.sitecorecontenthub.cloud/api/public/content/c9ce5417b63d43349ead3bcaec266351?v=a8f3baa7))

Use a constrained placement algorithm rather than independent random jitter:

1. Resample each road-following centerline at the local target spacing.
2. Snap or shift candidates to meaningful nodes: road bends, branch points, equipment, and alternate parcel boundaries when available.
3. Reject positions in the traveled way, on driveways, on sharp outside curves, or inside an intersection sight triangle.
4. Rebalance neighboring spans so one correction does not create a very short next span.
5. Record every exception in `placement_reason`, such as `tangent`, `curve`, `branch`, `equipment`, or `road_crossing`.

A realistic synthetic role mix is 72–80% tangent poles, 8–12% angle poles, 5–8% branch/dead-end poles, and 5–8% equipment poles. This mix is a test-design choice; it is not sourced as a utility-wide population statistic.

## Roads and crossings

For longitudinal runs, derive the line from the road geometry and offset it smoothly toward the right-of-way edge. Do not put poles in travel lanes or repeatedly alternate road sides. Preserve a mostly straight pole line even when the road edge contains small cartographic wiggles.

Cross roads as close to perpendicular as the synthetic geography allows, avoid diagonal crossings through intersections, and place the two crossing poles outside the roadside hazard area. Colorado's rule requires overhead clearance to be assessed at the lowest conductor point under the maximum final-sag case, including temperature, ice, and terrain effects. For open supply conductors over 750 V through 22 kV on State Highway right-of-way, it specifies 25 ft (7.62 m) over the roadway template and 23 ft (7.01 m) outside it. These values are a useful conservative Colorado test case but are not a universal city-street rule. ([Colorado 2 CCR 601-18](https://www.coloradosos.gov/CCR/GenerateRulePdf.do?fileName=2+CCR+601-18&ruleVersionId=9244))

Recommended road fields are:

- `road_relation`: `parallel`, `crossing`, `intersection_approach`, or `none`
- `road_name`, `road_class`, and a stable `road_id`
- `road_side`: `left` or `right` in the road's digitized direction
- `road_offset_m` and `crossing_angle_deg`
- `clearance_case`: for example `maximum_final_sag`
- `min_clearance_m` and `clearance_requirement_m`

## Trees and vegetation

Trees should be a related asset population, not decorative points placed independently of the conductors. For every pole and span, calculate the closest trunk, closest canopy edge, and whether a tree's height makes it capable of reaching the line.

Use four synthetic clearance classes:

- `clear`: canopy comfortably outside the management envelope
- `managed`: tree is close enough to explain directional pruning but remains clear
- `conflict`: canopy intersects the chosen test envelope
- `fall_in_risk`: trunk is outside the envelope but tree height could reach the span if it failed

Xcel's public material distinguishes primary multiphase mains, single-phase primary taps, transformers, fuses, secondary wires, and service drops in a vegetation-management context. That makes a varied tree relationship more realistic than applying one buffer to every asset. ([Xcel Energy distribution vegetation brochure](https://www.xcelenergy.com/staticfiles/xe/Corporate/Corporate%20PDFs/Distribution_Brochure.pdf))

For a useful test distribution, make roughly 65–75% of spans `clear`, 18–25% `managed`, 4–8% `conflict`, and 1–3% `fall_in_risk`. These percentages are intentionally synthetic. Keep the riskiest cases away from road crossings so clearance failures can be diagnosed independently.

Recommended vegetation fields are `nearest_tree_id`, `tree_distance_m`, `canopy_edge_distance_m`, `tree_height_m`, `tree_clearance_class`, `fall_in_risk`, `vegetation_cycle_years`, and `pruned_side`.

## Pole height, conductors, and sag

Xcel describes common distribution structures as wood poles roughly 30–50 ft tall, normally with crossarms and equipment near the top. ([Xcel Energy encroachment review](https://www.transmissionprod2.xcelenergy.com/right-of-way/Encroachments-Review)) A credible fixture can therefore use mostly 40 ft poles, 45 ft poles at equipment or crossings, and occasional 50 ft crossing poles. RUS construction tables use 6.0 ft embedment for 35/40 ft poles, 6.5 ft for 45 ft poles, and 7.0 ft for 50 ft poles; this leaves approximately 10.36 m above ground for a 40 ft pole and 11.73 m for a 45 ft pole. ([USDA RUS Bulletin 1728F-803](https://www.rd.usda.gov/files/UEP_Bulletin_1728F-803.pdf))

Use mostly bare ACSR metadata: a larger three-phase trunk conductor, a smaller lateral conductor, and a separate neutral. USDA worked examples use 4/0 ACSR primary and, in another example, 1/0 ACSR primary with a #2 ACSR neutral. Treat those as recognizable fixture values, not a conductor-selection recommendation. ([USDA RUS Bulletin 1724E-154](https://www.usda.gov/sites/default/files/guidance-documents/RUS%20Bulletin%201724E-154%20Distribution%20Conductor%20Clearances%20and%20Span%20Limitations.pdf))

Render sag; perfectly straight conductors are immediately conspicuous. RUS says the parabolic approximation is normally accurate for distribution/transmission spans up to 1,000 ft and gives the midspan relation `D = W S² / (8 T_h)`. For fixed conductor and tension assumptions, sag scales with the square of span length: `D = D_ref (S / S_ref)²`. ([USDA RUS Bulletin 1724E-152](https://www.usda.gov/sites/default/files/guidance-documents/RUS%20Bulletin%201724E-152%20The%20Mechanics%20of%20Overhead%20Distribution%20Line%20Conductors.pdf))

For visualization only, one RUS worked case provides a useful reference of about 1.45 m final primary sag over a 99.1 m span at 120°F. A fixture can seed `midspan_sag_m = 1.45 * (span_length_m / 99.1)²`, then clamp or override it at unusual spans. This produces about 0.37 m at 50 m, 0.53 m at 60 m, and 1.48 m at 100 m. Exact sag depends on conductor, tension, temperature, ice/wind loading, and creep, so retain `sag_case` and `sag_is_engineered: false`. ([USDA RUS Bulletin 1724E-154](https://www.usda.gov/sites/default/files/guidance-documents/RUS%20Bulletin%201724E-154%20Distribution%20Conductor%20Clearances%20and%20Span%20Limitations.pdf))

Generate 7–11 render samples per conductor span from the pole endpoints and sag metadata. Do not add those samples to the pole-route LineString: in the current importer, every route vertex becomes a pole.

## GeoJSON organization and fields

RFC 7946 uses WGS 84 longitude/latitude coordinates; a third position element is absolute height in metres relative to the WGS 84 ellipsoid, not height above local ground. Use two-dimensional ground coordinates for pole and route geometry and store relative heights/sag in properties unless the data truly contains ellipsoidal altitude. Put stable string or number identifiers in the Feature-level `id`, keep coordinates to about six decimal places, and optionally add a collection `bbox`. ([RFC 7946 §§3.1.1, 3.2, 4, 11.2](https://www.rfc-editor.org/rfc/rfc7946.html))

The richest interoperable form is one `FeatureCollection` containing:

- one `Point` Feature per pole;
- one `LineString` Feature per physical span, with `from_pole_id` and `to_pole_id`;
- `Point` Features for transformers, fuses, switches, reclosers, capacitors, and regulators;
- optional tree `Point` Features, or stable references to a companion tree dataset.

Ending span Features at taps, branches, and equipment preserves graph topology. OSM similarly models a power line section as the electrically continuous conductor between substations or tap points. ([OSM `power=line_section`](https://wiki.openstreetmap.org/wiki/Tag:power%3Dline_section))

### Common Feature fields

| Field | Purpose |
|---|---|
| Feature `id` | Stable globally unique asset identifier |
| `asset_type` | `pole`, `span`, `transformer`, `fuse`, `switch`, `recloser`, or `tree` |
| `network_id`, `feeder_id`, `circuit_id` | Connectivity and filtering |
| `synthetic` | Always `true` for this fixture |
| `source_basis` | Short provenance such as `synthetic_rus_xcel_cdot` |

### Span fields

| Field | Purpose |
|---|---|
| `span_id`, `from_pole_id`, `to_pole_id`, `sequence` | Graph edges and deterministic ordering |
| `phases`, `phase_config`, `voltage_v`, `frequency_hz`, `circuits` | Electrical identity |
| `cables`, `neutral_present`, `physical_conductor_count`, `wires` | Avoid ambiguity between OSM phase-conductor count and rendered physical wires |
| `conductor_material`, `conductor_size` | Sag and visual variation |
| `span_length_m`, `attachment_height_start_m_agl`, `attachment_height_end_m_agl` | Geometry checks |
| `midspan_sag_m`, `sag_case`, `sag_is_engineered` | Render and safety-case metadata |
| `min_clearance_m`, `clearance_requirement_m` | Clearance validation |
| road and vegetation fields listed above | Spatial context |
| `status`, `normally_open` | Operational state testing |

### Pole fields

| Field | Purpose |
|---|---|
| `pole_id`, `sequence`, `material`, `pole_length_ft`, `embedment_ft`, `height_agl_m` | Physical identity |
| `pole_class`, `install_year`, `condition`, `inspection_date` | Asset-management UI testing |
| `bearing_deg`, `structure_type`, `line_attachment`, `line_management`, `line_arrangement` | Model orientation and construction role |
| `guyed`, `guy_bearing_deg` | Dead-end and angle-pole realism |
| `equipment`, `transformer_kva`, `switch_state` | Attached equipment |
| `road_side`, `road_offset_m`, `placement_reason` | Explain the placement |

The OSM pole model provides useful controlled vocabulary for `material`, `structure`, `line_attachment`, `line_management`, `line_arrangement`, guying, and attached equipment. ([OSM `power=pole`](https://wiki.openstreetmap.org/wiki/Tag:power%3Dpole))

## Current frontend compatibility

The legacy Distribution Network visualization plugin has been removed. The
Digital Twin Demo now seeds the 327 span features from
`boulder_13_8kv_feeder_large.geojson` alongside the bundled
`testtrees.geojson` inventory. The seeder ignores the duplicate full-route
feature and unsupported pole/vegetation records in the mixed synthetic feeder
file before posting Engine asset contracts.

The public Engine asset endpoints currently preserve the WGS84 line geometry,
power-line name, and tree species/height needed by the wildfire demo. Rich pole,
span, equipment, conductor, and sag properties require additive Engine asset
contracts before they can become authoritative frontend data.

## Validation checklist

- GeoJSON validates as RFC 7946; positions are `[longitude, latitude]`, Feature IDs are unique, and precision is sensible.
- The first LineString is connected, has no duplicate consecutive coordinates, and contains all compatibility-route poles in order.
- Every rich span endpoint resolves to a pole ID and exactly matches its pole Point coordinate.
- No unflagged span is below 10 m; urban/rural span distributions match their target bands; exceptions have `placement_reason`.
- Main spans have phases `ABC`, `cables: 3`, and a neutral; single-phase laterals identify their phase and use `cables: 1`.
- Road-parallel assets stay on one side in a smooth right-of-way alignment; crossings are near perpendicular and tagged.
- Colorado State Highway test crossings meet the selected maximum-sag clearance requirement.
- Sag is zero at each attachment and reaches the recorded maximum near midspan; it scales plausibly with span length.
- Tree proximity, canopy clearance, and fall-in risk are calculated rather than randomly labeled.
- Dead ends, major branches, and angle poles have plausible guying; transformers/fuses/reclosers occur at electrically meaningful nodes.
- The file is tested through the manual importer, not only the three-coordinate bundled startup path.

## Primary sources

- [IETF RFC 7946: The GeoJSON Format](https://www.rfc-editor.org/rfc/rfc7946.html)
- [Colorado 2 CCR 601-18: Utility Accommodation Code](https://www.coloradosos.gov/CCR/GenerateRulePdf.do?fileName=2+CCR+601-18&ruleVersionId=9244)
- [USDA RUS Bulletin 1724E-102: Guide for the Design of Sectionalizing Distribution Lines](https://www.rd.usda.gov/files/UEP_Bulletin_1724E-102.pdf)
- [USDA RUS Bulletin 1724E-152: The Mechanics of Overhead Distribution Line Conductors](https://www.usda.gov/sites/default/files/guidance-documents/RUS%20Bulletin%201724E-152%20The%20Mechanics%20of%20Overhead%20Distribution%20Line%20Conductors.pdf)
- [USDA RUS Bulletin 1724E-154: Distribution Conductor Clearances and Span Limitations](https://www.usda.gov/sites/default/files/guidance-documents/RUS%20Bulletin%201724E-154%20Distribution%20Conductor%20Clearances%20and%20Span%20Limitations.pdf)
- [USDA RUS Bulletin 1728F-803: 24.9/14.4 kV Standard Distribution Assemblies](https://www.rd.usda.gov/files/UEP_Bulletin_1728F-803.pdf)
- [Ausgrid NS220: Overhead Line Design](https://aopt-p-001.sitecorecontenthub.cloud/api/public/content/c9ce5417b63d43349ead3bcaec266351?v=a8f3baa7)
- [Xcel Energy distribution vegetation brochure](https://www.xcelenergy.com/staticfiles/xe/Corporate/Corporate%20PDFs/Distribution_Brochure.pdf)
- [Xcel Energy 2023 Colorado Rule 3206 Report](https://www.transmission.xcelenergy.com/staticfiles/microsites/Transmission/Files/PDF/2023%20Rule%203206%20Report.pdf)
- [OSM power pole, line-section, voltage, and cable tagging](https://wiki.openstreetmap.org/wiki/Tag:power%3Dpole)
