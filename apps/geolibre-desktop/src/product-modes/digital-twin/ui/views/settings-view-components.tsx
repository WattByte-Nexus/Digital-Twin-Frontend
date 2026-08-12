import {
  Badge,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  SelectMenu,
  SelectMenuContent,
  SelectMenuItem,
  SelectMenuTrigger,
  SelectMenuValue,
  Separator,
  Switch,
  cn,
} from "@geolibre/ui";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

export function SettingsCard({
  action,
  children,
  description,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <Card className="gap-0 rounded-none border-0 border-b border-border bg-transparent py-0 shadow-none">
      <CardHeader className="gap-1.5 px-0 py-5">
        <CardTitle className="text-sm">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className="px-0 pb-1">{children}</CardContent>
    </Card>
  );
}

export function SettingRow({
  children,
  description,
  htmlFor,
  label,
  scope,
}: {
  children: ReactNode;
  description?: string;
  htmlFor?: string;
  label: string;
  scope?: "Engine-managed" | "Organization" | "Personal" | "Workspace";
}) {
  const copy = (
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {scope ? (
          <Badge className="font-normal" variant="outline">
            {scope}
          </Badge>
        ) : null}
      </div>
      {description ? (
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="grid min-h-16 gap-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(13rem,38%)] sm:items-center">
      {htmlFor ? (
        <Label className="block cursor-pointer" htmlFor={htmlFor}>
          {copy}
        </Label>
      ) : (
        copy
      )}
      <div className="flex min-w-0 items-center justify-start sm:justify-end">{children}</div>
    </div>
  );
}

export function SettingsRows({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-border/70">{children}</div>;
}

export function SettingsSwitch({
  checked,
  id,
  onCheckedChange,
}: {
  checked: boolean;
  id: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return <Switch checked={checked} id={id} onCheckedChange={onCheckedChange} />;
}

export function SettingsSelect({
  ariaLabel,
  id,
  onValueChange,
  options,
  value,
}: {
  ariaLabel: string;
  id?: string;
  onValueChange: (value: string) => void;
  options: ReadonlyArray<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <SelectMenu onValueChange={onValueChange} value={value}>
      <SelectMenuTrigger aria-label={ariaLabel} className="w-full sm:max-w-64" id={id}>
        <SelectMenuValue />
      </SelectMenuTrigger>
      <SelectMenuContent className="surface-glass-overlay min-w-[var(--radix-select-trigger-width)]">
        {options.map((option) => (
          <SelectMenuItem key={option.value} value={option.value}>
            {option.label}
          </SelectMenuItem>
        ))}
      </SelectMenuContent>
    </SelectMenu>
  );
}

export function ScopeLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border py-4 text-xs text-muted-foreground">
      <span>Setting scope</span>
      <Separator className="h-4" orientation="vertical" />
      <Badge variant="outline">Personal</Badge>
      <Badge variant="outline">Workspace</Badge>
      <Badge variant="outline">Organization</Badge>
      <Badge variant="outline">Engine-managed</Badge>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const RESIZE_STEP = 8;

export function ResizeSeparator({
  className,
  defaultValue,
  edge,
  label,
  max,
  min,
  onChange,
  value,
}: {
  className?: string;
  defaultValue: number;
  edge: "inline-start" | "inline-end";
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  function widthDeltaForPhysicalDelta(element: HTMLElement, physicalDelta: number) {
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
      const delta = widthDeltaForPhysicalDelta(separator, moveEvent.clientX - startX);
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
      if (separator.hasPointerCapture(pointerId)) separator.releasePointerCapture(pointerId);
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
    const physicalDelta = event.key === "ArrowRight" ? RESIZE_STEP : -RESIZE_STEP;
    onChange(
      clamp(
        value + widthDeltaForPhysicalDelta(event.currentTarget, physicalDelta),
        min,
        max,
      ),
    );
  }

  return (
    <div
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemax={max}
      aria-valuemin={min}
      aria-valuenow={value}
      aria-valuetext={`${value} pixels`}
      className={cn("dt-settings-resizer", className)}
      onDoubleClick={() => onChange(defaultValue)}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      role="separator"
      tabIndex={0}
    />
  );
}
