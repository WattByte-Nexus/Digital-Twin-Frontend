import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getMapboxAccessToken,
  getMapboxSatelliteTileJsonUrl,
  getMapboxStreetsTileJsonUrl,
} from "@geolibre/core";

describe("Mapbox Satellite runtime configuration", () => {
  it("treats a missing or blank token as unavailable", () => {
    assert.equal(getMapboxAccessToken({}), undefined);
    assert.equal(getMapboxAccessToken({ VITE_MAPBOX_ACCESS_TOKEN: "  " }), undefined);
    assert.equal(getMapboxSatelliteTileJsonUrl({}), undefined);
    assert.equal(getMapboxStreetsTileJsonUrl({}), undefined);
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

  it("accepts the bare runtime token and safely builds TileJSON", () => {
    assert.equal(
      getMapboxSatelliteTileJsonUrl({ MAPBOX_ACCESS_TOKEN: "  pk.a/b?c  " }),
      "https://api.mapbox.com/v4/mapbox.satellite.json?access_token=pk.a%2Fb%3Fc"
    );
    assert.equal(
      getMapboxStreetsTileJsonUrl({ MAPBOX_ACCESS_TOKEN: "  pk.a/b?c  " }),
      "https://api.mapbox.com/v4/mapbox.mapbox-streets-v8.json?access_token=pk.a%2Fb%3Fc"
    );
  });
});
