import {
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  surfaceThemeClassName,
} from "@geolibre/ui";
import { useCallback, useState } from "react";
import { signOutDigitalTwin } from "../../lib/digital-twin-api";
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
interface AdministrationLandingProps {
  access: DigitalTwinAccessContext;
  screen?: "administration" | "diagnostics" | "account";
  onOpenAdministration?: () => void;
  onOpenDiagnostics: () => void;
  onOpenExpertWorkspace?: () => void;
  onOpenProduct?: () => void;
}
export function AdministrationLanding({
  access,
  screen = "administration",
  onOpenAdministration,
  onOpenDiagnostics,
  onOpenExpertWorkspace,
  onOpenProduct,
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
    <main
      className={`${surfaceThemeClassName(
        themeMode
      )} h-full overflow-y-auto [&_button:not([data-slot=checkbox])]:min-h-11 [&_button:not([data-slot=checkbox])]:min-w-11 bg-background px-4 py-6 text-foreground sm:px-8`}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-primary">
              WATTBYTE NEXUS · DIGITAL TWIN
            </p>
            <h1 className="mt-2 text-2xl font-semibold">
              {screen === "diagnostics"
                ? "Diagnostics"
                : screen === "account"
                ? "Account"
                : role === "TENANT_ADMIN"
                ? "Organization administration"
                : "Administration"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {access.organization?.name ?? "Platform staff"} ·{" "}
              {access.displayName}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={toggleThemeMode}>
              {themeMode === "dark" ? "Light mode" : "Dark mode"}
            </Button>
            <Button variant="outline" onClick={refresh} disabled={busy}>
              Refresh
            </Button>
            <Button variant="outline" onClick={signOutDigitalTwin}>
              Sign out
            </Button>
            {onOpenProduct ? (
              <Button variant="outline" onClick={onOpenProduct}>
                Return to Digital Twin
              </Button>
            ) : null}
            {onOpenAdministration ? (
              <Button variant="outline" onClick={onOpenAdministration}>
                Administration
              </Button>
            ) : null}
            {onOpenExpertWorkspace ? (
              <Button variant="outline" onClick={onOpenExpertWorkspace}>
                Expert GIS
              </Button>
            ) : null}
          </div>
        </header>
        {restricted ? (
          <Section
            title="Organization access has expired"
            description="Product access and user administration are unavailable. You can request an extension and review its status here."
          >
            <p className="text-sm text-muted-foreground">
              An approved extension restores access subject to account and
              organization eligibility.
            </p>
          </Section>
        ) : null}
        {feedback}
        {screen === "diagnostics" ? (
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
        ) : (
          <Tabs
            key={`${role}-${restricted}-${screen}`}
            defaultValue={tabs[0].id}
            className="space-y-6"
          >
            <TabsList
              aria-label="Administration sections"
              className="flex h-auto flex-wrap justify-start"
            >
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="min-h-11">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {tabs.map((tab) => (
              <TabsContent key={tab.id} value={tab.id}>
                {tab.content}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </main>
  );
}
