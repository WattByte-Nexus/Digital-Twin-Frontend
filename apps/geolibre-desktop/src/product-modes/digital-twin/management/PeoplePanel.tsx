import {
  Badge,
  Button,
  Label,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@geolibre/ui";
import { useId, useState } from "react";
import {
  accountRoleLabel,
  DIGITAL_TWIN_ROLES,
  type DigitalTwinRole,
} from "../access";
import {
  accountStatus,
  canResendInvitation,
  type Account,
  type Collection,
  type Department,
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

interface TenantWorkspace {
  organization: Organization;
  plan: Plan;
  users: Account[];
  departments: Department[];
}
export function DepartmentSelect({
  departments,
  defaultValue = "",
}: {
  departments: Department[];
  defaultValue?: string;
}) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Department</Label>
      <Select id={id} name="department_id" defaultValue={defaultValue}>
        <option value="" disabled>
          Select a department
        </option>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
function PersonRow({
  person,
  departments,
  basePath,
  run,
  busy,
}: {
  person: Account;
  departments: Department[];
  basePath: string;
  run: RunAction;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <TableRow>
      <TableCell>
        <span className="font-medium">
          {person.first_name} {person.last_name}
        </span>
        <p className="text-xs text-muted-foreground">{person.email}</p>
        {editing ? (
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const values = formValues(event.currentTarget);
              void run(`${basePath}/${person.id}`, {
                version: person.version,
                first_name: values.first_name,
                last_name: values.last_name,
                ...(basePath === "/tenant-users"
                  ? { department_id: values.department_id }
                  : { role: values.role }),
              }).then((ok) => {
                if (ok) setEditing(false);
              });
            }}
          >
            <Field
              label="First name"
              name="first_name"
              defaultValue={person.first_name}
            />
            <Field
              label="Last name"
              name="last_name"
              defaultValue={person.last_name}
            />
            {basePath === "/tenant-users" ? (
              <DepartmentSelect
                departments={departments}
                defaultValue={person.department_id ?? ""}
              />
            ) : (
              <StaffRoleSelect defaultValue={person.role} />
            )}
            <div className="flex gap-2">
              <Button disabled={busy} type="submit">
                Save person
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(false)}
              >
                Cancel edit
              </Button>
            </div>
          </form>
        ) : null}
      </TableCell>
      <TableCell>{accountRoleLabel(person.role)}</TableCell>
      <TableCell>
        <Badge variant="secondary">{accountStatus(person)}</Badge>
        <InvitationDeliveryStatus delivery={person.invitation_delivery} />
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setEditing(!editing)}
          >
            Edit
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(`${basePath}/${person.id}/state`, {
                version: person.version,
                suspended: !person.suspended,
              })
            }
          >
            {person.suspended ? "Reactivate" : "Suspend"}
          </Button>
          {person.activation_state === "invited" ? (
            <Button
              variant="outline"
              disabled={busy || !canResendInvitation(person)}
              onClick={() =>
                void run(`${basePath}/${person.id}/resend-invitation`, {
                  version: person.version,
                })
              }
            >
              Resend invitation
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
export function PeoplePanel({
  tenant = false,
  revision,
  refresh,
  run,
  busy,
}: {
  tenant?: boolean;
  revision: number;
  refresh: () => void;
  run: RunAction;
  busy: boolean;
}) {
  const query = useManagementQuery<TenantWorkspace | Collection<Account>>(
    tenant ? "/tenant-workspace" : "/staff",
    revision
  );
  const people = query.data
    ? "users" in query.data
      ? query.data.users
      : query.data.items
    : [];
  const departments =
    query.data && "departments" in query.data ? query.data.departments : [];
  const basePath = tenant ? "/tenant-users" : "/staff";
  return (
    <div className="space-y-6">
      <Section
        title={tenant ? "Organization users" : "Administrative staff"}
        description={
          tenant
            ? "Product users inherit your organization's plan. Invitations and suspension are independent states."
            : "Staff accounts manage the service. They do not receive access to customer workspaces."
        }
      >
        <QueryState {...query} empty={!people.length} onRefresh={refresh} />
        {people.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Account role</TableHead>
                <TableHead>Eligibility</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((person) => (
                <PersonRow
                  key={`${person.id}-${person.version}`}
                  person={person}
                  departments={departments}
                  basePath={basePath}
                  run={run}
                  busy={busy}
                />
              ))}
            </TableBody>
          </Table>
        ) : null}
      </Section>
      <Section
        title={tenant ? "Invite product user" : "Invite staff member"}
        description="An email invitation lets the recipient set up their own account."
      >
        <form
          key={revision}
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const values = formValues(form);
            void run(basePath, {
              first_name: values.first_name,
              last_name: values.last_name,
              email: values.email,
              ...(tenant
                ? { department_id: values.department_id }
                : { role: values.role }),
            }).then((ok) => {
              if (ok) form.reset();
            });
          }}
        >
          <Field label="First name" name="first_name" />
          <Field label="Last name" name="last_name" />
          <Field label="Email" name="email" type="email" />
          {tenant ? (
            <DepartmentSelect departments={departments} />
          ) : (
            <StaffRoleSelect />
          )}
          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={
                busy ||
                query.loading ||
                Boolean(query.error) ||
                (tenant && departments.length === 0)
              }
            >
              Send invitation
            </Button>
          </div>
        </form>
      </Section>
      {tenant ? (
        <DepartmentsPanel
          departments={departments}
          run={run}
          busy={busy || query.loading || Boolean(query.error)}
        />
      ) : null}
    </div>
  );
}
function StaffRoleSelect({
  defaultValue = "WEB_TRIAL_ADMIN",
}: {
  defaultValue?: DigitalTwinRole;
}) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Staff role</Label>
      <Select id={id} name="role" defaultValue={defaultValue}>
        {DIGITAL_TWIN_ROLES.filter((role) => !role.startsWith("TENANT_")).map(
          (role) => (
            <option key={role} value={role}>
              {accountRoleLabel(role)}
            </option>
          )
        )}
      </Select>
    </div>
  );
}
function DepartmentsPanel({
  departments,
  run,
  busy,
}: {
  departments: Department[];
  run: RunAction;
  busy: boolean;
}) {
  return (
    <Section
      title="Departments"
      description="Departments organize people without changing their permissions. A department with assigned users cannot be deleted."
    >
      {departments.map((department) => (
        <form
          key={`${department.id}-${department.version}`}
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run(`/tenant-departments/${department.id}`, {
              version: department.version,
              name: formValues(event.currentTarget).name,
            });
          }}
        >
          <Field
            label="Department name"
            name="name"
            defaultValue={department.name}
          />
          <Button type="submit" disabled={busy} variant="outline">
            Rename
          </Button>
          <Button
            type="button"
            disabled={busy}
            variant="outline"
            onClick={() =>
              void run(`/tenant-departments/${department.id}/delete`, {
                version: department.version,
              })
            }
          >
            Delete {department.name}
          </Button>
        </form>
      ))}
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          void run("/tenant-departments", { name: formValues(form).name }).then(
            (ok) => {
              if (ok) form.reset();
            }
          );
        }}
      >
        <Field label="New department" name="name" />
        <Button disabled={busy} type="submit">
          Add department
        </Button>
      </form>
    </Section>
  );
}
