import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fetchDigitalTwinPowerLine,
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
                  [-105.22, 39.75, 1821.4],
                  [-105.21, 39.76, 1798.2],
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
              [-105.22, 39.75, 1821.4],
              [-105.21, 39.76, 1798.2],
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
                coordinates: [[-105.22, 39.75, 1821.4]],
                bounds: { west: -105.22, south: 39.75, east: -105.21, north: 39.76 },
              },
            },
          ])) as typeof fetch,
      }),
      /exactly two coordinates/i,
    );
  });

  it("rejects legacy 2D coordinates without conductor elevation", async () => {
    await assert.rejects(
      fetchDigitalTwinPowerLines("http://127.0.0.1:8000", "golden-co", {
        fetchImpl: (async () =>
          Response.json([
            {
              power_line_id: "legacy-line",
              geometry: {
                type: "LineString",
                coordinates: [
                  [-105.22, 39.75],
                  [-105.21, 39.76],
                ],
              },
            },
          ])) as typeof fetch,
      }),
      /3D WGS84 conductor coordinate/i,
    );
  });

  it("loads and validates authoritative power-line details", async () => {
    const calls: string[] = [];
    const detail = await fetchDigitalTwinPowerLine(
      "http://127.0.0.1:8000",
      "region/1",
      "line/7",
      {
        fetchImpl: (async (input: string | URL | Request) => {
          calls.push(String(input));
          return Response.json({
            power_line_id: "line/7",
            region_id: "region/1",
            geometry: {
              type: "LineString",
              coordinates: [[-105.1, 40, 1821.4], [-105, 40.1, 1798.2]],
              bounds: { west: -105.1, south: 40, east: -105, north: 40.1 },
            },
            conductor: {
              mass_per_meter_kg_m: 1.35,
              span_length_m: 100,
              conductor_diameter_m: 0.019,
              horizontal_tension_n: 24525,
              air_density_kg_m3: 1.225,
              drag_coefficient: 1.2,
              static_sag_m: 0.675,
              elastic_modulus_pa: 77_000_000_000,
              cross_sectional_area_m2: 0.000386,
            },
            latest_physics: {
              status: "succeeded",
              source: "fem",
              tick: 9,
              line_snapshot: 3,
              weather_version: "2026-07-31T18:00:00Z",
              weather_source_ref: "weather://region-1/2026-07-31T18:00:00Z",
              wind_speed_mps: 18.4,
              midspan_displacement_m: 1.2,
              max_displacement_m: 1.5,
              max_displacement_position_m: 53,
              collision_envelope_m: { min_x: 0, max_x: 100, min_y: -1.51, max_y: 1.51 },
              feature_contract_version: "power-line-static-v1",
              model_version: "model-1",
              model_checksum: "a".repeat(64),
              cached_from_tick: null,
              routing_reason: "near_threshold",
              solver_version: "solver-2",
              surrogate_confidence: null,
            },
          });
        }) as typeof fetch,
      },
    );

    assert.deepEqual(calls, [
      "http://127.0.0.1:8000/api/v1/regions/region%2F1/power-lines/line%2F7",
    ]);
    assert.equal(detail.powerLineId, "line/7");
    assert.equal(detail.conductor.spanLengthM, 100);
    assert.equal(detail.latestPhysics?.status, "succeeded");
    assert.equal(
      detail.latestPhysics?.status === "succeeded"
        ? detail.latestPhysics.maxDisplacementM
        : null,
      1.5,
    );
  });

  it("rejects mismatched detail identities and unsupported physics states", async () => {
    const response = {
      power_line_id: "wrong-line",
      region_id: "region-1",
      geometry: {
        type: "LineString",
        coordinates: [[-105.1, 40, 1821.4], [-105, 40.1, 1798.2]],
        bounds: { west: -105.1, south: 40, east: -105, north: 40.1 },
      },
      conductor: {
        mass_per_meter_kg_m: 1.35,
        span_length_m: 100,
        conductor_diameter_m: 0.019,
        horizontal_tension_n: 24525,
        air_density_kg_m3: 1.225,
        drag_coefficient: 1.2,
        static_sag_m: null,
        elastic_modulus_pa: null,
        cross_sectional_area_m2: null,
      },
      latest_physics: null,
    };

    await assert.rejects(
      fetchDigitalTwinPowerLine("http://engine.test", "region-1", "line-7", {
        fetchImpl: (async () => Response.json(response)) as typeof fetch,
      }),
      /does not match the requested line/i,
    );
  });
});
