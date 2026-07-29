# Digital Twin Demo plugin

This first-party bundled plugin connects GeoLibre to the Digital Twin Engine
HTTP API. It provides:

- curated Golden and seeded Boulder region selection for wildfire inputs;
- visible map polygons for those demo-region bounds, with the selection highlighted;
- clickable Engine tree assets as ignition points;
- synthetic-wind scenario controls;
- run submission, durable live SSE progress, cancellation, and recent-run recovery;
- browser-ready weather and Earth Engine layer discovery across every curated
  coverage, independent of the selected wildfire region; and
- completed burn-footprint GeoJSON rendering.

Active runs are monitored through
`GET /api/v1/simulation-runs/{run_id}/events`. The browser reconnects the
stream with its last SSE event ID, the panel replaces local counts after a
`stream_reset`, and terminal events close the browser connection before the
authoritative run and result resources are refreshed. Status polling remains a
compatibility fallback when the event stream cannot be opened.

The default API URL is `http://127.0.0.1:8000`. A deployment can set
`window.__DIGITAL_TWIN_API_URL__` before GeoLibre starts, or the user can edit
the URL in the panel. The last successful value is retained in local storage.

The Engine publishes renderable weather and Earth Engine descriptors through
region-scoped `/map-layers` endpoints. The plugin queries every curated region
and groups matching bands into one **Add all** action, so changing the wildfire
region does not remove or clip environmental visualization coverage. It shows a
clear metadata-only state when those endpoints are unavailable.

For local development, restart `npm run dev` after adding or updating a bundled
plugin so Vite rescans `public/plugins/`.

## Seed the Boulder demo region

With the Digital Twin Engine API running locally, create and publish a region
from this plugin's large synthetic feeder and the City of Boulder public-tree
inventory:

```sh
npm run seed:digital-twin:boulder
```

The command uploads the 327 individual spans from
`boulder_13_8kv_feeder_large.geojson`, downloads every page of the official
public-tree inventory, and excludes trees assigned to a property whose name
contains `Lake`. This removes the Wonderland Lake Park, Maxwell Lake Park, and
Coot Lake clusters without excluding ordinary street trees on roads such as
Silver Lake Avenue. The current 50,212-record source therefore contributes
49,444 trees. The command creates a draft covering the padded asset extent
through `POST /api/v1/regions`, uploads assets in bounded 1,000-record batches
through `POST /api/v1/regions/{region_id}/assets:batch`, and finishes
with `POST /api/v1/regions/{region_id}/publish`. It creates a new region on each
run. The plugin uses the Engine's canonical `boulder-co` region for Boulder
wildfire weather, bounds, and simulation requests, while loading map assets from
the newest published region named `Boulder Demo`. Environmental map layers are
assembled separately across all curated coverages. Rerunning the seed therefore
replaces the Boulder asset overlay without disconnecting it from the Engine's
weather-enabled region identity. Keep that default name for the bundled demo
selector. Use `-- --help` to see API URL, source-file, concurrency, and advanced
region-name overrides.
