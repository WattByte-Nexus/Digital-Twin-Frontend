import { DirectionProvider } from "@geolibre/ui";
import { useTranslation } from "react-i18next";
import { DesktopShell } from "./components/layout/DesktopShell";
import { OnboardingDialog } from "./components/layout/OnboardingDialog";
import { UpdateNotificationModal } from "./components/layout/UpdateNotificationModal";
import { useDesktopSettingsPersistence } from "./hooks/useDesktopSettings";
import { useLayoutOptions } from "./hooks/useLayoutOptions";
import { useProjectUrlLoader } from "./hooks/useProjectUrlLoader";
import { useBeforeUnloadGuard } from "./hooks/useBeforeUnloadGuard";
import { useRecentProjectsPersistence } from "./hooks/useRecentProjectsPersistence";
import { useStyleLibraryPersistence } from "./hooks/useStyleLibraryPersistence";
import { useRuntimeEnvironmentVariables } from "./hooks/useRuntimeEnvironmentVariables";
import { useStartupUpdateCheck } from "./hooks/useStartupUpdateCheck";
import { useThemeMode } from "./hooks/useThemeMode";
import { useThemeScheme } from "./hooks/useThemeScheme";
import { useUiProfileBootstrap } from "./hooks/useUiProfileBootstrap";
import { useUndoRedoShortcuts } from "./hooks/useUndoRedoShortcuts";
import { languageDirection } from "./i18n/languages";
import { ProductDataWorkspace } from "./product-modes/digital-twin/ProductDataWorkspace";
import { PublicAccountEntry } from "./product-modes/digital-twin/management/PublicAccountEntry";
import { ApplicationHome } from "./product-modes/digital-twin/ApplicationHome";
import { AdministrationLanding } from "./product-modes/digital-twin/AdministrationLanding";
import { DigitalTwinAccessBoundary } from "./product-modes/digital-twin/DigitalTwinAccessBoundary";
import { DigitalTwinMapWorkspace } from "./product-modes/digital-twin/ui/DigitalTwinMapWorkspace";
import { accountRoleLabel, hasRegionAction } from "./product-modes/digital-twin/access";
import type {
  AuthorizedLocationResolution,
  DigitalTwinAccessContext,
} from "./product-modes/digital-twin/access";

interface AuthorizedApplicationProps {
  access: DigitalTwinAccessContext;
  navigate: (location: string, options?: { replace?: boolean }) => void;
  route: Extract<AuthorizedLocationResolution, { kind: "allowed" }>;
}

function displayNameInitials(displayName: string): string {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "DT";
}

function AuthorizedWorkspace({ access, navigate, route }: AuthorizedApplicationProps) {
  const layoutOptions = useLayoutOptions();
  const { themeMode, toggleThemeMode } = useThemeMode();
  const projectUrlLoadState = useProjectUrlLoader();
  const { showOnboarding, dismissOnboarding } = useUiProfileBootstrap();
  const { pending: pendingUpdate, remindLater, skipVersion } = useStartupUpdateCheck();

  useDesktopSettingsPersistence();
  useThemeScheme();
  useRecentProjectsPersistence();
  useStyleLibraryPersistence();
  useRuntimeEnvironmentVariables();
  useUndoRedoShortcuts();
  useBeforeUnloadGuard();

  const activeRegionId = route.regionId ?? access.regions[0]?.id ?? "";
  const workspace =
    route.mode === "digital-twin" ? (
      <DigitalTwinMapWorkspace
        activeDestination={route.view}
        activeRegionId={activeRegionId}
        authorizedRegionIds={access.regions.map((region) => region.id)}
        location={route.location}
        operator={{
          initials: displayNameInitials(access.displayName),
          name: access.displayName,
          role: accountRoleLabel(access.roles[0]),
        }}
        organizationName={access.organization?.name ?? "Digital Twin"}
        showLidar
        showWeather
        themeMode={themeMode}
        onNavigate={(view, resourceId) =>
          navigate(
            `/regions/${encodeURIComponent(activeRegionId)}/${view}${
              resourceId ? `/${encodeURIComponent(resourceId)}` : ""
            }`,
          )
        }
        canPerform={(regionId, action) => hasRegionAction(access, regionId, action)}
        onOpenAccount={() => navigate("/account")}
        onOpenDiagnostics={() => navigate("/diagnostics")}
        onOpenExpertWorkspace={
          access.capabilities.includes("expert-gis")
            ? () =>
                navigate(
                  `/workspace?returnTo=${encodeURIComponent(route.location)}`,
                )
            : undefined
        }
        onSelectRegion={(regionId) =>
          navigate(`/regions/${encodeURIComponent(regionId)}/${route.view}`)
        }
        onToggleTheme={toggleThemeMode}
      />
    ) : (
      <DesktopShell
        access={access}
        layoutOptions={layoutOptions}
        navigate={navigate}
        projectUrlLoadState={projectUrlLoadState}
        route={route}
        themeMode={themeMode}
        onToggleThemeMode={toggleThemeMode}
      />
    );

  return (
    <>
      {workspace}
      <OnboardingDialog open={showOnboarding} onClose={dismissOnboarding} />
      <UpdateNotificationModal
        pending={pendingUpdate}
        onRemindLater={remindLater}
        onSkipVersion={skipVersion}
      />
    </>
  );
}

