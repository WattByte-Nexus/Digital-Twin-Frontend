import { Bell } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

export interface DigitalTwinAlertSummary {
  description: string;
  id: string;
  name: string;
}

export interface DigitalTwinAlertsDropdownProps {
  alerts?: readonly DigitalTwinAlertSummary[];
  alertsCount?: number;
  onOpenAlerts?: () => void;
  overlayClassName?: string;
}

export function DigitalTwinAlertsDropdown({
  alerts = [],
  alertsCount = 0,
  onOpenAlerts,
  overlayClassName,
}: DigitalTwinAlertsDropdownProps) {
  const countLabel = `${alertsCount} ${
    alertsCount === 1 ? "alert" : "alerts"
  } awaiting review`;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Open alerts${alertsCount > 0 ? `, ${countLabel}` : ""}`}
              className="relative h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
              size="icon"
              type="button"
              variant="ghost"
            >
              <Bell aria-hidden="true" className="h-4 w-4" />
              {alertsCount > 0 ? (
                <Badge
                  className="absolute end-0 top-0 h-4 min-w-4 rounded-full px-1 text-[9px] font-bold leading-4"
                  variant="destructive"
                >
                  {alertsCount > 99 ? "99+" : alertsCount}
                </Badge>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent className={overlayClassName}>
          Open alert inbox
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent
        align="end"
        className={cn(overlayClassName, "w-80")}
      >
        <DropdownMenuLabel className="flex items-center justify-between gap-3">
          <span>Alerts</span>
          {alertsCount > 0 ? (
            <Badge variant="destructive">{countLabel}</Badge>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {alerts.length > 0 ? (
          alerts.map((alert) => (
            <DropdownMenuItem
              className="items-start gap-3 py-3"
              key={alert.id}
              onSelect={onOpenAlerts}
            >
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-destructive" />
              <span className="min-w-0">
                <span className="block truncate font-medium">{alert.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {alert.description}
                </span>
              </span>
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled>
            {alertsCount > 0 ? countLabel : "No alerts awaiting review"}
          </DropdownMenuItem>
        )}
        {alertsCount > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onOpenAlerts}>
              <Bell aria-hidden="true" className="me-2 h-4 w-4" />
              View all alerts
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
