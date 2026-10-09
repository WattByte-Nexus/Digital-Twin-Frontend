import { useId, type ReactNode } from "react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Label } from "./label";
import { cn } from "../lib/utils";

/** A settings section whose rows respond to the available content width. */
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
  const titleId = useId();
  return (
    <Card
      aria-labelledby={titleId}
      className="@container/settings-card gap-0 rounded-lg border border-border py-0 shadow-none"
    >
      <CardHeader className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <CardTitle>
            <h3 id={titleId} className="text-sm leading-5">
              {title}
            </h3>
          </CardTitle>
          {description ? (
            <CardDescription className="max-w-[65ch] text-xs leading-relaxed">
              {description}
            </CardDescription>
          ) : null}
        </div>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className="divide-y divide-border px-5">{children}</CardContent>
    </Card>
  );
}

export function SettingRow({
  children,
  description,
  htmlFor,
  label,
  labelId,
  inline = false,
}: {
  children: ReactNode;
  description?: string;
  htmlFor?: string;
  label: string;
  labelId?: string;
  inline?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-3 py-4",
        inline
          ? "grid-cols-[minmax(0,1fr)_auto] items-center"
          : "@md/settings-card:grid-cols-[minmax(0,1fr)_auto] @md/settings-card:items-center",
      )}
    >
      <div className="min-w-0 space-y-1">
        {htmlFor ? (
          <Label className="cursor-pointer text-sm leading-5" htmlFor={htmlFor} id={labelId}>
            {label}
          </Label>
        ) : (
          <p className="text-sm font-medium leading-5" id={labelId}>
            {label}
          </p>
        )}
        {description ? (
          <p className="max-w-[65ch] text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-3 @md/settings-card:max-w-xs @md/settings-card:justify-end">
        {children}
      </div>
    </div>
  );
}
