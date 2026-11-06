# Digital Twin access projection

The shell resolves identity, account role, organization, plan features, lifecycle
restrictions, and exact regional actions before mounting protected product data.
The Engine resolves current authority on protected requests. A role name, hidden
control, browser setting, or URL never supplies a product grant.

Production sends a credentialed, non-cacheable `GET /api/digital-twin/access`.
`VITE_DIGITAL_TWIN_ACCESS_URL` can select another same-origin path. Sign-in uses
`/api/digital-twin/sign-in`, optionally selected through
`VITE_DIGITAL_TWIN_SIGN_IN_URL`. Return values contain a local pathname without
protected labels, cached data, or external redirect destinations.

```json
{
  "subject_id": "verified-cognito-subject",
  "account_id": "application-account-id",
  "display_name": "Alex Operator",
  "organization": { "id": "utility-1", "name": "Front Range Utility" },
  "roles": ["TENANT_USER"],
  "capabilities": ["digital-twin", "expert-gis"],
  "permissions": ["region:read", "scenarios:create", "runs:submit", "expert-gis"],
  "access_state": "active",
  "plan": {
    "id": "standard",
    "name": "Standard",
    "kind": "STANDARD",
    "cpu_hours": 20,
    "storage_bytes": 500000000
  },
  "regions": [
    {
      "id": "boulder-co",
      "name": "Boulder",
      "actions": ["region:read", "scenarios:create", "runs:submit"]
    }
  ],
  "most_recently_used_region_id": "boulder-co",
  "saved_start_location": "digital-twin"
}
```

Each account has one fixed role: `PLATFORM_SUPER_ADMIN`, `WEB_TRIAL_ADMIN`,
`DESKTOP_TRIAL_ADMIN`, `TENANT_ADMIN`, or `TENANT_USER`. Web trial users use
`TENANT_USER` with a trial organization and Trial plan. Staff have
`organization: null`, `plan: null`, no product permissions, and no product regions.
Tenant administrators also receive no product permissions or regions.

Workspace capabilities are derived navigation:

- `administration`: the selected staff role's management workspace;
- `tenant-administration`: ordinary tenant-user and department management;
- `expired-tenant-access`: the expired tenant administrator's extension screen;
- `digital-twin`: eligible product map/read access; and
- `expert-gis`: the enabled advanced-workspace feature.

Concrete regional actions govern individual product controls and requests.
Account administration does not authorize regional data mutation or cancellation.
Ordinary users inherit the current organization plan; departments do not alter
entitlements. Private point-cloud permissions remain an additional server check.
An eligible product user with `region:create` can enter `/data` to create an
organization-owned first region even when no regional map is available.

`access_state` is `active` or `organization-expired`. The expiry exception is
limited to tenant administrators. Unactivated, suspended, expired trial, and
otherwise ineligible accounts receive denial instead of product scope.

Responses use `200` for a validated projection, `401` for missing/expired sessions,
`403` for ineligible accounts or denied access, and `503` when account authority
is unavailable. Protected responses are private and non-cacheable. Role/plan
changes apply on subsequent requests; long responses also recheck session/grants.
Browser access refresh clears newly inaccessible content.

Vite development selects explicit local product permissions using only regions
returned by its configured Engine. `VITE_DIGITAL_TWIN_DEV_REGION_ID` narrows that
scope; unknown IDs fail resolution. `VITE_DIGITAL_TWIN_DEV_ACCESS=0` exercises
the real hosted endpoint. Production excludes the development projection.

See the [roles feature plan](digital-twin-roles-and-permissions-plan.md) and
[deployment setup](../deployment/README.md). The group-based blanket grant and
old operational-persona account roles are removed from authorization.
