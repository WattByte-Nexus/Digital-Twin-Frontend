# AWS frontend deployment

GitHub Actions builds and tests the web application, retains the exact artifact,
then deploys that artifact to Amplify Hosting. PRs build/test without AWS access.
Pushes and manual runs on `main` deploy through an exact-repository/main GitHub
OIDC role. There are no long-lived AWS credentials in GitHub.
The inherited GitHub Pages/demo and Cloudflare preview deployment workflows
have been removed; this is the frontend's deployment path.

## Resource ownership

- `hosting.yaml`: Amplify application and main branch, invitation-only Cognito
  pool/client/group, Secrets Manager session signing key, and the narrow GitHub
  deployment role.
- `api-edge.yaml`: HTTPS Application Load Balancer, ACM certificate, DNS and a second subnet.
  The listener starts with a fixed 503 response and is enabled only after protected
  Engine startup and network configuration have been verified.
- The sibling Infrastructure repository's Engine stack owns the private Fargate
  service, IP target group, task security group, and API authentication permissions.
  API tasks allow port 8000 from the load balancer security group. The frontend
  stack owns every ALB egress rule, limited to the API task security group.
  Never open port 8000 to the Internet. The load balancer accepts public
  HTTPS; the Engine requires Cognito sessions for every non-health API route.
  Amplify's managed reverse proxy must be able to reach this HTTPS endpoint.
- The Engine repository owns Cognito session validation and authorization.
  Enable `application.api_access.mode: verified_host` and configure `cognito`
  using this stack's public output identifiers. AWS credentials retrieve secret
  values inside the Engine. The frontend never receives OAuth tokens or secrets.

Amplify proxies `/api/*` to the HTTPS API origin. The load balancer forwards to
the private Fargate IP target group. API cookies and query strings are forwarded, and protected
responses specify `private, no-store`. The service worker excludes `/api/*`
navigation so OAuth callbacks reach the server. SPA deep links serve index.html.

## Provisioning

Use AWS region `us-east-1` and account `078183419290`. Review CloudFormation
changes before updating an existing deployment. Neither ordinary GitHub release
job has permission to create or change infrastructure. Supply the current target
group ARN and task security group ID from Infrastructure's `independent_api`
output. Both are required. `EngineSubnetId` retains the existing first ALB subnet;
it does not select an EC2 API instance.

```sh
rtk aws cloudformation deploy --stack-name digital-twin-api-load-balancer \
  --template-file deployment/api-edge.yaml \
  --parameter-overrides VpcId=vpc-05fee57a83f4119ca \
    EngineSubnetId=subnet-004a52aa9c89f52ce PublicRouteTableId=rtb-08a0ad21251c4f05e \
    HostedZoneId=Z02611002UN2XT68XWGT0 \
    ApiDomain=api.nexus.ipss.ai EnableApi=false \
    FargateTargetGroupArn="$FARGATE_TARGET_GROUP_ARN" \
    FargateSecurityGroupId="$FARGATE_SECURITY_GROUP_ID" \
  --region us-east-1 --no-execute-changeset

rtk aws cloudformation deploy --stack-name digital-twin-frontend \
  --template-file deployment/hosting.yaml \
  --capabilities CAPABILITY_NAMED_IAM --region us-east-1 --no-execute-changeset
```

`ApiOrigin` may be omitted during bootstrap. Set it to the API-edge stack's
`ApiOrigin` output after authentication is installed. If using a custom domain,
set `PublicOrigin` to its HTTPS origin. The stack associates that hostname with
the Amplify `main` branch and provisions an Amplify-managed TLS certificate.
Amplify creates routing and certificate validation records automatically when
the parent domain is in Route 53 in the same AWS account. Register only that
origin in Cognito and the Engine CSRF policy.

The production frontend is `https://digital-twin.wattbyte-nexus.com`:

```sh
rtk aws cloudformation deploy --stack-name digital-twin-frontend \
  --template-file deployment/hosting.yaml \
  --parameter-overrides ApiOrigin=https://api.nexus.ipss.ai \
    PublicOrigin=https://digital-twin.wattbyte-nexus.com \
  --capabilities CAPABILITY_NAMED_IAM --region us-east-1 --no-execute-changeset
```

