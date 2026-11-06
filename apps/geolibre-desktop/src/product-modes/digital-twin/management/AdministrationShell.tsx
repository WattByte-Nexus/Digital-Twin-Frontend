import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  surfaceThemeClassName,
  useSidebar,
} from "@geolibre/ui";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarClock,
  ChevronRight,
  CreditCard,
  FileCheck2,
  Fingerprint,
  Layers3,
  LogOut,
  Monitor,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { signOutDigitalTwin } from "../../../lib/digital-twin-api";
import { accountRoleLabel, type DigitalTwinAccessContext } from "../access";

export interface ManagementSection {
  id: string;
  label: string;
  content: ReactNode;
}
const sectionIcons: Record<string, LucideIcon> = {
  staff: Users,
  organizations: Building2,
  plans: CreditCard,
  extensions: CalendarClock,
  applications: FileCheck2,
  "trial-users": Users,
  users: Users,
  desktop: Monitor,
  account: Fingerprint,
};
const sectionDescriptions: Record<string, string> = {
  staff: "Manage the people who administer your platform.",
  organizations:
    "Manage customer organizations, access plans, and administrators.",
  plans: "Set product features and allowances for every organization.",
  extensions: "Review access extensions and keep organizations moving.",
  applications: "Review trial requests and prepare approved accounts.",
  "trial-users": "Manage active trials, invitations, and access.",
  users: "Manage your organization's people and departments.",
  desktop: "Manage desktop trial access.",
  account: "Review your account, plan, and usage.",
};
interface AdministrationShellProps {
  access: DigitalTwinAccessContext;
  sections: ManagementSection[];
  title: string;
  themeMode: "light" | "dark";
  onToggleTheme: () => void;
  onRefresh: () => void;
  busy: boolean;
  feedback: ReactNode;
  banner?: ReactNode;
  onReturnToApp: () => void;
  onOpenSettings: () => void;
  onOpenAdministration?: () => void;
  onOpenExpertWorkspace?: () => void;
}
function AdministrationNavigation({
  access,
  sections,
  activeSection,
  onReturnToApp,
  themeMode,
}: Pick<
  AdministrationShellProps,
  "access" | "sections" | "onReturnToApp" | "themeMode"
> & {
  activeSection: string;
}) {
  const { setOpenMobile } = useSidebar();
  return (
    <Sidebar
      className={`${surfaceThemeClassName(
        themeMode
      )} surface-glass shadow-none text-glass-foreground data-[state=open]:duration-200 data-[state=closed]:duration-150 motion-reduce:transition-none [&_[data-slot=sidebar-inner]]:bg-transparent`}
      aria-label="Administration navigation"
    >
      <SidebarHeader className="gap-5 px-5 pb-5 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Layers3 aria-hidden="true" className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">WattByte Nexus</p>
            <p className="text-xs text-muted-foreground">Digital Twin</p>
          </div>
        </div>
        {onReturnToApp ? (
          <Button
            variant="outline"
            className="min-h-11 w-full justify-start gap-2"
            onClick={onReturnToApp}
          >
            <ArrowLeft aria-hidden="true" className="size-4" /> Back to app
          </Button>
        ) : null}
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent className="px-3 py-4">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <TabsList
              aria-label="Administration sections"
              className="h-auto w-full gap-1 bg-transparent p-0"
            >
              <SidebarMenu role="presentation">
                {sections.map((section) => {
                  const Icon = sectionIcons[section.id] ?? ShieldCheck;
                  return (
                    <SidebarMenuItem role="presentation" key={section.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={activeSection === section.id}
                      >
                        <TabsTrigger
                          value={section.id}
                          onClick={() => setOpenMobile(false)}
                          className="min-h-11 w-full justify-start gap-3 px-3 py-2.5 text-sm shadow-none transition-colors duration-150 data-[state=active]:bg-sidebar-accent data-[state=active]:text-sidebar-accent-foreground"
                        >
                          <Icon aria-hidden="true" className="size-4" />
                          <span>{section.label}</span>
                        </TabsTrigger>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </TabsList>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-4 border-t border-sidebar-border p-5">
        <div className="flex items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
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
          variant="ghost"
          className="min-h-11 justify-start gap-2 px-2 text-muted-foreground"
          onClick={signOutDigitalTwin}
        >
          <LogOut aria-hidden="true" className="size-4" /> Sign out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
export function AdministrationShell({
  access,
  sections,
  title,
  themeMode,
  onToggleTheme,
  onRefresh,
  busy,
  feedback,
  banner,
  onReturnToApp,
  onOpenSettings,
  onOpenAdministration,
  onOpenExpertWorkspace,
}: AdministrationShellProps) {
  const [activeSection, setActiveSection] = useState(sections[0].id);
  const current =
    sections.find((section) => section.id === activeSection) ?? sections[0];
  return (
    <div
      className={`${surfaceThemeClassName(
        themeMode
      )} h-full bg-background text-foreground [&_button:not([data-slot=checkbox])]:min-h-11 [&_button:not([data-slot=checkbox])]:min-w-11 [&_input:not([type=checkbox])]:min-h-11 [&_select]:min-h-11`}
    >
      <Tabs
        orientation="vertical"
        value={activeSection}
        onValueChange={setActiveSection}
        className="h-full w-full gap-0"
      >
        <SidebarProvider className="h-full min-h-0">
          <AdministrationNavigation
            access={access}
            sections={sections}
            activeSection={activeSection}
            onReturnToApp={onReturnToApp}
            themeMode={themeMode}
          />
          <SidebarInset className="h-full min-h-0 min-w-0 overflow-y-auto bg-surface-subtle/40">
            <header className="surface-glass shadow-none sticky top-0 z-20 flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-2.5 sm:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <SidebarTrigger className="size-11 md:hidden" />
                <Button
                  variant="link"
                  className="h-auto min-w-0 p-0 text-sm font-normal text-muted-foreground"
                  onClick={onOpenSettings}
                >
                  Settings
                </Button>
                <ChevronRight
                  aria-hidden="true"
                  className="size-3.5 text-muted-foreground"
                />
                <h1 className="truncate text-sm font-semibold">{title}</h1>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label={themeMode === "dark" ? "Light mode" : "Dark mode"}
                  onClick={onToggleTheme}
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
                  onClick={onRefresh}
                  disabled={busy}
                >
                  <RefreshCw aria-hidden="true" className="size-4" />
                  <span className="hidden sm:inline">Refresh</span>
                  <span className="sr-only sm:hidden">Refresh</span>
                </Button>
                {onOpenAdministration ? (
                  <Button
                    variant="outline"
                    className="min-h-11"
                    onClick={onOpenAdministration}
                  >
                    Administration
                  </Button>
                ) : null}
                {onOpenExpertWorkspace ? (
                  <Button
                    variant="outline"
                    className="min-h-11 gap-2"
                    onClick={onOpenExpertWorkspace}
                  >
                    Expert GIS
                    <ArrowUpRight aria-hidden="true" className="size-4" />
                  </Button>
                ) : null}
              </div>
            </header>
            <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-7 sm:px-8 sm:py-9 lg:px-10">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    {access.organization?.name ?? "Platform workspace"}
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    {current.label}
                  </h2>
                  <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
                    {sectionDescriptions[current.id]}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="gap-1.5 border border-border px-3 py-1.5"
                >
                  <ShieldCheck aria-hidden="true" className="size-3.5" />
                  {accountRoleLabel(access.roles[0])}
                </Badge>
              </div>
              {banner}
              {feedback}
              {sections.map((section) => (
                <TabsContent
                  className="m-0 min-w-0"
                  key={section.id}
                  value={section.id}
                >
                  {section.content}
                </TabsContent>
              ))}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </Tabs>
    </div>
  );
}
