# USGS LiDAR 3D Tiles

GeoLibre includes a reproducible pilot pipeline that streams a small area from
the USGS 3D Elevation Program, applies the correct vertical-datum conversion,
and creates a static OGC 3D Tiles point cloud for the existing 3D Tiles viewer.

## Build the Golden pilot

Install [`uv`](https://docs.astral.sh/uv/) and run:

```sh
npm run build:lidar:golden
```

The script installs its pinned Python dependencies in an isolated environment,
streams only a 200-by-200-meter query, and writes:

```text
apps/geolibre-desktop/public/data/usgs-lidar/golden-pilot/tileset.json
```

The **Digital Twin / Map Workspace** Storybook story loads the dataset directly.
In GeoLibre, open the **3D Tiles** panel and select
**Golden USGS LiDAR (3DEP)** from its sample-data menu. The generated URL is:

```text
/data/usgs-lidar/golden-pilot/tileset.json
```

The same URL works in both the MapLibre/deck.gl map and the Cesium globe.

## Build another area

Pass a center, output directory, and query size after `--`:

```sh
npm run build:lidar:golden -- \
  --center-lon -105.265 \
  --center-lat 40.010 \
  --size-m 500 \
  --output apps/geolibre-desktop/public/data/usgs-lidar/custom-area
```

The selected EPT collection must cover the requested location. Use `--ept-url`
for a different USGS collection. Query sizes should be increased gradually;
point count, conversion time, repository size, and browser memory all grow with
area.

Some 3DEP collections classify buildings as ASPRS class 6. Retain only ground
and building points when that classification exists:

```sh
npm run build:lidar:golden -- --classifications 2 6
```

The default **CO DRCOG 2 2020** project covers Golden. The National Map's
**CO Eastern B2 QL2 North 2018** project does not overlap Golden, so using that
collection at this center returns no points. The default intentionally keeps all
classifications so measured roofs and vegetation remain visible.

## Height and color handling

USGS Golden elevations use NAVD88 with GEOID18. Web 3D globes use ellipsoidal
height, so the script queries NOAA's GEOID18 service at the requested center and
applies `ellipsoid height = NAVD88 height + geoid height` before tiling. Supply
`--geoid-height` to use a precomputed correction in an offline build.

The source has intensity rather than aerial RGB values. The pilot adds a
deterministic elevation/intensity color ramp while preserving the measured XYZ
geometry and ASPRS classification values.

## Data rights

USGS 3DEP products are public-domain United States government data, available
free of charge and without use restrictions. Each generated output contains a
`source.json` file recording its source URL, query bounds, point count, and
vertical correction.
