import { CloudSun } from "lucide-react";
import { padWeatherTime, type WeatherTheme } from "./types";

export interface WeatherSummaryBarProps {
  date: string;
  hour: number;
  location: string;
  minute: number;
  temperature: number;
  theme?: WeatherTheme;
}

export function WeatherSummaryBar({
  location,
  temperature,
  date,
  hour,
  minute,
}: WeatherSummaryBarProps) {
  const formattedDate = new Intl.DateTimeFormat("en", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00`));

  return (
    <header className="flex h-[46px] items-center gap-2.5 bg-transparent px-3">
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background text-amber-500 shadow-sm">
          <CloudSun className="h-[18px] w-[18px]" aria-hidden="true" />
          <span className="absolute -bottom-0.5 -right-1 rounded-full border bg-foreground px-1 text-[9px] font-semibold leading-[15px] text-background">
            {Math.round(temperature)}
          </span>
        </div>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[10px] font-medium text-muted-foreground">{location}</p>
          <p className="mt-0.5 text-[11px] font-medium tracking-wide text-foreground/70">
            {formattedDate}
            <span className="mx-2 text-muted-foreground/40">•</span>
            {padWeatherTime(hour)}:{padWeatherTime(minute)}
          </p>
        </div>
    </header>
  );
}
