import {
  Badge,
  Button,
  ScrollArea,
  SelectMenu,
  SelectMenuContent,
  SelectMenuItem,
  SelectMenuTrigger,
  SelectMenuValue,
  Separator,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@geolibre/ui";
import {
  BellRing,
  ChevronRight,
  CircleUserRound,
  Map,
  Server,
  Settings2,
  SlidersHorizontal,
  UsersRound,
  Workflow,
} from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { ResizeSeparator } from "./settings-view-components";
import {
  AccountPreferencesPage,
  AlertRoutingPage,
  EngineStatusPage,
  MembersAccessPage,
  SimulationPresetsPage,
  WorkspaceMapPage,
} from "./settings-view-pages";
import {
  SETTINGS_PAGE_COPY,
  type SettingsSectionId,
} from "./settings-view-model";
import "./settings-view.css";

export interface SettingsViewProps {
  accountInitials?: string;
  accountName?: string;
  accountRole?: string;
  onOpenRealSettings?: () => void;
  organizationName?: string;
  realSettingsSlot?: ReactNode;
}

interface SettingsViewStyle extends CSSProperties {
  "--dt-settings-nav-width": string;
}

const DEFAULT_NAV_WIDTH = 264;
const MIN_NAV_WIDTH = 224;
const MAX_NAV_WIDTH = 344;

const SETTINGS_GROUPS: ReadonlyArray<{
  items: ReadonlyArray<{
    icon: typeof Settings2;
    id: SettingsSectionId;
    label: string;
  }>;
  label: string;
}> = [
  {
    label: "Account",
    items: [
      { id: "account-preferences", label: "Preferences", icon: CircleUserRound },
    ],
  },
  {
    label: "Workspace",
    items: [
      { id: "workspace-map", label: "Map & display", icon: Map },
      {
        id: "workspace-simulation",
        label: "Simulation presets",
        icon: SlidersHorizontal,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        id: "operations-alert-routing",
        label: "Alert routing",
        icon: BellRing,
      },
    ],
  },
  {
    label: "Organization",
    items: [
      {
        id: "organization-members",
        label: "Members & roles",
        icon: UsersRound,
      },
    ],
  },
  {
    label: "Engine",
    items: [{ id: "engine-status", label: "Status & health", icon: Server }],
  },
];

export function SettingsView({
  accountInitials = "LW",
  accountName = "Luke Watt",
  accountRole = "Organization owner",
  onOpenRealSettings,
  organizationName = "WattByte Nexus",
  realSettingsSlot,
}: SettingsViewProps) {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>(
    "operations-alert-routing",
  );
  const [navWidth, setNavWidth] = useState(DEFAULT_NAV_WIDTH);
  const pageCopy = SETTINGS_PAGE_COPY[activeSection];
  const style: SettingsViewStyle = {
    "--dt-settings-nav-width": `${navWidth}px`,
  };

  return (
    <div className="dt-settings-view bg-background text-foreground" style={style}>
      <aside
        aria-label="Settings sections"
        className="dt-settings-navigation border-r border-border bg-card text-sidebar-foreground"
      >
        <div className="flex h-16 items-center border-b border-border px-5">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">Settings</h1>
            <p className="truncate text-xs text-muted-foreground">{organizationName}</p>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <nav className="space-y-2 p-3" aria-label="Settings navigation">
            {SETTINGS_GROUPS.map((group) => (
              <section aria-labelledby={`settings-group-${group.label}`} key={group.label}>
                <SidebarGroupLabel asChild>
                  <h2 id={`settings-group-${group.label}`}>{group.label}</h2>
                </SidebarGroupLabel>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = item.id === activeSection;
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          aria-current={active ? "page" : undefined}
                          className="h-10 gap-3 px-3 text-sm"
                          isActive={active}
                          onClick={() => setActiveSection(item.id)}
                          type="button"
                        >
                          <Icon aria-hidden="true" className="size-5" />
                          <span className="font-medium">{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </section>
            ))}
          </nav>
        </ScrollArea>

        <div className="border-t border-border px-5 py-3">
          <div className="flex h-10 items-center gap-3">
            <div className="grid size-8 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
              {accountInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{accountName}</p>
              <p className="truncate text-xs text-muted-foreground">{accountRole}</p>
            </div>
          </div>
        </div>
      </aside>

      <header className="dt-settings-page-header border-b border-border bg-background/95 px-5 backdrop-blur-sm sm:px-8">
        <div className="min-w-0 py-4">
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{pageCopy.eyebrow}</span>
            <ChevronRight className="size-3" />
            <span className="truncate">{pageCopy.title}</span>
          </div>
          <h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
            {pageCopy.title}
          </h2>
          <p className="mt-1 hidden max-w-2xl truncate text-xs text-muted-foreground sm:block">
            {pageCopy.description}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge className="hidden sm:inline-flex" variant="secondary">
            Design preview
          </Badge>
          {realSettingsSlot ? (
            <div className="flex items-center">{realSettingsSlot}</div>
          ) : onOpenRealSettings ? (
            <Button
              aria-label="Open general workspace settings; alert-routing preview changes will not be saved"
              onClick={onOpenRealSettings}
              size="sm"
              type="button"
              variant="outline"
            >
              <Workflow /> Existing settings
            </Button>
          ) : null}
        </div>
      </header>

      <div className="dt-settings-mobile-navigation border-b border-border bg-background px-5 py-3">
        <SelectMenu
          onValueChange={(value) => setActiveSection(value as SettingsSectionId)}
          value={activeSection}
        >
          <SelectMenuTrigger aria-label="Settings section" className="w-full">
            <SelectMenuValue />
          </SelectMenuTrigger>
          <SelectMenuContent className="surface-glass-overlay min-w-[var(--radix-select-trigger-width)]">
            {SETTINGS_GROUPS.map((group, index) => (
              <div key={group.label}>
                {index > 0 ? <Separator className="my-1" /> : null}
                <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  {group.label}
                </p>
                {group.items.map((item) => (
                  <SelectMenuItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectMenuItem>
                ))}
              </div>
            ))}
          </SelectMenuContent>
        </SelectMenu>
      </div>

      <div className="dt-settings-content min-h-0 bg-background" aria-label={`${pageCopy.title} settings`}>
        <ScrollArea className="h-full">
          <section hidden={activeSection !== "account-preferences"}>
            <AccountPreferencesPage />
          </section>
          <section hidden={activeSection !== "workspace-map"}>
            <WorkspaceMapPage onOpenRealSettings={onOpenRealSettings} />
          </section>
          <section hidden={activeSection !== "workspace-simulation"}>
            <SimulationPresetsPage />
          </section>
          <section hidden={activeSection !== "operations-alert-routing"}>
            <AlertRoutingPage />
          </section>
          <section hidden={activeSection !== "organization-members"}>
            <MembersAccessPage />
          </section>
          <section hidden={activeSection !== "engine-status"}>
            <EngineStatusPage onOpenRealSettings={onOpenRealSettings} />
          </section>
        </ScrollArea>
      </div>

      <ResizeSeparator
        className="dt-settings-resizer--navigation"
        defaultValue={DEFAULT_NAV_WIDTH}
        edge="inline-start"
        label="Resize settings navigation"
        max={MAX_NAV_WIDTH}
        min={MIN_NAV_WIDTH}
        onChange={setNavWidth}
        value={navWidth}
      />
    </div>
  );
}
