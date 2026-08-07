# GeoLibre time-of-day, sky, and shadow capability

**Research date:** 2026-08-07
**Status:** Verified against GeoLibre v2.4.0, MapLibre GL JS documentation/source,
and package-registry metadata
**Scope:** Identify the feature remembered as a time-of-day plugin and establish
whether it changes the sky or casts shadows onto the ground.

## Conclusion

The feature is GeoLibre's built-in **Sun Simulation** plugin:

- plugin ID: `geolibre-sun`;
- exported plugin object: `maplibreSunPlugin`;
- internal plugin version: `1.0.0`;
- user entry point: **Controls → Sun**;
- distribution: compiled into GeoLibre, not a marketplace or separately
  installable npm plugin.

It simulates a date and time, computes the sun position, sweeps a day/night
terminator across the map, and changes directional lighting on MapLibre 3D
extrusions. It does **not** currently drive GeoLibre's sky backdrop and does
**not** cast projected shadows from buildings or models onto terrain/ground.

The remembered effect is therefore probably a combination of two separate
GeoLibre features:

| Capability | GeoLibre feature | Time-driven? | What it actually renders |
| --- | --- | --- | --- |
| Date/time scrubber and playback | **Sun Simulation** (`geolibre-sun`) | Yes | Night raster, twilight terminator, and directional 3D lighting |
| Space backdrop, stars, comets, globe halo | **Atmospheric Effects** (`maplibre-atmosphere-effects`) | No | Decorative globe/space atmosphere |
| Projected shadows on ground/terrain | None in the current Sun integration | No | Not implemented |

Sources: [GeoLibre Sun source](https://github.com/opengeos/GeoLibre/blob/v2.4.0/packages/plugins/src/plugins/maplibre-sun.ts),
[GeoLibre Atmospheric Effects source](https://github.com/opengeos/GeoLibre/blob/v2.4.0/packages/plugins/src/plugins/maplibre-effects.ts),
[official map-controls guide](https://geolibre.app/user-guide/map-controls/#camera-overlay-and-recording-tools).

## What Sun Simulation does

The implementation uses NOAA-style low-precision solar equations to derive the
subsolar point and the sun's altitude and azimuth for the selected instant and
map center. It then:

1. draws a generated canvas raster over the night hemisphere, with a soft
   twilight transition;
2. calls MapLibre's `map.setLight()` using the calculated azimuth and altitude;
3. warms and dims the light near the horizon and at night;
4. exposes date/time, **Now**, scrub, play/pause, playback speed, loop, and
   night-shade opacity controls;
5. persists the panel state and settings in the GeoLibre project.

The source describes this as reproducing the core of Google Earth's sun feature,
but its own implementation boundary is explicit: the canvas overlay provides
day/night shading and `setLight()` lights 3D buildings and models.
[GeoLibre Sun source](https://github.com/opengeos/GeoLibre/blob/v2.4.0/packages/plugins/src/plugins/maplibre-sun.ts)

## What it does not do

### No time-reactive skybox

Sun Simulation never calls `map.setSky()` and does not modify the Atmospheric
Effects engine. Atmospheric Effects separately draws deep space, a starfield,
comets, and a globe atmosphere halo; it is not connected to the Sun clock.
[GeoLibre Atmospheric Effects source](https://github.com/opengeos/GeoLibre/blob/v2.4.0/packages/plugins/src/plugins/maplibre-effects.ts)

MapLibre itself supports style-level sky/fog appearance through `map.setSky()`
and the root `sky` style object, but those settings must be wired to the solar
clock if GeoLibre should transition from daylight through sunset to night.
[MapLibre sky/fog/terrain example](https://github.com/maplibre/maplibre-gl-js/blob/v5.19.0/test/examples/sky-fog-terrain.html)

### No projected ground shadows

`map.setLight()` controls directional lighting of extruded geometry; it is not
a shadow-map API. GeoLibre's Sun plugin creates no shadow camera, depth texture,
caster/receiver pass, or ground receiver. MapLibre's official fill-extrusion
shader likewise implements lighting rather than projected cast shadows.
[MapLibre fill-extrusion vertex shader](https://github.com/maplibre/maplibre-gl-js/blob/main/src/shaders/glsl/fill_extrusion.vertex.glsl)

Consequently, the apparent "ground shadow" is most likely the combination of
the night raster and changing face illumination on 3D geometry, not geometry
casting a moving silhouette onto the basemap or DEM terrain.

## Status and compatibility

Sun Simulation shipped by GeoLibre v2.0.0 and remains present in the stable
v2.4.0 source. GeoLibre v2.4.0's private `@geolibre/plugins` workspace package
uses `maplibre-gl: ^5.24.0`; this repository is currently GeoLibre 2.2.0 and uses
the same MapLibre range. The plugin is registered as a built-in and is inactive
by default, so users need only open **Controls → Sun**—there is nothing to
install.

Sources: [GeoLibre releases](https://github.com/opengeos/GeoLibre/releases),
[v2.4.0 plugin package](https://github.com/opengeos/GeoLibre/blob/v2.4.0/packages/plugins/package.json),
[GeoLibre plugin API](https://github.com/opengeos/GeoLibre/blob/v2.4.0/docs/plugin-api.md),
[official plugin registry](https://plugins.geolibre.app/plugin-registry.json).

## Usage

For an end user:

1. Open **Controls → Sun**.
2. Choose a date and time or press **Now**.
3. Scrub the day, or press play and choose a playback speed.
4. Adjust the night-shade opacity if desired.

For code already inside the GeoLibre monorepo:

```ts
import { maplibreSunPlugin, setSunSettings } from "@geolibre/plugins";

manager.register(maplibreSunPlugin);
manager.activate("geolibre-sun", appApi);

setSunSettings({
  dateMs: new Date("2026-08-07T18:00:00Z").getTime(),
  playing: false,
  shadeOpacity: 0.55,
});
```

This is an internal integration example, not a public npm installation recipe:
`@geolibre/plugins` is a private workspace package.

## Related Three.js package that may cause confusion

GeoLibre also depends on
[`@dvt3d/maplibre-three-plugin`](https://www.npmjs.com/package/@dvt3d/maplibre-three-plugin),
a MapLibre/Three.js bridge. Its public API has a `Sun` object with `currentTime`
and `castShadow`, plus `Creator.createShadowGround()`. Those primitives can
support real Three.js shadows when a scene is configured with shadow-casting
objects and a receiving ground mesh.
[Official source and API](https://github.com/dvt3d/maplibre-three-plugin#sun)

However, GeoLibre's `geolibre-sun` implementation does not instantiate that
package's `Sun` or `createShadowGround()` APIs. The presence of the dependency
therefore does not mean the current Controls → Sun feature casts shadows.

## Practical implication for the digital twin

The existing Sun Simulation is a solid clock, solar-position, and day/night
foundation. A fully realistic time-of-day mode would still need two additional
rendering layers:

- bind sky colors, fog, atmosphere, and possibly stars to solar altitude; and
- implement renderer-specific cast shadows for 3D assets and an appropriate
  terrain/ground receiver.

That work should extend the existing clock rather than replace it, while keeping
MapLibre extrusion lighting distinct from Three.js/Cesium shadow rendering.
