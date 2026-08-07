import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TimeSliderControl } from "maplibre-gl-time-slider";

const options = {
  startDate: "2024-01-01",
  endDate: "2024-01-02",
};

describe("time slider playback speed", () => {
  it("accepts positive speeds below the package's former 100 ms floor", () => {
    const control = new TimeSliderControl({ ...options, speed: 1 });

    assert.equal(control.getState().speed, 1);

    control.setSpeed(37);
    assert.equal(control.getState().speed, 37);
  });

  it("keeps zero from becoming a playback interval", () => {
    const control = new TimeSliderControl({ ...options, speed: 0 });

    assert.equal(control.getState().speed, 1);

    control.setSpeed(0);
    assert.equal(control.getState().speed, 1);
  });
});
