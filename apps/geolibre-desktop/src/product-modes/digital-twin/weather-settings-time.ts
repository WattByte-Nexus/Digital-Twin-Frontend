import type { WeatherSettingsValue } from "@geolibre/ui";

export function weatherSettingsDateMs(
  value: WeatherSettingsValue,
  now = Date.now(),
): number {
  if (value.mode === "auto") return now;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.date);
  if (!match) return now;
  const dateMs = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    value.hour,
    value.minute,
  );
  const matchesRequestedTime =
    dateMs.getFullYear() === Number(match[1]) &&
    dateMs.getMonth() === Number(match[2]) - 1 &&
    dateMs.getDate() === Number(match[3]) &&
    dateMs.getHours() === value.hour &&
    dateMs.getMinutes() === value.minute;
  return matchesRequestedTime ? dateMs.getTime() : now;
}
