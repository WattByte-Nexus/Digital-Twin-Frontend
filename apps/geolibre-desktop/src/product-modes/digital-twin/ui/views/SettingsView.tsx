import {
  Avatar,
  AvatarFallback,
  Button,
  Input,
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
  ArrowLeft,
  BellRing,
  CircleUserRound,
  Map,
  Search,
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
  onClose: () => void;
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

function settingsItemMatchesSearch(
  groupLabel: string,
  item: (typeof SETTINGS_GROUPS)[number]["items"][number],
  query: string,
) {
  if (!query) return true;
  const copy = SETTINGS_PAGE_COPY[item.id];
  return [groupLabel, item.label, copy.title, copy.description]
    .join(" ")
    .toLocaleLowerCase()
    .includes(query);
}

export function SettingsView({
  accountInitials = "LW",
  accountName = "Luke Watt",
  onClose,
  onOpenRealSettings,
  organizationName = "WattByte Nexus",
  realSettingsSlot,
}: SettingsViewProps) {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>(
    "operations-alert-routing",
  );
  const [navWidth, setNavWidth] = useState(DEFAULT_NAV_WIDTH);
  const [searchQuery, setSearchQuery] = useState("");
  const pageCopy = SETTINGS_PAGE_COPY[activeSection];
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const visibleGroups = SETTINGS_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      settingsItemMatchesSearch(group.label, item, normalizedSearchQuery),
    ),
  })).filter((group) => group.items.length > 0);
  const style: SettingsViewStyle = {
    "--dt-settings-nav-width": `${navWidth}px`,
  };

  function handleSearchQueryChange(nextSearchQuery: string) {
    const normalizedNextSearchQuery = nextSearchQuery.trim().toLocaleLowerCase();
    const activeGroup = SETTINGS_GROUPS.find((group) =>
      group.items.some((item) => item.id === activeSection),
    );
    const activeItem = activeGroup?.items.find((item) => item.id === activeSection);
    const activeItemMatches =
      activeGroup && activeItem
        ? settingsItemMatchesSearch(
            activeGroup.label,
            activeItem,
            normalizedNextSearchQuery,
          )
        : false;

    if (normalizedNextSearchQuery && !activeItemMatches) {
      const firstMatch = SETTINGS_GROUPS.flatMap((group) =>
        group.items.filter((item) =>
          settingsItemMatchesSearch(
            group.label,
            item,
            normalizedNextSearchQuery,
          ),
        ),
      )[0];
      if (firstMatch) setActiveSection(firstMatch.id);
    }
    setSearchQuery(nextSearchQuery);
  }

  return (
    <div className="dt-settings-view bg-background text-foreground" style={style}>
      <aside
        aria-label="Settings sections"
        className="dt-settings-navigation border-r border-sidebar-border bg-card text-sidebar-foreground shadow-none"
      >
        <div className="space-y-3 px-3 pb-2 pt-3">
          <Button
            aria-label="Close settings and return to workspace"
            className="h-10 w-full justify-start gap-2 px-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={onClose}
            size="sm"
            type="button"
            variant="ghost"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            <span>Back to workspace</span>
          </Button>

          <h1 className="px-2 text-sm font-semibold text-sidebar-foreground">Settings</h1>

          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar className="size-9">
              <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
                {accountInitials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {accountName}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/60">
                {organizationName}
              </p>
            </div>
          </div>

          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-sidebar-foreground/60"
            />
            <Input
              aria-label="Search settings"
              className="h-9 border-sidebar-border bg-sidebar ps-9 text-sidebar-foreground placeholder:text-sidebar-foreground/50"
              onChange={(event) => handleSearchQueryChange(event.currentTarget.value)}
              placeholder="Search settings"
              type="search"
              value={searchQuery}
            />
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <nav className="space-y-2 p-3" aria-label="Settings navigation">
            {visibleGroups.map((group) => (
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
            {visibleGroups.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                No settings found.
              </p>
            ) : null}
          </nav>
        </ScrollArea>
      </aside>

      <header className="dt-settings-page-header bg-background px-5 sm:px-8">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-6 py-6 sm:py-8">
          <Button
            aria-label="Close settings and return to workspace"
            className="dt-settings-mobile-close shrink-0"
            onClick={onClose}
            size="icon"
            type="button"
            variant="ghost"
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {pageCopy.eyebrow}
            </p>
            <h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
              {pageCopy.title}
            </h2>
            <p className="mt-1 hidden max-w-[65ch] text-sm text-muted-foreground sm:block">
              {pageCopy.description}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
