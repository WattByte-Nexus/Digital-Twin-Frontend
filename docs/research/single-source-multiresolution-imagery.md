# Single-source multiresolution imagery for the Digital Twin map

Checked 2026-08-12. This note supersedes only the two-source presentation recommendation in [Colorado Front Range high-resolution imagery sources](./colorado-front-range-imagery-sources.md); its acquisition and licensing research remains useful.

## Decision

Use **Mapbox Satellite (`mapbox.satellite`) as the sole client-visible imagery pyramid**. Keep the existing vector reference overlay and terrain DEM, but remove both the USGS imagery fallback and the separate DRAPP imagery layer from the rendered style.

Mapbox describes Satellite as one complete composite imagery layer whose inputs are color-corrected and blended into one raster tileset. It has global coverage through zoom 16 at 1–2 m, regional coverage through zoom 18 at 0.6–0.3 m, and selected coverage through zoom 21+ at 7.5 cm or better. The same documented endpoint serves every tier. [Mapbox Satellite tileset reference](https://docs.mapbox.com/data/tilesets/reference/mapbox-satellite/)

This is a particularly strong fit for the current Colorado view: Mapbox says its November 2025 Vexcel update includes Denver, generally at 10–20 cm and approximately 15 cm for the listed metropolitan areas. That is coarser than DRAPP's nominal 3-inch source pixels, but it is still high-resolution aerial imagery and avoids switching between independently rendered USGS and DRAPP layers in the client. The update announcement names Denver, not the exact Boulder-to-Golden footprint, so exact coverage must be verified in a trial account before committing. [Mapbox 2025 Denver aerial-imagery update](https://www.mapbox.com/blog/670k-sq-km-of-updated-aerial-imagery-for-the-us-and-europe) and [DRAPP 2022 service metadata](https://drcog-data.sanborn.com/arcgis/rest/services/DRCOG_2022/DRCOG_Mosaics_2022/ImageServer?f=pjson)

## What this fixes—and what it cannot fix

The current app defines a USGS cached raster fallback and a bounded DRAPP dynamic ImageServer raster, then keeps the fallback visible underneath the primary. When primary tiles arrive non-uniformly, the viewport can temporarily reveal two unrelated acquisitions and color treatments tile by tile. [Current Digital Twin imagery configuration](../../apps/geolibre-desktop/src/product-modes/digital-twin/satellite-terrain-config.ts) and [current two-layer style construction](../../packages/map/src/satellite-terrain-style.ts)

One `raster` source and one imagery layer remove that **client-side source mismatch**: every visible imagery tile comes from the same provider-managed pyramid, so slow arrival cannot expose USGS in one square and DRAPP in the next.

It does **not** guarantee one camera acquisition, date, or native resolution at all scales. Mapbox says the composite changes inputs by zoom and availability: MODIS at low zooms, primarily Maxar/Landsat in the middle, Maxar Vivid at zooms 13–16, and Vexcel or open aerial imagery above zoom 16 where available. Consequently, acquisition boundaries, seasonal differences, or a perceptible change while zooming can still exist; the improvement is that blending, color correction, source selection, and pyramid generation are owned by one imagery provider instead of being improvised by two client layers. [Mapbox Satellite data sources and zoom tiers](https://docs.mapbox.com/data/tilesets/reference/mapbox-satellite/) and [Mapbox imagery quality-control description](https://docs.mapbox.com/help/dive-deeper/imagery/)

## Recommended access contract

Prefer the provider's TileJSON as the MapLibre raster-source URL so source metadata and attribution remain provider-controlled:

```text
https://api.mapbox.com/v4/mapbox.satellite.json?access_token=<PUBLIC_MAPBOX_TOKEN>
```

If explicit tile URLs are required, Mapbox documents this XYZ template:

```text
https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90?access_token=<PUBLIC_MAPBOX_TOKEN>
```

The Raster Tiles API accepts standard `{z}/{x}/{y}` XYZ requests, requires a valid Mapbox access token, and supports `@2x`; Mapbox Satellite responses are JPEG even when another image extension is requested. Mapbox also publishes an official MapLibre example using a 256-pixel raster source with `maxzoom: 22`. [Raster Tiles API](https://docs.mapbox.com/api/maps/raster-tiles/) and [Mapbox APIs in MapLibre](https://docs.mapbox.com/help/ja/dive-deeper/mapbox-in-maplibre/)

This is a direct fit for the repository's MapLibre style model because `SatelliteRasterSource` is a MapLibre `RasterSourceSpecification` without the `type` field, and the style builder already creates the `raster` source and layer around it. [Satellite source type and style builder](../../packages/map/src/satellite-terrain-style.ts)

The imagery replacement should therefore be narrow:

- configure only `satelliteSource` with Mapbox TileJSON (or its XYZ template);
- delete `satelliteFallbackSource` from the Digital Twin configuration and delete the obsolete fallback source/layer path from the style implementation;
- keep the OpenFreeMap reference overlay as vector context and keep Mapterhorn as the terrain DEM, because neither is a second photographic imagery source.

This note does not make those product-code changes.

## Commercial, attribution, and operational constraints

- **Authentication:** every API request needs the account's API key/access token. Mapbox's terms make the account owner responsible for API-key use. [Mapbox Raster Tiles API authentication](https://docs.mapbox.com/api/maps/raster-tiles/) and [Mapbox Terms of Service](https://www.mapbox.com/legal/tos)
- **Attribution:** a map using Mapbox data must show the Mapbox logo and text attribution. Additional provider attribution is carried in TileJSON; Mapbox's satellite attribution guidance currently also calls for Maxar credit. An open-source renderer does not add all required branding automatically, so the app must explicitly render it. [Mapbox attribution requirements](https://docs.mapbox.com/help/dive-deeper/attribution/)
- **License scope:** this is licensed, hosted basemap content—not public-domain source imagery. Mapbox grants a revocable application-use license subject to its terms; its current terms also say production business-intelligence or analytics applications require a separate commercial license under an active order. The Digital Twin product should obtain Mapbox's written classification before production use and must not assume raw-imagery download, redistribution, offline, or analytic rights. [Mapbox Terms of Service](https://www.mapbox.com/legal/tos)
- **Caching:** the Raster Tiles API currently returns a 12-hour device cache TTL and a 5-minute shared-CDN TTL. Provider imagery updates are added without an integration change, but can become visible tile by tile as caches expire. [Raster Tiles API cache behavior](https://docs.mapbox.com/api/maps/raster-tiles/)
- **Limits:** the default Raster Tiles API rate limit is 100,000 requests per minute per token. [Mapbox API limits](https://docs.mapbox.com/api/)
- **Pricing:** Mapbox currently lists 750,000 Raster Tiles API requests per month free, then $0.25 per 1,000 through 2 million, $0.20 per 1,000 through 4 million, and $0.15 per 1,000 above 4 million, with sales pricing at very high volume. Pricing is usage-based and can change, so production budgeting should link to the live schedule rather than copy these values into product documentation. [Mapbox pricing, Raster Tiles API](https://www.mapbox.com/pricing)

## Candidate comparison

| Candidate | One client-visible pyramid | Colorado/detail evidence | MapLibre access | Cost and terms | Assessment |
|---|---|---|---|---|---|
| **Mapbox Satellite** | Yes. Mapbox calls it one complete color-corrected, blended composite, although upstream sources vary by zoom and geography. [Official tileset reference](https://docs.mapbox.com/data/tilesets/reference/mapbox-satellite/) | Global z16, regional z18, selected z21+; Denver received approximately 15 cm Vexcel imagery in 2025. [Coverage tiers](https://docs.mapbox.com/data/tilesets/reference/mapbox-satellite/) and [Denver update](https://www.mapbox.com/blog/670k-sq-km-of-updated-aerial-imagery-for-the-us-and-europe) | Direct TileJSON or XYZ raster API; Mapbox publishes a MapLibre example. [Raster API](https://docs.mapbox.com/api/maps/raster-tiles/) and [MapLibre example](https://docs.mapbox.com/help/ja/dive-deeper/mapbox-in-maplibre/) | Token, logo and text/provider attribution; 750k free requests/month before usage fees; production analytics may require a commercial order. [Attribution](https://docs.mapbox.com/help/dive-deeper/attribution/), [pricing](https://www.mapbox.com/pricing), and [terms](https://www.mapbox.com/legal/tos) | **Recommended.** Best explicit evidence for both visual blending and current Denver high resolution. |
| **MapTiler Satellite (`satellite-v2`)** | Yes from the client perspective. MapTiler calls it a virtual tileset that behaves like one object but draws from multiple sources. [Satellite schema](https://docs.maptiler.com/schema-raster/satellite/) | z0–22, 2 m globally, up to 7.5 cm in selected areas. Its public schema says the base satellite imagery is from 2021 and does not identify current Denver coverage, so a coverage trial is required. [Satellite schema](https://docs.maptiler.com/schema-raster/satellite/) | Direct raster TileJSON/XYZ is supported by MapLibre; the documented alias is `https://api.maptiler.com/tiles/satellite/tiles.json?key=...`. [MapTiler raster-source documentation](https://docs.maptiler.com/gl-style-specification/sources/) | Free is personal/non-commercial with 100k API requests and a logo; Flex is $30/month with 500k API requests, then $0.15/1k. Text attribution is always required, and proxying requires written approval. [Pricing](https://www.maptiler.com/cloud/pricing/), [attribution](https://docs.maptiler.com/guides/map-design/attribution/add-attribution/), and [Cloud terms](https://www.maptiler.com/terms/cloud/) | **Runner-up.** Simple and economical, but weaker public evidence for recent, high-resolution Denver coverage and explicit cross-tier color blending. |
| **ArcGIS Imagery / World Imagery** | Yes from the client perspective through the ArcGIS imagery basemap style, but World Imagery contains different source imagery by location and scale. [ArcGIS imagery style](https://developers.arcgis.com/rest/basemap-styles/arcgis-imagery-style-get/) and [World Imagery item](https://www.arcgis.com/home/item.html?id=fdf1e82456ca44c58776a6bcc4de8848) | Esri describes low-resolution global imagery and high-resolution satellite/aerial imagery, typically 3–5 years current, for most of the world; it does not publish a simple guaranteed Denver resolution on the style endpoint. [ArcGIS imagery style](https://developers.arcgis.com/rest/basemap-styles/arcgis-imagery-style-get/) | The authenticated service returns a Mapbox Style Specification v8 style and the official docs include a MapLibre workflow. [ArcGIS imagery style](https://developers.arcgis.com/rest/basemap-styles/arcgis-imagery-style-get/) and [ArcGIS basemap styles](https://developers.arcgis.com/documentation/mapping-and-location-services/mapping/basemaps/arcgis-styles/) | Account/token and Esri/data attribution are required. Location Platform pricing is currently 2 million free tiles/month then $0.15/1k, or 1,000 free sessions then $4/1k sessions. [Pricing and terms](https://developers.arcgis.com/rest/basemap-styles/) and [attribution](https://developers.arcgis.com/documentation/esri-and-data-attribution/) | **Strong cost alternative.** Less explicit evidence that its cross-scale imagery is color-matched, and adopting a provider-supplied full style is more invasive than swapping one raster source. |
| **USGS Imagery Only** | Yes; it is already the app's fallback and is one cached Web Mercator tile service. [USGS service metadata](https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer) | Most CONUS content is 1 m NAIP and the service is visible only to about 1:9,028; its metadata says data was refreshed in June 2024. It cannot preserve DRAPP-level detail at the product's close zooms. [USGS service metadata](https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer) | Direct 256-pixel ArcGIS cache tiles in EPSG:3857; no key is needed. [USGS service FAQ](https://www.usgs.gov/faqs/what-are-urls-imagery-services-national-map-and-are-they-cached-or-dynamic) and [projection FAQ](https://www.usgs.gov/faqs/what-projection-are-imagery-services-national-map-viewer) | Public-domain imagery layer. [USGS source/usage statement](https://www.usgs.gov/media/images/tnmcorps-national-map-imagery-layer) | **Free fallback option only.** It solves checkerboarding if used alone, but at a large loss of close-range detail and freshness. |

Google's 2D satellite tiles also form one provider-managed z0–22 pyramid, but their session-token lifecycle, viewport-dependent maximum-zoom/attribution requests, prohibition on non-visualization use and offline caching, and per-tile billing make them a more complicated fit than the finalists above. [Google 2D Tiles overview](https://developers.google.com/maps/documentation/tile/2d-tiles-overview), [session tokens](https://developers.google.com/maps/documentation/tile/session_tokens), [policies](https://developers.google.com/maps/documentation/tile/policies), and [pricing](https://developers.google.com/maps/billing-and-pricing/pricing)

## Acceptance spike before implementation

Use a restricted Mapbox trial token and capture the same pitched camera path at zooms 10, 13, 15, 17, 19, and 21 over Denver, Golden, Boulder, the foothills, and the eastern edge of the current DRAPP bounds. The trial should pass only if:

1. no second photographic source exists in the MapLibre style or DOM;
2. partially loaded frames never reveal the old USGS/DRAPP checkerboard;
3. Denver, Golden, and Boulder all retain acceptable detail at the product's operational close zooms;
4. zoom transitions and acquisition seams are acceptable in both light and dark imagery treatment;
5. required logo and provider attribution remain visible in the app and exported captures;
6. a tile-request trace supports a realistic monthly cost model; and
7. Mapbox confirms the production license category in writing for this Digital Twin analytics application.

If the exact Boulder-to-Golden high-resolution footprint is insufficient, test MapTiler and ArcGIS with the identical camera path before considering a return to self-hosted licensed imagery. Do not restore two live photographic layers as a fallback; a product-owned, preblended and color-normalized Web Mercator pyramid would be the long-term deterministic alternative.
