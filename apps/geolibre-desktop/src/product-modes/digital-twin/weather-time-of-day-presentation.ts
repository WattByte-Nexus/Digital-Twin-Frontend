import type { SkySpecification } from "maplibre-gl";

const DAY_SKY = [136, 198, 252] as const;
const DAY_HORIZON = [248, 250, 252] as const;
const NIGHT_SKY = [7, 17, 31] as const;
const NIGHT_HORIZON = [17, 24, 39] as const;
const TWILIGHT_HORIZON = [219, 126, 91] as const;

type Rgb = readonly [number, number, number];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function mixRgb(from: Rgb, to: Rgb, amount: number): Rgb {
  const t = clamp01(amount);
  return from.map((channel, index) =>
    Math.round(channel + (to[index] - channel) * t),
  ) as unknown as Rgb;
}

function rgb(value: Rgb): string {
  return `rgb(${value.join(", ")})`;
}

export function timeOfDaySky(solarAltitude: number): SkySpecification {
  const daylight = timeOfDayIllumination(solarAltitude);
  const twilight = 1 - clamp01(Math.abs(solarAltitude + 2) / 12);
  const sky = mixRgb(NIGHT_SKY, DAY_SKY, daylight);
  const baseHorizon = mixRgb(NIGHT_HORIZON, DAY_HORIZON, daylight);
  const horizon = mixRgb(baseHorizon, TWILIGHT_HORIZON, twilight * 0.72);
  return {
    "sky-color": rgb(sky),
    "horizon-color": rgb(horizon),
    "fog-color": rgb(mixRgb(horizon, sky, 0.18)),
    "fog-ground-blend": 0.9,
    "horizon-fog-blend": 0.8,
    "sky-horizon-blend": 0.8,
  };
}

export function timeOfDayIllumination(solarAltitude: number): number {
  return smoothstep((solarAltitude + 8) / 26);
}
