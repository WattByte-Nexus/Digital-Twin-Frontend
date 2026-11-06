import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  surfaceThemeClassName,
  useSidebar,
} from "@geolibre/ui";
import {
  ArrowRight,
  House,
  Layers3,
  LogOut,
  MapPin,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { useThemeMode } from "../../hooks/useThemeMode";
import {
  defaultDigitalTwinApiUrl,
  signOutDigitalTwin,
} from "../../lib/digital-twin-api";
import {
  accountRoleLabel,
  hasRegionAction,
  type DigitalTwinAccessContext,
} from "./access";
import { SettingsView } from "./ui/views/SettingsView";

interface ApplicationHomeProps {
  access: DigitalTwinAccessContext;
  navigate: (location: string) => void;
  settingsOpen: boolean;
}
function ApplicationNavigation({
  access,
  navigate,
  theme,
}: {
  access: DigitalTwinAccessContext;
  navigate: (location: string) => void;
  theme: "light" | "dark";
}) {
  const { setOpenMobile } = useSidebar();
  const openSettings = () => {
    setOpenMobile(false);
    navigate("/settings");
  };
  return (
    <Sidebar
      className={`${surfaceThemeClassName(
        theme
      )} surface-glass shadow-none text-glass-foreground [&_[data-slot=sidebar-inner]]:bg-transparent`}
    >
      <SidebarHeader className="p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Layers3 aria-hidden="true" className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">WattByte Nexus</p>
            <p className="text-xs text-muted-foreground">Digital Twin</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent className="p-3">
        <SidebarGroup className="p-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive
                className="min-h-11 gap-3 px-3"
                onClick={() => setOpenMobile(false)}
              >
                <House aria-hidden="true" className="size-4" />
                Home
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="min-h-11 gap-3 px-3"
                onClick={openSettings}
              >
                <Settings aria-hidden="true" className="size-4" />
                Settings
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-4 border-t border-sidebar-border p-5">
        <div className="flex items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {access.displayName
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{access.displayName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {accountRoleLabel(access.roles[0])}
            </p>
          </div>
        </div>
        <Button
          className="min-h-11 justify-start gap-2"
          variant="ghost"
          onClick={signOutDigitalTwin}
        >
          <LogOut aria-hidden="true" className="size-4" />
          Sign out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
export function ApplicationHome({
  access,
  navigate,
  settingsOpen,
}: ApplicationHomeProps) {
  const { themeMode, toggleThemeMode } = useThemeMode();
  const administrationPath =
    access.roles[0] === "TENANT_ADMIN"
      ? "/tenant-admin"
      : access.capabilities.includes("administration")
      ? "/admin"
      : null;
  const regions = access.regions.filter((region) =>
    hasRegionAction(access, region.id, "region:read")
  );
  const productAccount = access.roles[0] === "TENANT_USER";
  return (
    <div
      className={`${surfaceThemeClassName(
        themeMode
      )} h-full bg-background text-foreground`}
    >
      <SidebarProvider className="h-full min-h-0">
        {settingsOpen ? (
          <SettingsView
            apiUrl={defaultDigitalTwinApiUrl()}
            theme={themeMode}
            onToggleTheme={toggleThemeMode}
            accountInitials={access.displayName
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0])
              .join("")}
            accountName={access.displayName}
            organizationName={access.organization?.name ?? "WattByte Nexus"}
            onClose={() => navigate("/home")}
            onOpenAdministration={
              administrationPath
                ? () => navigate(administrationPath)
                : undefined
            }
          />
        ) : (
          <>
            <ApplicationNavigation
              access={access}
              navigate={navigate}
              theme={themeMode}
            />
            <SidebarInset className="h-full min-h-0 min-w-0 overflow-y-auto bg-surface-subtle/40">
              <header className="surface-glass sticky top-0 z-10 flex min-h-16 items-center justify-between gap-3 border-b border-border px-5 py-2 shadow-none sm:px-8">
                <div className="flex items-center gap-3">
                  <SidebarTrigger className="size-11" />
                  <span className="text-sm font-medium">Digital Twin</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={
                      themeMode === "dark" ? "Light mode" : "Dark mode"
                    }
                    onClick={toggleThemeMode}
                  >
                    {themeMode === "dark" ? (
                      <Sun className="size-4" />
                    ) : (
                      <Moon className="size-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-11 gap-2"
                    onClick={() => navigate("/settings")}
                  >
                    <Settings aria-hidden="true" className="size-4" />
                    Settings
                  </Button>
                </div>
              </header>
              <div className="mx-auto w-full max-w-6xl space-y-8 px-5 py-10 sm:px-8 lg:py-14">
                <div>
                  <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    {access.organization?.name ?? "WattByte Nexus"}
                  </p>
                  <h1 className="text-3xl font-semibold tracking-tight">
                    Your workspace
                  </h1>
                  <p className="mt-3 max-w-prose text-sm leading-6 text-muted-foreground">
                    Open a Digital Twin region or manage your account and
                    application settings.
                  </p>
                </div>
                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                  <Card className="border border-border/70 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-base">
                        Digital Twin regions
                      </CardTitle>
                      <CardDescription>
                        Workspaces available to your current account.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {regions.length ? (
                        <div className="grid gap-3">
                          {regions.map((region) => (
                            <Button
                              key={region.id}
                              variant="outline"
                              className="h-auto min-h-16 justify-start gap-3 whitespace-normal text-left"
                              onClick={() =>
                                navigate(
                                  `/regions/${encodeURIComponent(
                                    region.id
                                  )}/live`
                                )
                              }
                            >
                              <MapPin
                                aria-hidden="true"
                                className="size-5 text-primary"
                              />
                              <span className="min-w-0 flex-1">
                                {region.name}
                              </span>
                              <ArrowRight
                                aria-hidden="true"
                                className="size-4"
                              />
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-border bg-surface-subtle/50 px-6 py-10 text-center">
                          <MapPin
                            aria-hidden="true"
                            className="mx-auto mb-4 size-7 text-muted-foreground"
                          />
                          <h2 className="text-sm font-semibold">
                            {productAccount
                              ? "No regions assigned yet"
                              : "Administrative account"}
                          </h2>
                          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                            {productAccount
                              ? "Your organization administrator can assign region access. Your account permissions determine which tools are available."
                              : "This account manages people and access. Administration is available in Settings; product workspaces use a separate product account."}
                          </p>
                          {productAccount &&
                          access.permissions.includes("region:create") ? (
                            <Button
                              className="mt-5 min-h-11"
                              onClick={() => navigate("/data")}
                            >
                              Create a region
                            </Button>
                          ) : null}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="border border-border/70 shadow-sm">
                    <CardHeader>
                      <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                        <ShieldCheck aria-hidden="true" className="size-5" />
                      </div>
                      <CardTitle className="text-base">
                        Account & settings
                      </CardTitle>
                      <CardDescription>
                        Manage your preferences and the tools available to your
                        role.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <Badge variant="secondary">
                        {accountRoleLabel(access.roles[0])}
                      </Badge>
                      <Button
                        className="min-h-11 w-full gap-2"
                        variant="outline"
                        onClick={() => navigate("/settings")}
                      >
                        Open settings
                        <ArrowRight aria-hidden="true" className="size-4" />
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </SidebarInset>
          </>
        )}
      </SidebarProvider>
    </div>
  );
}
