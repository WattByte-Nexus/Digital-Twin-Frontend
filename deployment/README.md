# AWS frontend deployment

GitHub Actions builds and tests the web application, retains the exact artifact,
then deploys that artifact to Amplify Hosting. PRs build/test without AWS access.
Pushes and manual runs on `main` deploy through an exact-repository/main GitHub
OIDC role. There are no long-lived AWS credentials in GitHub.
The inherited GitHub Pages/demo and Cloudflare preview deployment workflows
have been removed; this is the frontend's deployment path.

## Resource ownership

- `hosting.yaml`: Amplify application and main branch, invitation-only Cognito
  pool/client/group, Secrets Manager session signing key, exact-resource Engine
  authentication permissions, and the narrow GitHub deployment role.
- `api-edge.yaml`: CloudFront HTTPS API endpoint and private EC2 VPC origin.
  The API distribution starts disabled and is enabled only after protected
  Engine startup and network configuration have been verified.
- The sibling Infrastructure repository's Engine stack owns EC2 and its security
  group. Allow port 8000 from the AWS-managed CloudFront VPC-origin security
  group. Never open it to the Internet or all CloudFront public address ranges.
- The Engine repository owns Cognito session validation and authorization.
  Enable `application.api_access.mode: verified_host` and configure `cognito`
  using this stack's public output identifiers. AWS credentials retrieve secret
  values inside the Engine. The frontend never receives OAuth tokens or secrets.

Amplify proxies `/api/*` to the HTTPS API origin. The private connection uses
the instance's private DNS and survives public-IP changes. CloudFront API
caching is disabled, all cookies and query strings are forwarded, and protected
responses specify `private, no-store`. The service worker excludes `/api/*`
navigation so OAuth callbacks reach the server. SPA deep links serve index.html.

## Provisioning

Use AWS region `us-east-1` and account `078183419290`. Review CloudFormation
changes before updating an existing deployment. Neither ordinary GitHub release
job has permission to create or change infrastructure.

```sh
aws cloudformation deploy --stack-name digital-twin-api-edge \
  --template-file deployment/api-edge.yaml \
  --parameter-overrides EngineInstanceId=i-03c49c9209662ec1b \
    EnginePrivateDns=ip-10-82-1-93.ec2.internal EnableApi=false \
  --region us-east-1 --disable-rollback

aws cloudformation deploy --stack-name digital-twin-frontend \
  --template-file deployment/hosting.yaml \
  --capabilities CAPABILITY_NAMED_IAM --region us-east-1
```

`ApiOrigin` may be omitted during bootstrap. Set it to the API-edge stack's
`ApiOrigin` output after authentication is installed. If using a custom domain,
set `PublicOrigin` to its HTTPS origin and configure the Amplify domain/DNS
association. Register only that origin in Cognito and the Engine CSRF policy.

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

The server stores sessions in Redis for at most one hour. Logout revokes the
session before redirecting through Cognito. Removing group membership prevents
new sessions; revoke existing Redis sessions when immediate removal is needed.
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
