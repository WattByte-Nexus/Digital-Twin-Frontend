import { Cloud, CloudSun } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "../toggle-group";
import type { WeatherMode } from "./types";

export interface WeatherModeToggleProps {
  onChange: (value: WeatherMode) => void;
  value: WeatherMode;
}

export function WeatherModeToggle({ value, onChange }: WeatherModeToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => next && onChange(next as WeatherMode)}
      variant="outline"
      spacing={8}
      className="grid w-full grid-cols-2"
      aria-label="Weather source"
    >
      <ToggleGroupItem
        value="auto"
        className="h-9 w-full rounded-md text-[12px] font-semibold text-muted-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
      >
        <CloudSun className="text-amber-500" aria-hidden="true" />
        Set auto
      </ToggleGroupItem>
      <ToggleGroupItem
        value="manual"
        className="h-9 w-full rounded-md text-[12px] font-semibold text-muted-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
      >
        <Cloud className="fill-fuchsia-600 text-fuchsia-600" aria-hidden="true" />
        Set manually
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
