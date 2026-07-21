# Distribution Network Demo plugin

This bundled GeoLibre plugin reads `assets/testpowerlines.geojson`, uses the first
three coordinates as pole locations, and renders exactly two elevated conductor
spans between them. The supplied `13.8kv_power_pole.glb` is placed once at each
of the three locations with deck.gl's `ScenegraphLayer`.

The plugin is a drop-in external plugin and does not modify GeoLibre core. Its
`activeByDefault` manifest flag makes it load when this build starts. Toggle it
from the **Plugins** menu using **Distribution Network Demo**.

The pole model is the user-supplied 13.8 kV Power Pole asset by RDOutlets,
originally published on Sketchfab under CC BY 4.0.
