import * as React from "react";
import { Card } from "../card";
import { DatePicker } from "../date-picker";
import { Input } from "../input";
import { Label } from "../label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../select-menu";
import { cn } from "../../lib/utils";
import { surfaceThemeClassName } from "../../lib/surface-theme";
import { TimeOfDayControl } from "./time-of-day-control";
import {
  DEFAULT_WEATHER_EVENTS,
  DEFAULT_WEATHER_SETTINGS,
  type WeatherEventKey,
  type WeatherSettingsPanelProps,
  type WeatherSettingsValue,
} from "./types";
import { WeatherEventRow } from "./weather-event-row";
import { WeatherModeToggle } from "./weather-mode-toggle";
import { WeatherSummaryBar } from "./weather-summary-bar";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold text-muted-foreground">
      {children}
    </h3>
  );
}

const WEATHER_EVENT_ROWS: readonly {
  autoBand?: string;
  event: WeatherEventKey;
  label: string;
  maximum?: number;
  minimum?: number;
  step?: number;
  unit: string;
}[] = [
  {
    autoBand: "wind_velocity",
    event: "wind",
    label: "Wind",
    maximum: 300,
    step: 0.1,
    unit: "mph",
  },
  {
    autoBand: "wind_direction",
    event: "windDirection",
    label: "Wind Direction",
    maximum: 360,
    unit: "°",
  },
  {
    autoBand: "dew_point_c",
    event: "dewPoint",
    label: "Dew Point",
    minimum: -100,
    maximum: 100,
    step: 0.1,
    unit: "°C",
  },
  {
    autoBand: "relative_humidity_pct",
    event: "relativeHumidity",
    label: "Relative Humidity",
    unit: "%",
  },
  {
    autoBand: "wind_gust_m_s",
    event: "windGust",
    label: "Wind Gust",
    maximum: 300,
    step: 0.1,
    unit: "mph",
  },
  {
    autoBand: "precipitation_last_hour_m",
    event: "precipitationLastHour",
    label: "Precipitation (last hour)",
    maximum: 1_000,
    step: 0.01,
    unit: "mm",
  },
  {
    autoBand: "barometric_pressure_pa",
    event: "barometricPressure",
    label: "Barometric Pressure",
    maximum: 2_000,
    step: 0.1,
    unit: "hPa",
  },
  {
    autoBand: "sea_level_pressure_pa",
    event: "seaLevelPressure",
    label: "Sea-level Pressure",
    maximum: 2_000,
    step: 0.1,
    unit: "hPa",
  },
  {
    autoBand: "visibility_m",
    event: "visibility",
    label: "Visibility",
    maximum: 1_000,
    step: 0.1,
    unit: "km",
  },
];

