import type { SurfaceTheme } from "../../lib/surface-theme";

export type WeatherMode = "auto" | "manual";
export type WeatherTheme = SurfaceTheme;
export type TimeFormat = "12" | "24";
export type WeatherEventKey =
  | "fog"
  | "rain"
  | "thunder"
  | "dust"
  | "cloudCoverage"
  | "wind"
  | "windDirection"
  | "snow";

export interface WeatherSettingsValue {
  mode: WeatherMode;
  date: string;
  hour: number;
  minute: number;
  timeFormat: TimeFormat;
  season: string;
  temperature: number;
  events: Record<WeatherEventKey, number>;
}

export type WeatherSettingsInitialValue = Omit<Partial<WeatherSettingsValue>, "events"> & {
  events?: Partial<WeatherSettingsValue["events"]>;
};

export interface WeatherSettingsPanelProps {
  className?: string;
  initialValue?: WeatherSettingsInitialValue;
  location?: string;
  onValueChange?: (value: WeatherSettingsValue) => void;
  theme?: WeatherTheme;
  value?: WeatherSettingsValue;
}

export const DEFAULT_WEATHER_EVENTS: WeatherSettingsValue["events"] = {
  fog: 0,
  rain: 0,
  thunder: 0,
  dust: 0,
  cloudCoverage: 0,
  wind: 20.4,
  windDirection: 270,
  snow: 0,
};

export const DEFAULT_WEATHER_SETTINGS: WeatherSettingsValue = {
  mode: "manual",
  date: "2024-10-07",
  hour: 14,
  minute: 7,
  timeFormat: "24",
  season: "Spring",
  temperature: 41,
  events: DEFAULT_WEATHER_EVENTS,
};

export function clampWeatherValue(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function padWeatherTime(value: number) {
  return String(value).padStart(2, "0");
}
