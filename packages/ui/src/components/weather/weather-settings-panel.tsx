import * as React from "react";
import { Card } from "../card";
import { DatePicker } from "../date-picker";
import { Input } from "../input";
import { Label } from "../label";
import { ScrollArea } from "../scroll-area";
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
        "flex max-h-[min(calc(100dvh-2rem),var(--radix-popover-content-available-height,calc(100dvh-2rem)))] w-[min(380px,calc(100vw-2rem))] flex-col gap-0 overflow-hidden rounded-[10px] py-0 [@media(max-height:900px)]:h-[min(calc(100dvh-2rem),var(--radix-popover-content-available-height,calc(100dvh-2rem)))]",
        className,
      )}
      surface="panel"
      aria-label="Weather settings"
    >
      <WeatherSummaryBar
        location={location}
        temperature={value.temperature}
        date={value.date}
        hour={value.hour}
        minute={value.minute}
        theme={theme}
      />

      <ScrollArea type="auto" className="min-h-0 flex-1">
        <div className="space-y-4 px-3 pb-4 pt-3 [@media(max-height:900px)]:space-y-2 [@media(max-height:900px)]:py-2">
          <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-card-foreground">
            Weather settings
          </h2>

          <WeatherModeToggle
            value={value.mode}
            onChange={(mode) => setValue((current) => ({ ...current, mode }))}
          />

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
                  <SelectContent className={theme === "dark" ? "dark" : undefined}>
                    <SelectItem value="Spring">Spring</SelectItem>
                    <SelectItem value="Summer">Summer</SelectItem>
                    <SelectItem value="Autumn">Autumn</SelectItem>
                    <SelectItem value="Winter">Winter</SelectItem>
                  </SelectContent>
                </Select>
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
              </div>
            </div>

            <div className="space-y-2 [@media(max-height:900px)]:space-y-1">
              <SectionLabel>Weather Events</SectionLabel>
              <div className="space-y-4 [@media(max-height:900px)]:space-y-1">
                <WeatherEventRow label="Fog" value={value.events.fog} unit="%" onChange={(next) => updateEvent("fog", next)} />
                <WeatherEventRow label="Rain" value={value.events.rain} unit="%" onChange={(next) => updateEvent("rain", next)} />
                <WeatherEventRow label="Thunder" value={value.events.thunder} unit="%" onChange={(next) => updateEvent("thunder", next)} />
                <WeatherEventRow label="Dust" value={value.events.dust} unit="%" onChange={(next) => updateEvent("dust", next)} />
                <WeatherEventRow label="Cloud Coverage" value={value.events.cloudCoverage} unit="%" onChange={(next) => updateEvent("cloudCoverage", next)} />
                <WeatherEventRow label="Wind" value={value.events.wind} unit="%" step={0.1} onChange={(next) => updateEvent("wind", next)} />
                <WeatherEventRow label="Wind Direction" value={value.events.windDirection} unit="°" maximum={360} onChange={(next) => updateEvent("windDirection", next)} />
                <WeatherEventRow label="Snow" value={value.events.snow} unit="%" onChange={(next) => updateEvent("snow", next)} />
              </div>
            </div>
          </fieldset>
        </div>
      </ScrollArea>
    </Card>
  );
}
