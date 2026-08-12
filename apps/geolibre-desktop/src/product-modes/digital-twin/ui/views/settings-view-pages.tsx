import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@geolibre/ui";
import {
  Activity,
  CircleHelp,
  Clock3,
  Database,
  Gauge,
  Info,
  LockKeyhole,
  Map,
  MoreHorizontal,
  Server,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  ScopeLegend,
  SettingRow,
  SettingsCard,
  SettingsRows,
  SettingsSelect,
  SettingsSwitch,
} from "./settings-view-components";
import {
  INITIAL_ALERT_ROUTING,
  SEVERITY_LABELS,
  type AlertRoutingSettings,
  type Channel,
  type Severity,
} from "./settings-view-model";

const LANGUAGE_OPTIONS = [
  { value: "automatic", label: "Automatic" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
] as const;

const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

export function AccountPreferencesPage() {
  const initial = {
    language: "automatic",
    reducedMotion: false,
    sounds: true,
    theme: "system",
    units: "imperial",
  };
  const [draft, setDraft] = useState(initial);

  return (
    <SettingsPageBody>
      <ScopeLegend />
      <SettingsCard
        description="These choices follow your account across workspaces."
        title="Interface"
      >
        <SettingsRows>
          <SettingRow
            description="Follow your operating system or choose a fixed appearance."
            label="Theme"
            scope="Personal"
          >
            <SettingsSelect
              ariaLabel="Theme"
              onValueChange={(theme) => setDraft((current) => ({ ...current, theme }))}
              options={THEME_OPTIONS}
              value={draft.theme}
            />
          </SettingRow>
          <SettingRow
            description="Controls navigation labels and application copy."
            label="Language"
            scope="Personal"
          >
            <SettingsSelect
              ariaLabel="Language"
              onValueChange={(language) =>
                setDraft((current) => ({ ...current, language }))
              }
              options={LANGUAGE_OPTIONS}
              value={draft.language}
            />
          </SettingRow>
          <SettingRow
            description="Used for distance, area, speed, and weather values."
            label="Measurement system"
            scope="Personal"
          >
            <SettingsSelect
              ariaLabel="Measurement system"
              onValueChange={(units) => setDraft((current) => ({ ...current, units }))}
              options={[
                { value: "imperial", label: "Imperial" },
                { value: "metric", label: "Metric" },
              ]}
              value={draft.units}
            />
          </SettingRow>
          <SettingRow
            description="Minimizes non-essential interface and map animation."
            htmlFor="settings-reduced-motion"
            label="Reduce motion"
            scope="Personal"
          >
            <SettingsSwitch
              checked={draft.reducedMotion}
              id="settings-reduced-motion"
              onCheckedChange={(reducedMotion) =>
                setDraft((current) => ({ ...current, reducedMotion }))
              }
            />
          </SettingRow>
        </SettingsRows>
      </SettingsCard>

      <SettingsCard description="Choose which local cues should interrupt your work." title="Sounds">
        <SettingsRows>
          <SettingRow
            description="Play a short sound for alerts routed to this device."
            htmlFor="settings-alert-sounds"
            label="Operational alert sounds"
            scope="Personal"
          >
            <SettingsSwitch
              checked={draft.sounds}
              id="settings-alert-sounds"
              onCheckedChange={(sounds) => setDraft((current) => ({ ...current, sounds }))}
            />
          </SettingRow>
        </SettingsRows>
      </SettingsCard>
    </SettingsPageBody>
  );
}

export function WorkspaceMapPage({
  onOpenRealSettings,
}: {
  onOpenRealSettings?: () => void;
}) {
  const initial = {
    basemap: "organization",
    coordinateFormat: "decimal",
    labels: true,
    projection: "mercator",
    terrain: false,
  };
  const [draft, setDraft] = useState(initial);

  return (
    <SettingsPageBody>
      <ScopeLegend />
      <SettingsCard
        action={
          <Badge variant="secondary">
            <Map /> Shared default
          </Badge>
        }
        description="New sessions start here. Individual operators can still adjust their live map."
        title="Map defaults"
      >
        <SettingsRows>
          <SettingRow label="Projection" scope="Workspace">
            <SettingsSelect
              ariaLabel="Map projection"
              onValueChange={(projection) =>
                setDraft((current) => ({ ...current, projection }))
              }
              options={[
                { value: "mercator", label: "Mercator" },
                { value: "globe", label: "Globe" },
              ]}
              value={draft.projection}
            />
          </SettingRow>
          <SettingRow label="Default basemap" scope="Workspace">
            <SettingsSelect
              ariaLabel="Default basemap"
              onValueChange={(basemap) => setDraft((current) => ({ ...current, basemap }))}
              options={[
                { value: "organization", label: "Organization default" },
                { value: "satellite", label: "Satellite" },
                { value: "streets", label: "Streets" },
                { value: "terrain", label: "Terrain" },
              ]}
              value={draft.basemap}
            />
          </SettingRow>
          <SettingRow label="Coordinate format" scope="Workspace">
            <SettingsSelect
              ariaLabel="Coordinate format"
              onValueChange={(coordinateFormat) =>
                setDraft((current) => ({ ...current, coordinateFormat }))
              }
              options={[
                { value: "decimal", label: "Decimal degrees" },
                { value: "dms", label: "Degrees, minutes, seconds" },
                { value: "utm", label: "UTM" },
              ]}
              value={draft.coordinateFormat}
            />
          </SettingRow>
          <SettingRow htmlFor="settings-map-labels" label="Place labels" scope="Workspace">
            <SettingsSwitch
              checked={draft.labels}
              id="settings-map-labels"
              onCheckedChange={(labels) => setDraft((current) => ({ ...current, labels }))}
            />
          </SettingRow>
          <SettingRow
            description="Operators can enable terrain for an individual session."
            htmlFor="settings-map-terrain"
            label="3D terrain on startup"
            scope="Workspace"
          >
            <SettingsSwitch
              checked={draft.terrain}
              id="settings-map-terrain"
              onCheckedChange={(terrain) => setDraft((current) => ({ ...current, terrain }))}
            />
          </SettingRow>
        </SettingsRows>
      </SettingsCard>
      {onOpenRealSettings ? (
        <SettingsCard
          action={
            <Button
              aria-label="Open general workspace settings; alert-routing preview changes will not be saved"
              onClick={onOpenRealSettings}
              size="sm"
              type="button"
              variant="outline"
            >
              Open existing settings
            </Button>
          }
          description="The existing GeoLibre dialog still owns map bounds, geocoding, layout, and appearance persistence."
          title="Advanced application settings"
        >
          <div className="flex items-start gap-3 py-5 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            This page will replace that dialog section-by-section as each settings API is connected.
          </div>
        </SettingsCard>
      ) : null}
    </SettingsPageBody>
  );
}

export function SimulationPresetsPage() {
  const initial = {
    durationHours: "2",
    ignitionMode: "prompt",
    presetName: "Standard wildfire assessment",
    region: "boulder-co",
    timeStepHours: "1",
  };
  const [draft, setDraft] = useState(initial);

  return (
    <SettingsPageBody>
      <div className="flex items-start gap-3 border-y border-border bg-muted/20 p-4 text-sm">
        <CircleHelp className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-medium">Presets are starting values, not hidden engine configuration.</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Region, ignition, time, and timestep remain visible and editable in every New simulation flow.
          </p>
        </div>
      </div>
      <SettingsCard description="Used when an operator starts a simulation without selecting another preset." title="Default preset">
        <SettingsRows>
          <SettingRow label="Preset name" scope="Workspace">
            <Input
              aria-label="Preset name"
              className="sm:max-w-72"
              onChange={(event) =>
                setDraft((current) => ({ ...current, presetName: event.currentTarget.value }))
              }
              value={draft.presetName}
            />
          </SettingRow>
          <SettingRow label="Default region" scope="Workspace">
            <SettingsSelect
              ariaLabel="Default simulation region"
              onValueChange={(region) => setDraft((current) => ({ ...current, region }))}
              options={[
                { value: "boulder-co", label: "Boulder County, CO" },
                { value: "none", label: "Ask every run" },
              ]}
              value={draft.region}
            />
          </SettingRow>
          <SettingRow description="Must be greater than zero." htmlFor="simulation-duration" label="Duration" scope="Workspace">
            <div className="flex w-full items-center gap-2 sm:max-w-64">
              <Input
                className="input-compact-number"
                id="simulation-duration"
                min="0.25"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, durationHours: event.currentTarget.value }))
                }
                step="0.25"
                type="number"
                value={draft.durationHours}
              />
              <span className="text-xs text-muted-foreground">hours</span>
            </div>
          </SettingRow>
          <SettingRow description="The engine validates this against the selected run time." htmlFor="simulation-timestep" label="Timestep" scope="Workspace">
            <div className="flex w-full items-center gap-2 sm:max-w-64">
              <Input
                className="input-compact-number"
                id="simulation-timestep"
                min="0.25"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, timeStepHours: event.currentTarget.value }))
                }
                step="0.25"
                type="number"
                value={draft.timeStepHours}
              />
              <span className="text-xs text-muted-foreground">hours</span>
            </div>
          </SettingRow>
          <SettingRow label="Ignition input" scope="Workspace">
            <SettingsSelect
              ariaLabel="Ignition input"
              onValueChange={(ignitionMode) =>
                setDraft((current) => ({ ...current, ignitionMode }))
              }
              options={[
                { value: "prompt", label: "Ask every run" },
                { value: "draw", label: "Start in drawing mode" },
              ]}
              value={draft.ignitionMode}
            />
          </SettingRow>
        </SettingsRows>
      </SettingsCard>
    </SettingsPageBody>
  );
}

