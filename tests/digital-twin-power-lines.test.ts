import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fetchDigitalTwinPowerLines,
  powerLinesFeatureCollection,
} from "../apps/geolibre-desktop/src/lib/digital-twin-power-lines";

describe("Digital Twin operational power lines", () => {
  it("loads the selected region's authoritative power-line inventory", async () => {
    const calls: string[] = [];
    const lines = await fetchDigitalTwinPowerLines(
      "http://127.0.0.1:8000",
      "golden-co",
      {
        fetchImpl: (async (input: string | URL | Request) => {
          calls.push(String(input));
          return Response.json([
            {
              power_line_id: "golden-line-1",
              geometry: {
                type: "LineString",
                coordinates: [
                  [-105.22, 39.75],
                  [-105.21, 39.76],
                ],
                bounds: { west: -105.22, south: 39.75, east: -105.21, north: 39.76 },
              },
            },
          ]);
        }) as typeof fetch,
      },
    );

    assert.equal(
      calls[0],
      "http://127.0.0.1:8000/api/v1/regions/golden-co/power-lines",
    );
    assert.deepEqual(powerLinesFeatureCollection(lines), {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: "golden-line-1",
          properties: { power_line_id: "golden-line-1" },
          geometry: {
            type: "LineString",
            coordinates: [
              [-105.22, 39.75],
              [-105.21, 39.76],
            ],
          },
        },
      ],
    });
  });

  it("rejects malformed line geometry instead of silently drawing bad data", async () => {
    await assert.rejects(
      fetchDigitalTwinPowerLines("http://127.0.0.1:8000", "boulder-co", {
        fetchImpl: (async () =>
          Response.json([
            {
              power_line_id: "bad-line",
              geometry: {
                type: "LineString",
                coordinates: [[-105.22, 39.75]],
                bounds: { west: -105.22, south: 39.75, east: -105.21, north: 39.76 },
              },
            },
          ])) as typeof fetch,
      }),
      /exactly two coordinates/i,
    );
  });
});
