import { CloudSun, X } from "lucide-react";
import * as React from "react";
import { Button } from "../button";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "../popover";
import { cn } from "../../lib/utils";
import { surfaceThemeClassName } from "../../lib/surface-theme";
import type { WeatherSettingsPanelProps } from "./types";
import { WeatherSettingsPanel } from "./weather-settings-panel";

export interface WeatherSettingsPopoverProps extends WeatherSettingsPanelProps {
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  trigger?: React.ReactElement;
}

export function WeatherSettingsPopover({
  defaultOpen,
  onOpenChange,
  open,
  trigger,
  theme = "light",
  ...panelProps
}: WeatherSettingsPopoverProps) {
  return (
    <Popover defaultOpen={defaultOpen} onOpenChange={onOpenChange} open={open}>
      <PopoverTrigger asChild className="data-[state=open]:invisible">
        {trigger ?? (
          <Button type="button" variant="outline" className="text-foreground">
            <CloudSun aria-hidden="true" />
            Weather settings
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={-36}
        collisionPadding={16}
        className={cn(
          "w-auto border-0 bg-transparent p-0 shadow-none",
          surfaceThemeClassName(theme),
        )}
      >
        <div className="relative">
          <WeatherSettingsPanel {...panelProps} theme={theme} />
          <PopoverClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 z-10 h-7 w-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close weather settings"
            >
              <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Button>
          </PopoverClose>
        </div>
      </PopoverContent>
    </Popover>
  );
}
