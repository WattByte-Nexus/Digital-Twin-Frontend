import { Map, Mountain } from "lucide-react";
import { cn } from "../lib/utils";

export interface DigitalTwinMapStatusProps {
  viewMode: "3d" | "plan";
  visibleDetailCount: number;
  className?: string;
}

/** Read-only summary pill for the current map presentation and display density. */
export function DigitalTwinMapStatus({
  viewMode,
  visibleDetailCount,
  className,
}: DigitalTwinMapStatusProps) {
  const ViewIcon = viewMode === "3d" ? Mountain : Map;
  const detailNoun = visibleDetailCount === 1 ? "detail group" : "detail groups";

  return (
    <output
      aria-live="polite"
      className={cn(
        "surface-glass inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium",
        className,
      )}
    >
      <ViewIcon aria-hidden="true" className="size-3.5 text-primary" />
      <span>{viewMode === "3d" ? "3D terrain" : "Plan view"}</span>
      <span aria-hidden="true" className="size-1 rounded-full bg-muted-foreground/60" />
      <span className="text-muted-foreground">
        {visibleDetailCount} {detailNoun} visible
      </span>
    </output>
  );
}
