import { Input } from "../input";
import { Label } from "../label";
import { clampWeatherValue } from "./types";

export interface WeatherEventRowProps {
  label: string;
  maximum?: number;
  onChange: (value: number) => void;
  step?: number;
  unit: string;
  value: number;
}

export function WeatherEventRow({
  label,
  value,
  unit,
  maximum = 100,
  step = 1,
  onChange,
}: WeatherEventRowProps) {
  const id = `weather-${label.toLowerCase().replaceAll(" ", "-")}`;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_104px] items-center gap-2">
      <Label className="truncate text-[11px] font-medium text-muted-foreground" htmlFor={id}>
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          className="input-compact-number h-8 min-w-0 ps-3 pe-10 text-right tabular-nums"
          type="number"
          min={0}
          max={maximum}
          step={step}
          value={value}
          onChange={(event) =>
            onChange(clampWeatherValue(Number(event.target.value), 0, maximum))
          }
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
          {unit}
        </span>
      </div>
    </div>
  );
}
