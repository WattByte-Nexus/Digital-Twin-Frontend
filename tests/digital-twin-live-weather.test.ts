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
              items: [{ dataset_id: "weather:boulder/co:2026-08-12T18:00:00Z", version: "2026-08-12T18:00:00Z", ready: true }],
            });
          }
          if (url.endsWith("/map-layers")) {
            return Response.json({
              items: [
                { layer_id: "wind-speed", name: "Wind speed", units: "m/s", band: "wind_velocity" },
                { layer_id: "wind-direction", name: "Wind direction", units: "degrees", band: "wind_direction" },
                { layer_id: "temperature", name: "Air temperature", units: "°C", band: "temperature_c" },
                { layer_id: "precipitation", name: "Precipitation", units: "mm", band: "precipitation_mm" },
              ],
            });
          }
          if (url.includes("wind-speed")) return Response.json({ value: 10 });
          if (url.includes("wind-direction")) return Response.json({ value: 450 });
          if (url.includes("precipitation")) return Response.json({ value: 3.2 });
          return Response.json({ value: 21.5 });
        }) as typeof fetch,
      },
    );

    assert.deepEqual(weather, {
      observedAt: "2026-08-12T18:00:00Z",
      readings: [
        { band: "wind_velocity", label: "Wind speed", unit: "m/s", value: 10 },
        { band: "wind_direction", label: "Wind direction", unit: "degrees", value: 450 },
        { band: "temperature_c", label: "Air temperature", unit: "°C", value: 21.5 },
        { band: "precipitation_mm", label: "Precipitation", unit: "mm", value: 3.2 },
      ],
      temperatureC: 21.5,
      windDirectionDegrees: 90,
      windSpeedMph: 22.369362920544,
    });
    assert.equal(calls.length, 6);
    assert.match(calls[1] ?? "", /weather%3Aboulder%2Fco%3A2026-08-12T18%3A00%3A00Z/);
    for (const call of calls.slice(2)) {
      assert.match(call, /longitude=-105.27/);
      assert.match(call, /latitude=40.02/);
    }
  });
});
