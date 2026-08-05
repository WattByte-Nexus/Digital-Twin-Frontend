import { Button, Select } from "@geolibre/ui";
import {
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import "./settings-view.css";

type Channel = "inApp" | "email" | "sms";
type Severity = "high" | "medium" | "low";

interface SeverityRoute {
  assignment: string;
  channels: Record<Channel, boolean>;
  escalateAfter: string;
}

interface AlertRoutingPreview {
  autoAcknowledge: boolean;
  defaultAssignee: string;
  defaultFilter: string;
  escalateUnacknowledged: boolean;
  escalationTarget: string;
  groupRelatedAlerts: boolean;
  operationalAlerts: boolean;
  playArrivalSound: boolean;
  queueOrder: "severity" | "newest";
  repeatHighSeveritySound: boolean;
  routing: Record<Severity, SeverityRoute>;
  showAcknowledgedAlerts: boolean;
  showAssetIdentifiers: boolean;
  showModelConfidence: boolean;
}

export interface SettingsViewProps {
  /** Opens GeoLibre's existing settings dialog; this preview is never persisted. */
  onOpenRealSettings?: () => void;
  /** Alternative host-provided entry point to the real settings experience. */
  realSettingsSlot?: ReactNode;
}

interface SettingsViewStyle extends CSSProperties {
  "--dt-settings-help-width": string;
  "--dt-settings-nav-width": string;
}

const DEFAULT_NAV_WIDTH = 264;
const MIN_NAV_WIDTH = 216;
const MAX_NAV_WIDTH = 360;
const DEFAULT_HELP_WIDTH = 398;
const MIN_HELP_WIDTH = 320;
const MAX_HELP_WIDTH = 520;
const RESIZE_STEP = 8;

const INITIAL_PREVIEW: AlertRoutingPreview = {
  autoAcknowledge: false,
  defaultAssignee: "on-duty",
  defaultFilter: "all-active",
  escalateUnacknowledged: true,
  escalationTarget: "operations-supervisor",
  groupRelatedAlerts: false,
  operationalAlerts: true,
  playArrivalSound: true,
  queueOrder: "severity",
  repeatHighSeveritySound: true,
  routing: {
    high: {
      assignment: "grid-operations",
      channels: { inApp: true, email: true, sms: true },
      escalateAfter: "5-min",
    },
    medium: {
      assignment: "on-duty",
      channels: { inApp: true, email: true, sms: false },
      escalateAfter: "15-min",
    },
    low: {
      assignment: "unassigned",
      channels: { inApp: true, email: false, sms: false },
      escalateAfter: "off",
    },
  },
  showAcknowledgedAlerts: true,
  showAssetIdentifiers: true,
  showModelConfidence: true,
};

const SETTINGS_GROUPS = [
  {
    label: "Workspace",
    items: ["General", "Map & display", "Simulation defaults"],
  },
  {
    label: "Operations",
    items: ["Alert routing", "Notifications", "Handoffs"],
  },
  {
    label: "Organization",
    items: ["Team & access", "Integrations", "Security"],
  },
] as const;

const SEVERITY_LABELS: Record<Severity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function SettingsNavigation() {
  return (
    <nav
      className="dt-settings-navigation dt-settings-glass-panel"
      aria-label="Settings sections"
    >
      {SETTINGS_GROUPS.map((group) => (
        <section
          className="dt-settings-nav-group"
          aria-labelledby={`settings-${group.label}`}
          key={group.label}
        >
          <h2 id={`settings-${group.label}`}>{group.label}</h2>
          <div className="dt-settings-nav-items">
            {group.items.map((item) => {
              const isCurrent = item === "Alert routing";
              return (
                <span
                  aria-current={isCurrent ? "page" : undefined}
                  className="dt-settings-nav-item"
                  data-current={isCurrent || undefined}
                  key={item}
                >
                  {item}
                </span>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}

function PreviewToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className="dt-settings-toggle"
      data-checked={checked}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span aria-hidden="true" />
    </button>
  );
}

function SettingsSelect({
  ariaLabel,
  children,
  id,
  onChange,
  value,
}: {
  ariaLabel?: string;
  children: ReactNode;
  id?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <Select
      aria-label={ariaLabel}
      className="dt-settings-select"
      id={id}
      onChange={(event) => onChange(event.currentTarget.value)}
      value={value}
    >
      {children}
    </Select>
  );
}

function ToggleRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="dt-settings-toggle-row">
      <span>{label}</span>
      <PreviewToggle checked={checked} label={label} onChange={onChange} />
    </div>
  );
}

function ChannelCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="dt-settings-channel-checkbox">
      <span className="dt-settings-visually-hidden">{label}</span>
      <input
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        type="checkbox"
      />
    </label>
  );
}

function SeverityRoutingTable({
  routing,
  onChannelChange,
  onRouteChange,
}: {
  routing: Record<Severity, SeverityRoute>;
  onChannelChange: (
    severity: Severity,
    channel: Channel,
    checked: boolean
  ) => void;
  onRouteChange: (
    severity: Severity,
    key: "escalateAfter" | "assignment",
    value: string
  ) => void;
}) {
  const severities = Object.keys(SEVERITY_LABELS) as Severity[];

  return (
    <div className="dt-settings-routing-table-wrap">
      <table className="dt-settings-routing-table">
        <caption className="dt-settings-visually-hidden">
          Preview delivery channels, escalation timing, and assignment by alert
          severity
        </caption>
        <colgroup>
          <col className="dt-settings-severity-column" />
          <col className="dt-settings-channel-column" />
          <col className="dt-settings-channel-column" />
          <col className="dt-settings-channel-column" />
          <col className="dt-settings-escalation-column" />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Severity</th>
            <th scope="col">In app</th>
            <th scope="col">Email</th>
            <th scope="col">SMS</th>
            <th scope="col">Escalate after</th>
            <th scope="col">Assignment</th>
          </tr>
        </thead>
        <tbody>
          {severities.map((severity) => {
            const route = routing[severity];
            return (
              <tr data-severity={severity} key={severity}>
                <th scope="row">
                  <i aria-hidden="true" />
                  {SEVERITY_LABELS[severity]}
                </th>
                {(["inApp", "email", "sms"] as Channel[]).map((channel) => (
                  <td key={channel}>
                    <ChannelCheckbox
                      checked={route.channels[channel]}
                      label={`${SEVERITY_LABELS[severity]} alerts via ${
                        channel === "inApp" ? "in app" : channel.toUpperCase()
                      }`}
                      onChange={(checked) =>
                        onChannelChange(severity, channel, checked)
                      }
                    />
                  </td>
                ))}
                <td>
                  <SettingsSelect
                    ariaLabel={`${SEVERITY_LABELS[severity]} escalation delay`}
                    onChange={(value) =>
                      onRouteChange(severity, "escalateAfter", value)
                    }
                    value={route.escalateAfter}
                  >
                    <option value="off">Off</option>
                    <option value="5-min">5 min</option>
                    <option value="15-min">15 min</option>
                    <option value="30-min">30 min</option>
                  </SettingsSelect>
                </td>
                <td>
                  <SettingsSelect
                    ariaLabel={`${SEVERITY_LABELS[severity]} assignment`}
                    onChange={(value) =>
                      onRouteChange(severity, "assignment", value)
                    }
                    value={route.assignment}
                  >
                    <option value="grid-operations">Grid Operations</option>
                    <option value="on-duty">On-duty operator</option>
                    <option value="unassigned">Unassigned</option>
                  </SettingsSelect>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AlertRoutingHelp({
  onOpenRealSettings,
}: Pick<SettingsViewProps, "onOpenRealSettings">) {
  return (
    <aside
      className="dt-settings-help dt-settings-glass-panel"
      aria-labelledby="settings-help-title"
    >
      <div className="dt-settings-help-scroll">
        <section className="dt-settings-help-intro">
          <h2 id="settings-help-title">About alert routing</h2>
          <p>
            Routing controls delivery and assignment. It does not change Engine
            severity or risk calculations.
          </p>
          <div
            className="dt-settings-severity-legend"
            aria-label="Alert severity colors"
          >
            <span data-severity="high">
              <i aria-hidden="true" />
              High
            </span>
            <span data-severity="medium">
              <i aria-hidden="true" />
              Medium
            </span>
            <span data-severity="low">
              <i aria-hidden="true" />
              Low
            </span>
          </div>
        </section>

        <section
          className="dt-settings-help-preview"
          aria-labelledby="settings-preview-title"
        >
          <h3 id="settings-preview-title">Preview</h3>
          <article className="dt-settings-alert-preview">
            <strong>Vegetation clearance risk</strong>
            <p>Circuit FRN-12&nbsp;&nbsp;·&nbsp;&nbsp;Segment 14</p>
            <div>
              <span>High</span>
              <time dateTime="10:12">10:12 AM</time>
            </div>
          </article>
          <p className="dt-settings-preview-route">
            In app&nbsp;&nbsp;·&nbsp;&nbsp;Email&nbsp;&nbsp;·&nbsp;&nbsp;SMS
          </p>
          <p className="dt-settings-preview-escalation">
            Escalates after 5 min
          </p>
        </section>

        <section
          className="dt-settings-help-audit"
          aria-labelledby="settings-audit-title"
        >
          <h3 id="settings-audit-title">Audit</h3>
          <p>
            This alert-routing preview is local and cannot be saved from this
            screen.
          </p>
          {onOpenRealSettings ? (
            <button
              aria-label="Open general workspace settings; alert-routing preview changes will not be saved"
              className="dt-settings-text-action"
              onClick={onOpenRealSettings}
              title="Opens existing connection settings only"
              type="button"
            >
              Open workspace settings
            </button>
          ) : (
            <p className="dt-settings-help-hint">
              Existing workspace settings do not save this alert-routing
              preview.
            </p>
          )}
        </section>

        <div
          className="dt-settings-help-docs"
          aria-label="Alert routing documentation reference"
        >
          Alert routing documentation&nbsp;&nbsp;↗
        </div>
      </div>

      <div className="dt-settings-live-strip">
        <span>
          <i aria-hidden="true" />1 new high-severity alert
        </span>
        <strong>Live preview</strong>
      </div>
    </aside>
  );
}

function ResizeSeparator({
  defaultValue,
  edge,
  label,
  max,
  min,
  onChange,
  value,
}: {
  defaultValue: number;
  edge: "inline-start" | "inline-end";
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  function widthDeltaForPhysicalDelta(
    element: HTMLElement,
    physicalDelta: number
  ) {
    const direction = getComputedStyle(element).direction === "rtl" ? -1 : 1;
    return physicalDelta * (edge === "inline-start" ? direction : -direction);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;

    event.preventDefault();
    const separator = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startValue = value;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const delta = widthDeltaForPhysicalDelta(
        separator,
        moveEvent.clientX - startX
      );
      onChange(clamp(Math.round(startValue + delta), min, max));
    };

    const removeListeners = () => {
      separator.removeEventListener("pointermove", handlePointerMove);
      separator.removeEventListener("pointerup", finishResize);
      separator.removeEventListener("pointercancel", finishResize);
      separator.removeEventListener("lostpointercapture", removeListeners);
    };

    const finishResize = () => {
      removeListeners();
      if (separator.hasPointerCapture(pointerId))
        separator.releasePointerCapture(pointerId);
    };

    separator.addEventListener("pointermove", handlePointerMove);
    separator.addEventListener("pointerup", finishResize);
    separator.addEventListener("pointercancel", finishResize);
    separator.addEventListener("lostpointercapture", removeListeners);
    separator.setPointerCapture(pointerId);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Home") {
      event.preventDefault();
      onChange(min);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      onChange(max);
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    const physicalDelta =
      event.key === "ArrowRight" ? RESIZE_STEP : -RESIZE_STEP;
    const delta = widthDeltaForPhysicalDelta(
      event.currentTarget,
      physicalDelta
    );
    onChange(clamp(value + delta, min, max));
  }

  return (
    <div
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemax={max}
      aria-valuemin={min}
      aria-valuenow={value}
      aria-valuetext={`${value} pixels`}
      className={`dt-settings-resizer dt-settings-resizer--${edge}`}
      onDoubleClick={() => onChange(defaultValue)}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      role="separator"
      tabIndex={0}
    />
  );
}

export function SettingsView({
  onOpenRealSettings,
  realSettingsSlot,
}: SettingsViewProps) {
  const [preview, setPreview] = useState<AlertRoutingPreview>(INITIAL_PREVIEW);
  const [navWidth, setNavWidth] = useState(DEFAULT_NAV_WIDTH);
  const [helpWidth, setHelpWidth] = useState(DEFAULT_HELP_WIDTH);
  const hasPreviewChanges =
    JSON.stringify(preview) !== JSON.stringify(INITIAL_PREVIEW);
  const style: SettingsViewStyle = {
    "--dt-settings-help-width": `${helpWidth}px`,
    "--dt-settings-nav-width": `${navWidth}px`,
  };

  function updatePreview<K extends keyof AlertRoutingPreview>(
    key: K,
    value: AlertRoutingPreview[K]
  ) {
    setPreview((current) => ({ ...current, [key]: value }));
  }

  function updateSeverityChannel(
    severity: Severity,
    channel: Channel,
    checked: boolean
  ) {
    setPreview((current) => ({
      ...current,
      routing: {
        ...current.routing,
        [severity]: {
          ...current.routing[severity],
          channels: {
            ...current.routing[severity].channels,
            [channel]: checked,
          },
        },
      },
    }));
  }

  function updateSeverityRoute(
    severity: Severity,
    key: "escalateAfter" | "assignment",
    value: string
  ) {
    setPreview((current) => ({
      ...current,
      routing: {
        ...current.routing,
        [severity]: { ...current.routing[severity], [key]: value },
      },
    }));
  }

  return (
    <div className="dt-settings-view" style={style}>
      <header className="dt-settings-page-header dt-settings-glass-panel">
        <div>
          <h1>Settings</h1>
          <p>Configure operations, alerts, and workspace defaults</p>
        </div>
        <div className="dt-settings-page-actions">
          <span className="dt-settings-preview-badge">Preview only</span>
          {realSettingsSlot ? (
            <div className="dt-settings-real-settings-slot">
              {realSettingsSlot}
            </div>
          ) : onOpenRealSettings ? (
            <Button
              aria-label="Open general workspace settings; alert-routing preview changes will not be saved"
              className="dt-settings-button dt-settings-button--primary"
              onClick={onOpenRealSettings}
              title="Opens existing connection settings only"
              type="button"
            >
              Open settings
            </Button>
          ) : null}
        </div>
      </header>

      <SettingsNavigation />

      <section
        className="dt-settings-form dt-settings-glass-panel"
        aria-labelledby="alert-routing-title"
      >
        <div className="dt-settings-form-scroll">
          <section className="dt-settings-form-intro">
            <div>
              <h2 id="alert-routing-title">Alert routing</h2>
              <p>
                Control how operational alerts enter the queue and reach your
                team.
              </p>
              <span
                className="dt-settings-enabled-status"
                data-enabled={preview.operationalAlerts}
              >
                <i aria-hidden="true" />
                Operational alerts{" "}
                {preview.operationalAlerts ? "enabled" : "disabled"}
              </span>
            </div>
            <PreviewToggle
              checked={preview.operationalAlerts}
              label="Operational alerts"
              onChange={(checked) =>
                updatePreview("operationalAlerts", checked)
              }
            />
          </section>

          <section
            className="dt-settings-form-section"
            aria-labelledby="queue-defaults-title"
          >
            <div className="dt-settings-section-heading">
              <h3 id="queue-defaults-title">1. Queue defaults</h3>
              <p>Choose the initial ownership and ordering for new alerts.</p>
            </div>
            <div className="dt-settings-field-row">
              <label htmlFor="dt-default-assignee">Default assignee</label>
              <SettingsSelect
                id="dt-default-assignee"
                onChange={(value) => updatePreview("defaultAssignee", value)}
                value={preview.defaultAssignee}
              >
                <option value="on-duty">On-duty operator</option>
                <option value="grid-operations">Grid Operations</option>
                <option value="unassigned">Unassigned</option>
              </SettingsSelect>
            </div>
            <div className="dt-settings-field-row">
              <span>Queue order</span>
              <div
                className="dt-settings-segmented"
                aria-label="Queue order"
                role="radiogroup"
              >
                <button
                  aria-checked={preview.queueOrder === "severity"}
                  data-selected={preview.queueOrder === "severity"}
                  onClick={() => updatePreview("queueOrder", "severity")}
                  role="radio"
                  type="button"
                >
                  Severity
                </button>
                <button
                  aria-checked={preview.queueOrder === "newest"}
                  data-selected={preview.queueOrder === "newest"}
                  onClick={() => updatePreview("queueOrder", "newest")}
                  role="radio"
                  type="button"
                >
                  Newest
                </button>
              </div>
            </div>
            <ToggleRow
              checked={preview.autoAcknowledge}
              label="Auto-acknowledge system notices"
              onChange={(checked) => updatePreview("autoAcknowledge", checked)}
            />
            <ToggleRow
              checked={preview.showAcknowledgedAlerts}
              label="Show acknowledged alerts"
              onChange={(checked) =>
                updatePreview("showAcknowledgedAlerts", checked)
              }
            />
          </section>

          <section
            className="dt-settings-form-section"
            aria-labelledby="severity-routing-title"
          >
            <div className="dt-settings-section-heading">
              <h3 id="severity-routing-title">2. Severity routing</h3>
              <p>Set channels and escalation behavior by severity.</p>
            </div>
            <SeverityRoutingTable
              onChannelChange={updateSeverityChannel}
              onRouteChange={updateSeverityRoute}
              routing={preview.routing}
            />
          </section>

          <div className="dt-settings-form-split">
            <section aria-labelledby="escalation-policy-title">
              <h3 id="escalation-policy-title">3. Escalation policy</h3>
              <ToggleRow
                checked={preview.escalateUnacknowledged}
                label="Escalate unacknowledged alerts"
                onChange={(checked) =>
                  updatePreview("escalateUnacknowledged", checked)
                }
              />
              <div className="dt-settings-inline-select-row">
                <label htmlFor="dt-escalation-target">After two attempts</label>
                <SettingsSelect
                  id="dt-escalation-target"
                  onChange={(value) => updatePreview("escalationTarget", value)}
                  value={preview.escalationTarget}
                >
                  <option value="operations-supervisor">
                    Notify operations supervisor
                  </option>
                  <option value="grid-operations">
                    Notify Grid Operations
                  </option>
                  <option value="on-duty">Notify on-duty operator</option>
                </SettingsSelect>
              </div>
              <ToggleRow
                checked={preview.repeatHighSeveritySound}
                label="Repeat high-severity sound until acknowledged"
                onChange={(checked) =>
                  updatePreview("repeatHighSeveritySound", checked)
                }
              />
              <p className="dt-settings-warning">
                ▲&nbsp;&nbsp;High-severity alerts bypass quiet hours.
              </p>
            </section>

            <section aria-labelledby="queue-display-title">
              <h3 id="queue-display-title">4. Alert queue display</h3>
              <ToggleRow
                checked={preview.showAssetIdentifiers}
                label="Show asset and segment identifiers"
                onChange={(checked) =>
                  updatePreview("showAssetIdentifiers", checked)
                }
              />
              <ToggleRow
                checked={preview.showModelConfidence}
                label="Show model confidence"
                onChange={(checked) =>
                  updatePreview("showModelConfidence", checked)
                }
              />
              <ToggleRow
                checked={preview.groupRelatedAlerts}
                label="Group related alerts"
                onChange={(checked) =>
                  updatePreview("groupRelatedAlerts", checked)
                }
              />
              <ToggleRow
                checked={preview.playArrivalSound}
                label="Play arrival sound"
                onChange={(checked) =>
                  updatePreview("playArrivalSound", checked)
                }
              />
              <div className="dt-settings-inline-select-row dt-settings-inline-select-row--filter">
                <label htmlFor="dt-default-filter">Default filter</label>
                <SettingsSelect
                  id="dt-default-filter"
                  onChange={(value) => updatePreview("defaultFilter", value)}
                  value={preview.defaultFilter}
                >
                  <option value="all-active">All active alerts</option>
                  <option value="unassigned">Unassigned alerts</option>
                  <option value="high-severity">High severity</option>
                </SettingsSelect>
              </div>
            </section>
          </div>
        </div>

        <footer className="dt-settings-action-bar">
          <span
            className="dt-settings-change-status"
            data-dirty={hasPreviewChanges}
          >
            <i aria-hidden="true" />
            {hasPreviewChanges
              ? "Preview changes only"
              : "Preview matches defaults"}
          </span>
          <div>
            <Button
              className="dt-settings-button dt-settings-button--secondary"
              disabled={!hasPreviewChanges}
              onClick={() => setPreview(INITIAL_PREVIEW)}
              type="button"
            >
              Reset preview
            </Button>
            {onOpenRealSettings ? (
              <Button
                aria-label="Open general workspace settings; alert-routing preview changes will not be saved"
                className="dt-settings-button dt-settings-button--primary"
                onClick={onOpenRealSettings}
                title="Opens existing connection settings only"
                type="button"
              >
                Open settings
              </Button>
            ) : null}
          </div>
        </footer>
      </section>

      <AlertRoutingHelp onOpenRealSettings={onOpenRealSettings} />

      <ResizeSeparator
        defaultValue={DEFAULT_NAV_WIDTH}
        edge="inline-start"
        label="Resize settings navigation"
        max={MAX_NAV_WIDTH}
        min={MIN_NAV_WIDTH}
        onChange={setNavWidth}
        value={navWidth}
      />
      <ResizeSeparator
        defaultValue={DEFAULT_HELP_WIDTH}
        edge="inline-end"
        label="Resize alert routing help"
        max={MAX_HELP_WIDTH}
        min={MIN_HELP_WIDTH}
        onChange={setHelpWidth}
        value={helpWidth}
      />
    </div>
  );
}
