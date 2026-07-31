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
  CircleHelp,
  FlaskConical,
  History,
  MapPin,
  Moon,
  Radio,
  Search,
  Settings,
  Sun,
  UserRound,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import type { ThemeMode } from "../../hooks/useThemeMode";
import { useGlobalShortcuts } from "../../hooks/useGlobalShortcuts";
import { usePluginRegistry } from "../../hooks/usePlugins";
import {
  type Command,
  formatShortcut,
  isMacPlatform,
  PALETTE_SHORTCUT,
} from "../../lib/commands";
import { MENU_MANAGED_PLUGIN_IDS } from "../../lib/ui-profile";
import type {
  DigitalTwinAccessContext,
  DigitalTwinView,
} from "../../product-modes/digital-twin/access";
import { CommandPalette } from "../command/CommandPalette";
import { KeyboardShortcutsDialog } from "../command/KeyboardShortcutsDialog";
import { ManagePluginsDialog } from "./ManagePluginsDialog";
import { SettingsDialog, openSettingsSection } from "./SettingsDialog";

interface DigitalTwinHeaderProps {
  access: DigitalTwinAccessContext;
  activeView: DigitalTwinView;
  activeRegionId: string | null;
  compact?: boolean;
  diagnosticsErrorCount: number;
  mapControllerRef: RefObject<MapController | null>;
  themeMode: ThemeMode;
  onNavigate: (view: DigitalTwinView) => void;
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
  activeRegionId,
  compact = false,
  diagnosticsErrorCount,
  mapControllerRef,
  themeMode,
  onNavigate,
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
  const isMac = useMemo(() => isMacPlatform(), []);
  const canConfigureWorkspace =
    access.capabilities.includes("expert-gis") ||
    access.capabilities.includes("administration");

  const activeRegion = access.regions.find((region) => region.id === activeRegionId);
  const regionLabel = activeRegion?.name ?? t("digitalTwin.header.regionUnassigned");

  const navigation = useMemo<NavigationItem[]>(
    () => [
      { id: "live", icon: Radio, label: t("digitalTwin.nav.live") },
      { id: "scenarios", icon: FlaskConical, label: t("digitalTwin.nav.scenarios") },
      { id: "runs", icon: History, label: t("digitalTwin.nav.runs") },
    ],
    [t],
  );

  const profilePlugins = useMemo(
    () =>
      plugins
        .filter((plugin) => !MENU_MANAGED_PLUGIN_IDS.has(plugin.id))
        .map((plugin) => ({ id: plugin.id, name: plugin.name })),
    [plugins],
  );

  const commands = useMemo<Command[]>(
    () => {
      const productCommands: Command[] = navigation.map(({ id, icon, label }) => ({
        id: `digital-twin.navigate.${id}`,
        title: label,
        group: t("digitalTwin.commands.navigationGroup"),
        icon,
        run: () => onNavigate(id),
      }));
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
          run: () => openSettingsSection("interface"),
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
          keywords: "GeoLibre advanced workspace GIS",
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
    },
    [
      canConfigureWorkspace,
      navigation,
      onNavigate,
      onOpenAdministration,
      onOpenDiagnostics,
      onOpenExpertWorkspace,
      onToggleThemeMode,
      t,
      themeMode,
    ],
  );

  useGlobalShortcuts({
    commands,
    onOpenPalette: () => setCommandPaletteOpen(true),
    onOpenShortcuts: () => setShortcutsOpen(true),
  });

  const themeLabel =
    themeMode === "dark"
      ? t("toolbar.command.switchToLight")
      : t("toolbar.command.switchToDark");

