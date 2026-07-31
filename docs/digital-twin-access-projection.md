# Digital Twin access projection

The Digital Twin shell does not mount the GeoLibre workspace until a trusted
application backend resolves the current identity, organization, roles,
capabilities, and authorized regions.

Production builds send a credentialed, non-cacheable `GET` request to
`/api/digital-twin/access`. Set `VITE_DIGITAL_TWIN_ACCESS_URL` at build time to
use another same-origin path. Authentication redirects use
`/api/digital-twin/sign-in`; `VITE_DIGITAL_TWIN_SIGN_IN_URL` may override that
path. The sign-in return value contains the requested pathname only, never a
display label or cached object content.

The successful access projection is:

```json
{
  "subject_id": "entra-subject-id",
  "display_name": "Alex Operator",
  "organization": {
    "id": "utility-1",
    "name": "Front Range Utility"
  },
  "roles": ["operator"],
  "capabilities": ["digital-twin"],
  "regions": [
    { "id": "boulder-co", "name": "Boulder" }
  ],
  "most_recently_used_region_id": "boulder-co",
  "saved_start_location": "digital-twin"
}
```

Recognized roles are `operator`, `supervisor`, `engineer`, `analyst`, and
`administrator`. Recognized capabilities are `digital-twin`, `expert-gis`, and
`administration`. The backend must project capabilities after applying its role
and grant policy; the browser does not infer authorization from a hidden control
or from a role name. Unknown values are ignored.

Responses use these status codes:

- `200`: validated access projection;
- `401`: unauthenticated or expired session;
- `403`: authenticated without product access; and
- other non-success responses: provider or access-resolution unavailable.

All protected Engine and application-backend endpoints must still enforce the
same organization, region, and action policy. The route guard is only the UI
boundary.

Vite development uses a compiled-development-only engineer projection for the
`boulder-co` region. Override its label with
`VITE_DIGITAL_TWIN_DEV_REGION_ID` and `VITE_DIGITAL_TWIN_DEV_REGION_NAME`, or
set `VITE_DIGITAL_TWIN_DEV_ACCESS=0` to exercise the real access endpoint.
Production builds never include this fallback path.
