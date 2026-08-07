import assert from "node:assert/strict";
import test from "node:test";
import { getTimeOfDayPhase } from "../packages/ui/src/components/weather/time-of-day-control";

test("time-of-day dial selects the icon phase from its current time", () => {
  const cases = [
    { time: [0, 0], phase: "night" },
    { time: [5, 59], phase: "night" },
    { time: [6, 0], phase: "sunrise" },
    { time: [7, 59], phase: "sunrise" },
    { time: [8, 0], phase: "day" },
    { time: [17, 59], phase: "day" },
    { time: [18, 0], phase: "sunset" },
    { time: [19, 59], phase: "sunset" },
    { time: [20, 0], phase: "night" },
    { time: [23, 59], phase: "night" },
  ] as const;

  for (const { time, phase } of cases) {
    assert.equal(getTimeOfDayPhase(...time), phase, `${time.join(":")} should be ${phase}`);
  }
});
