import { FlaskConical, History, Radio, type LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";
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
        "surface-glass-subtle border-y-0 border-l-0 border-sidebar-border [&_[data-slot=sidebar-inner]]:bg-transparent",
        className
      )}
      collapsible="icon"
    >
      <SidebarHeader className="h-16 shrink-0 justify-center border-b border-sidebar-border px-4 py-0 transition-[padding] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none group-data-[collapsible=icon]:px-2">
        <div className="relative h-8 overflow-hidden">
          <span className="absolute inset-y-0 left-0 flex items-center whitespace-nowrap text-sm font-semibold opacity-100 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none group-data-[collapsible=icon]:-translate-x-2 group-data-[collapsible=icon]:opacity-0">
            Digital Twin
          </span>
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 flex size-8 scale-90 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground opacity-0 transition-[opacity,transform] delay-0 duration-200 ease-out motion-reduce:transition-none group-data-[collapsible=icon]:scale-100 group-data-[collapsible=icon]:opacity-100 group-data-[collapsible=icon]:delay-75"
          >
            DT
          </span>
        </div>
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
