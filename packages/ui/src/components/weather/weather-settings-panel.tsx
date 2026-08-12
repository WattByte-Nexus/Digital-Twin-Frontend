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
  return <h3 className="text-[11px] font-semibold text-muted-foreground">{children}</h3>;
}

export function WeatherSettingsPanel({
  autoWeatherReadings,
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
    [initialValue],
  );
  const [uncontrolledValue, setUncontrolledValue] = React.useState(resolvedInitial);
  const value = controlledValue ?? uncontrolledValue;
  const autoReadingBands = new Set(autoWeatherReadings?.map((reading) => reading.id));
  const additionalAutoReadings = autoWeatherReadings?.filter(
    (reading) =>
      !["temperature_c", "wind_velocity", "wind_direction", "wind_towards_direction"].includes(
        reading.id,
      ),
  );
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
        className,
      )}
      surface="panel"
      aria-label="Weather settings"
    >
      <WeatherSummaryBar
        location={location}
        temperature={
          value.mode === "auto" && autoWeatherReadings && !liveTemperatureAvailable
            ? undefined
            : value.temperature
        }
        date={value.date}
        hour={value.hour}
        minute={value.minute}
        theme={theme}
      />

      <div className="min-h-0 flex-1">
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

          {value.mode === "auto" && additionalAutoReadings?.length ? (
            <section aria-label="Live weather readings" className="rounded-md border bg-muted/30 p-3">
              <h3 className="text-xs font-semibold text-foreground">Additional Engine readings</h3>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                {additionalAutoReadings.map((reading) => (
                  <div key={reading.id} className="min-w-0">
                    <dt className="truncate text-[11px] text-muted-foreground">{reading.label}</dt>
                    <dd className="text-sm font-medium tabular-nums text-foreground">
                      {reading.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                      {reading.unit ? ` ${reading.unit}` : ""}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          <fieldset
            className="space-y-4 disabled:opacity-55 [@media(max-height:900px)]:space-y-2"
            disabled={value.mode === "auto"}
          >
            <div className="space-y-2 [@media(max-height:900px)]:space-y-1">
              <SectionLabel>Date</SectionLabel>
              <DatePicker
                value={value.date}
                theme={theme}
                onChange={(date) => setValue((current) => ({ ...current, date }))}
              />
            </div>

            <div className="space-y-2 [@media(max-height:900px)]:space-y-1">
              <SectionLabel>Time of the Day</SectionLabel>
              <TimeOfDayControl
                hour={value.hour}
                minute={value.minute}
                format={value.timeFormat}
                onTimeChange={(hour, minute) =>
                  setValue((current) => ({ ...current, hour, minute }))
                }
                onFormatChange={(timeFormat) =>
                  setValue((current) => ({ ...current, timeFormat }))
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
                {value.mode === "auto" && autoWeatherReadings && !liveTemperatureAvailable ? (
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

            {value.mode === "manual" || autoReadingBands.has("wind_velocity") ||
            autoReadingBands.has("wind_direction") ||
            autoReadingBands.has("wind_towards_direction") ? (
            <div className="space-y-2 [@media(max-height:900px)]:space-y-1">
              <SectionLabel>Weather Events</SectionLabel>
              <div className="space-y-2 [@media(max-height:900px)]:space-y-1">
                {value.mode === "manual" ? (
                  <>
                    <WeatherEventRow label="Fog" value={value.events.fog} unit="%" onChange={(next) => updateEvent("fog", next)} />
                    <WeatherEventRow label="Rain" value={value.events.rain} unit="%" onChange={(next) => updateEvent("rain", next)} />
                    <WeatherEventRow label="Thunder" value={value.events.thunder} unit="%" onChange={(next) => updateEvent("thunder", next)} />
                    <WeatherEventRow label="Dust" value={value.events.dust} unit="%" onChange={(next) => updateEvent("dust", next)} />
                    <WeatherEventRow label="Cloud Coverage" value={value.events.cloudCoverage} unit="%" onChange={(next) => updateEvent("cloudCoverage", next)} />
                  </>
                ) : null}
                {value.mode === "manual" || autoReadingBands.has("wind_velocity") ? (
                  <WeatherEventRow label="Wind" value={value.events.wind} unit="mph" step={0.1} onChange={(next) => updateEvent("wind", next)} />
                ) : null}
                {value.mode === "manual" || autoReadingBands.has("wind_direction") || autoReadingBands.has("wind_towards_direction") ? (
                  <WeatherEventRow label="Wind Direction" value={value.events.windDirection} unit="°" maximum={360} onChange={(next) => updateEvent("windDirection", next)} />
                ) : null}
                {value.mode === "manual" ? (
                  <WeatherEventRow label="Snow" value={value.events.snow} unit="%" onChange={(next) => updateEvent("snow", next)} />
                ) : null}
              </div>
            </div>
            ) : null}
          </fieldset>
        </div>
      </div>
    </Card>
  );
}