When changing its hostname, also update the Cognito `frontend_origin` in the
Engine's API task configuration, release the updated API task, and set the repository's
`FRONTEND_URL` Actions variable to the same origin. The deployment smoke check
verifies that Cognito redirects back to that origin.

## GitHub configuration

Set repository Actions variables from the hosting stack outputs:

| Variable | Source |
| --- | --- |
| `FRONTEND_AWS_REGION` | `us-east-1` |
| `FRONTEND_AMPLIFY_APP_ID` | `AppId` |
| `FRONTEND_DEPLOY_ROLE_ARN` | `DeployRoleArn` |
| `FRONTEND_URL` | `FrontendUrl` |

Browser mapping integrations use the existing `VITE_MAPBOX_ACCESS_TOKEN`,
`VITE_GOOGLE_MAPS_API_KEY`, `VITE_CESIUM_TOKEN`, `VITE_GEE_OAUTH_CLIENT_ID`,
`VITE_PROTOMAPS_API_KEY` and `VITE_MAPILLARY_ACCESS_TOKEN` repository secrets.
They are public browser credentials once bundled; restrict their provider-side
origins appropriately. Never add Engine credentials to Vite variables.

The deployment workflow runs the pinned Engine contract check, lint, frontend
tests, worker type checks, and TypeScript/Vite production build with JupyterLite.
It records the commit and workflow run in `/deployment.json`, waits for Amplify
success, then verifies the deployed revision, SPA route, Engine readiness,
unauthenticated denial and Cognito code/PKCE redirect. A job that fails any
check is not reported as a successful release.

## Login and operations

There is no self-registration. Create Cognito users explicitly and assign the
`nexus-administrators` group for this single-organization deployment. The Engine
returns the current region catalog as the user's authorized scope. Private
point-cloud datasets additionally need an Engine permission for the Cognito
subject; the group never bypasses dataset authorization.

API replicas share DynamoDB sessions for at most one hour. Logout revokes the
session before redirecting through Cognito. Removing group membership prevents
new sessions; revoke existing DynamoDB sessions when immediate removal is needed.
Application deployments preserve the runtime configuration and session store.

To roll back frontend code, revert the faulty commit on main and let the same
checks rebuild and deploy it. A manual retry of a workflow redeploys its exact
artifact. Inspect the Amplify job ID in the workflow summary when a deployment
times out; cancelling a workflow does not cancel an already accepted AWS job.

Infrastructure checks:

```sh
cfn-lint deployment/api-edge.yaml deployment/hosting.yaml
bash -n scripts/deploy-amplify.sh
```

## Independent API operations

The frontend is hosted at https://main.dbv0kjyl8w1at.amplifyapp.com, with
same-origin API requests forwarded to `https://api.nexus.ipss.ai`. The API
load balancer accepts public HTTPS; API tasks accept port 8000 only from its
security group. Keep `EnableApi=true` for
the active `digital-twin-api-load-balancer` stack when updating it.

Session cookies are Secure/HttpOnly and API responses remain `private, no-store`.

Infrastructure's Engine stack owns the independent ECS service, private task
network, task security group and IP target group. This frontend stack continues
to own the existing ALB/listener/DNS/certificate and every ALB egress rule.

The API task role receives narrowly scoped Cognito and signing-secret access
from Infrastructure. The EC2 worker has no hosted-session authentication role.
Never commit initial user passwords or session keys. API release rollback uses
a previous verified cloud task definition and preserves the shared cloud state.

## Final cutover cleanup

Apply these final templates only after signed-in browser, streaming, replica
replacement and public Fargate routing acceptance have passed. Prepare and review
separate change sets before execution:

- API edge: remove the retired instance target group and its ALB egress, leaving
  the current private Fargate route and egress. Preserve the ALB, certificate,
  DNS, subnets and existing listener identity. The template requires the current
  Fargate target group and task security group; it has no migration switch or
  diagnostic header route.
- Hosting: remove only the retired host authentication policy and its unused
  role parameter. Preserve Cognito users/client/group, signing secret, Amplify
  application/branch/domain, GitHub deployment role, and `/api/*` forwarding.

Retain existing values for every remaining stack parameter. Reject any change set
that replaces a resource or changes shared authentication, domain or ALB resources
outside this cleanup. Keep `api.nexus.ipss.ai` and Amplify's `/api/*` origin
unchanged. The Infrastructure `engine/independent-api.md` documents cloud API
release ownership and recovery.
