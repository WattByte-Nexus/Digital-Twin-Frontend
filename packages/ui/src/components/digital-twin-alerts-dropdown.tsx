import { Bell, CheckCheck, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";
import { Badge } from "./badge";
import { Button } from "./button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import {
  FloatingMapPanel,
  FloatingMapPanelDragHandle,
} from "./floating-map-panel";
import { ScrollArea } from "./scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

export type DigitalTwinAlertSeverity = "high" | "medium" | "low";

export interface DigitalTwinAlertSummary {
  description: string;
  id: string;
  name: string;
  severity: DigitalTwinAlertSeverity;
}

export interface DigitalTwinAlertsDropdownProps {
  alerts?: readonly DigitalTwinAlertSummary[];
  alertsCount?: number;
  inboxContainer?: Element | DocumentFragment | null;
  onOpenAlerts?: () => void;
  overlayClassName?: string;
}

type AlertTab = "active" | "acknowledged" | "all";

const ALERT_TABS: readonly { label: string; value: AlertTab }[] = [
  { label: "Active", value: "active" },
  { label: "Acknowledged", value: "acknowledged" },
  { label: "All", value: "all" },
];

function severityLabel(severity: DigitalTwinAlertSeverity) {
  return `${severity.charAt(0).toUpperCase()}${severity.slice(1)}`;
}

function severityVariant(severity: DigitalTwinAlertSeverity) {
  if (severity === "high") return "destructive" as const;
  if (severity === "medium") return "secondary" as const;
  return "outline" as const;
}

