import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkDigitalTwinEngineHealth,
  fetchDigitalTwinWeatherDatasets,
} from "../apps/geolibre-desktop/src/lib/digital-twin-status";

describe("Digital Twin monitoring status", () => {
  it("checks the Engine liveness and readiness endpoints", async () => {
    const calls: string[] = [];
    const health = await checkDigitalTwinEngineHealth("http://127.0.0.1:8000", {
      fetchImpl: (async (input: string | URL | Request) => {
        calls.push(String(input));
        return Response.json({ status: String(input).endsWith("/live") ? "live" : "ready" });
      }) as typeof fetch,
    });

    assert.equal(health, "ready");
    assert.deepEqual(calls.sort(), [
      "http://127.0.0.1:8000/api/v1/health/live",
      "http://127.0.0.1:8000/api/v1/health/ready",
    ]);
  });

  it("reports a live Engine with failed readiness as degraded", async () => {
    const health = await checkDigitalTwinEngineHealth("http://127.0.0.1:8000", {
      fetchImpl: (async (input: string | URL | Request) =>
        String(input).endsWith("/live")
          ? Response.json({ status: "live" })
          : new Response(null, { status: 503 })) as typeof fetch,
    });

    assert.equal(health, "degraded");
  });

  it("loads the selected region's weather datasets", async () => {
    const calls: string[] = [];
    const datasets = await fetchDigitalTwinWeatherDatasets(
      "http://127.0.0.1:8000",
      "boulder/co",
      {
        fetchImpl: (async (input: string | URL | Request) => {
          calls.push(String(input));
          return Response.json({
            items: [
              { dataset_id: "weather:boulder:latest", ready: true },
              { dataset_id: "weather:boulder:staging", ready: false },
            ],
            next_cursor: null,
          });
        }) as typeof fetch,
      },
    );

    assert.deepEqual(datasets, [
      { datasetId: "weather:boulder:latest", ready: true },
      { datasetId: "weather:boulder:staging", ready: false },
    ]);
    assert.deepEqual(calls, [
      "http://127.0.0.1:8000/api/v1/regions/boulder%2Fco/weather-datasets?limit=20",
    ]);
  });
});
