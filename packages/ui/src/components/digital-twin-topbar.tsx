import {
  Activity,
  Bell,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  FlaskConical,
  History,
  LogOut,
  MapPin,
  Moon,
  Radio,
  Search,
  Settings,
  Sun,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { Avatar, AvatarFallback } from "./avatar";
import { Badge } from "./badge";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

export type DigitalTwinDestination = "live" | "scenarios" | "runs";

export interface DigitalTwinRegion {
  id: string;
  name: string;
  description: string;
}

export interface DigitalTwinOperator {
  name: string;
  role: string;
  initials: string;
}

export interface DigitalTwinTopbarProps {
  activeDestination?: DigitalTwinDestination;
  activeRegionId: string;
  alertsCount?: number;
  operator: DigitalTwinOperator;
  organizationName: string;
  regions: DigitalTwinRegion[];
  themeMode?: "light" | "dark";
  onNavigate?: (destination: DigitalTwinDestination) => void;
  onOpenAdministration?: () => void;
  onOpenAlerts?: () => void;
  onOpenDiagnostics?: () => void;
  onOpenExpertWorkspace?: () => void;
  onOpenHelp?: () => void;
  onOpenSearch?: () => void;
  onSelectRegion?: (regionId: string) => void;
  onSignOut?: () => void;
  onToggleTheme?: () => void;
}

interface DestinationDefinition {
  id: DigitalTwinDestination;
  label: string;
  description: string;
  icon: LucideIcon;
}

const destinations: DestinationDefinition[] = [
  {
    id: "live",
    label: "Live",
    description: "Monitoring and alert inbox",
    icon: Radio,
  },
  {
    id: "scenarios",
    label: "Scenarios",
    description: "Bounded what-if studies",
    icon: FlaskConical,
  },
  {
    id: "runs",
    label: "Runs",
    description: "Run status, history, and replay",
    icon: History,
  },
];

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
  activeDestination = "live",
  activeRegionId,
  alertsCount = 0,
  operator,
  organizationName,
  regions,
  themeMode = "dark",
  onNavigate,
  onOpenAdministration,
  onOpenAlerts,
  onOpenDiagnostics,
  onOpenExpertWorkspace,
  onOpenHelp,
  onOpenSearch,
  onSelectRegion,
  onSignOut,
  onToggleTheme,
}: DigitalTwinTopbarProps) {
  const activeRegion =
    regions.find((region) => region.id === activeRegionId) ?? regions[0];
  const activeDestinationDefinition =
    destinations.find((destination) => destination.id === activeDestination) ??
    destinations[0];
  const ActiveDestinationIcon = activeDestinationDefinition.icon;
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
          "surface-glass-subtle @container/topbar flex h-16 w-full min-w-0 items-center border-b px-4 text-card-foreground"
        )}
      >
        <Button
          asChild
          className="h-11 shrink-0 px-2 text-sm font-semibold"
          variant="ghost"
        >
          <a href="#digital-twin">
            <span>WattByte Nexus</span>
          </a>
        </Button>

        <span
          aria-hidden="true"
          className="mx-1 h-7 w-px shrink-0 bg-border @sm/topbar:mx-2"
        />
        <div className="ms-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={`Change Digital Twin section. Current section: ${activeDestinationDefinition.label}`}
                className="h-10 min-w-10 gap-2 px-2 @sm/topbar:px-3"
                size="sm"
                type="button"
                variant="ghost"
              >
                <ActiveDestinationIcon
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0"
                />
                <span className="hidden text-sm font-medium @sm/topbar:inline">
                  {activeDestinationDefinition.label}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="hidden h-3.5 w-3.5 text-muted-foreground @sm/topbar:block"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className={cn(
                overlayClassName,
                "w-72 min-w-[var(--radix-dropdown-menu-trigger-width)]"
              )}
            >
              <DropdownMenuLabel>Digital Twin</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {destinations.map(
                ({ description, icon: Icon, id, label }) => (
                  <DropdownMenuItem
                    aria-current={activeDestination === id ? "page" : undefined}
                    className={cn(
                      activeDestination === id &&
                        "bg-accent text-accent-foreground"
                    )}
                    key={id}
                    onSelect={() => onNavigate?.(id)}
                  >
                    <Icon
                      aria-hidden="true"
                      className="me-2 h-4 w-4 text-muted-foreground"
                    />
                    <span className="min-w-0">
                      <span className="block">{label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {description}
                      </span>
                    </span>
                  </DropdownMenuItem>
                )
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="ms-auto flex min-w-0 items-center gap-1 @sm/topbar:gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={`Change assigned region. Current region: ${
                  activeRegion?.name ?? "Unassigned"
                }`}
                className="hidden h-11 min-w-0 max-w-60 gap-2.5 px-2.5 @3xl/topbar:inline-flex"
                size="sm"
                type="button"
                variant="ghost"
              >
                <MapPin
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 text-start">
                  <span className="block truncate text-xs font-medium">
                    {activeRegion?.name ?? "Unassigned"}
                  </span>
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className={cn(
                overlayClassName,
                "w-72 min-w-[var(--radix-dropdown-menu-trigger-width)]"
              )}
            >
              <DropdownMenuLabel>Assigned region</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={activeRegionId}
                onValueChange={onSelectRegion}
              >
                {regions.map((region) => (
                  <DropdownMenuRadioItem
                    className="px-2 py-2 data-[state=checked]:bg-accent/60 [&>span:first-child]:hidden"
                    key={region.id}
                    value={region.id}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{region.name}</span>
                      <span className="block whitespace-normal text-xs leading-4 text-muted-foreground">
                        {region.description}
                      </span>
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

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
                <span className="hidden text-xs @5xl/topbar:inline">Search</span>
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

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={`Open alerts${
                  alertsCount > 0 ? `, ${alertsCount} awaiting review` : ""
                }`}
                className="relative h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={onOpenAlerts}
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
            </TooltipTrigger>
            <TooltipContent className={overlayClassName}>
              Open alert inbox
            </TooltipContent>
          </Tooltip>

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
    </TooltipProvider>
  );
}
