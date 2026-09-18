import { X } from "lucide-react";
import type * as React from "react";
import { surfaceThemeClassName, type SurfaceTheme } from "../lib/surface-theme";
import { cn } from "../lib/utils";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card } from "./card";
import {
  Popover,
  PopoverAnchor,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
} from "./popover";

export interface AssetPropertiesPopoverPositionProps {
  align?: "start" | "center" | "end";
  defaultOpen?: boolean;
  dock?: "right";
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  screenPosition: { x: number; y: number };
  side?: "top" | "right" | "bottom" | "left";
  theme?: SurfaceTheme;
}

export function SectionHeading({
  children,
  id,
}: {
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <h3
      className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
      id={id}
    >
      {children}
    </h3>
  );
}

export function PropertyRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] items-start gap-4 py-2.5 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}

export function AssetPropertiesPopover({
  align = "end",
  assetName,
  assetKind,
  children,
  defaultOpen,
  description,
  dock,
  icon: Icon,
  onOpenChange,
  open,
  screenPosition,
  side = "bottom",
  theme = "light",
}: AssetPropertiesPopoverPositionProps & {
  assetName: string;
  assetKind: string;
  children: React.ReactNode;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}) {
  return (
    <Popover
      defaultOpen={defaultOpen}
      modal={false}
      onOpenChange={onOpenChange}
      open={open}
    >
      <PopoverAnchor asChild>
        <span
          aria-hidden="true"
          className="pointer-events-none fixed size-px"
          style={
            dock === "right"
              ? { right: 12, top: screenPosition.y }
              : { left: screenPosition.x, top: screenPosition.y }
          }
        />
      </PopoverAnchor>
      <PopoverContent
        align={align}
        aria-label={`Properties for ${assetName}`}
        className={cn(
          surfaceThemeClassName(theme),
          "z-[90] w-[min(420px,calc(100vw-24px))] overflow-hidden border-0 bg-transparent p-0 shadow-none data-[state=open]:duration-200 data-[state=closed]:duration-150 ease-out motion-reduce:animate-none"
        )}
        side={side}
        sideOffset={10}
      >
        <Card
          className="h-[min(720px,var(--radix-popover-content-available-height))] gap-0 overflow-hidden rounded-xl py-0"
          surface="panel"
        >
          <PopoverHeader className="flex-row items-start gap-3 border-b px-4 py-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <PopoverTitle className="truncate text-base font-semibold text-foreground">
                  {assetName}
                </PopoverTitle>
                <Badge variant="outline">{assetKind}</Badge>
              </div>
              <PopoverDescription className="mt-1 break-words text-xs">
                {description}
              </PopoverDescription>
            </div>
            <PopoverClose asChild>
              <Button
                aria-label={`Close ${assetKind.toLowerCase()} properties`}
                className="-mr-2 -mt-2 size-11 shrink-0 text-muted-foreground"
                size="icon"
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" className="size-4" />
              </Button>
            </PopoverClose>
          </PopoverHeader>
          {children}
        </Card>
      </PopoverContent>
    </Popover>
  );
}
