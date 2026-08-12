import {
  Bell,
  Boxes,
  ChevronDown,
  CirclePlay,
  FolderClosed,
  Layers3,
  MapPin,
  Radio,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/utils";
import { Badge } from "./badge";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "./sidebar";

interface DestinationDefinition {
  id: DigitalTwinDestination;
  label: string;
  description: string;
  icon: LucideIcon;
}

export type DigitalTwinDestination = "live" | "assets" | "scenarios" | "runs";

export interface DigitalTwinRegion {
  id: string;
  name: string;
  description: string;
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
    icon: FolderClosed,
  },
  {
    id: "runs",
    label: "Runs",
    description: "Run status, history, and replay",
    icon: CirclePlay,
  },
];

const assetDestination: DestinationDefinition = {
  id: "assets",
  label: "Assets",
  description: "Network catalog and properties",
  icon: Boxes,
};

interface UtilityDefinition {
  id: "alerts" | "data" | "settings";
  label: string;
  description: string;
  icon: LucideIcon;
}

const utilities: UtilityDefinition[] = [
  {
    id: "alerts",
    label: "Alerts",
    description: "Open the operational alert inbox",
    icon: Bell,
  },
  {
    id: "data",
    label: "Data",
    description: "Open the Expert GIS data workspace",
    icon: Layers3,
  },
  {
    id: "settings",
    label: "Settings",
    description: "Open Digital Twin administration",
    icon: Settings,
  },
];

export interface DigitalTwinSidebarProps {
  activeDestination?: DigitalTwinDestination;
  activeRegionId: string;
  appVersion?: string;
  className?: string;
  regions: DigitalTwinRegion[];
  settingsActive?: boolean;
  themeMode?: "light" | "dark";
  onNavigate?: (destination: DigitalTwinDestination) => void;
  onOpenAlerts?: () => void;
  onOpenData?: () => void;
  onOpenSettings?: () => void;
  onSelectRegion?: (regionId: string) => void;
}

export function DigitalTwinSidebar({
  activeDestination = "live",
  activeRegionId,
  appVersion,
  className,
  regions,
  settingsActive = false,
  themeMode = "dark",
  onNavigate,
  onOpenAlerts,
  onOpenData,
  onOpenSettings,
  onSelectRegion,
}: DigitalTwinSidebarProps) {
  const activeRegion =
    regions.find((region) => region.id === activeRegionId) ?? regions[0];
  const themeClassName = themeMode === "dark" ? "dark" : "theme-light";
  const utilityActions = {
    alerts: onOpenAlerts,
    data: onOpenData,
    settings: onOpenSettings,
  };

  return (
    <Sidebar
      aria-label="Digital Twin navigation"
      className={cn(
        themeClassName,
        "border-y-0 border-l-0 border-sidebar-border bg-card shadow-none [&_[data-slot=sidebar-inner]]:bg-transparent",
        className
      )}
      collapsible="icon"
    >
      <SidebarHeader className="grid h-28 shrink-0 grid-rows-[minmax(0,1fr)_auto] gap-1.5 px-3 py-3 group-data-[collapsible=icon]:px-2">
        <div className="flex h-10 items-center gap-2.5 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <img
            alt=""
            aria-hidden="true"
            className="h-6 w-6 shrink-0 object-contain"
            src={`${import.meta.env.BASE_URL}maskable-icon-512x512.png`}
          />
          <span className="truncate text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            WattByte Nexus
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Change assigned region. Current region: ${
                activeRegion?.name ?? "Unassigned"
              }`}
              className="h-11 w-full min-w-0 justify-start gap-2.5 px-2.5 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2"
              size="sm"
              type="button"
              variant="ghost"
            >
              <MapPin
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-muted-foreground"
              />
              <span className="min-w-0 flex-1 truncate text-start text-xs font-medium group-data-[collapsible=icon]:hidden">
                {activeRegion?.name ?? "Unassigned"}
              </span>
              <ChevronDown
                aria-hidden="true"
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className={cn(
              themeClassName,
              "surface-glass-overlay w-72 min-w-[var(--radix-dropdown-menu-trigger-width)]"
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
      </SidebarHeader>
      <SidebarContent className="pt-2">
        <SidebarGroup className="px-3 py-2 group-data-[collapsible=icon]:px-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {destinations.map(({ description, icon: Icon, id, label }) => (
                <SidebarMenuItem key={id}>
                  <SidebarMenuButton
                    aria-label={`${label}: ${description}`}
                    aria-current={
                      !settingsActive && activeDestination === id ? "page" : undefined
                    }
                    className="h-11 gap-3 px-3 text-sm group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-2"
                    isActive={!settingsActive && activeDestination === id}
                    onClick={() => onNavigate?.(id)}
                    tooltip={`${label} — ${description}`}
                    type="button"
                  >
                    <Icon aria-hidden="true" className="h-5 w-5" />
                    <span className="font-medium group-data-[collapsible=icon]:hidden">
                      {label}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            <SidebarSeparator className="my-2" />
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  aria-label={`${assetDestination.label}: ${assetDestination.description}`}
                  aria-current={
                    !settingsActive && activeDestination === assetDestination.id
                      ? "page"
                      : undefined
                  }
                  className="h-11 gap-3 px-3 text-sm group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-2"
                  isActive={!settingsActive && activeDestination === assetDestination.id}
                  onClick={() => onNavigate?.(assetDestination.id)}
                  tooltip={`${assetDestination.label} — ${assetDestination.description}`}
                  type="button"
                >
                  <Boxes aria-hidden="true" className="h-5 w-5" />
                  <span className="font-medium group-data-[collapsible=icon]:hidden">
                    {assetDestination.label}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-2 px-3 pb-3 pt-2 group-data-[collapsible=icon]:px-2">
        <SidebarMenu>
          {utilities.map(({ description, icon: Icon, id, label }) => {
            const action = utilityActions[id];
            return (
              <SidebarMenuItem key={id}>
                <SidebarMenuButton
                  aria-label={label}
                  aria-current={id === "settings" && settingsActive ? "page" : undefined}
                  className="h-10 gap-3 px-3 text-sm group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-2"
                  disabled={!action}
                  isActive={id === "settings" && settingsActive}
                  onClick={action}
                  tooltip={`${label} — ${description}`}
                  type="button"
                >
                  <Icon aria-hidden="true" className="h-5 w-5" />
                  <span className="group-data-[collapsible=icon]:hidden">
                    {label}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
        <SidebarSeparator className="mx-0 my-1" />
        {appVersion ? (
          <div className="flex h-8 items-center justify-center group-data-[collapsible=icon]:hidden">
            <Badge
              className="font-mono text-[10px] font-normal text-muted-foreground"
              variant="outline"
            >
              {appVersion}
            </Badge>
          </div>
        ) : null}
      </SidebarFooter>
    </Sidebar>
  );
}
