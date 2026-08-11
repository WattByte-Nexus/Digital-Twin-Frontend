import type { MapController } from "@geolibre/map";
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Select,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@geolibre/ui";
import {
  Activity,
  Archive,
  Bell,
  CircleHelp,
  CloudSun,
  FlaskConical,
  History,
  MapPin,
  Moon,
  Play,
  Radio,
  Search,
  Settings,
  Sun,
  UserRound,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import type { ThemeMode } from "../../hooks/useThemeMode";
import { useGlobalShortcuts } from "../../hooks/useGlobalShortcuts";
import { usePluginRegistry } from "../../hooks/usePlugins";
import { type Command } from "../../lib/commands";
import { MENU_MANAGED_PLUGIN_IDS } from "../../lib/ui-profile";
import type {
  DigitalTwinAccessContext,
  DigitalTwinView,
} from "../../product-modes/digital-twin/access";
import { CommandPalette } from "../command/CommandPalette";
import { KeyboardShortcutsDialog } from "../command/KeyboardShortcutsDialog";
import { ManagePluginsDialog } from "./ManagePluginsDialog";
import { SettingsDialog } from "./SettingsDialog";

interface DigitalTwinHeaderProps {
  access: DigitalTwinAccessContext;
  activeView: DigitalTwinView;
  settingsActive?: boolean;
  activeRegionId: string | null;
  compact?: boolean;
  mapControllerRef: RefObject<MapController | null>;
  themeMode: ThemeMode;
  onNavigate: (view: DigitalTwinView) => void;
  onOpenSettingsView?: () => void;
  onOpenAdministration?: () => void;
  onOpenDiagnostics: () => void;
  onOpenExpertWorkspace?: () => void;
  onRegionChange: (regionId: string) => void;
  onToggleThemeMode: () => void;
}

interface NavigationItem {
  id: DigitalTwinView;
  icon: LucideIcon;
  label: string;
}

function operatorInitials(displayName: string): string {
  return (
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "WB"
  );
}

/**
 * The focused, first-party header for the Digital Twin product mode.
 *
 * It deliberately owns only product-level navigation and status. General GIS
 * menus remain in {@link TopToolbar} and are reached through the explicit
 * Expert GIS workspace transition.
 */
export function DigitalTwinHeader({
  access,
  activeView,
  settingsActive = false,
  activeRegionId,
  compact = false,
  mapControllerRef,
  themeMode,
  onNavigate,
  onOpenSettingsView,
  onOpenAdministration,
  onOpenDiagnostics,
  onOpenExpertWorkspace,
  onRegionChange,
  onToggleThemeMode,
}: DigitalTwinHeaderProps) {
  const { t } = useTranslation();
  const { plugins } = usePluginRegistry();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [managePluginsOpen, setManagePluginsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const canConfigureWorkspace =
    access.capabilities.includes("expert-gis") ||
    access.capabilities.includes("administration");

  const activeRegion = access.regions.find(
    (region) => region.id === activeRegionId
  );
  const regionLabel =
    activeRegion?.name ?? t("digitalTwin.header.regionUnassigned");

  const navigation = useMemo<NavigationItem[]>(
    () => [
      { id: "live", icon: Radio, label: t("digitalTwin.nav.live") },
      {
        id: "scenarios",
        icon: FlaskConical,
        label: t("digitalTwin.nav.scenarios"),
      },
      { id: "runs", icon: History, label: t("digitalTwin.nav.runs") },
    ],
    [t]
  );
  const activeNavigationLabel = settingsActive
    ? t("settings.title")
    : navigation.find((item) => item.id === activeView)?.label ?? activeView;
  const initials = operatorInitials(access.displayName);

  const profilePlugins = useMemo(
    () =>
      plugins
        .filter((plugin) => !MENU_MANAGED_PLUGIN_IDS.has(plugin.id))
        .map((plugin) => ({ id: plugin.id, name: plugin.name })),
    [plugins]
  );

  const commands = useMemo<Command[]>(() => {
    const productCommands: Command[] = navigation.map(
      ({ id, icon, label }) => ({
        id: `digital-twin.navigate.${id}`,
        title: label,
        group: t("digitalTwin.commands.navigationGroup"),
        icon,
        run: () => onNavigate(id),
      })
    );
    productCommands.push({
      id: "digital-twin.diagnostics",
      title: t("digitalTwin.header.openDiagnostics"),
      group: t("digitalTwin.commands.systemGroup"),
      icon: Activity,
      run: onOpenDiagnostics,
    });
    if (canConfigureWorkspace) {
      productCommands.push({
        id: "digital-twin.settings",
        title: t("settings.title"),
        group: t("digitalTwin.commands.systemGroup"),
        keywords: "preferences configuration",
        icon: Settings,
        run: () => onOpenSettingsView?.(),
      });
    }
    productCommands.push({
      id: "digital-twin.toggle-theme",
      title:
        themeMode === "dark"
          ? t("toolbar.command.switchToLight")
          : t("toolbar.command.switchToDark"),
      group: t("digitalTwin.commands.systemGroup"),
      icon: themeMode === "dark" ? Sun : Moon,
      run: onToggleThemeMode,
    });
    if (onOpenExpertWorkspace) {
      productCommands.push({
        id: "digital-twin.open-expert-workspace",
        title: t("digitalTwin.header.openExpertWorkspace"),
        group: t("digitalTwin.commands.workspaceGroup"),
        keywords: "WattByte Nexus advanced workspace GIS",
        icon: Wrench,
        run: onOpenExpertWorkspace,
      });
    }
    if (onOpenAdministration) {
      productCommands.push({
        id: "digital-twin.open-administration",
        title: t("digitalTwin.header.openAdministration"),
        group: t("digitalTwin.commands.systemGroup"),
        icon: Settings,
        run: onOpenAdministration,
      });
    }
    return productCommands;
  }, [
    canConfigureWorkspace,
    navigation,
    onNavigate,
    onOpenAdministration,
    onOpenDiagnostics,
    onOpenExpertWorkspace,
    onOpenSettingsView,
    onToggleThemeMode,
    t,
    themeMode,
  ]);

  useGlobalShortcuts({
    commands,
    onOpenPalette: () => setCommandPaletteOpen(true),
    onOpenShortcuts: () => setShortcutsOpen(true),
  });

  const themeLabel =
    themeMode === "dark"
      ? t("toolbar.command.switchToLight")
      : t("toolbar.command.switchToDark");

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("geolibre:digital-twin-view", {
        detail: { view: activeView },
      })
    );
  }, [activeView]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const currentTimeLabel = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(now);

  return (
    <TooltipProvider delayDuration={400}>
      <aside className="dt-nexus-rail" aria-label={t("digitalTwin.nav.label")}>
        <div className="dt-nexus-brand" aria-label="WattByte Nexus">
          <Zap aria-hidden="true" />
          <span>WattByte</span>
        </div>

        <nav className="dt-nexus-primary-nav">
          {navigation.map(({ id, icon: Icon, label }) => {
            const selected = !settingsActive && activeView === id;
            return (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <Button
                    aria-current={selected ? "page" : undefined}
                    aria-label={label}
                    className="dt-nexus-rail-item"
                    data-active={selected ? "true" : "false"}
                    data-digital-twin-view={id}
                    onClick={() => onNavigate(id)}
                    size="sm"
                    variant="ghost"
                  >
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            );
          })}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label="Assets"
                className="dt-nexus-rail-item"
                disabled
                size="sm"
                variant="ghost"
              >
                <Archive aria-hidden="true" />
                <span>Assets</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              Assets are not available in this release.
            </TooltipContent>
          </Tooltip>
        </nav>

        <div className="dt-nexus-rail-footer">
          <Button
            aria-label={t("digitalTwin.header.keyboardHelp")}
            className="dt-nexus-rail-action"
            onClick={() => setShortcutsOpen(true)}
            size="sm"
            variant="ghost"
          >
            <CircleHelp aria-hidden="true" />
            <span>Support</span>
          </Button>
          {canConfigureWorkspace ? (
            <Button
              aria-current={settingsActive ? "page" : undefined}
              aria-label={t("settings.title")}
              className="dt-nexus-rail-action"
              data-active={settingsActive ? "true" : "false"}
              onClick={onOpenSettingsView}
              size="sm"
              variant="ghost"
            >
              <Settings aria-hidden="true" />
              <span>{t("settings.title")}</span>
            </Button>
          ) : null}
          <span className="dt-nexus-rail-avatar" title={access.displayName}>
            {initials}
          </span>
        </div>
      </aside>

      <header className="dt-nexus-header" data-digital-twin-header="">
        <div
          className={cn(
            "dt-nexus-header-main",
            compact && "dt-nexus-header-main--compact"
          )}
        >
          <div className="dt-nexus-breadcrumb" aria-label="Current workspace">
            <span>{t("digitalTwin.productName")}</span>
            <span aria-hidden="true">/</span>
            <span>{settingsActive ? t("settings.title") : regionLabel}</span>
            <span aria-hidden="true">/</span>
            <strong>
              {settingsActive ? "Alert routing" : activeNavigationLabel}
            </strong>
          </div>

          <div className="dt-nexus-header-actions">
            {access.regions.length > 1 ? (
              <label className="hidden min-w-0 items-center gap-2 text-xs xl:flex">
                <MapPin
                  aria-hidden="true"
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                />
                <span className="sr-only">
                  {t("digitalTwin.header.region")}
                </span>
                <Select
                  aria-label={t("digitalTwin.header.assignedRegion", {
                    region: regionLabel,
                  })}
                  className="max-w-56"
                  onChange={(event) =>
                    onRegionChange(event.currentTarget.value)
                  }
                  value={activeRegionId ?? ""}
                >
                  {access.regions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </Select>
              </label>
            ) : null}

            <span className="dt-nexus-status dt-nexus-status--live">
              <span aria-hidden="true" />
              Live
            </span>
            <time className="dt-nexus-time" dateTime={now.toISOString()}>
              {currentTimeLabel}
            </time>
            <span className="dt-nexus-status">
              <CloudSun aria-hidden="true" />
              Weather 6 min
            </span>
            <Button
              aria-label="Open runs"
              className="dt-nexus-header-stat"
              onClick={() => onNavigate("runs")}
              size="sm"
              variant="ghost"
            >
              <Play aria-hidden="true" />
              <span>Runs 3</span>
            </Button>
            <Button
              aria-label="Open alerts"
              className="dt-nexus-header-stat"
              onClick={() => onNavigate("live")}
              size="sm"
              variant="ghost"
            >
              <Bell aria-hidden="true" />
              <span>Alerts 7</span>
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label={t("digitalTwin.header.searchCommands")}
                  className="dt-nexus-header-icon"
                  onClick={() => setCommandPaletteOpen(true)}
                  size="icon"
                  variant="ghost"
                >
                  <Search aria-hidden="true" className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t("digitalTwin.header.searchCommands")}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Notifications"
                  className="dt-nexus-header-icon"
                  onClick={() => onNavigate("live")}
                  size="icon"
                  variant="ghost"
                >
                  <Bell aria-hidden="true" className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Notifications</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      aria-label={t("digitalTwin.header.workspaceMenu")}
                      className="h-8 gap-2 px-2"
                      size="sm"
                      variant="ghost"
                    >
                      <UserRound aria-hidden="true" className="h-4 w-4" />
                      <span className="dt-nexus-top-avatar">{initials}</span>
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  {t("digitalTwin.header.workspaceMenu")}
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <span className="block truncate text-sm">
                    {access.displayName}
                  </span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {access.organization.name}
                  </span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {t("digitalTwin.header.decisionSupportOnly")}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onOpenDiagnostics}>
                  <Activity aria-hidden="true" className="me-2 h-4 w-4" />
                  {t("digitalTwin.header.openDiagnostics")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onToggleThemeMode}>
                  {themeMode === "dark" ? (
                    <Sun aria-hidden="true" className="me-2 h-4 w-4" />
                  ) : (
                    <Moon aria-hidden="true" className="me-2 h-4 w-4" />
                  )}
                  {themeLabel}
                </DropdownMenuItem>
                {onOpenExpertWorkspace ? (
                  <DropdownMenuItem onSelect={onOpenExpertWorkspace}>
                    <Wrench aria-hidden="true" className="me-2 h-4 w-4" />
                    {t("digitalTwin.header.openExpertWorkspace")}
                  </DropdownMenuItem>
                ) : null}
                {onOpenAdministration ? (
                  <DropdownMenuItem onSelect={onOpenAdministration}>
                    <Settings aria-hidden="true" className="me-2 h-4 w-4" />
                    {t("digitalTwin.header.openAdministration")}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <CommandPalette
          commands={commands}
          open={commandPaletteOpen}
          onOpenChange={setCommandPaletteOpen}
        />
        <KeyboardShortcutsDialog
          commands={commands}
          open={shortcutsOpen}
          onOpenChange={setShortcutsOpen}
        />
        {canConfigureWorkspace ? (
          <>
            <SettingsDialog
              buttonClassName="dt-settings-dialog-host"
              buttonSize="sm"
              iconClassName=""
              mapControllerRef={mapControllerRef}
              onOpenManagePlugins={() => setManagePluginsOpen(true)}
              profilePlugins={profilePlugins}
              showLabels={false}
              themeMode={themeMode}
              onToggleThemeMode={onToggleThemeMode}
            />
            <ManagePluginsDialog
              mapControllerRef={mapControllerRef}
              open={managePluginsOpen}
              onOpenChange={setManagePluginsOpen}
            />
          </>
        ) : null}
      </header>
    </TooltipProvider>
  );
}
