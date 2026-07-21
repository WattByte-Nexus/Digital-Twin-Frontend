# Distribution Network Demo plugin

This bundled GeoLibre plugin reads `assets/testpowerlines.geojson`, uses the first
three coordinates as pole locations, and renders two black conductors along the
two spans: one wire on each side of the pole centerline. Each pole is rotated to
the local bearing of the GeoJSON line. The supplied `13.8kv_power_pole.glb` is
placed once at each of the three locations with deck.gl's `ScenegraphLayer`.

The **Distribution** toolbar menu opens a small **Distribution Assets** panel.
Click a pole to see its pole ID in the asset panel. Click either conductor to
see the selected pole-to-pole span's line ID and geodesic length, shown in
metres or kilometres. Long routes are split at every pole rather than reported
as one route-wide line.

Use it to select and add another pole GLB + GeoJSON pair or a tree GLB + GeoJSON
pair. Line vertices place poles and conductors; every unique coordinate places a
tree. Each importer also includes a model-scale control.
Tree imports default to half scale, which makes the bundled forest models roughly
9–17 metres tall instead of 18–33 metres tall; the value can still be adjusted for other models.

The plugin is a drop-in external plugin and does not modify GeoLibre core. Its
`activeByDefault` manifest flag makes it load when this build starts. Toggle it
from the **Plugins** menu using **Distribution Network Demo**.

The pole model is the user-supplied 13.8 kV Power Pole asset by RDOutlets,
originally published on Sketchfab under CC BY 4.0.
