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
`13.8kv_power_pole.glb` + `testpowerlines.geojson`, while trees default to
`tree_07.glb` + `testtrees.geojson`. Choosing a local file overrides its bundled
default. Line vertices place poles and conductors; every unique coordinate
places a tree. Selecting another tree model replaces the active imported tree
layer so models do not stack at identical coordinates. Each importer also
includes a model-scale control. Tree imports default to half scale, which makes
the bundled forest models roughly 9–17 metres tall instead of 18–33 metres tall;
the value can still be adjusted for other models. Scenegraph pixel-size clamps
are disabled, so tree size remains tied to map-world units as the camera zooms.

The tree importer also offers **Boulder public trees · current view**. This option
queries the City of Boulder public tree inventory for the visible map extent,
paginates the ArcGIS GeoJSON response, and renders up to 10,000 public trees at
once. Selected trees show available inventory fields such as common and Latin
names, diameter at breast height, and location type. The inventory is maintained
by the City of Boulder and provided under CC0 1.0. It primarily represents public
trees, so it should not be treated as a complete inventory of private-property or
natural-area vegetation.

Inventory service:
`https://gis.bouldercolorado.gov/ags_svr2/rest/services/parks/TreesOpenData/MapServer/0`

The plugin is a drop-in external plugin and does not modify GeoLibre core. Its
`activeByDefault` manifest flag makes it load when this build starts. Toggle it
from the **Plugins** menu using **Distribution Network Demo**.

The pole model is the user-supplied 13.8 kV Power Pole asset by RDOutlets,
originally published on Sketchfab under CC BY 4.0.
