import type { WeatherSettingsValue } from "@geolibre/ui";

const MOUNTAIN_TIME_ZONE = "America/Denver";

export interface MountainWeatherDateTime {
  date: string;
  hour: number;
  minute: number;
  month: number;
}

export function mountainWeatherDateTime(
  value: string
): MountainWeatherDateTime {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new Error("Invalid live weather timestamp.");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MOUNTAIN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => {
    const parsed = Number(
      parts.find((candidate) => candidate.type === type)?.value
    );
    if (!Number.isInteger(parsed))
      throw new Error("Invalid live weather timestamp.");
    return parsed;
  };
  const year = part("year");
  const month = part("month");
  const day = part("day");
  return {
    date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
      2,
      "0"
    )}`,
    hour: part("hour"),
    minute: part("minute"),
    month,
  };
}

export function weatherSettingsDateMs(
  value: WeatherSettingsValue,
  now = Date.now()
): number {
  if (value.mode === "auto") return now;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.date);
  if (!match) return now;
  const dateMs = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    value.hour,
    value.minute
  );
  const matchesRequestedTime =
    dateMs.getFullYear() === Number(match[1]) &&
    dateMs.getMonth() === Number(match[2]) - 1 &&
    dateMs.getDate() === Number(match[3]) &&
    dateMs.getHours() === value.hour &&
    dateMs.getMinutes() === value.minute;
  return matchesRequestedTime ? dateMs.getTime() : now;
}
