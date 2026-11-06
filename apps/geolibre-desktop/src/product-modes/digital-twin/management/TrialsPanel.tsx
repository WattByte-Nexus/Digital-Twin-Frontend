import {
  Badge,
  Button,
  Checkbox,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@geolibre/ui";
import { useId } from "react";
import {
  accountStatus,
  canResendInvitation,
  featureName,
  type Account,
  type Collection,
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
interface Application {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  organization_name: string;
  reason: string;
  status: "PENDING" | "UNDER_EVALUATION" | "APPROVED" | "REJECTED";
  owner_id: string | null;
  version: number;
  created_at: string;
  decision_message: string | null;
  provisioned_account_id: string | null;
}
function ApplicationCard({
  application,
  accountId,
  run,
  busy,
  canProvision,
}: {
  application: Application;
  canProvision: boolean;
  accountId: string;
  run: RunAction;
  busy: boolean;
}) {
  const confirmationId = useId();
  const own = application.owner_id === accountId;
  const path = `/applications/${application.id}`;
  return (
    <Section
      title={`${application.first_name} ${application.last_name}`}
      description={`${application.organization_name} · ${application.email}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary">
          {application.status.replaceAll("_", " ")}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {application.owner_id
            ? own
              ? "Assigned to you"
              : "Assigned to another reviewer"
            : "Unassigned"}
        </span>
      </div>
      <p className="max-w-prose whitespace-pre-wrap text-sm">
        {application.reason}
      </p>
      {application.decision_message ? (
        <p className="text-sm text-muted-foreground">
          Decision: {application.decision_message}
        </p>
      ) : null}
      {!application.owner_id && application.status === "PENDING" ? (
        <Button
          disabled={busy}
          onClick={() =>
            void run(`${path}/claim`, { version: application.version })
          }
        >
          Claim application
        </Button>
      ) : null}
      {own &&
      (application.status === "UNDER_EVALUATION" ||
        application.status === "PENDING") ? (
        <div className="space-y-5">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(`${path}/release`, { version: application.version })
            }
          >
            Release application
          </Button>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void run(`${path}/transfer`, {
                version: application.version,
                owner_id: formValues(event.currentTarget).owner_id,
              });
            }}
          >
            <Field label="Transfer to reviewer account ID" name="owner_id" />
            <Button type="submit" variant="outline" disabled={busy}>
              Transfer review
            </Button>
          </form>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const submitter = (event.nativeEvent as SubmitEvent)
                .submitter as HTMLButtonElement;
              void run(`${path}/decision`, {
                version: application.version,
                approved: submitter.value === "approve",
                message: formValues(event.currentTarget).message,
              });
            }}
          >
            <Field label="Decision message" name="message" maxLength={2000} />
            <div className="flex gap-3">
              <Button
                name="decision"
                value="approve"
                type="submit"
                disabled={busy}
              >
                Approve application
              </Button>
              <Button
                name="decision"
                value="reject"
                type="submit"
                variant="outline"
                disabled={busy}
              >
                Reject application
              </Button>
            </div>
          </form>
        </div>
      ) : null}
      {own &&
      application.status === "APPROVED" &&
      !application.provisioned_account_id ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const values = formValues(event.currentTarget);
            void run(`${path}/provision`, {
              version: application.version,
              duration_days: Number(values.duration_days),
              confirmed: values.confirmed === "on",
            });
          }}
        >
          <p className="max-w-prose text-sm text-muted-foreground">
            Provisioning invites this recipient to the Trial plan. Trial time
            starts when the recipient activates the account.
          </p>
          <Field
            label="Trial duration in days"
            name="duration_days"
            type="number"
            min={1}
            defaultValue={30}
          />
          <div className="flex min-h-11 items-center gap-2">
            <Checkbox id={confirmationId} name="confirmed" required />
            <Label htmlFor={confirmationId}>
              I reviewed the recipient, Trial plan, and duration.
            </Label>
          </div>
          <Button type="submit" disabled={busy || !canProvision}>
            Confirm provisioning and send invitation
          </Button>
        </form>
      ) : null}
      {application.provisioned_account_id ? (
        <p className="text-sm text-primary">
          Account provisioned. Manage invitation and suspension from Trial
          users.
        </p>
      ) : null}
    </Section>
  );
}
function TrialPlanSummary({ plan }: { plan: Plan }) {
  return (
    <Section
      title={`${plan.name} plan`}
      description="This live plan applies to provisioned web trial users. Time begins when the recipient activates the invitation."
    >
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <p className="tabular-nums">
          {plan.cpu_hours} cumulative compute hours per user
        </p>
        <p className="tabular-nums">
          {plan.storage_bytes.toLocaleString()} storage bytes per user
        </p>
      </div>
      <p className="max-w-prose text-sm text-muted-foreground">
        Features: {plan.features.map(featureName).join(", ") || "None enabled"}
      </p>
    </Section>
  );
}
export function ApplicationsPanel({
  accountId,
  revision,
  refresh,
  run,
  busy,
}: {
  accountId: string;
  revision: number;
  refresh: () => void;
  run: RunAction;
  busy: boolean;
}) {
  const query = useManagementQuery<Collection<Application>>(
    "/applications",
    revision
  );
  const trialPlan = useManagementQuery<Plan>("/trial-plan", revision);
  return (
    <div className="space-y-6">
      <QueryState {...trialPlan} onRefresh={refresh} />
      {trialPlan.data ? <TrialPlanSummary plan={trialPlan.data} /> : null}
      <p className="max-w-prose text-sm text-muted-foreground">
        Claim an application explicitly before reviewing. Approval does not
        create an account; provisioning requires a separate confirmation.
      </p>
      <QueryState
        {...query}
        empty={!query.data?.items.length}
        onRefresh={refresh}
      />
      {query.data?.items.map((application) => (
        <ApplicationCard
          application={application}
          key={`${application.id}-${application.version}`}
          accountId={accountId}
          canProvision={
            Boolean(trialPlan.data) && !trialPlan.loading && !trialPlan.error
          }
          run={run}
          busy={busy}
        />
      ))}
    </div>
  );
}
interface TrialAccount extends Account {
  organization: { effective_at: string | null; expires_at: string | null };
}

export function TrialUsersPanel({
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
  const query = useManagementQuery<Collection<TrialAccount>>(
    "/trial-users",
    revision
  );
  const trialPlan = useManagementQuery<Plan>("/trial-plan", revision);
  return (
    <div className="space-y-6">
      <Section
        title="Web trial users"
        description="Invitations, account suspension, and trial expiry are separate conditions. Expired trials must be extended before reactivation."
      >
        <QueryState
          {...query}
          empty={!query.data?.items.length}
          onRefresh={refresh}
        />
        {query.data?.items.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Account state</TableHead>
                <TableHead>Trial validity</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.items.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>
                    {account.first_name} {account.last_name}
                    <p className="text-xs text-muted-foreground">
                      {account.email}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{accountStatus(account)}</Badge>
                    <InvitationDeliveryStatus
                      delivery={account.invitation_delivery}
                    />
                  </TableCell>
                  <TableCell>
                    {account.organization.expires_at ? (
                      <>
                        <p className="text-sm">
                          {new Date(account.organization.expires_at) <=
                          new Date()
                            ? "Expired"
                            : "Expires"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(
                            account.organization.expires_at
                          ).toLocaleString()}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Duration starts at activation
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void run(`/trial-users/${account.id}/state`, {
                            version: account.version,
                            suspended: !account.suspended,
                          })
                        }
                      >
                        {account.suspended ? "Reactivate" : "Suspend"}
                      </Button>
                      {account.activation_state === "invited" ? (
                        <Button
                          variant="outline"
                          disabled={busy || !canResendInvitation(account)}
                          onClick={() =>
                            void run(
                              `/trial-users/${account.id}/resend-invitation`,
                              { version: account.version }
                            )
                          }
                        >
                          Resend invitation
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </Section>
      <Section
        title="Create direct trial"
        description="Use the same invitation and Trial plan as approved applications. Time begins at activation."
      >
        <QueryState {...trialPlan} onRefresh={refresh} />
        {trialPlan.data ? <TrialPlanSummary plan={trialPlan.data} /> : null}
        <form
          key={revision}
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const values = formValues(form);
            void run("/trial-users/direct", {
              ...values,
              duration_days: Number(values.duration_days),
            }).then((ok) => {
              if (ok) form.reset();
            });
          }}
        >
          <Field label="First name" name="first_name" />
          <Field label="Last name" name="last_name" />
          <Field label="Email" name="email" type="email" />
          <Field label="Organization name" name="organization_name" />
          <Field
            label="Trial duration in days"
            name="duration_days"
            type="number"
            min={1}
            defaultValue={30}
          />
          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={
                busy ||
                query.loading ||
                Boolean(query.error) ||
                trialPlan.loading ||
                Boolean(trialPlan.error) ||
                !trialPlan.data
              }
            >
              Create trial and send invitation
            </Button>
          </div>
        </form>
      </Section>
    </div>
  );
}
interface Extension {
  id: string;
  account_id: string;
  organization_id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  version: number;
  current_expires_at: string | null;
  duration_days?: number;
  requested_expires_at?: string;
  reason?: string;
  message?: string;
  created_at: string;
}
export function ExtensionsPanel({
  trial = false,
  decide = false,
  revision,
  refresh,
  run,
  busy,
}: {
  trial?: boolean;
  decide?: boolean;
  revision: number;
  refresh: () => void;
  run: RunAction;
  busy: boolean;
}) {
  const basePath = trial ? "/trial-extensions" : "/organization-extensions";
  const query = useManagementQuery<Collection<Extension>>(basePath, revision);
  const reasonId = useId();
  return (
    <Section
      title={
        trial ? "Trial access extensions" : "Organization access extensions"
      }
      description={
        decide
          ? "Review requests and record a decision message. Approval extends access without resetting measured compute usage."
          : "One request may be pending at a time. Existing access stays subject to its current expiry until approval."
      }
    >
      <QueryState
        {...query}
        empty={!query.data?.items.length}
        onRefresh={refresh}
      />
      {query.data?.items.map((extension) => (
        <div
          className="space-y-3 border-b border-border pb-5"
          key={`${extension.id}-${extension.version}`}
        >
          <div className="flex flex-wrap gap-3">
            <Badge variant="secondary">{extension.status}</Badge>
            {decide ? (
              <span className="text-sm">{extension.organization_id}</span>
            ) : null}
            <span className="text-sm text-muted-foreground">
              {new Date(extension.created_at).toLocaleDateString()}
            </span>
          </div>
          {extension.reason ? (
            <p className="max-w-prose whitespace-pre-wrap text-sm">
              Request: {extension.reason}
            </p>
          ) : null}
          {extension.message ? (
            <p className="max-w-prose whitespace-pre-wrap text-sm">
              Response: {extension.message}
            </p>
          ) : null}
          {extension.current_expires_at ? (
            <p className="text-sm text-muted-foreground">
              Current access ends:{" "}
              {new Date(extension.current_expires_at).toLocaleString()}
            </p>
          ) : null}
          {extension.requested_expires_at ? (
            <p className="text-sm">
              Requested expiry:{" "}
              {new Date(extension.requested_expires_at).toLocaleString()}
            </p>
          ) : null}
          {decide && extension.status === "PENDING" ? (
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                const values = formValues(event.currentTarget);
                const submitter = (event.nativeEvent as SubmitEvent)
                  .submitter as HTMLButtonElement;
                const approved = submitter.value === "approve";
                void run(`${basePath}/${extension.id}/decision`, {
                  version: extension.version,
                  approved,
                  message: values.message,
                  ...(approved
                    ? trial
                      ? {
                          expires_at: values.expires_at,
                          expected_expires_at: extension.current_expires_at,
                        }
                      : {}
                    : {}),
                });
              }}
            >
              <Field label="Decision message" name="message" maxLength={2000} />
              {trial ? (
                <Field
                  label="Approved expiry (ISO date and time)"
                  name="expires_at"
                  defaultValue={extension.requested_expires_at}
                  required={false}
                />
              ) : (
                <p className="self-center text-sm">
                  Requested duration: {extension.duration_days ?? 365} days
                </p>
              )}
              <div className="flex gap-3 sm:col-span-2">
                <Button type="submit" value="approve" disabled={busy}>
                  Approve extension
                </Button>
                <Button
                  type="submit"
                  value="reject"
                  variant="outline"
                  disabled={busy}
                >
                  Reject extension
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      ))}
      {!decide ? (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const values = formValues(event.currentTarget);
            void run(
              basePath,
              trial
                ? {
                    reason: values.message,
                    requested_expires_at: values.requested_expires_at,
                  }
                : {
                    message: values.message,
                    duration_days: Number(values.duration_days),
                  }
            );
          }}
        >
          {trial ? (
            <Field
              label="Requested expiry (ISO date and time)"
              name="requested_expires_at"
            />
          ) : (
            <Field
              label="Additional access days"
              name="duration_days"
              type="number"
              min={1}
              max={36500}
              defaultValue={365}
            />
          )}
          <div className="grid gap-2">
            <Label htmlFor={reasonId}>
              {trial ? "Reason for extension" : "Message (optional)"}
            </Label>
            <Textarea
              id={reasonId}
              name="message"
              maxLength={2000}
              required={trial}
            />
          </div>
          <Button
            type="submit"
            disabled={
              busy ||
              query.loading ||
              Boolean(query.error) ||
              query.data?.items.some((item) => item.status === "PENDING")
            }
          >
            Request extension
          </Button>
        </form>
      ) : null}
    </Section>
  );
}
