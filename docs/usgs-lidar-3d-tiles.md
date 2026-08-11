# USGS LiDAR 3D Tiles

GeoLibre includes a reproducible pilot pipeline that streams a small area from
the USGS 3D Elevation Program, applies the correct vertical-datum conversion,
and creates a static OGC 3D Tiles point cloud for the existing 3D Tiles viewer.

## Build Golden

Install [`uv`](https://docs.astral.sh/uv/) and run:

```sh
npm run build:lidar:golden
```

The script installs its pinned Python dependencies in an isolated environment,
loads Golden's current municipal boundary from the U.S. Census Bureau, streams
its complete continuous bounding envelope at a 1-meter EPT sampling resolution,
retains above-ground vegetation, building, conductor, and transmission-tower
classifications, spatially thins the 1 m query to one surface sample per
4 × 4 × 3 m display voxel, and samples DRAPP 2022 orthophoto color onto the
result. Unlike the former random city-wide cap, this preserves consistent local
building density; conductor and tower points are retained in full. The terrain
supplies the ground surface, so ground-class points are deliberately omitted.
The continuous envelope fills
municipal holes and irregular annexation gaps so no visible part of Golden
disappears. It writes:

```text
apps/geolibre-desktop/public/data/usgs-lidar/golden-city/tileset.json
```

The **Digital Twin / Map Workspace** Storybook story and the migrated core-app
workspace load the dataset directly. In GeoLibre's expert workspace, open the
**3D Tiles** panel and select **Golden USGS LiDAR (3DEP)** from its sample-data
menu. The generated URL is:

```text
/data/usgs-lidar/golden-city/tileset.json
```

The same URL works in both the MapLibre/deck.gl map and the Cesium globe.

## Adjust density

Increase the EPT sampling resolution after `--` to trade detail for build time,
download size, repository size, and browser memory:

```sh
npm run build:lidar:golden -- \
  --query-resolution 2
```

Use `--boundary-url` for another municipal GeoJSON query and `--ept-url` for a
different USGS collection. The selected EPT collection must cover the requested
boundary.

The default retains ASPRS unclassified class 1 (which carries most above-ground
returns in this collection), vegetation classes 3–5, building class 6,
conductor class 14, and transmission-tower class 15. Override it when another
collection uses different classifications:

```sh
npm run build:lidar:golden -- --classifications 3 4 5 6
```

The default **CO DRCOG 2 2020** project covers Golden. The National Map's
**CO Eastern B2 QL2 North 2018** project does not overlap Golden, so using that
collection at this center returns no points.

## Height and color handling

USGS Golden elevations use NAVD88. This product is fused with MapLibre
`raster-dem` terrain, whose elevation samples are also sea-level heights, so the
build retains the source Z values. Applying a GEOID18 ellipsoid correction here
would lower Golden's points by about 15.6 m relative to the rendered terrain and
depth-occlude the surfels. A standalone globe export must instead transform both
the terrain and point cloud to the same ellipsoidal-height convention.

The source has intensity rather than aerial RGB values. The build requests a
Web-Mercator DRCOG/Sanborn DRAPP 2022 orthophoto over the same bounds and samples
that raster at every point's XY coordinate. Sparse conductor and tower classes
receive semantic accent colors so utility geometry remains legible. Use
`--imagery-url` to select a licensed/versioned source and `--imagery-size` to
control the sampling raster's maximum dimension.

The MapLibre workspace renders the resulting 3D Tiles through deck.gl in an
interleaved WebGL context, allowing point splats and terrain to share depth. Its
point-cloud sublayer uses bounded screen-space Gaussian surfels for softer fill;
this is a display treatment, not a multi-view 3D Gaussian reconstruction. The
Cesium workspace enables attenuation and eye-dome lighting for the same tileset.

## Data rights

USGS 3DEP products are public-domain United States government data, available
free of charge and without use restrictions. Each generated output contains a
`source.json` file recording its source URL, query bounds, point count, and
vertical correction. Imagery-derived color remains subject to the imagery
provider's terms; production builds should use a licensed, versioned imagery
asset rather than depend on the anonymous demo endpoint.