export function WeatherSettingsPanel({
  autoWeatherCondition,
  autoWeatherReadings,
  autoWeatherSource,
  autoWeatherStatus,
  className,
  initialValue,
  location = "United Arab Emirates, Sharjah Emirate",
  onValueChange,
  theme = "light",
  value: controlledValue,
}: WeatherSettingsPanelProps) {
  const resolvedInitial = React.useMemo<WeatherSettingsValue>(
    () => ({
      ...DEFAULT_WEATHER_SETTINGS,
      ...initialValue,
      events: { ...DEFAULT_WEATHER_EVENTS, ...initialValue?.events },
    }),
    [initialValue]
  );
  const [uncontrolledValue, setUncontrolledValue] =
    React.useState(resolvedInitial);
  const value = controlledValue ?? uncontrolledValue;
  const autoReadingByBand = new Map(
    autoWeatherReadings?.map((reading) => [reading.id, reading])
  );
  if (
    !autoReadingByBand.has("wind_direction") &&
    autoReadingByBand.has("wind_towards_direction")
  ) {
    autoReadingByBand.set(
      "wind_direction",
      autoReadingByBand.get("wind_towards_direction")!
    );
  }
  const autoReadingBands = new Set(autoReadingByBand.keys());
  const liveTemperatureAvailable = autoReadingBands.has("temperature_c");

  const setValue = (update: React.SetStateAction<WeatherSettingsValue>) => {
    const nextValue = typeof update === "function" ? update(value) : update;
    if (controlledValue === undefined) setUncontrolledValue(nextValue);
    onValueChange?.(nextValue);
  };

  const updateEvent = (event: WeatherEventKey, amount: number) => {
    setValue((current) => ({
      ...current,
      events: { ...current.events, [event]: amount },
    }));
  };

  return (
    <Card
      className={cn(
        surfaceThemeClassName(theme),
        "flex w-[min(380px,calc(100vw-2rem))] flex-col gap-0 overflow-hidden rounded-[10px] py-0",
        className
      )}
      surface="panel"
      aria-label="Weather settings"
    >
      <WeatherSummaryBar
        location={location}
        temperature={
          value.mode === "auto" &&
          autoWeatherReadings &&
          !liveTemperatureAvailable
            ? undefined
            : value.temperature
        }
        date={value.date}
        hour={value.hour}
        minute={value.minute}
        theme={theme}
      />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="space-y-4 px-3 pb-6 pt-3 [@media(max-height:900px)]:space-y-2 [@media(max-height:900px)]:pb-6 [@media(max-height:900px)]:pt-2">
          <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-card-foreground">
            Weather settings
          </h2>

          <WeatherModeToggle
            value={value.mode}
            onChange={(mode) => setValue((current) => ({ ...current, mode }))}
          />

          {value.mode === "auto" && autoWeatherStatus ? (
            <p className="text-xs text-muted-foreground" role="status">
              {autoWeatherStatus}
            </p>
          ) : null}

          {value.mode === "auto" &&
          (autoWeatherCondition || autoWeatherSource) ? (
            <section
              aria-label="Live weather source"
              className="rounded-md border bg-muted/30 p-3"
            >
              {autoWeatherCondition ? (
                <p className="text-sm font-medium text-foreground">
                  {autoWeatherCondition}
                </p>
              ) : null}
              {autoWeatherSource ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {autoWeatherSource}
                </p>
              ) : null}
            </section>
          ) : null}

          <fieldset
            className="space-y-4 [@media(max-height:900px)]:space-y-2"
            disabled={value.mode === "auto"}
          >
            <div className="space-y-2 [@media(max-height:900px)]:space-y-1">
              <SectionLabel>Date</SectionLabel>
              <DatePicker
                value={value.date}
                theme={theme}
                onChange={(date) =>
                  setValue((current) => ({ ...current, date }))
                }
              />
            </div>

            <div className="space-y-2 [@media(max-height:900px)]:space-y-1">
              <SectionLabel>Time of the Day</SectionLabel>
              <TimeOfDayControl
                disabled={value.mode === "auto"}
                hour={value.hour}
                minute={value.minute}
                onTimeChange={(hour, minute) =>
                  setValue((current) => ({ ...current, hour, minute }))
                }
              />
            </div>

            <div className="space-y-2 [@media(max-height:900px)]:space-y-1">
              <SectionLabel>Season and Temperature</SectionLabel>
              <div className="grid grid-cols-[minmax(0,1fr)_104px] gap-2">
                <Label className="sr-only" htmlFor="weather-season">
                  Season
                </Label>
                <Select
                  value={value.season}
                  onValueChange={(season) =>
                    setValue((current) => ({ ...current, season }))
                  }
                >
                  <SelectTrigger id="weather-season" className="w-full">
                    <SelectValue placeholder="Select season" />
                  </SelectTrigger>
                  <SelectContent className={surfaceThemeClassName(theme)}>
                    <SelectItem value="Spring">Spring</SelectItem>
                    <SelectItem value="Summer">Summer</SelectItem>
                    <SelectItem value="Autumn">Autumn</SelectItem>
                    <SelectItem value="Winter">Winter</SelectItem>
                  </SelectContent>
                </Select>
                {value.mode === "auto" &&
                autoWeatherReadings &&
                !liveTemperatureAvailable ? (
                  <div className="flex h-9 items-center justify-end rounded-md border bg-muted px-3 text-xs text-muted-foreground">
                    Unavailable
                  </div>
                ) : (
                  <label className="relative">
                    <span className="sr-only">Temperature in Celsius</span>
                    <Input
                      className="input-compact-number min-w-0 pe-10 text-right tabular-nums"
                      type="number"
                      value={value.temperature}
                      onChange={(event) =>
                        setValue((current) => ({
                          ...current,
                          temperature: Number(event.target.value),
                        }))
                      }
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                      °C
                    </span>
                  </label>
                )}
              </div>
            </div>

            <div className="space-y-2 [@media(max-height:900px)]:space-y-1">
              <SectionLabel>Weather Events</SectionLabel>
              <div className="space-y-2 [@media(max-height:900px)]:space-y-1">
                {WEATHER_EVENT_ROWS.map((row) => {
                  const autoReading = row.autoBand
                    ? autoReadingByBand.get(row.autoBand)
                    : undefined;
                  return (
                    <WeatherEventRow
                      key={row.event}
                      label={row.label}
                      maximum={row.maximum}
                      minimum={row.minimum}
                      onChange={(next) => updateEvent(row.event, next)}
                      step={row.step}
                      unavailable={value.mode === "auto" && !autoReading}
                      unit={row.unit}
                      value={
                        value.mode === "auto" && autoReading
                          ? autoReading.value
                          : value.events[row.event]
                      }
                    />
                  );
                })}
              </div>
            </div>
          </fieldset>
        </div>
      </div>
    </Card>
  );
}
