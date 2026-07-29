import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { latestReadyWeatherDataset } from "../apps/geolibre-desktop/public/plugins/digital-twin-demo/dist/index.js";

describe("latestReadyWeatherDataset", () => {
  it("selects the newest ready dataset regardless of API ordering", () => {
    const selected = latestReadyWeatherDataset([
      {
        dataset_id: "hrrr-older",
        version: "2026-07-29T12:00:00Z",
        ready: true,
      },
      {
        dataset_id: "hrrr-latest",
        version: "2026-07-29T18:00:00Z",
        ready: true,
      },
      {
        dataset_id: "hrrr-middle",
        version: "2026-07-29T15:00:00Z",
        ready: true,
      },
    ]);

    assert.equal(selected?.dataset_id, "hrrr-latest");
  });

  it("ignores a newer dataset until it is ready", () => {
    const selected = latestReadyWeatherDataset([
      {
        dataset_id: "hrrr-publishing",
        version: "2026-07-29T21:00:00Z",
        ready: false,
      },
      {
        dataset_id: "hrrr-ready",
        version: "2026-07-29T18:00:00Z",
        ready: true,
      },
    ]);

    assert.equal(selected?.dataset_id, "hrrr-ready");
  });

  it("returns null when no ready dataset exists", () => {
    assert.equal(
      latestReadyWeatherDataset([
        {
          dataset_id: "hrrr-publishing",
          version: "2026-07-29T21:00:00Z",
          ready: false,
        },
      ]),
      null,
    );
  });
});
