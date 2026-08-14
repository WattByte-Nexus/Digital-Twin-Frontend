import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getMapboxAccessToken,
  getMapboxGlyphsUrl,
  getMapboxSatelliteTileUrlTemplate,
  getMapboxStreetsTileJsonUrl,
} from "@geolibre/core";

describe("Mapbox Satellite runtime configuration", () => {
  it("treats a missing or blank token as unavailable", () => {
    assert.equal(getMapboxAccessToken({}), undefined);
    assert.equal(getMapboxAccessToken({ VITE_MAPBOX_ACCESS_TOKEN: "  " }), undefined);
    assert.equal(getMapboxSatelliteTileUrlTemplate({}), undefined);
    assert.equal(getMapboxStreetsTileJsonUrl({}), undefined);
    assert.equal(getMapboxGlyphsUrl({}), undefined);
  });

  it("prefers and trims the Vite-prefixed public token", () => {
    assert.equal(
      getMapboxAccessToken({
        VITE_MAPBOX_ACCESS_TOKEN: "  pk.public-token  ",
        MAPBOX_ACCESS_TOKEN: "bare-token",
      }),
      "pk.public-token"
    );
  });

  it("builds direct HTTPS satellite tiles without the legacy redirect", () => {
    assert.equal(
      getMapboxSatelliteTileUrlTemplate({
        MAPBOX_ACCESS_TOKEN: "  pk.a/b?c  ",
      }),
      "https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.jpg90?access_token=pk.a%2Fb%3Fc"
    );
    assert.equal(
      getMapboxStreetsTileJsonUrl({ MAPBOX_ACCESS_TOKEN: "  pk.a/b?c  " }),
      "https://api.mapbox.com/v4/mapbox.mapbox-streets-v8.json?access_token=pk.a%2Fb%3Fc"
    );
    assert.equal(
      getMapboxGlyphsUrl({ MAPBOX_ACCESS_TOKEN: "  pk.a/b?c  " }),
      "https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=pk.a%2Fb%3Fc"
    );
  });
});
