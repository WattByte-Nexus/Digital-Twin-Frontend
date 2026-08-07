import { Activity, CircleCheck, CloudOff, ShieldCheck } from "lucide-react";
import { cn } from "../lib/utils";
import { Badge } from "./badge";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

export type DigitalTwinMonitoringTone = "current" | "degraded" | "offline";

export interface DigitalTwinMonitoringStatusProps {
  className?: string;
  detail?: string;
  label?: string;
  themeMode?: "light" | "dark";
  tone?: DigitalTwinMonitoringTone;
  onOpenDiagnostics?: () => void;
}

const monitoringStyles: Record<DigitalTwinMonitoringTone, string> = {
  current:
    "border-[hsl(var(--dt-status-ok-border))] bg-[hsl(var(--dt-status-ok-surface))] text-[hsl(var(--dt-status-ok-text))]",
  degraded:
    "border-[hsl(var(--dt-status-review-border))] bg-[hsl(var(--dt-status-review-surface))] text-[hsl(var(--dt-status-review-text))]",
  offline:
    "border-[hsl(var(--dt-status-failed-border))] bg-[hsl(var(--dt-status-failed-surface))] text-[hsl(var(--dt-status-failed-text))]",
};

export function DigitalTwinMonitoringStatus({
  className,
  detail = "Updated 2 min ago",
  label = "Current",
  themeMode = "dark",
  tone = "current",
  onOpenDiagnostics,
}: DigitalTwinMonitoringStatusProps) {
  const MonitoringIcon = tone === "offline" ? CloudOff : CircleCheck;
  const themeClassName = themeMode === "dark" ? "dark" : "theme-light";
  const overlayClassName = cn(themeClassName, "surface-glass-overlay");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Monitoring status: ${label}. ${detail}`}
          className={cn(
            themeClassName,
            "group h-9 shrink-0 rounded-full p-0 hover:bg-transparent hover:text-inherit",
            className
          )}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Badge
            className={cn(
              "h-9 gap-1.5 rounded-full px-3 text-xs font-semibold transition-[filter] group-hover:brightness-110",
              monitoringStyles[tone]
            )}
            variant="outline"
          >
            <MonitoringIcon aria-hidden="true" className="h-3.5 w-3.5" />
            <span>{label}</span>
            <span className="font-normal opacity-80">· {detail}</span>
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(
          overlayClassName,
          "w-72 min-w-[var(--radix-dropdown-menu-trigger-width)]"
        )}
      >
        <DropdownMenuLabel>Monitoring summary</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onOpenDiagnostics}>
          <Activity
            aria-hidden="true"
            className="me-2 h-4 w-4 text-muted-foreground"
          />
          <span>
            <span className="block">{label}</span>
            <span className="block text-xs text-muted-foreground">
              {detail}
            </span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenDiagnostics}>
          <ShieldCheck
            aria-hidden="true"
            className="me-2 h-4 w-4 text-muted-foreground"
          />
          Decision-support diagnostics
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
