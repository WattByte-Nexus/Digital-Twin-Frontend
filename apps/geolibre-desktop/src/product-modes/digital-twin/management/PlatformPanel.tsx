import {
  Badge,
  Button,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Input,
  Label,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@geolibre/ui";
import { ArrowUpRight, Building2, Plus, Search, X } from "lucide-react";
import { useId, useState } from "react";
import {
  accountStatus,
  canResendInvitation,
  featureName,
  type Account,
  type Collection,
  type Organization,
  type Plan,
} from "./client";
import { InvitationDeliveryStatus } from "./InvitationDeliveryStatus";
import {
  Field,
  formValues,
  QueryState,
  Section,
  useManagementQuery,
  type RunAction,
} from "./shared";

interface ProductFeature {
  id: string;
  enabled: boolean;
  is_ai: boolean;
  version: number;
}
export function planPayload(form: HTMLFormElement) {
  const values = formValues(form);
  return {
    name: String(values.name).trim(),
    features: new FormData(form).getAll("features").map(String),
    cpu_hours: Number(values.cpu_hours),
    storage_bytes: Number(values.storage_bytes),
  };
}
function FeatureChoices({
  features = [],
  catalog,
}: {
  features?: string[];
  catalog: ProductFeature[];
}) {
  const id = useId();
  return (
    <fieldset className="space-y-3 sm:col-span-2">
      <legend className="mb-3 text-sm font-medium">Product features</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {catalog.map((feature) => (
          <div key={feature.id} className="flex min-h-11 items-center gap-2">
            <Checkbox
              className="relative before:absolute before:-inset-3.5"
              id={`${id}-${feature.id}`}
              name="features"
              value={featureName(feature.id)}
              defaultChecked={features.includes(feature.id)}
              disabled={!feature.enabled}
            />
            <Label htmlFor={`${id}-${feature.id}`}>
              {featureName(feature.id)}
              {!feature.enabled ? " (unavailable)" : ""}
            </Label>
            {!feature.enabled && features.includes(feature.id) ? (
              <input type="hidden" name="features" value={feature.id} />
            ) : null}
          </div>
        ))}
      </div>
    </fieldset>
  );
}
function PlanEditor({
  plan,
  catalog,
  run,
  busy,
}: {
  plan?: Plan;
  catalog: ProductFeature[];
  run: RunAction;
  busy: boolean;
}) {
  const system = plan && plan.kind !== "CUSTOM";
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const payload = planPayload(form);
        void run(plan ? `/plans/${plan.id}` : "/plans", {
          ...payload,
          ...(plan
            ? {
                version: plan.version,
                ...(system ? { name: plan.name, features: plan.features } : {}),
              }
            : {}),
        }).then((ok) => {
          if (ok && !plan) form.reset();
        });
      }}
    >
      {system ? (
        <p className="sm:col-span-2 text-sm text-muted-foreground">
          {plan.name} is a protected system plan. Only allowances may be
          changed.
        </p>
      ) : (
        <Field label="Plan name" name="name" defaultValue={plan?.name} />
      )}
      <Field
        label="Cumulative compute hours per user"
        name="cpu_hours"
        type="number"
        min={0}
        step="0.1"
        defaultValue={plan?.cpu_hours ?? 20}
      />
      <Field
        label="Storage bytes per user"
        name="storage_bytes"
        type="number"
        min={0}
        step="1"
        defaultValue={plan?.storage_bytes ?? 500000000}
      />
      {system ? (
        <p className="sm:col-span-2 text-sm">
          Features: {plan.features.map(featureName).join(", ") || "None"}
        </p>
      ) : (
        <FeatureChoices features={plan?.features} catalog={catalog} />
      )}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" disabled={busy}>
          {plan ? "Save plan" : "Create custom plan"}
        </Button>
        {plan?.deletable ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(`/plans/${plan.id}/delete`, { version: plan.version })
            }
          >
            Delete plan
          </Button>
        ) : null}
      </div>
    </form>
  );
}
export function PlansPanel({
  revision,
  refresh,
  run,
  busy,
}: {
  revision: number;
  refresh: () => void;
  run: RunAction;
  busy: boolean;
}) {
  const query = useManagementQuery<Collection<Plan>>("/plans", revision);
  const catalog = useManagementQuery<Collection<ProductFeature>>(
    "/features",
    revision
  );
  const blocked =
    busy ||
    query.loading ||
    catalog.loading ||
    Boolean(query.error || catalog.error);
  return (
    <div className="space-y-6">
      <QueryState {...query} onRefresh={refresh} />
      <QueryState {...catalog} onRefresh={refresh} />
      {catalog.data ? (
        <FeatureCatalogPanel
          catalog={catalog.data.items}
          run={run}
          busy={blocked}
        />
      ) : null}
      {query.data?.items.map((plan) => (
        <Section
          key={`${plan.id}-${plan.version}`}
          title={plan.name}
          description={`${plan.kind.toLowerCase()} plan · changes apply to all users inheriting this plan`}
        >
          <PlanEditor
            plan={plan}
            catalog={catalog.data?.items ?? []}
            run={run}
            busy={blocked}
          />
        </Section>
      ))}
      <Section
        title="Create custom plan"
        description="Standard includes enabled non-AI features. Trial includes all enabled features. Custom plans use the features selected here."
      >
        <PlanEditor
          key={revision}
          run={run}
          catalog={catalog.data?.items ?? []}
          busy={blocked}
        />
      </Section>
    </div>
  );
}
function FeatureCatalogPanel({
  catalog,
  run,
  busy,
}: {
  catalog: ProductFeature[];
  run: RunAction;
  busy: boolean;
}) {
  return (
    <Section
      title="Platform feature availability"
      description="Availability applies to every plan immediately. Trial includes all enabled features; Standard includes enabled non-AI features."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {catalog.map((feature) => (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
            key={featureName(feature.id)}
          >
            <div>
              <p className="text-sm font-medium">{featureName(feature.id)}</p>
              <p className="text-xs text-muted-foreground">
                {feature.enabled ? "Enabled" : "Unavailable"}
                {feature.is_ai ? " · AI" : ""}
              </p>
            </div>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(`/features/${feature.id}`, {
                  version: feature.version,
                  enabled: !feature.enabled,
                })
              }
            >
              {feature.enabled ? "Disable" : "Enable"} {featureName(feature.id)}
            </Button>
          </div>
        ))}
      </div>
    </Section>
  );
}
function PlanSelect({
  plans,
  defaultValue,
}: {
  plans: Plan[];
  defaultValue?: string;
}) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Organization plan</Label>
      <Select id={id} name="plan_id" required defaultValue={defaultValue ?? ""}>
        <option value="" disabled>
          Select a plan
        </option>
        {plans
          .filter((plan) => plan.kind !== "TRIAL")
          .map((plan) => (
            <option value={plan.id} key={plan.id}>
              {plan.name}
            </option>
          ))}
      </Select>
    </div>
  );
}
type ManagedOrganization = Organization & {
  region_ids: string[];
  administrator: Account | null;
};
function OrganizationRow({
  organization,
  plans,
  run,
  busy,
}: {
  organization: ManagedOrganization;
  plans: Plan[];
  run: RunAction;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const enabledId = useId();
  return (
    <Section
      title={organization.name}
      description={`Access ends ${new Date(
        organization.expires_at
      ).toLocaleString()}`}
    >
      <div className="flex items-center gap-3">
        <Badge variant="secondary">
          {organization.enabled ? "Enabled" : "Disabled"}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {plans.find((plan) => plan.id === organization.plan_id)?.name ??
            organization.plan_id}
        </span>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => setEditing(!editing)}
        >
          {editing ? "Close edit" : "Edit organization"}
        </Button>
      </div>
      {organization.administrator ? (
        <TenantAdministratorEditor
          key={`${organization.administrator.id}-${organization.administrator.version}`}
          administrator={organization.administrator}
          organizationId={organization.id}
          run={run}
          busy={busy}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Initial administrator details are unavailable.
        </p>
      )}
      {editing ? (
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const values = formValues(event.currentTarget);
            void run(`/organizations/${organization.id}`, {
              version: organization.version,
              name: values.name,
              plan_id: values.plan_id,
              enabled: values.enabled === "on",
              effective_at: String(values.effective_at),
              expires_at: String(values.expires_at),
              region_ids: String(values.region_ids)
                .split(",")
                .map((value) => value.trim())
                .filter(Boolean),
            });
          }}
        >
          <Field
            label="Organization name"
            name="name"
            defaultValue={organization.name}
          />
          <PlanSelect plans={plans} defaultValue={organization.plan_id} />
          <Field
            label="Effective at (ISO date and time)"
            name="effective_at"
            defaultValue={organization.effective_at}
          />
          <Field
            label="Expires at (ISO date and time)"
            name="expires_at"
            defaultValue={organization.expires_at}
          />
          <Field
            label="Authorized region IDs, separated by commas"
            name="region_ids"
            defaultValue={organization.region_ids.join(", ")}
            required={false}
          />
          <div className="flex min-h-11 items-center gap-2">
            <Checkbox
              className="relative before:absolute before:-inset-3.5"
              id={enabledId}
              name="enabled"
              defaultChecked={organization.enabled}
            />
            <Label htmlFor={enabledId}>Organization enabled</Label>
          </div>
          <Button type="submit" disabled={busy}>
            Save organization
          </Button>
        </form>
      ) : null}
    </Section>
  );
}
function TenantAdministratorEditor({
  administrator,
  organizationId,
  run,
  busy,
}: {
  administrator: Account;
  organizationId: string;
  run: RunAction;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const path = `/organizations/${organizationId}/administrator`;
  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <p className="text-sm font-medium">
        Tenant administrator · {administrator.first_name}{" "}
        {administrator.last_name}
      </p>
      <p className="text-sm text-muted-foreground">{administrator.email}</p>
      <Badge variant="secondary">{accountStatus(administrator)}</Badge>
      <InvitationDeliveryStatus delivery={administrator.invitation_delivery} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => setEditing(!editing)}
        >
          {editing ? "Close administrator edit" : "Edit administrator"}
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run(`${path}/state`, {
              version: administrator.version,
              suspended: !administrator.suspended,
            })
          }
        >
          {administrator.suspended
            ? "Reactivate administrator"
            : "Suspend administrator"}
        </Button>
        {administrator.activation_state === "invited" ? (
          <Button
            variant="outline"
            disabled={busy || !canResendInvitation(administrator)}
            onClick={() =>
              void run(`${path}/resend-invitation`, {
                version: administrator.version,
              })
            }
          >
            Resend administrator invitation
          </Button>
        ) : null}
      </div>
      {editing ? (
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const values = formValues(event.currentTarget);
            void run(path, {
              version: administrator.version,
              first_name: values.first_name,
              last_name: values.last_name,
            });
          }}
        >
          <Field
            label="Administrator first name"
            name="first_name"
            defaultValue={administrator.first_name}
          />
          <Field
            label="Administrator last name"
            name="last_name"
            defaultValue={administrator.last_name}
          />
          <Button type="submit" disabled={busy}>
            Save administrator
          </Button>
        </form>
      ) : null}
    </div>
  );
}
export function OrganizationsPanel({
  revision,
  refresh,
  run,
  busy,
}: {
  revision: number;
  refresh: () => void;
  run: RunAction;
  busy: boolean;
}) {
  const [creationRevision, setCreationRevision] = useState<number | null>(null);
  const creating = creationRevision === revision;
  const setCreating = (open: boolean) =>
    setCreationRevision(open ? revision : null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const organizations = useManagementQuery<Collection<ManagedOrganization>>(
    "/organizations",
    revision
  );
  const plans = useManagementQuery<Collection<Plan>>("/plans", revision);
  const records = organizations.data?.items ?? [];
  const visible = records.filter((organization) =>
    organization.name.toLowerCase().includes(search.trim().toLowerCase())
  );
  const selected = records.find(
    (organization) => organization.id === selectedId
  );
  const blocked =
    busy ||
    organizations.loading ||
    plans.loading ||
    Boolean(organizations.error || plans.error);
  return (
    <Collapsible
      open={creating}
      onOpenChange={setCreating}
      className="space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-xs">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search organizations"
            placeholder="Search organizations…"
            className="min-h-11 pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <CollapsibleTrigger asChild>
          <Button className="min-h-11 gap-2" disabled={blocked}>
            {creating ? (
              <X aria-hidden="true" className="size-4" />
            ) : (
              <Plus aria-hidden="true" className="size-4" />
            )}
            {creating ? "Close new organization" : "Create organization"}
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="space-y-5">
        <Section
          title="Create organization"
          description="Set up the organization, then invite the person who will manage its users."
        >
          <form
            key={revision}
            className="max-w-3xl space-y-7"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const values = formValues(form);
              void run("/organizations", {
                name: values.name,
                plan_id: values.plan_id,
                duration_days: Number(values.duration_days),
                region_ids: String(values.region_ids)
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean),
                initial_admin: {
                  first_name: values.first_name,
                  last_name: values.last_name,
                  email: values.email,
                },
              }).then((ok) => {
                if (ok) {
                  form.reset();
                  setCreating(false);
                }
              });
            }}
          >
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-4 text-sm font-semibold">
                Organization details
              </legend>
              <Field
                label="Organization name"
                name="name"
                placeholder="e.g. Mountain West Utilities"
              />
              <PlanSelect plans={plans.data?.items ?? []} />
              <Field
                label="Access duration in days"
                name="duration_days"
                type="number"
                min={1}
                defaultValue={365}
              />
              <Field
                label="Authorized region IDs, separated by commas"
                name="region_ids"
                required={false}
                description="Optional. Assign regions now or update access later."
              />
            </fieldset>
            <fieldset className="grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
              <legend className="mb-2 pr-3 text-sm font-semibold">
                First administrator
              </legend>
              <Field label="Administrator first name" name="first_name" />
              <Field label="Administrator last name" name="last_name" />
              <div className="sm:col-span-2">
                <Field
                  label="Administrator email"
                  name="email"
                  type="email"
                  description="We'll email an invitation so they can set up their account securely."
                />
              </div>
            </fieldset>
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
              <Button type="submit" disabled={blocked}>
                Create organization and invite administrator
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setCreating(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Section>
      </CollapsibleContent>
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <Building2
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <h3 className="text-sm font-semibold">All organizations</h3>
          <Badge variant="secondary" className="ml-1 tabular-nums">
            {records.length}
          </Badge>
        </div>
        <div className={!visible.length ? "p-5" : ""}>
          <QueryState
            {...organizations}
            empty={!records.length}
            emptyTitle="No organizations yet"
            emptyDescription="Create your first organization to assign a plan and invite its administrator."
            onRefresh={refresh}
          />
          <QueryState {...plans} onRefresh={refresh} />
          {visible.length ? (
            <Table className="[&_td]:py-4 [&_th]:h-11 [&_th]:bg-surface-subtle/60">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Organization</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Access ends</TableHead>
                  <TableHead>Regions</TableHead>
                  <TableHead className="text-right pr-5">Manage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((organization) => (
                  <TableRow key={organization.id}>
                    <TableCell className="pl-5">
                      <p className="font-medium">{organization.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {organization.administrator?.email ??
                          "Administrator pending"}
                      </p>
                    </TableCell>
                    <TableCell>
                      {plans.data?.items.find(
                        (plan) => plan.id === organization.plan_id
                      )?.name ?? organization.plan_id}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={organization.enabled ? "secondary" : "outline"}
                      >
                        {organization.enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                      {new Date(organization.expires_at).toLocaleDateString(
                        undefined,
                        { month: "short", day: "numeric", year: "numeric" }
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {organization.region_ids.length}
                    </TableCell>
                    <TableCell className="pr-5 text-right">
                      <Button
                        variant="ghost"
                        className="min-h-11 gap-2"
                        onClick={() =>
                          setSelectedId(
                            selectedId === organization.id
                              ? undefined
                              : organization.id
                          )
                        }
                        aria-expanded={selectedId === organization.id}
                        aria-label={`Manage ${organization.name}`}
                      >
                        Manage
                        <ArrowUpRight aria-hidden="true" className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : records.length && !organizations.loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No organizations match “{search}”.{" "}
              <Button variant="link" onClick={() => setSearch("")}>
                Clear search
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      {selected ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              className="gap-2"
              onClick={() => setSelectedId(undefined)}
            >
              <X aria-hidden="true" className="size-4" />
              Close organization details
            </Button>
          </div>
          <OrganizationRow
            key={`${selected.id}-${selected.version}`}
            organization={selected}
            plans={plans.data?.items ?? []}
            run={run}
            busy={blocked}
          />
        </div>
      ) : null}
    </Collapsible>
  );
}
