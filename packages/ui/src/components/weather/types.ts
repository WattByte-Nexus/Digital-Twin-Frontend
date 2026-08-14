import type { SurfaceTheme } from "../../lib/surface-theme";

export type WeatherMode = "auto" | "manual";
export type WeatherTheme = SurfaceTheme;
export type WeatherEventKey =
  | "wind"
  | "windDirection"
  | "dewPoint"
  | "relativeHumidity"
  | "windGust"
  | "precipitationLastHour"
  | "barometricPressure"
  | "seaLevelPressure"
  | "visibility";

export interface WeatherSettingsValue {
  mode: WeatherMode;
  date: string;
  hour: number;
  minute: number;
  season: string;
  temperature: number;
  events: Record<WeatherEventKey, number>;
}

export interface WeatherLiveReading {
  id: string;
  label: string;
  unit?: string;
  value: number;
}

export type WeatherSettingsInitialValue = Omit<
  Partial<WeatherSettingsValue>,
  "events"
> & {
  events?: Partial<WeatherSettingsValue["events"]>;
};

export interface WeatherSettingsPanelProps {
  autoWeatherCondition?: string;
  autoWeatherReadings?: readonly WeatherLiveReading[];
  autoWeatherSource?: string;
  autoWeatherStatus?: string;
  className?: string;
  initialValue?: WeatherSettingsInitialValue;
  location?: string;
  onValueChange?: (value: WeatherSettingsValue) => void;
  theme?: WeatherTheme;
  value?: WeatherSettingsValue;
}

export const DEFAULT_WEATHER_EVENTS: WeatherSettingsValue["events"] = {
  wind: 20.4,
  windDirection: 270,
  dewPoint: 0,
  relativeHumidity: 0,
  windGust: 0,
  precipitationLastHour: 0,
  barometricPressure: 0,
  seaLevelPressure: 0,
  visibility: 0,
};

export const DEFAULT_WEATHER_SETTINGS: WeatherSettingsValue = {
  mode: "manual",
  date: "2024-10-07",
  hour: 14,
  minute: 7,
  season: "Spring",
  temperature: 41,
  events: DEFAULT_WEATHER_EVENTS,
};

export function clampWeatherValue(
  value: number,
  minimum: number,
  maximum: number
) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function padWeatherTime(value: number) {
  return String(value).padStart(2, "0");
}
