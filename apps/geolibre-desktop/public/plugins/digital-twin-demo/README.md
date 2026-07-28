# Digital Twin Demo plugin

This first-party bundled plugin connects GeoLibre to the Digital Twin Engine
HTTP API. It provides:

- published-region and exact weather selection;
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
