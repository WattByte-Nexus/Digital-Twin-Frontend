import * as React from "react";

import { cn } from "../lib/utils";
import { surfaceThemeClassName, type SurfaceTheme } from "../lib/surface-theme";
import { Card } from "./card";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "./popover";
import { ScrollArea } from "./scroll-area";

export interface SimulationPopoverProps {
  children: React.ReactNode;
  trigger?: React.ReactElement;
  anchor?: React.ReactElement;
  label?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: React.ComponentProps<typeof PopoverContent>["align"];
  side?: React.ComponentProps<typeof PopoverContent>["side"];
  sideOffset?: number;
  contentClassName?: string;
  panelClassName?: string;
  bodyClassName?: string;
  theme?: SurfaceTheme;
}

/**
 * A non-modal work surface for configuring and monitoring simulations.
 * The consumer owns the simulation form and run state; this component owns
 * only the accessible popover chrome and scrolling behavior.
 */
export function SimulationPopover({
  children,
  trigger,
  anchor,
  label = "Simulation workspace",
  open,
  defaultOpen,
  onOpenChange,
  align = "end",
  side = "bottom",
  sideOffset = 10,
  contentClassName,
  panelClassName,
  bodyClassName,
  theme,
}: SimulationPopoverProps) {
  return (
    <Popover
      defaultOpen={defaultOpen}
      modal={false}
      onOpenChange={onOpenChange}
      open={open}
    >
      {trigger ? <PopoverTrigger asChild>{trigger}</PopoverTrigger> : null}
      {anchor ? <PopoverAnchor asChild>{anchor}</PopoverAnchor> : null}
      <PopoverContent
        align={align}
        aria-label={label}
        className={cn(
          "z-[90] w-[min(420px,calc(100vw-24px))] overflow-hidden border-0 bg-transparent p-0 shadow-none outline-none",
          theme && surfaceThemeClassName(theme),
          contentClassName,
        )}
        onOpenAutoFocus={(event) => event.preventDefault()}
        side={side}
        sideOffset={sideOffset}
      >
        <Card
          className={cn(
            "max-h-[min(760px,var(--radix-popover-content-available-height))] gap-0 overflow-hidden rounded-xl py-0",
            panelClassName,
          )}
          surface="panel"
        >
          <ScrollArea className={cn("min-h-0 flex-1", bodyClassName)}>
            {children}
          </ScrollArea>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