export function AlertRoutingPage() {
  const [draft, setDraft] = useState<AlertRoutingSettings>(INITIAL_ALERT_ROUTING);
  const severities = Object.keys(SEVERITY_LABELS) as Severity[];

  function updateChannel(severity: Severity, channel: Channel, checked: boolean) {
    setDraft((current) => ({
      ...current,
      routing: {
        ...current.routing,
        [severity]: {
          ...current.routing[severity],
          channels: { ...current.routing[severity].channels, [channel]: checked },
        },
      },
    }));
  }

  function updateRoute(
    severity: Severity,
    key: "assignment" | "escalateAfter",
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      routing: {
        ...current.routing,
        [severity]: { ...current.routing[severity], [key]: value },
      },
    }));
  }

  return (
    <SettingsPageBody>
      <SettingsCard
        action={
          <SettingsSwitch
            checked={draft.enabled}
            id="settings-operational-alerts"
            onCheckedChange={(enabled) => setDraft((current) => ({ ...current, enabled }))}
          />
        }
        description="Routing changes delivery and ownership. It does not change engine severity calculations."
        title="Operational alerts"
      >
        <SettingsRows>
          <SettingRow label="Default assignee" scope="Organization">
            <SettingsSelect
              ariaLabel="Default alert assignee"
              onValueChange={(defaultAssignee) =>
                setDraft((current) => ({ ...current, defaultAssignee }))
              }
              options={[
                { value: "on-duty", label: "On-duty operator" },
                { value: "grid-operations", label: "Grid Operations" },
                { value: "unassigned", label: "Unassigned" },
              ]}
              value={draft.defaultAssignee}
            />
          </SettingRow>
          <SettingRow label="Queue order" scope="Organization">
            <div className="inline-flex rounded-md border border-input bg-background p-1">
              <Button
                aria-pressed={draft.queueOrder === "severity"}
                onClick={() => setDraft((current) => ({ ...current, queueOrder: "severity" }))}
                size="sm"
                type="button"
                variant={draft.queueOrder === "severity" ? "secondary" : "ghost"}
              >
                Severity
              </Button>
              <Button
                aria-pressed={draft.queueOrder === "newest"}
                onClick={() => setDraft((current) => ({ ...current, queueOrder: "newest" }))}
                size="sm"
                type="button"
                variant={draft.queueOrder === "newest" ? "secondary" : "ghost"}
              >
                Newest
              </Button>
            </div>
          </SettingRow>
        </SettingsRows>
      </SettingsCard>

      <SettingsCard description="Choose delivery, escalation, and ownership for each severity." title="Severity routing">
        <Table>
          <caption className="sr-only">Alert delivery and assignment by severity</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Severity</TableHead>
              <TableHead className="text-center">In app</TableHead>
              <TableHead className="text-center">Email</TableHead>
              <TableHead className="text-center">SMS</TableHead>
              <TableHead>Escalate after</TableHead>
              <TableHead>Assignment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {severities.map((severity) => {
              const route = draft.routing[severity];
              return (
                <TableRow key={severity}>
                  <TableCell className="font-medium">
                    <Badge variant={severity === "high" ? "destructive" : "outline"}>
                      {SEVERITY_LABELS[severity]}
                    </Badge>
                  </TableCell>
                  {(["inApp", "email", "sms"] as Channel[]).map((channel) => (
                    <TableCell className="text-center" key={channel}>
                      <Checkbox
                        aria-label={`${SEVERITY_LABELS[severity]} alerts via ${channel === "inApp" ? "in app" : channel.toUpperCase()}`}
                        checked={route.channels[channel]}
                        onCheckedChange={(checked) =>
                          updateChannel(severity, channel, checked === true)
                        }
                      />
                    </TableCell>
                  ))}
                  <TableCell className="min-w-40">
                    <SettingsSelect
                      ariaLabel={`${SEVERITY_LABELS[severity]} escalation delay`}
                      onValueChange={(value) => updateRoute(severity, "escalateAfter", value)}
                      options={[
                        { value: "off", label: "Off" },
                        { value: "5-min", label: "5 minutes" },
                        { value: "15-min", label: "15 minutes" },
                        { value: "30-min", label: "30 minutes" },
                      ]}
                      value={route.escalateAfter}
                    />
                  </TableCell>
                  <TableCell className="min-w-48">
                    <SettingsSelect
                      ariaLabel={`${SEVERITY_LABELS[severity]} assignment`}
                      onValueChange={(value) => updateRoute(severity, "assignment", value)}
                      options={[
                        { value: "grid-operations", label: "Grid Operations" },
                        { value: "on-duty", label: "On-duty operator" },
                        { value: "unassigned", label: "Unassigned" },
                      ]}
                      value={route.assignment}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </SettingsCard>

      <div>
        <SettingsCard title="Escalation policy">
          <SettingsRows>
            <SettingRow htmlFor="settings-escalate-alerts" label="Escalate unacknowledged alerts" scope="Organization">
              <SettingsSwitch
                checked={draft.escalateUnacknowledged}
                id="settings-escalate-alerts"
                onCheckedChange={(escalateUnacknowledged) =>
                  setDraft((current) => ({ ...current, escalateUnacknowledged }))
                }
              />
            </SettingRow>
            <SettingRow htmlFor="settings-arrival-sound" label="Play arrival sound" scope="Personal">
              <SettingsSwitch
                checked={draft.playArrivalSound}
                id="settings-arrival-sound"
                onCheckedChange={(playArrivalSound) =>
                  setDraft((current) => ({ ...current, playArrivalSound }))
                }
              />
            </SettingRow>
          </SettingsRows>
        </SettingsCard>
        <SettingsCard title="Queue display">
          <SettingsRows>
            <SettingRow htmlFor="settings-model-confidence" label="Show model confidence" scope="Personal">
              <SettingsSwitch
                checked={draft.showModelConfidence}
                id="settings-model-confidence"
                onCheckedChange={(showModelConfidence) =>
                  setDraft((current) => ({ ...current, showModelConfidence }))
                }
              />
            </SettingRow>
            <SettingRow htmlFor="settings-group-alerts" label="Group related alerts" scope="Personal">
              <SettingsSwitch
                checked={draft.groupRelatedAlerts}
                id="settings-group-alerts"
                onCheckedChange={(groupRelatedAlerts) =>
                  setDraft((current) => ({ ...current, groupRelatedAlerts }))
                }
              />
            </SettingRow>
          </SettingsRows>
        </SettingsCard>
      </div>
    </SettingsPageBody>
  );
}

const MEMBERS = [
  { initials: "LW", name: "Luke Watt", email: "luke@wattbyte.com", role: "Owner", status: "Active" },
  { initials: "GO", name: "Grid Operations", email: "operations@wattbyte.com", role: "Admin", status: "Active" },
  { initials: "AM", name: "Avery Morgan", email: "avery@wattbyte.com", role: "Operator", status: "Invited" },
] as const;

export function MembersAccessPage() {
  return (
    <SettingsPageBody>
      <div className="grid border-y border-border xl:grid-cols-3">
        <SummaryCard icon={<ShieldCheck />} label="Owners" value="1" />
        <SummaryCard icon={<LockKeyhole />} label="Admins" value="1" />
        <SummaryCard icon={<Activity />} label="Active members" value="2" />
      </div>
      <SettingsCard
        action={
          <Button disabled size="sm" title="Member APIs are not connected yet" type="button">
            <UserPlus /> Invite member
          </Button>
        }
        description="Roles determine which settings and operational actions each person can access."
        title="Members"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MEMBERS.map((member) => (
              <TableRow key={member.email}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback>{member.initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium">{member.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline">{member.role}</Badge></TableCell>
                <TableCell><Badge variant={member.status === "Active" ? "secondary" : "outline"}>{member.status}</Badge></TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-label={`Manage ${member.name}`} size="icon" type="button" variant="ghost">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="surface-glass-overlay">
                      <DropdownMenuLabel>{member.name}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled>Change role</DropdownMenuItem>
                      <DropdownMenuItem disabled>Suspend access</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SettingsCard>
      <div className="flex items-start gap-3 border-y border-border bg-muted/20 p-4 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        Member actions are intentionally disabled until organization identity and role APIs are connected.
      </div>
    </SettingsPageBody>
  );
}

export function EngineStatusPage({
  onOpenRealSettings,
}: {
  onOpenRealSettings?: () => void;
}) {
  return (
    <SettingsPageBody>
      <div className="grid border-y border-border xl:grid-cols-4">
        <SummaryCard icon={<Server />} label="Engine API" status="Connected" value="Ready" />
        <SummaryCard icon={<Gauge />} label="Run queue" status="Healthy" value="0 queued" />
        <SummaryCard icon={<Database />} label="Snapshot store" status="Available" value="SQLite" />
        <SummaryCard icon={<Clock3 />} label="Last health check" value="Just now" />
      </div>
      <SettingsCard
        action={<Badge variant="secondary">Connected</Badge>}
        description="Connection details are device-local and do not change organization policy."
        title="Connection"
      >
        <SettingsRows>
          <SettingRow label="API endpoint" scope="Personal">
            <code className="max-w-full truncate rounded-md bg-muted px-2.5 py-1.5 text-xs">
              http://localhost:8000
            </code>
          </SettingRow>
          <SettingRow label="Engine version" scope="Engine-managed">
            <span className="text-sm">Development build</span>
          </SettingRow>
          <SettingRow label="Active region" scope="Engine-managed">
            <span className="text-sm">Boulder County, CO</span>
          </SettingRow>
        </SettingsRows>
      </SettingsCard>
      <SettingsCard
        action={<Badge variant="outline">Requires restart</Badge>}
        description="Startup-critical values are visible here but remain controlled by validated engine configuration."
        title="Runtime configuration"
      >
        <SettingsRows>
          <SettingRow label="Local Redis" scope="Engine-managed"><span className="text-sm">Disabled</span></SettingRow>
          <SettingRow label="Wildfire snapshot store" scope="Engine-managed"><span className="text-sm">var/state/wildfire_snapshots.sqlite3</span></SettingRow>
          <SettingRow label="Weather polling" scope="Engine-managed"><span className="text-sm">Region policy</span></SettingRow>
        </SettingsRows>
      </SettingsCard>
      {onOpenRealSettings ? (
        <div className="flex justify-end">
          <Button
            aria-label="Open general workspace settings; alert-routing preview changes will not be saved"
            onClick={onOpenRealSettings}
            type="button"
            variant="outline"
          >
            <Server /> Configure connection
          </Button>
        </div>
      ) : null}
    </SettingsPageBody>
  );
}

function SettingsPageBody({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-5 py-2 sm:px-8 sm:py-3">
      {children}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  status,
  value,
}: {
  icon: ReactNode;
  label: string;
  status?: string;
  value: string;
}) {
  return (
    <div className="border-b border-border p-4 last:border-b-0 xl:border-r xl:border-b-0 xl:last:border-r-0">
      <div className="flex items-center justify-between gap-3 text-muted-foreground">
        <span className="[&_svg]:size-4">{icon}</span>
        {status ? <Badge variant="outline">{status}</Badge> : null}
      </div>
      <p className="mt-5 text-xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
