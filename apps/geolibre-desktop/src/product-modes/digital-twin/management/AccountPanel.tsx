import { Badge, Button } from "@geolibre/ui";
import { accountRoleLabel, type DigitalTwinAccessContext } from "../access";
import {
  featureName,
  type Account,
  type Organization,
  type Plan,
} from "./client";
import { ExtensionsPanel } from "./TrialsPanel";
import {
  QueryState,
  Section,
  useManagementQuery,
  type RunAction,
} from "./shared";
interface OwnAccount {
  account: Account;
  organization: (Organization & { is_trial: boolean }) | null;
  plan: Plan | null;
  features: string[];
  access_state: string;
  usage: null | {
    enforced: boolean;
    cpu_used_seconds: number;
    cpu_hours: number;
    storage_bytes: number;
    storage_used_bytes: number | null;
    storage_enforced: boolean;
    active_runs: number;
  };
}
export function AccountPanel({
  access,
  revision,
  refresh,
  run,
  busy,
}: {
  access: DigitalTwinAccessContext;
  revision: number;
  refresh: () => void;
  run: RunAction;
  busy: boolean;
}) {
  const query = useManagementQuery<OwnAccount>("/me", revision);
  return (
    <div className="space-y-6">
      <Section
        title="Your account"
        description="Your plan and account eligibility are checked by the service on every protected request."
      >
        <QueryState {...query} onRefresh={refresh} />
        {query.data ? (
          <>
            <p className="font-medium">
              {query.data.account.first_name} {query.data.account.last_name}
            </p>
            <p className="text-sm text-muted-foreground">
              {query.data.account.email}
            </p>
            <Badge variant="secondary">
              {accountRoleLabel(query.data.account.role)}
            </Badge>
            {query.data.organization ? (
              <p className="text-sm">
                {query.data.organization.name} · Expires{" "}
                {new Date(query.data.organization.expires_at).toLocaleString()}
              </p>
            ) : null}
            <p className="text-sm">
              Plan: {query.data.plan?.name ?? "No product plan"}
            </p>
            {query.data.plan ? (
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <p className="tabular-nums">
                  Compute allowance: {query.data.plan.cpu_hours} cumulative
                  hours per user
                </p>
                <p className="tabular-nums">
                  Storage allowance:{" "}
                  {query.data.plan.storage_bytes.toLocaleString()} bytes per
                  user
                </p>
              </div>
            ) : null}
            {query.data.usage ? (
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <p className="tabular-nums">
                  Compute used:{" "}
                  {(query.data.usage.cpu_used_seconds / 3600).toFixed(2)}{" "}
                  elapsed hours
                </p>
                <p className="tabular-nums">
                  Storage used:{" "}
                  {query.data.usage.storage_used_bytes === null
                    ? "Not measured"
                    : `${query.data.usage.storage_used_bytes.toLocaleString()} bytes`}
                </p>
                <p className="tabular-nums">
                  Active simulations: {query.data.usage.active_runs}
                </p>
                <p className="text-muted-foreground">
                  {query.data.usage.enforced
                    ? "Cumulative compute allowance is enforced."
                    : "Compute allowance is not enforced."}
                </p>
                <p className="sm:col-span-2 text-muted-foreground">
                  {query.data.usage.storage_enforced
                    ? "Storage allowance is enforced for uploads."
                    : "Storage allowance is configured; upload admission is not enforced."}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Measured usage is currently unavailable. Allowances above
                describe the current plan.
              </p>
            )}
            <p className="max-w-prose text-sm text-muted-foreground">
              Enabled features:{" "}
              {query.data.features.map(featureName).join(", ") || "None"}
            </p>
          </>
        ) : null}
        <Button asChild variant="outline">
          <a href="/api/digital-twin/sign-in">Account recovery and sign in</a>
        </Button>
      </Section>
      {query.data?.organization?.is_trial && access.accessState === "active" ? (
        <ExtensionsPanel
          trial
          revision={revision}
          refresh={refresh}
          run={run}
          busy={busy}
        />
      ) : null}
    </div>
  );
}