function AuthorizedApplication({ access, navigate, route }: AuthorizedApplicationProps) {
  if (route.mode === "home") return <ApplicationHome access={access} navigate={navigate} settingsOpen={new URL(route.location, "https://digital-twin.invalid").pathname.toLowerCase() === "/settings"} />;
  const diagnostics =
    new URL(route.location, "https://digital-twin.invalid").pathname === "/diagnostics";
  if (new URL(route.location, "https://digital-twin.invalid").pathname === "/data") return <ProductDataWorkspace access={access} onClose={() => navigate(access.regions[0] ? `/regions/${encodeURIComponent(access.regions[0].id)}/live` : "/account")} />;
  if (route.mode === "administration" || diagnostics) {
    const canOpenExpertWorkspace = access.capabilities.includes("expert-gis");
    const canOpenAdministration = access.capabilities.includes("administration") || access.capabilities.includes("tenant-administration") || access.capabilities.includes("expired-tenant-access");
    return (
      <AdministrationLanding
        access={access}
        screen={diagnostics ? "diagnostics" : new URL(route.location, "https://digital-twin.invalid").pathname === "/account" ? "account" : "administration"}
        onOpenSettings={() => navigate("/settings")}
        onReturnToApp={() => navigate(access.roles[0] === "TENANT_USER" && access.regions[0] ? `/regions/${encodeURIComponent(access.regions[0].id)}/live` : "/home")}
        onOpenAdministration={
          diagnostics && canOpenAdministration ? () => navigate(access.roles[0] === "TENANT_ADMIN" ? "/tenant-admin" : "/admin") : undefined
        }
        onOpenDiagnostics={() => navigate("/diagnostics")}
        onOpenExpertWorkspace={
          canOpenExpertWorkspace
            ? () =>
                navigate(`/workspace?returnTo=${encodeURIComponent(route.location)}`)
            : undefined
        }
      />
    );
  }
  return <AuthorizedWorkspace access={access} navigate={navigate} route={route} />;
}

export default function App() {
  // Re-renders on language change, so Radix primitives (menus, sliders, tabs)
  // pick up the right-to-left direction together with the document `dir`.
  const { i18n } = useTranslation();

  return (
    <DirectionProvider dir={languageDirection(i18n.language)}>
      {window.location.pathname === "/activate" || window.location.pathname === "/request-trial" ? <PublicAccountEntry activate={window.location.pathname === "/activate"} /> : <DigitalTwinAccessBoundary>
        {(context) => <AuthorizedApplication {...context} />}
      </DigitalTwinAccessBoundary>}
    </DirectionProvider>
  );
}
