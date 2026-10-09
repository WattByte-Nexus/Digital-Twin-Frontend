import {
  Badge,
  Button,
  Input,
  SettingRow,
  SettingsCard,
  SelectMenu,
  SelectMenuContent,
  SelectMenuItem,
  SelectMenuTrigger,
  SelectMenuValue,
  ToggleGroup,
  ToggleGroupItem,
  surfaceThemeClassName,
} from "@geolibre/ui";
import {
  ArrowUpRight,
  CircleCheck,
  CircleHelp,
  CircleX,
  LoaderCircle,
  Moon,
  RefreshCw,
  Sun,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import {
  checkDigitalTwinEngineHealth,
  type DigitalTwinEngineHealth,
} from "../../../../lib/digital-twin-status";
import { normalizeDigitalTwinApiUrl } from "../../../../lib/digital-twin-api";
import { useDesktopSettingsStore } from "../../../../hooks/useDesktopSettings";
import { isThemeScheme, THEME_SCHEMES } from "../../../../lib/theme-schemes";

export function AccountPreferencesPage({
  theme,
  onToggleTheme,
}: {
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const id = useId();
  const appearance = useDesktopSettingsStore((state) => state.desktopSettings.theme);
  const updateAppearance = (patch: Partial<typeof appearance>) => {
    const { desktopSettings, setDesktopSettings } = useDesktopSettingsStore.getState();
    setDesktopSettings({ ...desktopSettings, theme: { ...desktopSettings.theme, ...patch } });
  };

  return (
    <SettingsCard
      title="Device appearance"
      description="Your appearance preferences are saved in this browser and apply across the application."
    >
      <SettingRow
        label="Application theme"
        labelId={`${id}-theme`}
        description="Choose the appearance that works best for you."
      >
        <ToggleGroup
          aria-labelledby={`${id}-theme`}
          onValueChange={(next) => {
            if (next && next !== theme) onToggleTheme();
          }}
          type="single"
          value={theme}
          variant="outline"
        >
          <ToggleGroupItem className="min-h-11 px-4" value="light">
            <Sun aria-hidden="true" />
            Light
          </ToggleGroupItem>
          <ToggleGroupItem className="min-h-11 px-4" value="dark">
            <Moon aria-hidden="true" />
            Dark
          </ToggleGroupItem>
        </ToggleGroup>
      </SettingRow>
      <SettingRow
        htmlFor={`${id}-accent`}
        label="Accent color"
        description="Used for selected controls and keyboard focus."
      >
        <SelectMenu
          onValueChange={(scheme) => {
            if (isThemeScheme(scheme)) updateAppearance({ scheme });
          }}
          value={appearance.scheme}
        >
          <SelectMenuTrigger
            className="min-h-11 w-full capitalize @md/settings-card:w-44"
            id={`${id}-accent`}
          >
            <SelectMenuValue />
          </SelectMenuTrigger>
          <SelectMenuContent
            className={`${surfaceThemeClassName(theme)} surface-glass-overlay min-w-[var(--radix-select-trigger-width)]`}
            position="popper"
          >
            {THEME_SCHEMES.map((scheme) => (
              <SelectMenuItem className="min-h-11" key={scheme.id} value={scheme.id}>
                {scheme.id.charAt(0).toUpperCase() + scheme.id.slice(1)}
              </SelectMenuItem>
            ))}
            <SelectMenuItem className="min-h-11" value="custom">
              Custom
            </SelectMenuItem>
          </SelectMenuContent>
        </SelectMenu>
      </SettingRow>
      {appearance.scheme === "custom" ? (
        <SettingRow
          htmlFor={`${id}-color`}
          label="Custom accent"
          description="Pick a color for your application accent."
        >
          <Input
            className="h-11 w-20 cursor-pointer p-1"
            id={`${id}-color`}
            onChange={(event) => updateAppearance({ customColor: event.currentTarget.value })}
            type="color"
            value={appearance.customColor}
          />
          <span className="font-mono text-xs text-muted-foreground">{appearance.customColor}</span>
        </SettingRow>
      ) : null}
    </SettingsCard>
  );
}

export function SavedScenariosPage({ onOpenScenarios }: { onOpenScenarios: () => void }) {
  return (
    <SettingsCard
      title="Scenario library"
      description="Reuse saved environmental conditions when preparing a simulation."
    >
      <SettingRow
        label="Saved scenarios"
        description="Each scenario retains its region, weather version, bounds and synthetic wind. Choose ignition and run inputs when submitting a run."
      >
        <Button className="min-h-11" onClick={onOpenScenarios} type="button" variant="outline">
          Open saved scenarios
          <ArrowUpRight aria-hidden="true" />
        </Button>
      </SettingRow>
    </SettingsCard>
  );
}

const HEALTH_PRESENTATION = {
  ready: {
    label: "Live and ready",
    Icon: CircleCheck,
    className:
      "border-[hsl(var(--dt-status-ok-border))] bg-[hsl(var(--dt-status-ok-surface))] text-[hsl(var(--dt-status-ok-text))]",
  },
  degraded: {
    label: "Startup not ready",
    Icon: TriangleAlert,
    className:
      "border-[hsl(var(--dt-status-review-border))] bg-[hsl(var(--dt-status-review-surface))] text-[hsl(var(--dt-status-review-text))]",
  },
  offline: {
    label: "Offline",
    Icon: CircleX,
    className:
      "border-[hsl(var(--dt-status-failed-border))] bg-[hsl(var(--dt-status-failed-surface))] text-[hsl(var(--dt-status-failed-text))]",
  },
};

export function EngineStatusPage({ apiUrl }: { apiUrl: string }) {
  const [health, setHealth] = useState<DigitalTwinEngineHealth | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setChecking(true);
    setError(null);
    void checkDigitalTwinEngineHealth(apiUrl, { signal: controller.signal })
      .then(
        (status) => {
          if (!controller.signal.aborted) {
            setHealth(status);
            setCheckedAt(new Date().toISOString());
          }
        },
        (cause) => {
          if (!controller.signal.aborted) {
            setHealth(null);
            setCheckedAt(null);
            setError(cause instanceof Error ? cause.message : "Health check failed.");
          }
        },
      )
      .finally(() => {
        if (!controller.signal.aborted) setChecking(false);
      });
    return () => controller.abort();
  }, [apiUrl, refresh]);
  let endpoint = apiUrl;
  try {
    endpoint = normalizeDigitalTwinApiUrl(apiUrl);
  } catch {
    /* The health error reports invalid configuration. */
  }
  const status = checking
    ? { label: "Checking…", Icon: LoaderCircle, className: "" }
    : health
      ? HEALTH_PRESENTATION[health]
      : { label: "Check failed", Icon: CircleHelp, className: "text-destructive" };
  const StatusIcon = status.Icon;

  return (
    <SettingsCard
      title="Engine connectivity"
      description="Check the service's connection and startup readiness. Region readiness is available in Data administration."
      action={
        <Button
          className="min-h-11"
          variant="outline"
          disabled={checking}
          onClick={() => setRefresh((key) => key + 1)}
          type="button"
        >
          <RefreshCw
            aria-hidden="true"
            className={checking ? "animate-spin motion-reduce:animate-none" : undefined}
          />
          {checking ? "Checking…" : "Check now"}
        </Button>
      }
    >
      <SettingRow label="API endpoint" description="The Engine service used by this workspace.">
        <code className="break-all text-xs text-muted-foreground">{endpoint}</code>
      </SettingRow>
      <SettingRow label="Service status" description="Checks both the live and ready probes.">
        <div aria-live="polite" role="status">
          <Badge className={`gap-1.5 whitespace-normal ${status.className}`} variant="outline">
            <StatusIcon
              aria-hidden="true"
              className={`size-3.5 shrink-0 ${checking ? "animate-spin motion-reduce:animate-none" : ""}`}
            />
            {status.label}
          </Badge>
        </div>
      </SettingRow>
      <SettingRow label="Last checked" description="Shown in your local time zone.">
        {checkedAt ? (
          <time
            className="text-xs tabular-nums text-muted-foreground"
            dateTime={checkedAt}
            title={checkedAt}
          >
            {new Intl.DateTimeFormat(undefined, {
              dateStyle: "medium",
              timeStyle: "medium",
            }).format(new Date(checkedAt))}
          </time>
        ) : (
          <span className="text-xs text-muted-foreground">Not checked yet</span>
        )}
      </SettingRow>
      {error ? (
        <p role="alert" className="break-words py-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </SettingsCard>
  );
}