export function DigitalTwinAlertsDropdown({
  alerts = [],
  alertsCount = 0,
  inboxContainer,
  onOpenAlerts,
  overlayClassName,
}: DigitalTwinAlertsDropdownProps) {
  const [allReviewed, setAllReviewed] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [reviewedAlertIds, setReviewedAlertIds] = useState<Set<string>>(
    () => new Set()
  );
  const reviewedCount = allReviewed ? alertsCount : reviewedAlertIds.size;
  const activeCount = Math.max(0, alertsCount - reviewedCount);
  const activeAlerts = alerts.filter(
    (alert) => !allReviewed && !reviewedAlertIds.has(alert.id)
  );
  const countLabel = `${activeCount} ${
    activeCount === 1 ? "alert" : "alerts"
  } awaiting review`;

  const alertsForTab = (tab: AlertTab) => {
    if (tab === "all") return alerts;
    return alerts.filter((alert) => {
      const acknowledged = allReviewed || reviewedAlertIds.has(alert.id);
      return tab === "acknowledged" ? acknowledged : !acknowledged;
    });
  };

  const openAlert = (alertId: string) => {
    setReviewedAlertIds((current) => new Set(current).add(alertId));
    setInboxOpen(false);
    onOpenAlerts?.();
  };

  const openFullInbox = () => {
    setInboxOpen(false);
    onOpenAlerts?.();
  };

  const renderAlertList = (tab: AlertTab) => {
    const visibleAlerts = alertsForTab(tab);

    return (
      <ScrollArea className="h-full">
        <div className="space-y-2 p-3">
          {visibleAlerts.length > 0 ? (
            visibleAlerts.map((alert) => (
              <Button
                className="h-auto w-full items-start justify-start gap-3 whitespace-normal border border-border/70 p-3 text-start"
                key={alert.id}
                onClick={() => openAlert(alert.id)}
                type="button"
                variant="ghost"
              >
                <span className="min-w-0 flex-1">
                  <span className="mb-1.5 flex items-center gap-2">
                    <Badge
                      className="text-[12px]"
                      variant={severityVariant(alert.severity)}
                    >
                      {severityLabel(alert.severity)}
                    </Badge>
                    <span className="truncate text-[13px] font-medium">
                      {alert.name}
                    </span>
                  </span>
                  <span className="block text-[12px] font-normal text-muted-foreground">
                    {alert.description}
                  </span>
                </span>
                {allReviewed || reviewedAlertIds.has(alert.id) ? (
                  <CheckCheck
                    aria-label="Acknowledged"
                    className="mt-1 h-4 w-4 shrink-0 text-muted-foreground"
                  />
                ) : null}
              </Button>
            ))
          ) : (
            <div className="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-border p-6 text-center text-[13px] text-muted-foreground">
              {tab === "active"
                ? "No active alerts"
                : tab === "acknowledged"
                ? "No acknowledged alerts"
                : "No alerts to display"}
            </div>
          )}
        </div>
      </ScrollArea>
    );
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={`Open alerts${
                  activeCount > 0 ? `, ${countLabel}` : ""
                }`}
                className="relative h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
                size="icon"
                type="button"
                variant="ghost"
              >
                <Bell aria-hidden="true" className="h-4 w-4" />
                {activeCount > 0 ? (
                  <Badge
                    className="absolute end-0 top-0 h-4 min-w-4 rounded-full px-1 text-[9px] font-bold leading-4"
                    variant="destructive"
                  >
                    {activeCount > 99 ? "99+" : activeCount}
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
            {activeCount > 0 ? (
              <Badge variant="destructive">{countLabel}</Badge>
            ) : null}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {activeAlerts.length > 0 ? (
            activeAlerts.map((alert) => (
              <DropdownMenuItem
                className="items-start gap-3 py-3"
                key={alert.id}
                onSelect={onOpenAlerts}
              >
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-destructive" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {alert.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {severityLabel(alert.severity)} · {alert.description}
                  </span>
                </span>
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled>
              {activeCount > 0 ? countLabel : "No alerts awaiting review"}
            </DropdownMenuItem>
          )}
          {alertsCount > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setInboxOpen(true)}>
                <Bell aria-hidden="true" className="me-2 h-4 w-4" />
                View all alerts
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {inboxOpen
        ? createPortal(
            <FloatingMapPanel
              aria-label="Alerts"
              defaultDock="top-left"
              defaultSize={{ width: 380, height: 820 }}
              fitToBounds
            >
              <Card
                className={cn(
                  overlayClassName,
                  "relative h-full gap-0 overflow-hidden rounded-[10px] py-0 shadow-xl animate-in fade-in-0 zoom-in-95"
                )}
                surface="panel"
              >
                <FloatingMapPanelDragHandle className="absolute inset-x-0 top-0 z-10 h-[46px] rounded-t-[10px]" />
                <Button
                  aria-label="Close alert inbox"
                  className="absolute right-2 top-2 z-20 h-7 w-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => setInboxOpen(false)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </Button>

                <CardHeader className="gap-0 border-b border-border px-3 pb-3 pt-3 pe-12">
                  <span className="flex items-center justify-between gap-3">
                    <CardTitle className="text-[18px] tracking-[-0.01em]">
                      Alerts
                    </CardTitle>
                    <Badge
                      className="text-[12px]"
                      variant={activeCount > 0 ? "destructive" : "secondary"}
                    >
                      {countLabel}
                    </Badge>
                  </span>
                  <CardDescription className="mt-0.5 text-[12px] font-medium">
                    Review operational alerts without leaving the map workspace.
                  </CardDescription>
                  <Button
                    className="mt-2 w-fit text-sm"
                    disabled={activeCount === 0}
                    onClick={() => setAllReviewed(true)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <CheckCheck aria-hidden="true" className="h-4 w-4" />
                    Mark all reviewed
                  </Button>
                </CardHeader>

                <CardContent className="min-h-0 flex-1 p-0">
                  <Tabs className="h-full min-h-0 gap-0" defaultValue="active">
                    <TabsList className="mx-3 mt-3 grid w-auto grid-cols-3">
                      {ALERT_TABS.map((tab) => (
                        <TabsTrigger
                          className="text-[14px]"
                          key={tab.value}
                          value={tab.value}
                        >
                          {tab.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {ALERT_TABS.map((tab) => (
                      <TabsContent
                        className="min-h-0 flex-1"
                        key={tab.value}
                        value={tab.value}
                      >
                        {renderAlertList(tab.value)}
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>

                <CardFooter className="border-t border-border p-3">
                  <Button
                    className="text-sm"
                    onClick={openFullInbox}
                    size="sm"
                    type="button"
                  >
                    Open full alert inbox
                  </Button>
                </CardFooter>
              </Card>
            </FloatingMapPanel>,
            inboxContainer ?? document.body
          )
        : null}
    </>
  );
}
