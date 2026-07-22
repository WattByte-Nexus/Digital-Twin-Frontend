# Distribution Network Demo plugin

This bundled GeoLibre plugin reads `assets/testpowerlines.geojson`, uses the first
three coordinates as pole locations, and renders two black conductors along the
two spans: one wire on each side of the pole centerline. Each pole is rotated to
the local bearing of the GeoJSON line. The supplied `13.8kv_power_pole.glb` is
placed once at each of the three locations with deck.gl's `ScenegraphLayer`.

Click a pole to see its pole ID in the asset panel. Click either conductor to
see the selected pole-to-pole span's line ID and geodesic length, shown in
metres or kilometres. Long routes are split at every pole rather than reported
as one route-wide line.

The **Plugins → Distribution Network Demo** submenu opens the **Distribution Assets** panel.
Both importers are ready to run without choosing files: poles default to
`13.8kv_power_pole.glb` + `testpowerlines.geojson`, while all 864 bundled tree
locations load automatically from `testtrees.geojson`. Trees are distributed
across ten realistic cross-plane GLBs. Conifers, hardwoods, birches, and
dead/winter trees are matched to the available species metadata, and the three
different views in every GLB prevent the flat-card effect as the map rotates.
Choosing a local model replaces the realistic collection for the next tree
import. Line vertices place poles and conductors; every unique coordinate places
a tree. Selecting another tree model replaces the active imported tree layer so
models do not stack at identical coordinates.

Tree height and canopy width use `height_m`, `canopy_diameter_m`, and Boulder DBH
attributes when available, with conservative mature-tree estimates otherwise.
The model-scale control is a multiplier over those world-unit dimensions and
defaults to `1`. Scenegraph pixel-size clamps are disabled, so tree size remains
tied to map-world units as the camera zooms.

The tree importer also offers **Boulder public trees · current view**. This option
queries the City of Boulder public tree inventory for the visible map extent,
paginates the ArcGIS GeoJSON response until every matching public tree has been
loaded, and renders the complete result. Selected trees show available inventory
fields such as common and Latin names, diameter at breast height, and location
type. The inventory is maintained by the City of Boulder and provided under CC0
1.0. It primarily represents public trees, so it should not be treated as a
complete inventory of private-property or natural-area vegetation.

The panel's **Export engine tree assets** action converts the active locations
to the Digital Twin Engine's `TreeAssetSnapshot` JSON shape. Every record has a
WGS84 location and a meter-based, axis-aligned collision box. Where DBH and genus
are available, crown width is estimated with USDA i-Tree genus equations;
reported canopy diameters take precedence, and incomplete records receive a
low-confidence generic fallback. The exported footprint adds a 20% crown-radius
safety factor and 0.5 m location buffer. Metadata preserves the method, input
DBH, estimated crown and height, buffers, estimator version, inventory confidence,
and original source fields. These are conservative 2D canopy envelopes—not
surveyed crowns, fall zones, or 3D collision meshes.

Allometric basis: USDA Forest Service [Understanding i-Tree, Appendix 13](https://www.fs.usda.gov/nrs/pubs/gtr/gtrnrs200_appendixes/gtr_nrs200_appendix13.pdf)
and the [Urban Tree Database and Allometric Equations](https://research.fs.usda.gov/treesearch/52933).

Inventory service:
`https://gis.bouldercolorado.gov/ags_svr2/rest/services/parks/TreesOpenData/MapServer/0`

The plugin is a drop-in external plugin and does not modify GeoLibre core. Its
`activeByDefault` manifest flag makes it load when this build starts. Toggle it
from the **Plugins** menu using **Distribution Network Demo**.

The pole model is the user-supplied 13.8 kV Power Pole asset by RDOutlets,
originally published on Sketchfab under CC BY 4.0.

## Large realistic feeder fixture

`assets/boulder_13_8kv_feeder_large.geojson` is the large engine and frontend
test fixture. It contains a 16.15 km synthetic 13.8 kV feeder aligned to City
of Boulder street centerlines, with 328 poles, 327 individually selectable
spans, and 1,297 nearby records from the City's public tree inventory. Pole
spacing averages 49.4 m; shortened spans are limited to tagged road bends.

The first feature is an importer-compatible `LineString` whose vertices are
the ordered pole locations. The remaining features provide rich span, pole,
conductor, sag, equipment, road, and vegetation-clearance properties for
engine tests. To render all 328 poles, choose this file in the **Distribution
poles** importer; the automatic startup demo intentionally still uses only
three coordinates.

The fixture is reproducible with
`scripts/generate-realistic-power-network.mjs` after downloading the relevant
ArcGIS GeoJSON pages into a source directory as `roads-*.geojson` and
`trees-*.geojson`. The research basis and primary-source citations are in
`docs/research/realistic-overhead-distribution-geojson.md`.

The realistic tree sprites are by klamtii and permit copying, modification,
distribution, derivative works, and commercial use without required
attribution. The source and transformation details are recorded in
`assets/realistic_tree_billboards/ATTRIBUTION.txt`.
