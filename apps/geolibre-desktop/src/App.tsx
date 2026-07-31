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
import { AdministrationLanding } from "./product-modes/digital-twin/AdministrationLanding";
import { DigitalTwinAccessBoundary } from "./product-modes/digital-twin/DigitalTwinAccessBoundary";
import type {
  AuthorizedLocationResolution,
  DigitalTwinAccessContext,
} from "./product-modes/digital-twin/access";

interface AuthorizedApplicationProps {
  access: DigitalTwinAccessContext;
  navigate: (location: string, options?: { replace?: boolean }) => void;
  route: Extract<AuthorizedLocationResolution, { kind: "allowed" }>;
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

  return (
    <>
      <DesktopShell
        access={access}
        layoutOptions={layoutOptions}
        navigate={navigate}
        projectUrlLoadState={projectUrlLoadState}
        route={route}
        themeMode={themeMode}
        onToggleThemeMode={toggleThemeMode}
      />
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
  const diagnostics =
    new URL(route.location, "https://digital-twin.invalid").pathname === "/diagnostics";
  if (route.mode === "administration" || diagnostics) {
    const canOpenExpertWorkspace = access.capabilities.includes("expert-gis");
    const canOpenAdministration = access.capabilities.includes("administration");
    return (
      <AdministrationLanding
        access={access}
        screen={diagnostics ? "diagnostics" : "administration"}
        onOpenAdministration={
          diagnostics && canOpenAdministration ? () => navigate("/admin") : undefined
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
      <DigitalTwinAccessBoundary>
        {(context) => <AuthorizedApplication {...context} />}
      </DigitalTwinAccessBoundary>
    </DirectionProvider>
  );
}