  return (
    <TooltipProvider delayDuration={400}>
      <header
        className={cn(
          "flex h-12 min-w-0 shrink-0 items-center gap-1 border-b bg-card px-2",
          compact && "h-11 px-1.5",
        )}
        data-digital-twin-header=""
      >
        <div className="flex min-w-0 shrink-0 items-center pe-1 sm:pe-2">
          <div className="hidden min-w-0 items-baseline gap-2 sm:flex">
            <span className="hidden text-sm font-semibold text-primary lg:inline">GeoLibre</span>
            <span aria-hidden="true" className="hidden h-4 w-px bg-border lg:block" />
            <span className="truncate text-sm font-semibold text-foreground">
              {t("digitalTwin.productName")}
            </span>
          </div>
        </div>

        <nav
          aria-label={t("digitalTwin.nav.label")}
          className="flex min-w-0 items-center gap-0.5"
        >
          {navigation.map(({ id, icon: Icon, label }) => {
            const selected = activeView === id;
            return (
              <Tooltip key={id}>
                <TooltipTrigger asChild>
                  <Button
                    aria-current={selected ? "page" : undefined}
                    aria-label={label}
                    className={cn(
                      "h-9 gap-1.5 px-2.5 text-muted-foreground",
                      selected && "bg-accent text-accent-foreground shadow-sm",
                    )}
                    data-digital-twin-view={id}
                    onClick={() => onNavigate(id)}
                    size="sm"
                    variant="ghost"
                  >
                    <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                    <span className="hidden md:inline">{label}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="md:hidden">{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        <div className="ms-auto flex min-w-0 items-center gap-0.5">
          {access.regions.length > 1 ? (
            <label className="hidden min-w-0 items-center gap-2 text-xs xl:flex">
              <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="sr-only">{t("digitalTwin.header.region")}</span>
              <Select
                aria-label={t("digitalTwin.header.assignedRegion", { region: regionLabel })}
                className="max-w-56"
                onChange={(event) => onRegionChange(event.currentTarget.value)}
                value={activeRegionId ?? ""}
              >
                {access.regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </Select>
            </label>
          ) : (
            <div
              aria-label={t("digitalTwin.header.assignedRegion", { region: regionLabel })}
              className="hidden h-8 min-w-0 max-w-56 items-center gap-2 rounded-md border bg-background px-2.5 text-xs xl:flex"
              title={regionLabel}
            >
              <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="shrink-0 text-muted-foreground">
                {t("digitalTwin.header.region")}
              </span>
              <span className="truncate font-medium text-foreground">{regionLabel}</span>
            </div>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={t("digitalTwin.header.monitoringUnavailable")}
                className="hidden h-8 gap-2 px-2.5 text-amber-700 hover:text-amber-800 md:inline-flex dark:text-amber-300 dark:hover:text-amber-200"
                onClick={onOpenDiagnostics}
                size="sm"
                variant="ghost"
              >
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="hidden lg:inline">
                  {t("digitalTwin.header.monitoringUnavailable")}
                </span>
                {diagnosticsErrorCount > 0 ? (
                  <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                    {diagnosticsErrorCount}
                  </span>
                ) : null}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("digitalTwin.header.openDiagnostics")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={t("digitalTwin.header.searchCommands")}
                className="h-8 gap-2 px-2 lg:px-2.5"
                onClick={() => setCommandPaletteOpen(true)}
                size="sm"
                variant="ghost"
              >
                <Search aria-hidden="true" className="h-4 w-4" />
                <span className="hidden text-xs lg:inline">
                  {t("digitalTwin.header.searchCommands")}
                </span>
                <kbd className="hidden rounded border bg-muted px-1 py-0.5 font-mono text-[9px] text-muted-foreground 2xl:inline">
                  {formatShortcut(PALETTE_SHORTCUT, isMac)}
                </kbd>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("digitalTwin.header.searchCommands")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={t("digitalTwin.header.keyboardHelp")}
                className="h-8 w-8"
                onClick={() => setShortcutsOpen(true)}
                size="icon"
                variant="ghost"
              >
                <CircleHelp aria-hidden="true" className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("digitalTwin.header.keyboardHelp")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={themeLabel}
                className="h-8 w-8"
                onClick={onToggleThemeMode}
                size="icon"
                variant="ghost"
              >
                {themeMode === "dark" ? (
                  <Sun aria-hidden="true" className="h-4 w-4" />
                ) : (
                  <Moon aria-hidden="true" className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{themeLabel}</TooltipContent>
          </Tooltip>

          {canConfigureWorkspace ? (
            <SettingsDialog
              buttonClassName="h-8 shrink-0 gap-2 px-2"
              buttonSize="sm"
              iconClassName="h-4 w-4"
              mapControllerRef={mapControllerRef}
              onOpenManagePlugins={() => setManagePluginsOpen(true)}
              profilePlugins={profilePlugins}
              showLabels
              themeMode={themeMode}
              onToggleThemeMode={onToggleThemeMode}
            />
          ) : null}


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
                    <span className="hidden text-xs 2xl:inline">
                      {access.displayName}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{t("digitalTwin.header.workspaceMenu")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                <span className="block truncate text-sm">{access.displayName}</span>
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
          <ManagePluginsDialog
            mapControllerRef={mapControllerRef}
            open={managePluginsOpen}
            onOpenChange={setManagePluginsOpen}
          />
        ) : null}
      </header>
    </TooltipProvider>
  );
}
