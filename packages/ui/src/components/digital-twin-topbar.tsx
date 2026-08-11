import {
  Activity,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  LogOut,
  Moon,
  Search,
  Settings,
  Sun,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { Avatar, AvatarFallback } from "./avatar";
import { Button } from "./button";
import {
  DigitalTwinAlertsDropdown,
  type DigitalTwinAlertSummary,
} from "./digital-twin-alerts-dropdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

export interface DigitalTwinOperator {
  name: string;
  role: string;
  initials: string;
}

export interface DigitalTwinTopbarProps {
  alerts?: readonly DigitalTwinAlertSummary[];
  alertsCount?: number;
  alertsPanelContainer?: Element | DocumentFragment | null;
  mapToolbar?: ReactNode;
  operator: DigitalTwinOperator;
  organizationName: string;
  sidebarTrigger?: ReactNode;
  themeMode?: "light" | "dark";
  onOpenAdministration?: () => void;
  onOpenAlerts?: () => void;
  onOpenDiagnostics?: () => void;
  onOpenExpertWorkspace?: () => void;
  onOpenHelp?: () => void;
  onOpenSearch?: () => void;
  onSignOut?: () => void;
  onToggleTheme?: () => void;
}

function IconAction({
  label,
  icon: Icon,
  onClick,
  overlayClassName,
}: {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  overlayClassName: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onClick}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Icon aria-hidden="true" className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent className={overlayClassName}>{label}</TooltipContent>
    </Tooltip>
  );
}

function MenuAction({
  children,
  icon: Icon,
  onSelect,
}: {
  children: ReactNode;
  icon: LucideIcon;
  onSelect?: () => void;
}) {
  return (
    <DropdownMenuItem onSelect={onSelect}>
      <Icon aria-hidden="true" className="me-2 h-4 w-4 text-muted-foreground" />
      {children}
    </DropdownMenuItem>
  );
}

export function DigitalTwinTopbar({
  alerts = [],
  alertsCount = 0,
  alertsPanelContainer,
  mapToolbar,
  operator,
  organizationName,
  sidebarTrigger,
  themeMode = "dark",
  onOpenAdministration,
  onOpenAlerts,
  onOpenDiagnostics,
  onOpenExpertWorkspace,
  onOpenHelp,
  onOpenSearch,
  onSignOut,
  onToggleTheme,
}: DigitalTwinTopbarProps) {
  const themeLabel =
    themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode";
  const ThemeIcon = themeMode === "dark" ? Sun : Moon;
  const themeClassName = themeMode === "dark" ? "dark" : "theme-light";
  const overlayClassName = cn(themeClassName, "surface-glass-overlay");

  return (
    <TooltipProvider delayDuration={300}>
      <header
        aria-label="Digital Twin application header"
        className={cn(
          themeClassName,
          "@container/topbar flex h-16 w-full min-w-0 shrink-0 items-center border-b border-separator bg-card px-4 text-card-foreground shadow-none"
        )}
      >
        {sidebarTrigger ? (
          <div className="me-1 flex shrink-0 items-center">
            {sidebarTrigger}
          </div>
        ) : null}

        <div className="ms-auto flex min-w-0 items-center gap-1 @sm/topbar:gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Search regions, assets, alerts, and runs"
                className="hidden h-10 gap-2 px-2.5 text-muted-foreground hover:text-foreground @sm/topbar:inline-flex"
                onClick={onOpenSearch}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Search aria-hidden="true" className="h-4 w-4" />
                <span className="hidden text-xs @5xl/topbar:inline">
                  Search
                </span>
                <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground @[96rem]/topbar:inline">
                  /
                </kbd>
              </Button>
            </TooltipTrigger>
            <TooltipContent className={overlayClassName}>
              Search regions, assets, alerts, and runs
            </TooltipContent>
          </Tooltip>

          <IconAction
            icon={ThemeIcon}
            label={themeLabel}
            onClick={onToggleTheme}
            overlayClassName={overlayClassName}
          />

          <IconAction
            icon={CircleHelp}
            label="Help and keyboard shortcuts"
            onClick={onOpenHelp}
            overlayClassName={overlayClassName}
          />

          <DigitalTwinAlertsDropdown
            alerts={alerts}
            alertsCount={alertsCount}
            inboxContainer={alertsPanelContainer}
            onOpenAlerts={onOpenAlerts}
            overlayClassName={overlayClassName}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Open operator and system menu"
                className="h-11 min-w-11 gap-2.5 px-1.5 @sm/topbar:px-2.5"
                size="sm"
                type="button"
                variant="ghost"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
                    {operator.initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden min-w-0 text-start @[96rem]/topbar:block">
                  <span className="block max-w-32 truncate text-xs font-medium">
                    {operator.name}
                  </span>
                  <span className="block max-w-32 truncate text-[10px] font-normal text-muted-foreground">
                    {operator.role}
                  </span>
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground @sm/topbar:block"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className={cn(
                overlayClassName,
                "w-80 min-w-[var(--radix-dropdown-menu-trigger-width)]"
              )}
            >
              <DropdownMenuLabel>
                <span className="block truncate">{operator.name}</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {operator.role} · {organizationName}
                </span>
                <span className="block text-xs font-normal text-muted-foreground">
                  Decision support only
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <MenuAction icon={Activity} onSelect={onOpenDiagnostics}>
                Diagnostics
              </MenuAction>
              {onOpenExpertWorkspace ? (
                <MenuAction icon={Wrench} onSelect={onOpenExpertWorkspace}>
                  Open Expert GIS workspace
                  <ExternalLink
                    aria-hidden="true"
                    className="ms-auto h-3.5 w-3.5"
                  />
                </MenuAction>
              ) : null}
              {onOpenAdministration ? (
                <MenuAction icon={Settings} onSelect={onOpenAdministration}>
                  Administration
                </MenuAction>
              ) : null}
              {onSignOut ? (
                <>
                  <DropdownMenuSeparator />
                  <MenuAction icon={LogOut} onSelect={onSignOut}>
                    Sign out
                  </MenuAction>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      {mapToolbar ? (
        <nav
          aria-label="Map controls"
          className={cn(
            themeClassName,
            "flex h-12 w-full min-w-0 shrink-0 items-center overflow-x-auto border-b border-separator bg-card px-4 text-card-foreground shadow-none"
          )}
        >
          {mapToolbar}
        </nav>
      ) : null}
    </TooltipProvider>
  );
}
