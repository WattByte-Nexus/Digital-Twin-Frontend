import {
  ChevronDown,
  FlaskConical,
  History,
  MapPin,
  Radio,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/utils";
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
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./sidebar";

interface DestinationDefinition {
  id: DigitalTwinDestination;
  label: string;
  description: string;
  icon: LucideIcon;
}

export type DigitalTwinDestination = "live" | "scenarios" | "runs";

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
    icon: FlaskConical,
  },
  {
    id: "runs",
    label: "Runs",
    description: "Run status, history, and replay",
    icon: History,
  },
];

export interface DigitalTwinSidebarProps {
  activeDestination?: DigitalTwinDestination;
  activeRegionId: string;
  className?: string;
  regions: DigitalTwinRegion[];
  themeMode?: "light" | "dark";
  onNavigate?: (destination: DigitalTwinDestination) => void;
  onSelectRegion?: (regionId: string) => void;
}

export function DigitalTwinSidebar({
  activeDestination = "live",
  activeRegionId,
  className,
  regions,
  themeMode = "dark",
  onNavigate,
  onSelectRegion,
}: DigitalTwinSidebarProps) {
  const activeRegion =
    regions.find((region) => region.id === activeRegionId) ?? regions[0];
  const themeClassName = themeMode === "dark" ? "dark" : "theme-light";

  return (
    <Sidebar
      aria-label="Digital Twin navigation"
      className={cn(
        themeClassName,
        "surface-glass-subtle border-y-0 border-l-0 border-sidebar-border [&_[data-slot=sidebar-inner]]:bg-transparent",
        className
      )}
      collapsible="icon"
    >
      <SidebarHeader className="h-16 shrink-0 justify-center border-b border-sidebar-border px-2 py-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Change assigned region. Current region: ${
                activeRegion?.name ?? "Unassigned"
              }`}
              className="h-11 w-full min-w-0 justify-start gap-2.5 px-2.5 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2"
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
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {destinations.map(({ description, icon: Icon, id, label }) => (
                <SidebarMenuItem key={id}>
                  <SidebarMenuButton
                    aria-label={`${label}: ${description}`}
                    aria-current={activeDestination === id ? "page" : undefined}
                    className="h-auto min-h-12 items-start py-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:min-h-8 group-data-[collapsible=icon]:p-2"
                    isActive={activeDestination === id}
                    onClick={() => onNavigate?.(id)}
                    tooltip={`${label} — ${description}`}
                    type="button"
                  >
                    <Icon aria-hidden="true" className="mt-0.5" />
                    <span className="min-w-0 max-w-48 overflow-hidden opacity-100 transition-[max-width,opacity,transform] duration-200 ease-out motion-reduce:transition-none group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:-translate-x-1 group-data-[collapsible=icon]:opacity-0">
                      <span className="block font-medium leading-5">
                        {label}
                      </span>
                      <span className="block whitespace-normal text-xs leading-4 text-muted-foreground">
                        {description}
                      </span>
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
