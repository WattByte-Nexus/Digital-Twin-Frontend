import { FlaskConical, History, Radio, type LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";
import type { DigitalTwinDestination } from "./digital-twin-topbar";
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
  className?: string;
  themeMode?: "light" | "dark";
  onNavigate?: (destination: DigitalTwinDestination) => void;
}

export function DigitalTwinSidebar({
  activeDestination = "live",
  className,
  themeMode = "dark",
  onNavigate,
}: DigitalTwinSidebarProps) {
  return (
    <Sidebar
      aria-label="Digital Twin navigation"
      className={cn(
        themeMode === "dark" ? "dark" : "theme-light",
        "surface-glass-subtle [&_[data-slot=sidebar-inner]]:bg-transparent",
        className
      )}
      collapsible="icon"
    >
      <SidebarHeader className="border-b border-sidebar-border p-4 group-data-[collapsible=icon]:px-2">
        <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:sr-only">
          Digital Twin
        </span>
        <span
          aria-hidden="true"
          className="hidden size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground group-data-[collapsible=icon]:flex"
        >
          DT
        </span>
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
                    <span className="min-w-0 group-data-[collapsible=icon]:hidden">
                      <span className="block font-medium leading-5">{label}</span>
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
