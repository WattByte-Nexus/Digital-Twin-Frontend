import { Button } from "@geolibre/ui";
import { useCallback, useState } from "react";
import { useThemeMode } from "../../hooks/useThemeMode";
import type { DigitalTwinAccessContext } from "./access";
import { AccountPanel } from "./management/AccountPanel";
import { PeoplePanel } from "./management/PeoplePanel";
import { OrganizationsPanel, PlansPanel } from "./management/PlatformPanel";
import {
  ApplicationsPanel,
  ExtensionsPanel,
  TrialUsersPanel,
} from "./management/TrialsPanel";
import { Section, useManagementActions } from "./management/shared";
import { AdministrationShell } from "./management/AdministrationShell";
interface AdministrationLandingProps {
  access: DigitalTwinAccessContext;
  screen?: "administration" | "diagnostics" | "account";
  onOpenAdministration?: () => void;
  onOpenDiagnostics: () => void;
  onOpenExpertWorkspace?: () => void;
  onReturnToApp: () => void;
  onOpenSettings: () => void;
}
export function AdministrationLanding({
  access,
  screen = "administration",
  onOpenAdministration,
  onOpenDiagnostics,
  onOpenExpertWorkspace,
  onReturnToApp,
  onOpenSettings,
}: AdministrationLandingProps) {
  const { themeMode, toggleThemeMode } = useThemeMode();
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const { run, busy, feedback } = useManagementActions(refresh);
  const role = access.roles[0];
  const restricted = access.accessState === "organization-expired";
  const common = { revision, refresh, run, busy };
  const tabs =
    screen === "account"
      ? [
          {
            id: "account",
            label: "Account and usage",
            content: <AccountPanel access={access} {...common} />,
          },
        ]
      : role === "PLATFORM_SUPER_ADMIN"
      ? [
          { id: "staff", label: "Staff", content: <PeoplePanel {...common} /> },
          {
            id: "organizations",
            label: "Organizations",
            content: <OrganizationsPanel {...common} />,
          },
          { id: "plans", label: "Plans", content: <PlansPanel {...common} /> },
          {
            id: "extensions",
            label: "Extensions",
            content: <ExtensionsPanel decide {...common} />,
          },
        ]
      : role === "WEB_TRIAL_ADMIN"
      ? [
          {
            id: "applications",
            label: "Applications",
            content: (
              <ApplicationsPanel accountId={access.accountId} {...common} />
            ),
          },
          {
            id: "trial-users",
            label: "Trial users",
            content: <TrialUsersPanel {...common} />,
          },
          {
            id: "extensions",
            label: "Extensions",
            content: <ExtensionsPanel decide trial {...common} />,
          },
        ]
      : role === "TENANT_ADMIN"
      ? [
          ...(!restricted
            ? [
                {
                  id: "users",
                  label: "Users and departments",
                  content: <PeoplePanel tenant {...common} />,
                },
              ]
            : []),
          {
            id: "extensions",
            label: "Access extensions",
            content: <ExtensionsPanel {...common} />,
          },
        ]
      : [
          {
            id: "desktop",
            label: "Desktop trials",
            content: (
              <Section
                title="Desktop trial administration"
                description="Desktop trial review and external license delivery are scheduled after the web account workflows."
              >
                <p className="text-sm text-muted-foreground">
                  This account does not grant access to customer web workspaces.
                </p>
              </Section>
            ),
          },
        ];
  return (
    <AdministrationShell
      key={`${role}-${restricted}-${screen}`}
      access={access}
      sections={
        screen === "diagnostics"
          ? [
              {
                id: "diagnostics",
                label: "Diagnostics",
                content: (
                  <Section
                    title="Account access resolved"
                    description="Your identity and current account policy were resolved by the application service."
                  >
                    <p className="text-sm">Account: {access.accountId}</p>
                    <p className="text-sm">State: {access.accessState}</p>
                    <Button variant="outline" onClick={onOpenDiagnostics}>
                      Reload diagnostics
                    </Button>
                  </Section>
                ),
              },
            ]
          : tabs
      }
      title={
        screen === "diagnostics"
          ? "Diagnostics"
          : screen === "account"
          ? "Account"
          : role === "TENANT_ADMIN"
          ? "Organization administration"
          : "Administration"
      }
      themeMode={themeMode}
      onToggleTheme={toggleThemeMode}
      onRefresh={refresh}
      busy={busy}
      feedback={feedback}
      onReturnToApp={onReturnToApp}
      onOpenSettings={onOpenSettings}
      onOpenAdministration={onOpenAdministration}
      onOpenExpertWorkspace={onOpenExpertWorkspace}
      banner={
        restricted ? (
          <Section
            title="Organization access has expired"
            description="Product access and user administration are unavailable. You can request an extension and review its status here."
          >
            <p className="text-sm text-muted-foreground">
              An approved extension restores access subject to account and
              organization eligibility.
            </p>
          </Section>
        ) : null
      }
    />
  );
}
