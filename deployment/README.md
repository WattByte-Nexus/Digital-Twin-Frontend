# AWS frontend deployment

GitHub Actions builds and tests the web application, retains the exact artifact,
then deploys that artifact to Amplify Hosting. PRs build/test without AWS access.
Pushes and manual runs on `main` and `develop` deploy to their matching branches
in separate Amplify applications through separate GitHub OIDC roles. GitHub records deployments under
the `production` and `development` environments, including the live URL and final
deployment status. There are no long-lived AWS credentials in GitHub.
The inherited GitHub Pages/demo and Cloudflare preview deployment workflows
have been removed; this is the frontend's deployment path.

## Resource ownership

- `hosting.yaml`: production and development Amplify applications, their main
  and develop branches, invitation-only
  Cognito pool/client/group, Secrets Manager session signing key, and separate
  branch-scoped GitHub deployment roles. The Engine infrastructure owns its
  runtime authentication permissions.
- `api-edge.yaml`: HTTPS Application Load Balancer, ACM certificate, DNS and a second subnet.
  The listener starts with a fixed 503 response and is enabled only after protected
  Engine startup and network configuration have been verified.
- The sibling Infrastructure repository's Engine stack owns EC2 and its security
  group. Allow port 8000 from the load balancer security
  group. Never open port 8000 to the Internet. The load balancer accepts public
  HTTPS; the Engine requires Cognito sessions for every non-health API route.
  Amplify's managed reverse proxy must be able to reach this HTTPS endpoint.
- The Engine repository owns Cognito session validation and authorization.
  Enable `application.api_access.mode: verified_host` and configure `cognito`
  using this stack's public output identifiers. AWS credentials retrieve secret
  values inside the Engine. The frontend never receives OAuth tokens or secrets.

Amplify proxies `/api/*` to the HTTPS API origin. The load balancer forwards to the instance's private IP and survives public-IP
changes. API cookies and query strings are forwarded, and protected
responses specify `private, no-store`. The service worker excludes `/api/*`
navigation so OAuth callbacks reach the server. SPA deep links serve index.html.

## Provisioning

Use AWS region `us-east-1` and account `078183419290`. Review CloudFormation
changes before updating an existing deployment. Neither ordinary GitHub release
job has permission to create or change infrastructure.

```sh
aws cloudformation deploy --stack-name digital-twin-api-load-balancer \
  --template-file deployment/api-edge.yaml \
  --parameter-overrides EngineInstanceId=i-03c49c9209662ec1b \
    VpcId=vpc-05fee57a83f4119ca EngineSecurityGroupId=sg-0d0cf13de742ded3a \
    EngineSubnetId=subnet-004a52aa9c89f52ce PublicRouteTableId=rtb-08a0ad21251c4f05e \
    HostedZoneId=Z02611002UN2XT68XWGT0 \
    ApiDomain=api.nexus.ipss.ai EnableApi=false \
  --region us-east-1 --disable-rollback

aws cloudformation deploy --stack-name digital-twin-frontend \
  --template-file deployment/hosting.yaml \
  --capabilities CAPABILITY_NAMED_IAM --region us-east-1
```

`ApiOrigin` may be omitted during bootstrap. Set it to the API-edge stack's
`ApiOrigin` output after authentication is installed. If using a custom domain,
set `PublicOrigin` to its HTTPS origin. The stack associates that hostname with
the Amplify `main` branch and provisions an Amplify-managed TLS certificate.
Amplify creates routing and certificate validation records automatically when
the parent domain is in Route 53 in the same AWS account. The stack registers
the production and development callbacks and logout origins in Cognito. Configure
both frontend origins in the shared API's hosted authentication allowlist.

The development frontend is `https://develop.digital-twin.wattbyte-nexus.com`.
`DevelopPublicOrigin` configures this hostname independently of production's
`PublicOrigin`; `DevelopPublicDomain` associates it with the development app's
`develop` branch and provisions a separate managed TLS certificate.

The production frontend is `https://digital-twin.wattbyte-nexus.com`:

```sh
aws cloudformation deploy --stack-name digital-twin-frontend \
  --template-file deployment/hosting.yaml \
  --parameter-overrides ApiOrigin=https://api.nexus.ipss.ai \
    DevelopApiOrigin=https://api.nexus.ipss.ai \
    DevelopPublicOrigin=https://develop.digital-twin.wattbyte-nexus.com \
    PublicOrigin=https://digital-twin.wattbyte-nexus.com \
  --capabilities CAPABILITY_NAMED_IAM --region us-east-1
```

When changing a hostname, provision and verify its DNS and TLS before switching
login. Update `cognito.frontend_origins` in both the Engine's
`DTE_API_ACCESS_CONFIG` and `DTE_APPLICATION_CONFIG_JSON.api_access`, validate
the complete application configuration, and release the API. Set that GitHub
environment's `FRONTEND_URL` Actions variable to the same origin, then deploy
the branch so GitHub records its new live URL. The hosted smoke check verifies
that Cognito redirects back to that origin. The hosting stack owns the matching
Cognito callback and logout registrations.

