import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkDigitalTwinEngineHealth,
  digitalTwinWeatherFreshness,
  fetchDigitalTwinWeatherDatasets,
  type DigitalTwinWeatherDataset,
} from "../apps/geolibre-desktop/src/lib/digital-twin-status";

describe("Digital Twin monitoring status", () => {
  const timestamps = {
    version: "2026-09-18T02:40:00Z",
    fresh_until: "2026-09-18T03:40:00Z",
    source_kind: "observation",
  };
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
              { dataset_id: "weather:boulder:latest", ready: true, ...timestamps },
              { dataset_id: "weather:boulder:staging", ready: false, ...timestamps },
            ],
            next_cursor: null,
          });
        }) as typeof fetch,
      },
    );

    assert.deepEqual(datasets, [
      { datasetId: "weather:boulder:latest", ready: true, observedAt: timestamps.version, freshUntil: timestamps.fresh_until, sourceKind: "observation" },
      { datasetId: "weather:boulder:staging", ready: false, observedAt: timestamps.version, freshUntil: timestamps.fresh_until, sourceKind: "observation" },
    ]);
    assert.deepEqual(calls, [
      "http://127.0.0.1:8000/api/v1/regions/boulder%2Fco/weather-datasets?limit=100",
    ]);
  });

  const observation: DigitalTwinWeatherDataset = {
    datasetId: "weather:golden:observation",
    ready: true,
    observedAt: "2026-09-18T02:40:00Z",
    freshUntil: "2026-09-18T03:40:00Z",
    sourceKind: "observation",
  };

  it("expires ready weather at the Engine-configured time without losing its timestamp", () => {
    assert.deepEqual(digitalTwinWeatherFreshness([observation], Date.parse("2026-09-18T03:00:00Z")), {
      status: "current", observedAt: observation.observedAt,
    });
    assert.deepEqual(digitalTwinWeatherFreshness([observation], Date.parse("2026-09-18T03:40:01Z")), {
      status: "stale", observedAt: observation.observedAt,
    });
  });

  it("does not confuse empty, unavailable, forecast or future data with live observations", () => {
    for (const datasets of [
      [],
      [{ ...observation, ready: false }],
      [{ ...observation, sourceKind: "forecast" as const }],
      [{ ...observation, observedAt: "2026-09-18T04:00:00Z" }],
    ]) {
      assert.deepEqual(digitalTwinWeatherFreshness(datasets, Date.parse("2026-09-18T03:00:00Z")), {
        status: "missing", observedAt: null,
      });
    }
  });

  it("selects the newest ready analysis or observation without mutating the catalog", () => {
    const datasets = [
      { ...observation, observedAt: "2026-09-18T01:00:00Z", freshUntil: "2026-09-18T02:00:00Z" },
      { ...observation, sourceKind: "analysis" as const },
    ];
    assert.equal(digitalTwinWeatherFreshness(datasets, Date.parse("2026-09-18T03:00:00Z")).status, "current");
    assert.equal(datasets[0].observedAt, "2026-09-18T01:00:00Z");
  });

  it("rejects malformed or absent freshness metadata", async () => {
    for (const metadata of [{}, { ...timestamps, fresh_until: "invalid" }, { ...timestamps, fresh_until: timestamps.version }]) {
      await assert.rejects(fetchDigitalTwinWeatherDatasets("http://127.0.0.1:8000", "golden-co", {
        fetchImpl: (async () => Response.json({ items: [{ dataset_id: "weather:golden", ready: true, ...metadata }], next_cursor: null })) as typeof fetch,
      }), /invalid freshness metadata/);
    }
  });
});
