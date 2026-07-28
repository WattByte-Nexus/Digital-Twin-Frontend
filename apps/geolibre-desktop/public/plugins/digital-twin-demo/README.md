# Digital Twin Demo plugin

This first-party bundled plugin connects GeoLibre to the Digital Twin Engine
HTTP API. It provides:

- published-region and exact weather selection;
- visible map polygons for all published region bounds, with the selection highlighted;
- clickable Engine tree assets as ignition points;
- synthetic-wind scenario controls;
- run submission, polling, cancellation, and recent-run recovery;
- browser-ready weather and Earth Engine layer discovery; and
- completed burn-footprint GeoJSON rendering.

The default API URL is `http://127.0.0.1:8000`. A deployment can set
`window.__DIGITAL_TWIN_API_URL__` before GeoLibre starts, or the user can edit
the URL in the panel. The last successful value is retained in local storage.

The current Engine metadata endpoints do not yet return renderable weather or
Earth Engine URLs. The plugin detects the additive `/map-layers` endpoints and
shows a clear metadata-only state when they are unavailable.

For local development, restart `npm run dev` after adding or updating a bundled
plugin so Vite rescans `public/plugins/`.

## Seed the Boulder demo region

With the Digital Twin Engine API running locally, create and publish a region
from this plugin's bundled power-line and tree GeoJSON:

```sh
npm run seed:digital-twin:boulder
```

The command derives padded WGS84 bounds from `testpowerlines.geojson` and
`testtrees.geojson`, creates the draft through `POST /api/v1/regions`, uploads
each feature through `POST /api/v1/regions/{region_id}/assets`, and finishes
with `POST /api/v1/regions/{region_id}/publish`. It creates a new region on each
run. Use `-- --help` to see API URL, region-name, source-file, and concurrency
overrides.
