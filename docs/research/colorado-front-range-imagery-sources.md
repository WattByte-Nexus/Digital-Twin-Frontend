# Colorado Front Range high-resolution imagery sources

Checked 2026-08-07. This note answers whether the Boulder 2020 3-inch imagery has newer versions and whether one source can cover Boulder, Golden, and Denver.

## Decision

Yes. Use **DRCOG DRAPP 2022** for the next demo iteration.

- It is the newest publicly reachable regional orthophoto source found that covers **Boulder, Golden, and Denver in one mosaic**.
- The public DRCOG/Sanborn ImageServer reports a **0.25-foot pixel size (3 inches)**, four bands (RGB + infrared), and a geographic envelope of **-105.939624 to -103.668018 longitude and 39.104426 to 40.321386 latitude**. That envelope contains all three cities. [DRCOG 2022 ImageServer metadata](https://drcog-data.sanborn.com/arcgis/rest/services/DRCOG_2022/DRCOG_Mosaics_2022/ImageServer?f=pjson) and [WMS capabilities](https://drcog-data.sanborn.com/arcgis/services/DRCOG_2022/DRCOG_Mosaics_2022/ImageServer/WMSServer?service=WMS&request=GetCapabilities&version=1.3.0).
- A newer **DRAPP 2024** acquisition exists. DRCOG says it covered about 6,000 square miles, was delivered, and its web service was streaming by the end of 2025. However, DRCOG's published ArcGIS item identifies that service as **secured**, and DRCOG says current imagery is purchased from Sanborn while past imagery is available free. It is therefore not a safe anonymous production dependency without a license/service agreement. [DRCOG 2024 delivery status](https://www.drcog.org/sites/default/files/acc/TPO-GF-25UPWPENDOFYEAR-EN-ACC-25-12-10-V1.pdf), [DRCOG data acquisition policy](https://www.drcog.org/data-maps-modeling/data-acquisition-projects), and [DRCOG 2024 secured ArcGIS item](https://www.arcgis.com/home/item.html?id=c0cdf1b06693418ab5e470696046ea33).
- DRCOG is planning the 2026 acquisition, but no 2026 imagery is available yet. [DRAPP 2026 planning notice](https://www.drcog.org/events/drcog-denver-regional-aerial-photography-project-0).

In short: **2020 → 2022 is a real upgrade; 2024 exists but requires commercial/partner access.**

## Source comparison

| Source | Newest relevant public year | Resolution | Coverage | Web delivery | Terms / operational note |
|---|---:|---:|---|---|---|
| DRCOG/Sanborn regional mosaic | **2022** | **0.25 ft / 3 in** reported pixel size | Boulder, Golden, Denver, and the broader DRCOG region | Public ArcGIS ImageServer and WMS 1.3.0 | DRCOG says past imagery is free; the service item does not publish a full reuse license or SLA. Confirm commercial reuse and do not depend on vendor hotlinking for production. |
| City of Boulder `AP2020Cached3inWM` | 2020 | 3 in; Web Mercator cache through LOD 21 | Boulder County extent | Direct ArcGIS cached XYZ-compatible tiles | Public endpoint, but item license fields are blank. Flights occurred spring/summer 2020. [Service metadata](https://maps.bouldercolorado.gov/arcgis/rest/services/raster/AP2020Cached3inWM/MapServer). |
| City of Boulder `AP2022DRCOGCached` | **2022** | Finest cache resolution 0.434 ft (~5.2 in) | Boulder-area DRCOG extract | ArcGIS tile cache in Colorado State Plane, only 10 LODs | Newer than the current source, but its non-Web-Mercator tile matrix is not a drop-in MapLibre XYZ source. [Service metadata](https://maps.bouldercolorado.gov/arcgis/rest/services/raster/AP2022DRCOGCached/MapServer). |
| City and County of Denver | 2020 city-hosted imagery; **2022 via DRCOG** | Denver's public 2020 ImageServer is DRAPP; the regional 2022 source is 3 in | Denver or regional, depending on endpoint | ArcGIS ImageServer | Denver's organization did not expose a public 2022 or 2024 orthophoto ImageServer in its imagery search; its public 2020 service carries an “as is / not for engineering” disclaimer. [Denver 2020 ArcGIS item](https://www.arcgis.com/home/item.html?id=1761e6fa37b347b3993d0cf08246ec60). |
| Jefferson County / Golden | **2022** | 0.1524 m / 6 in | Jefferson County, including Golden | Public Web-Mercator ArcGIS ImageServer | County catalog's newest DRAPP service is 2022. County open-data page says downloadable GIS data is CC BY 4.0; image service itself includes planning-use disclaimers and no explicit engineering warranty. [Jeffco DRAPP catalog](https://gisportal.jeffco.us/image/rest/services/DRAPP), [DRAPP 2022 ImageServer](https://gisportal.jeffco.us/image/rest/services/DRAPP/DRAPP2022/ImageServer), [Jeffco open-data terms](https://www.jeffco.us/3165/Maps-Data-Download). |
| USGS The National Map imagery | Composite, refreshed June 2024 | Usually NAIP at 1 m; source may vary from 6 in to 1 m | Nationwide | Cached Web-Mercator XYZ/ArcGIS tiles | Public domain and operationally simple, but much less detailed than DRAPP 2022. [USGS service metadata](https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer) and [USGS service FAQ](https://www.usgs.gov/faqs/what-are-urls-imagery-services-national-map-and-are-they-cached-or-dynamic). |
| USDA NAIP via USGS | Acquisition cycle of no more than 3 years; current local year must be read from tile metadata | Primarily 0.6 m since 2018 | Statewide / nationwide | Downloads; USGS composite web service | Public domain and suitable as a statewide fallback, but roughly eight times coarser per pixel than 3-inch DRAPP. It is leaf-on imagery, which can obscure utility corridors under canopy. [USGS NAIP archive](https://www.usgs.gov/centers/eros/science/usgs-eros-archive-aerial-photography-national-agriculture-imagery-program-naip) and [USGS public-domain imagery statement](https://www.usgs.gov/national-map-supporting-themes). |

### Important resolution detail

The DRCOG 2022 regional ImageServer's `pixelSizeX` and `pixelSizeY` are `0.25` in a US-foot State Plane source CRS, so the source pixels are 3 inches. The public Jeffco copy is a different mosaic with `pixelSizeX ≈ 0.1524` metres, or 6 inches. The DRCOG regional mosaic is therefore the better single source for the demo.

## MapLibre-compatible demo integration

The public WMS advertises EPSG:4326 and EPSG:6428, but not EPSG:3857. Use the ArcGIS ImageServer `exportImage` operation instead; it successfully accepts Web Mercator input and output extents.

```ts
const DRAPP_2022_URL =
  "https://drcog-data.sanborn.com/arcgis/rest/services/" +
  "DRCOG_2022/DRCOG_Mosaics_2022/ImageServer/exportImage" +
  "?bbox={bbox-epsg-3857}" +
  "&bboxSR=3857" +
  "&imageSR=3857" +
  "&size=256,256" +
  "&format=jpgpng" +
  "&f=image";

const imagerySource = {
  type: "raster" as const,
  tiles: [DRAPP_2022_URL],
  tileSize: 256,
  minzoom: 8,
  maxzoom: 21,
  bounds: [-105.939624, 39.104426, -103.668018, 40.321386],
  attribution: "DRCOG / Sanborn — DRAPP 2022",
};
```

This was verified with an anonymous `exportImage` request using a 3857 bounding box; the service returned a 256 × 256 image and a 3857 output extent. The service dynamically renders each request rather than serving a standard Web-Mercator cache, so it is appropriate for the Storybook/demo slice but not the preferred production distribution path.

Retain the current USGS imagery layer underneath it as the statewide fallback. The DRAPP layer will then provide high detail inside its bounds, while USGS avoids a blank map outside the Front Range mosaic.

## Production strategy

Do not make the shipping product dependent on an undocumented anonymous Sanborn endpoint.

1. Obtain DRAPP 2022 downloads or license the current DRAPP 2024 imagery from DRCOG/Sanborn. Get explicit confirmation of commercial web-display, derivative-tile, cache, and attribution rights.
2. Store the licensed regional source in object storage as source COGs, or retain the delivered GeoTIFF/MrSID masters in the ingestion tier.
3. Publish a Web-Mercator raster tile pyramid through the product's own CDN. Prefer immutable versioned URLs such as `/imagery/drapp/2022/{z}/{x}/{y}.jpg` and a small metadata record containing acquisition date, source resolution, bounds, attribution, and license identifier.
4. Keep imagery versions side by side. Do not overwrite 2022 when 2024 is licensed; time comparison will be useful for asset-change detection.
5. Use DRAPP as the Front Range high-resolution layer and public-domain NAIP/USGS imagery as the statewide fallback. For corridors outside either source, ingest project-specific COGs through the same tiling path.

This approach gives the demo a quick, visible improvement now while establishing a production path with stable performance, controlled caching, known rights, and repeatable versioning.

## Exact answers by city

- **Boulder:** latest city-catalog imagery is 2022, newer than the current 2020 3-inch layer. The regional DRCOG 2022 mosaic is the simpler upgrade because it is one source shared with Denver and Golden.
- **Denver:** DRCOG 2022 is the newest public regional imagery found. Denver's own public imagery service is still 2020.
- **Golden:** Jefferson County publishes DRAPP 2022 at 6 inches, while the regional DRCOG 2022 mosaic provides a 3-inch source and also covers the other two cities.
- **Later than 2022:** DRAPP 2024 exists and is newer, but is secured/current commercial imagery. It should be treated as a procurement option, not anonymously hotlinked.

