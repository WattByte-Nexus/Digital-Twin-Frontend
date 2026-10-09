import {
  Avatar,
  AvatarFallback,
  Button,
  DEFAULT_DIGITAL_TWIN_MAP_DISPLAY_SETTINGS,
  DigitalTwinMapSettings,
  Input,
  ScrollArea,
  SelectMenu,
  SelectMenuContent,
  SelectMenuGroup,
  SelectMenuItem,
  SelectMenuLabel,
  SelectMenuTrigger,
  SelectMenuValue,
  Separator,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  type DigitalTwinMapDisplaySettings,
} from "@geolibre/ui";
import {
  ArrowLeft,
  Map,
  Palette,
  Search,
  Server,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import { useState, type CSSProperties } from "react";
import { ResizeSeparator } from "./settings-view-components";
import {
  AccountPreferencesPage,
  EngineStatusPage,
  SavedScenariosPage,
} from "./settings-view-pages";
import { SETTINGS_PAGE_COPY, type SettingsSectionId } from "./settings-view-model";
import "./settings-view.css";

export interface SettingsViewProps {
  apiUrl: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  mapDisplaySettings: DigitalTwinMapDisplaySettings;
  onMapDisplaySettingsChange: (settings: DigitalTwinMapDisplaySettings) => void;
  viewMode: "3d" | "plan";
  onViewModeChange: (mode: "3d" | "plan") => void;
  onOpenScenarios: () => void;
  accountInitials?: string;
  accountName?: string;
  onClose: () => void;
  organizationName?: string;
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
    label: "This device",
    items: [{ id: "account-preferences", label: "Appearance", icon: Palette }],
  },
  {
    label: "Workspace",
    items: [
      { id: "workspace-map", label: "Map & display", icon: Map },
      {
        id: "workspace-simulation",
        label: "Saved scenarios",
        icon: SlidersHorizontal,
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
  return [groupLabel, item.label, copy.title, copy.description, copy.keywords]
    .join(" ")
    .toLocaleLowerCase()
    .includes(query);
}

export function SettingsView({
  apiUrl,
  theme,
  onToggleTheme,
  mapDisplaySettings,
  onMapDisplaySettingsChange,
  viewMode,
  onViewModeChange,
  onOpenScenarios,
  accountInitials = "",
  accountName = "",
  onClose,
  organizationName = "",
}: SettingsViewProps) {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("account-preferences");
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
        ? settingsItemMatchesSearch(activeGroup.label, activeItem, normalizedNextSearchQuery)
        : false;

    if (normalizedNextSearchQuery && !activeItemMatches) {
      const firstMatch = SETTINGS_GROUPS.flatMap((group) =>
        group.items.filter((item) =>
          settingsItemMatchesSearch(group.label, item, normalizedNextSearchQuery),
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
            className="h-11 w-full justify-start gap-2 px-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={onClose}
            size="sm"
            type="button"
            variant="ghost"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            <span>Back to workspace</span>
          </Button>

          <h1 className="px-2 text-sm font-semibold text-sidebar-foreground">Settings</h1>

          {accountName || organizationName ? (
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
                <p className="truncate text-xs text-sidebar-foreground/60">{organizationName}</p>
              </div>
            </div>
          ) : null}

          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-sidebar-foreground/60"
            />
            <Input
              aria-label="Search settings"
              className="h-11 border-sidebar-border bg-sidebar ps-9 text-sidebar-foreground placeholder:text-sidebar-foreground/50"
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
              <section
                aria-labelledby={`settings-group-${group.label.replaceAll(" ", "-")}`}
                key={group.label}
              >
                <SidebarGroupLabel asChild>
                  <h2 id={`settings-group-${group.label.replaceAll(" ", "-")}`}>{group.label}</h2>
                </SidebarGroupLabel>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = item.id === activeSection;
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          aria-current={active ? "page" : undefined}
                          className="h-11 gap-3 px-3 text-sm"
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

      <header className="dt-settings-page-header border-b border-border bg-background px-5 sm:px-8">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 py-5 sm:py-6">
          <Button
            aria-label="Close settings and return to workspace"
            className="dt-settings-mobile-close size-11 shrink-0"
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
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {visibleGroups.length ? pageCopy.title : "No settings found"}
            </h2>
            <p className="mt-1 hidden max-w-[65ch] text-sm text-muted-foreground sm:block">
              {visibleGroups.length
                ? pageCopy.description
                : "Search by a setting name or try a broader term."}
            </p>
          </div>
        </div>
      </header>

      <div className="dt-settings-mobile-navigation space-y-3 border-b border-border bg-background px-5 py-3">
        <Input
          aria-label="Search settings"
          className="h-11"
          onChange={(event) => handleSearchQueryChange(event.currentTarget.value)}
          placeholder="Search settings"
          type="search"
          value={searchQuery}
        />
        <SelectMenu
          disabled={visibleGroups.length === 0}
          onValueChange={(value) => setActiveSection(value as SettingsSectionId)}
          value={activeSection}
        >
          <SelectMenuTrigger aria-label="Settings section" className="h-11 w-full">
            <SelectMenuValue />
          </SelectMenuTrigger>
          <SelectMenuContent
            className={`${theme === "dark" ? "dark" : "theme-light"} surface-glass-overlay min-w-[var(--radix-select-trigger-width)]`}
            position="popper"
          >
            {visibleGroups.map((group, index) => (
              <SelectMenuGroup key={group.label}>
                {index > 0 ? <Separator className="my-1" /> : null}
                <SelectMenuLabel>{group.label}</SelectMenuLabel>
                {group.items.map((item) => (
                  <SelectMenuItem className="min-h-11" key={item.id} value={item.id}>
                    {item.label}
                  </SelectMenuItem>
                ))}
              </SelectMenuGroup>
            ))}
          </SelectMenuContent>
        </SelectMenu>
      </div>

      <section
        className="dt-settings-content min-h-0 bg-background"
        aria-label={`${pageCopy.title} settings`}
      >
        <ScrollArea className="h-full" key={activeSection}>
          <div className="p-5 sm:p-8">
            <div className="mx-auto w-full max-w-3xl space-y-5">
              {visibleGroups.length === 0 ? (
                <div className="space-y-4 py-8 text-center">
                  <p className="break-words text-sm text-muted-foreground">
                    No settings match “{searchQuery.trim()}”. Try a different search.
                  </p>
                  <Button
                    className="min-h-11"
                    onClick={() => handleSearchQueryChange("")}
                    type="button"
                    variant="outline"
                  >
                    Clear search
                  </Button>
                </div>
              ) : activeSection === "account-preferences" ? (
                <AccountPreferencesPage theme={theme} onToggleTheme={onToggleTheme} />
              ) : activeSection === "workspace-map" ? (
                <>
                  <DigitalTwinMapSettings
                    value={mapDisplaySettings}
                    viewMode={viewMode}
                    onValueChange={onMapDisplaySettingsChange}
                    onViewModeChange={onViewModeChange}
                  />
                  <div className="flex justify-end">
                    <Button
                      className="min-h-11"
                      onClick={() => {
                        onMapDisplaySettingsChange(DEFAULT_DIGITAL_TWIN_MAP_DISPLAY_SETTINGS);
                        onViewModeChange("3d");
                      }}
                      type="button"
                      variant="outline"
                    >
                      Restore map defaults
                    </Button>
                  </div>
                </>
              ) : activeSection === "workspace-simulation" ? (
                <SavedScenariosPage onOpenScenarios={onOpenScenarios} />
              ) : (
                <EngineStatusPage apiUrl={apiUrl} />
              )}
            </div>
          </div>
        </ScrollArea>
      </section>

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
