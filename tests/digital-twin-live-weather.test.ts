import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchDigitalTwinLiveWeather } from "../apps/geolibre-desktop/src/lib/digital-twin-live-weather";

describe("Digital Twin live weather", () => {
  it("samples the latest Engine dataset at the requested map location", async () => {
    const calls: string[] = [];
    const weather = await fetchDigitalTwinLiveWeather(
      "http://127.0.0.1:8000",
      "boulder/co",
      { longitude: -105.27, latitude: 40.02 },
      {
        fetchImpl: (async (input: string | URL | Request) => {
          const url = String(input);
          calls.push(url);
          if (url.includes("/weather-datasets?")) {
            return Response.json({
              items: [
                {
                  dataset_id: "weather:boulder/co:2026-08-12T18:00:00Z",
                  version: "2026-08-12T18:00:00Z",
                  bounds: { west: -106, south: 39, east: -104, north: 41 },
                  ready: true,
                },
              ],
            });
          }
          if (url.endsWith("/map-layers")) {
            return Response.json({
              items: [
                {
                  layer_id: "wind-speed",
                  name: "Wind speed",
                  units: "m/s",
                  band: "wind_velocity",
                },
                {
                  layer_id: "wind-direction",
                  name: "Wind direction",
                  units: "degrees",
                  band: "wind_direction",
                },
                {
                  layer_id: "temperature",
                  name: "Air temperature",
                  units: "°C",
                  band: "temperature_c",
                },
                {
                  layer_id: "precipitation",
                  name: "Precipitation",
                  units: "mm",
                  band: "precipitation_mm",
                },
              ],
            });
          }
          if (url.endsWith("/station-observations")) {
            return Response.json({
              items: [
                {
                  station_id: "KBDU",
                  observed_at: "2026-08-12T17:55:00Z",
                  lat: 40.02,
                  lon: -105.27,
                  elevation_m: 1_612,
                  dew_point_c: 8.5,
                  relative_humidity_pct: 42,
                  wind_gust_m_s: 12,
                  precipitation_last_hour_m: 0.0015,
                  barometric_pressure_pa: 83_500,
                  sea_level_pressure_pa: 101_200,
                  visibility_m: 16_000,
                  text_description: "Light rain",
                  quality_status: "accepted",
                  source_provider: "nws",
                },
              ],
            });
          }
          if (url.includes("wind-speed")) return Response.json({ value: 10 });
          if (url.includes("wind-direction"))
            return Response.json({ value: 450 });
          if (url.includes("precipitation"))
            return Response.json({ value: 3.2 });
          return Response.json({ value: 21.5 });
        }) as typeof fetch,
      }
    );

    assert.deepEqual(weather, {
      condition: "Light rain",
      nearestStation: {
        distanceKm: 0,
        elevationM: 1_612,
        id: "KBDU",
        observedAt: "2026-08-12T17:55:00Z",
        provider: "nws",
        qualityStatus: "accepted",
      },
      observedAt: "2026-08-12T18:00:00Z",
      readings: [
        { band: "wind_velocity", label: "Wind speed", unit: "m/s", value: 10 },
        {
          band: "wind_direction",
          label: "Wind direction",
          unit: "degrees",
          value: 450,
        },
        {
          band: "temperature_c",
          label: "Air temperature",
          unit: "°C",
          value: 21.5,
        },
        {
          band: "precipitation_mm",
          label: "Precipitation",
          unit: "mm",
          value: 3.2,
        },
        { band: "dew_point_c", label: "Dew point", unit: "°C", value: 8.5 },
        {
          band: "relative_humidity_pct",
          label: "Relative humidity",
          unit: "%",
          value: 42,
        },
        { band: "wind_gust_m_s", label: "Wind gust", unit: "m/s", value: 12 },
        {
          band: "precipitation_last_hour_m",
          label: "Precipitation in last hour",
          unit: "m",
          value: 0.0015,
        },
        {
          band: "barometric_pressure_pa",
          label: "Barometric pressure",
          unit: "Pa",
          value: 83_500,
        },
        {
          band: "sea_level_pressure_pa",
          label: "Sea-level pressure",
          unit: "Pa",
          value: 101_200,
        },
        { band: "visibility_m", label: "Visibility", unit: "m", value: 16_000 },
      ],
      unavailableReadingLabels: [],
      temperatureC: 21.5,
      windDirectionDegrees: 90,
      windSpeedMph: 22.369362920544,
    });
    assert.equal(calls.length, 7);
    assert.ok(
      calls.some((call) =>
        /weather%3Aboulder%2Fco%3A2026-08-12T18%3A00%3A00Z/.test(call)
      )
    );
    for (const call of calls.filter(
      (call) => call.includes("/map-layers/") && call.includes("data.json")
    )) {
      assert.match(call, /longitude=-105.27/);
      assert.match(call, /latitude=40.02/);
    }
  });

  it("keeps the dataset timestamp and retries no-data readings within its bounds", async () => {
    const sampledLongitudes: string[] = [];
    const weather = await fetchDigitalTwinLiveWeather(
      "http://127.0.0.1:8000",
      "boulder",
      { longitude: -105.27, latitude: 40.02 },
      {
        fetchImpl: (async (input: string | URL | Request) => {
          const url = new URL(String(input));
          if (url.pathname.endsWith("/weather-datasets")) {
            return Response.json({
              items: [
                {
                  dataset_id: "weather:boulder:2026-08-12T18:00:00Z",
                  version: "2026-08-12T18:00:00Z",
                  bounds: { west: -106, south: 39, east: -104, north: 41 },
                  ready: true,
                },
              ],
            });
          }
          if (url.pathname.endsWith("/map-layers")) {
            return Response.json({
              items: [
                {
                  layer_id: "wind-speed",
                  name: "Wind speed",
                  units: "m/s",
                  band: "wind_velocity",
                },
                {
                  layer_id: "precipitation",
                  name: "Precipitation",
                  units: "mm",
                  band: "precipitation_mm",
                },
              ],
            });
          }
          if (url.pathname.endsWith("/station-observations")) {
            return Response.json({ items: [] });
          }
          const longitude = url.searchParams.get("longitude") ?? "";
          if (url.pathname.includes("wind-speed")) {
            sampledLongitudes.push(longitude);
            return Response.json({ value: longitude === "-105.27" ? null : 8 });
          }
          return Response.json({ value: null });
        }) as typeof fetch,
      }
    );

    assert.equal(weather.observedAt, "2026-08-12T18:00:00Z");
    assert.equal(weather.condition, undefined);
    assert.equal(weather.nearestStation, undefined);
    assert.equal(weather.windSpeedMph, 17.8954903364352);
    assert.deepEqual(weather.readings, [
      { band: "wind_velocity", label: "Wind speed", unit: "m/s", value: 8 },
    ]);
    assert.deepEqual(weather.unavailableReadingLabels, ["Precipitation"]);
    assert.deepEqual(sampledLongitudes.slice(0, 2), ["-105.27", "-105"]);
  });
});