### Development API target

`develop` deliberately uses the production API for now. Development users see
and modify production data with their normal production permissions. Its
`DevelopApiOrigin` stack parameter is independent of production's `ApiOrigin`.
Amplify rewrite rules belong to the application, so each environment has its
own application rather than sharing an app-wide API proxy.

When the development backend is ready, update only `DevelopApiOrigin` to its
HTTPS origin while retaining the existing stack's other parameter values. The
new backend must allow the `DevelopFrontendUrl` origin and use the appropriate
Cognito client callback and logout registrations. Keep production's `ApiOrigin`
unchanged. No browser API URL or frontend rebuild is needed because requests
remain same-origin under `/api/*`.

The shared production API's `cognito.frontend_origins` allowlist contains
`DevelopFrontendUrl` and `FrontendUrl`. Login supplies its explicit
`frontendOrigin`; each signed session binds writes, callback and logout to that
origin. Cognito registration alone does not update the API policy. The hosted
smoke check fails if sign-in redirects to another site. A session on a retired
hostname requires a fresh login at the new hostname.

## GitHub configuration

Set shared repository Actions variables from the hosting stack outputs:

| Variable | Source |
| --- | --- |
| `FRONTEND_AWS_REGION` | `us-east-1` |

Configure these GitHub environments with custom deployment branch policies:

| Environment | Allowed branch | `FRONTEND_AMPLIFY_APP_ID` | `FRONTEND_DEPLOY_ROLE_ARN` | `FRONTEND_URL` |
| --- | --- | --- | --- | --- |
| `production` | `main` | `AppId` output | `DeployRoleArn` output | `FrontendUrl` output |
| `development` | `develop` | `DevelopAppId` output | `DevelopDeployRoleArn` output | `DevelopFrontendUrl` output |

These three variables belong to each environment, not the repository. The OIDC
trust subjects name the exact environment, and GitHub's branch policies restrict
which branch may use it. The production role can deploy only Amplify `main`;
the development role can deploy only its application's Amplify `develop`. PR builds receive no
deployment credentials and do not create a deployment.

The `develop` branch is created from `main`. Push development work to `develop`
to test its deployment before promoting it through a pull request into `main`.
Both branches run the same contract, lint, test, build and hosted smoke checks.
The deploy script requires `AMPLIFY_BRANCH=main` or `AMPLIFY_BRANCH=develop`;
missing or unsupported branch names fail before contacting AWS. Release metadata
includes the source commit, workflow run and branch, all verified after deployment.

The GitHub repository's **Deployments** page lists both environments. Each
workflow run also provides its environment URL as a **View deployment** link.
Amplify builds remain disabled because GitHub deploys its exact tested artifact.

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

## Deployed instance

The frontend is hosted at https://main.dbv0kjyl8w1at.amplifyapp.com, with
same-origin API requests forwarded to `https://api.nexus.ipss.ai`. The API
load balancer accepts public HTTPS; only its security group and the existing
operator network can reach the Engine's port 8000. Keep `EnableApi=true` for
the active `digital-twin-api-load-balancer` stack when updating it.

Backend release [37963539199](https://github.com/WattByte-Nexus/Digital-Twin-Engine/actions/runs/37963539199)
deployed source `855db229410d3f95384d882eb918aa3517216698` through GitHub OIDC
and SSM. On 2026-10-09, live checks verified Cognito login, the Golden workspace,
current weather and assets, and private point-cloud metadata. A separate
unauthenticated client received HTTP 401 after those authenticated reads.
Session cookies are Secure/HttpOnly and API responses remain `private, no-store`.

The API's runtime authentication configuration is installed in
`/opt/digital-twin/config/app.yaml`; an operator backup is retained at
`/opt/digital-twin/app.before-hosting-20261009.yaml`. Infrastructure's ignored
`engine/frontend.auto.tfvars.json` preserves the enabled load-balancer ingress
on future Terraform plans. Never commit initial user passwords or session keys.

## Independent Fargate API preparation

Infrastructure's Engine stack owns the independent ECS service, private task
network, task security group and IP target group. This frontend stack continues
to own the existing ALB/listener/DNS/certificate and every ALB egress rule.

First provision the target group and API security group in Infrastructure. Set
`FargateTargetGroupArn` and `FargateSecurityGroupId` to its `independent_api`
output while retaining `UseFargateApi=false` and `EnableApi=true`. Both inputs
must be supplied together. This adds ALB egress and a temporary verification
rule matching `X-Digital-Twin-Api-Target: fargate`; API authentication is still
required. The target association permits ECS startup before the normal traffic
switch. Requests without that header continue using the active instance target.

Start and validate the API tasks, including the actual Amplify streaming and
cross-replica session paths, before setting `UseFargateApi=true`. The verification
rule is removed automatically on switch. Keep `api.nexus.ipss.ai` and Amplify's
`/api/*` forwarding unchanged. Remove the EC2 target only after acceptance;
never create a Terraform listener or Terraform ALB egress for this migration.
The Infrastructure `engine/independent-api.md` documents the staged procedure,
quota/cost estimates and release ownership.
