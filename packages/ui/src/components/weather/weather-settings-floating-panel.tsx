import { CloudSun, X } from "lucide-react";
import * as React from "react";
import { Button } from "../button";
import { cn } from "../../lib/utils";
import {
  FloatingMapLauncher,
  FloatingMapPanel,
  FloatingMapPanelDragHandle,
} from "../floating-map-panel";
import type { FloatingPanelAnchor } from "../floating-map-panel-geometry";
import type { WeatherSettingsPanelProps } from "./types";
import { WeatherSettingsPanel } from "./weather-settings-panel";

const WEATHER_PANEL_SIZE = { width: 380, height: 820 };

export interface WeatherSettingsFloatingPanelProps extends WeatherSettingsPanelProps {
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  trigger?: React.ReactElement;
}

export function WeatherSettingsFloatingPanel({
  defaultOpen = false,
  onOpenChange,
  open,
  trigger,
  theme = "light",
  ...panelProps
}: WeatherSettingsFloatingPanelProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isOpen = open ?? uncontrolledOpen;
  const [anchor, setAnchor] = React.useState<FloatingPanelAnchor>({
    edge: "right",
    offset: 0,
  });
  const [panelPresent, setPanelPresent] = React.useState(isOpen);
  React.useEffect(() => {
    if (isOpen) return;
    const timeout = window.setTimeout(() => setPanelPresent(false), 200);
    return () => window.clearTimeout(timeout);
  }, [isOpen]);
  const setOpen = (nextOpen: boolean) => {
    if (nextOpen) setPanelPresent(true);
    if (open === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };
  const triggerElement = trigger ?? (
    <Button type="button" variant="outline" className="text-foreground">
      <CloudSun aria-hidden="true" />
      Weather settings
    </Button>
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <FloatingMapLauncher
        anchor={anchor}
        hidden={isOpen}
        onActivate={() => setOpen(true)}
        onAnchorChange={setAnchor}
      >
        {React.cloneElement(triggerElement, {
          "aria-expanded": isOpen,
          "aria-haspopup": "dialog",
        } as React.HTMLAttributes<HTMLElement>)}
      </FloatingMapLauncher>

      {isOpen || panelPresent ? (
        <FloatingMapPanel
          anchor={anchor}
          aria-label="Weather settings"
          defaultSize={WEATHER_PANEL_SIZE}
          fitToBounds
          onAnchorChange={setAnchor}
        >
          <div
            className={cn(
              "relative h-full origin-center",
              isOpen
                ? "animate-in fade-in-0 zoom-in-95"
                : "pointer-events-none animate-out fade-out-0 zoom-out-95",
            )}
            data-state={isOpen ? "open" : "closed"}
            style={{
              transformOrigin:
                anchor.edge === "left" || anchor.edge === "right"
                  ? `${anchor.edge} ${anchor.offset * 100}%`
                  : `${anchor.offset * 100}% ${anchor.edge}`,
            }}
          >
            <WeatherSettingsPanel
              {...panelProps}
              className="h-full max-h-none w-full max-w-none"
              theme={theme}
            />
            <FloatingMapPanelDragHandle className="absolute inset-x-0 top-0 z-10 h-[46px] rounded-t-[10px]" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 z-20 h-7 w-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close weather settings"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Button>
          </div>
        </FloatingMapPanel>
      ) : null}
    </div>
  );
}
