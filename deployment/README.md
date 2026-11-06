# AWS frontend deployment

Dev and Golden use account `078183419290` in `us-east-1` and share the existing
ALB/listener and network. Dev has its own API hostname, target group, task role
and security group, Cognito pool/client, session-signing secret and DynamoDB
session/runtime storage. Shared infrastructure reduces cost; account identity
alone cannot prove separation. Exact resource policies and live negative tests
must prove dev cannot use Golden state or credentials.

## Ownership

- `api-edge.yaml` is the Golden-only owner of the existing ALB, listener/default
  action/default certificate, Golden task egress, certificate, DNS and public
  subnet. Never deploy this template for dev or update that stack to add dev.
- `dev-api-edge.yaml` is a separate dev attachment stack. It owns only the
  `api-dev.nexus.ipss.ai` certificate, its SNI certificate attachment, exact
  host-header listener rule, DNS alias and ALB egress to the dev task SG.
  It creates no ALB, listener, VPC, subnet, target group or default action.
  Its Rules require stack name `digital-twin-dev-api-edge`, rejecting accidental
  use of the existing Golden edge stack.
- `hosting.yaml` owns one environment's Amplify app/branch, Cognito pool/client,
  generated session secret, scoped authentication grant and OIDC deployment role.
  Keep the existing Golden stack; dev Rules require the separate
  `digital-twin-dev-frontend` stack name.
- Infrastructure owns the shared network/cluster, each environment's Fargate
  service/target group/task role/task SG and task ingress from the shared ALB.
  Engine owns authentication, authorization and session validation. Redis is
  internal compute infrastructure, not the hosted session authority.

All ALB egress remains owned by Frontend CloudFormation. The two stacks own
distinct rules; Terraform must not manage them or the shared listener.
`ListenerCertificate` adds only the dev SNI certificate. Golden's default
certificate and default Fargate action are outside the dev stack's ownership.
Only the exact `api-dev.nexus.ipss.ai` host selects dev; ordinary Golden requests
continue to use the existing default route.

## Shared-account dev bootstrap

1. Keep the running Golden edge unchanged. Read its actual listener ARN, ALB ARN,
   DNS name, canonical hosted-zone ID and ALB security-group ID. Confirm an unused
   listener-rule priority. Preserve its default action/certificate and target ARN
   as a before/after acceptance baseline.
2. Provision Infrastructure's inactive dev resources in the existing network.
   Export `dev_runtime.target_group_arn`, `security_group_id`, `api_task_role_name`
   and `cloud_config`. Do not activate dev tasks until auth/runtime configuration
   and the target association are installed. No new ALB/public subnet is needed.
3. Deploy `hosting.yaml` as `digital-twin-dev-frontend`, using the dev task role,
   `Environment=dev`, `ExpectedAccountId=078183419290`,
   `ApiOrigin=https://api-dev.nexus.ipss.ai`,
   `PublicOrigin=https://dev.digital-twin.wattbyte-nexus.com`, and
   `GitHubOidcSubject=repo:WattByte-Nexus/Digital-Twin-Frontend:environment:dev`.
   Supply the selected verified SES sender/identity. This creates distinct dev
   auth resources even when the frontend artifact deployment is deferred.
4. Deploy `dev-api-edge.yaml` as `digital-twin-dev-api-edge`. Supply the existing
   shared ALB/listener inputs, dev target/SG and a free priority. Supply the actual
   `GoldenTargetGroupArn` and `GoldenApiSecurityGroupId` for reuse rejection.
   `ApiDomain` permits only `api-dev.nexus.ipss.ai`; the template never changes
   the Golden DNS name. It attaches the dev target before ECS service creation.
   Until healthy dev tasks exist, requests to that hostname return ALB 503.
5. Configure the dev API using dev hosting outputs and `dev_runtime.cloud_config`,
   publish its digest-pinned image and activate its tasks. Use the dev DynamoDB
   session table, operational table, storage prefixes/buckets and queue. Never
   copy Golden session secrets, pool IDs, client secrets, sessions or users.
6. Verify dev HTTPS/readiness/login and independent sessions, then deploy the
   tested frontend artifact when ready. Confirm Golden default action, default
   certificate, target health and authenticated behavior remain unchanged.

The same account guard still verifies actual caller identity. Dev no longer
requires another account or an Organizations/bootstrap migration. API hosting
uses the exact browser origin for Cognito callbacks and CSRF; Amplify proxies
same-origin `/api/*` to the dev API. A local frontend can be used only through
the Engine's explicitly configured local/dev access flow; the templates do not
broaden hosted callbacks or disable verified-host authentication for localhost.

Example dev attachment command, after filling verified nonsecret inputs:

```sh
aws cloudformation deploy --region us-east-1 \
  --stack-name digital-twin-dev-api-edge \
  --template-file deployment/dev-api-edge.yaml \
  --parameter-overrides Environment=dev ExpectedAccountId=078183419290 \
    ApiDomain=api-dev.nexus.ipss.ai HostedZoneId="$API_HOSTED_ZONE_ID" \
    ListenerArn="$SHARED_LISTENER_ARN" LoadBalancerArn="$SHARED_ALB_ARN" \
    LoadBalancerDnsName="$SHARED_ALB_DNS_NAME" \
    LoadBalancerCanonicalHostedZoneId="$SHARED_ALB_ZONE_ID" \
    LoadBalancerSecurityGroupId="$SHARED_ALB_SECURITY_GROUP_ID" \
    RulePriority="$UNUSED_RULE_PRIORITY" \
    FargateTargetGroupArn="$DEV_TARGET_GROUP_ARN" \
    FargateSecurityGroupId="$DEV_API_SECURITY_GROUP_ID" \
    GoldenTargetGroupArn="$GOLDEN_TARGET_GROUP_ARN" \
    GoldenApiSecurityGroupId="$GOLDEN_API_SECURITY_GROUP_ID"
```

Review the change set before deploying. The ALB DNS name/zone ID come from its
actual description, not the application hosted-zone ID. Confirm the listener,
ALB and SG belong together in the same account/region/VPC. A conflicting rule
priority fails creation; select a free priority instead of replacing any rule.

## DNS, auth and artifacts

The existing account's parent hosted zones may directly host the new dev records;
no cross-account delegation is needed. Use the actual zone containing
`api-dev.nexus.ipss.ai` for dev certificate validation/DNS. Amplify manages the
separate browser domain association and certificate. Retain the existing Golden
DNS records and leave `EnableAutoSubDomain=false`. Wait for ACM issuance and
Amplify's `AVAILABLE` domain status before browser acceptance.

Hosting requires `ApiOrigin`, `PublicOrigin`, `EngineRoleName`,
`TransactionalEmailSender` and `TransactionalEmailIdentityArn` explicitly.
`EngineRoleName` must be the dev API task role, not its execution role or the
Golden API/worker role. The exact dev resource ARNs scope Cognito and session
secret access; SES sends are restricted to the configured sender. The email
identity must be verified in this account/region. Sandbox SES requires verified
test recipients. Preserve the existing mandatory TOTP/account-management setup.
Never put OAuth tokens, session secrets or Engine credentials into Vite variables.

`BranchName=main` identifies a branch inside the separate dev Amplify app; it does
not deploy to the Golden app. The existing upload script targets that branch.
For manual deployment, use explicit operator credentials and the dev `AppId`:

```sh
AWS_PROFILE="$DEV_OPERATOR_PROFILE" AWS_REGION=us-east-1 \
AMPLIFY_APP_ID="$DEV_AMPLIFY_APP_ID" \
  bash scripts/deploy-amplify.sh /absolute/path/to/tested/dist
```

The existing GitHub workflow still deploys only main with a Golden account
allowlist and repository/main OIDC subject. It has no `environment: dev` job.
Do not redirect its stable repository-level variables. A future dev release job
must select the protected GitHub dev environment and its app/role variables to
match the dev role's exact OIDC trust. Manual operator deployment does not assume
that OIDC role. No GitHub repository connection or Amplify auto-build is required.

Both hosting and dev edge export `DeploymentEnvironment`, actual
`DeploymentAccountId` and `DeploymentRegion`; matching identities are necessary
but not proof of separate resources inside a shared account. Hosting additionally
exports `AppId`, `BranchName`, `FrontendUrl`, `DeployRoleArn`, `UserPoolId`,
`ClientId`, `CognitoDomain`, `SessionSecretArn` and `ApiOrigin`. Dev edge exports
`ApiOrigin`, dev `TargetGroupArn`, shared `LoadBalancerArn`, `ListenerArn`,
`SecurityGroupId` (shared ALB SG) and its own `CertificateArn`.

## Golden preservation and verification

Golden stays at `https://digital-twin.wattbyte-nexus.com` and
`https://api.nexus.ipss.ai`. Its edge template remains Golden-only and preserves
all rendered resources from the audited Fargate-only live baseline. Keep its
`EnableApi=true`, existing target/SG and certificate inputs when independently
updating that stack. Dev provisioning never updates this stack or changes its
environment, network, default action or default certificate.

Offline checks require no AWS credentials:

```sh
uvx --from cfn-lint cfn-lint deployment/api-edge.yaml deployment/dev-api-edge.yaml deployment/hosting.yaml
node --test tests/deployment-templates.test.mjs
bash -n scripts/deploy-amplify.sh
```

Tests compare every Golden edge property against its audited live fixture and
every Golden hosting resource/output against its pre-change snapshot. They prove
same-account dev auth separation, exact-host routing, certificate attachment-only
ownership, no new ALB/network resources, distinct targets/SGs and invalid-input
rejection. No offline test proves live IAM/session isolation. Verify negative
Golden-token/session/data access in dev and unchanged Golden behavior after
provisioning. This adds no ALB/NAT/subnet fixed cost; dev tasks, auth, secret,
storage and any frontend traffic remain billable.

There is no self-registration. Explicitly bootstrap a managed platform account,
then invite staff and customer administrators through the management workspace.
The retired `nexus-administrators` group grants no application access. Cognito
requires authenticator-app MFA; application management writes additionally use
single-use email verification. Account state, plan features, organization validity
and exact region ownership are resolved on protected requests. Staff and tenant
administrators receive no product grants. Private datasets also require their
existing Engine grants. Logout revokes the session. Application release/rollback must preserve hosted configuration and
cloud storage authority. A code rollback does not restore retired Redis sessions.

The account feature requires the matching Engine schema and account-management
release. Install the account schema with the explicit `digital-twin-accounts`
operator command before enabling the new API, and bind the intended existing
Cognito administrator by issuer and subject. Do not infer identity from email or
bulk-enable the previous group. The API checks mandatory TOTP configuration at
startup. Its runtime role needs the pool-scoped provisioning/MFA permissions and
sender-scoped SES permission declared in `hosting.yaml`. For setup and acceptance,
see the Engine's `docs/operations/accounts.md` and this repository's
[role implementation plan](../docs/digital-twin-roles-and-permissions-plan.md).

## Debug point-cloud uploads

Settings → Debug → Point-cloud upload sends LAS, LAZ and PLY files directly to
the configured private source bucket in 32 MiB parts (100 GiB maximum). Region
choices come from the authenticated Engine catalog. The control endpoint is
`POST /api/v1/regions/{region_id}/point-cloud-uploads`; deploy the matching Engine
change with the frontend's pinned contract before enabling this workflow.

The Engine requires verified hosting authentication and `surveys:submit` for
the selected region. It signs 24-hour owner/region-bound sessions using the
existing hosting secret with a separate salt, and fifteen-minute S3 PUT URLs
using its runtime role. No new IAM user, browser credential or Vite secret is
needed. File bytes never pass through Amplify or the Engine.

The source bucket's infrastructure owner must permit the frontend origin in
S3 CORS. Merge this rule with the existing Site's rules; preserve its access:

```json
{
  "AllowedOrigins": ["https://digital-twin.wattbyte-nexus.com"],
  "AllowedMethods": ["PUT"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 3600
}
```

The Engine runtime role needs `s3:PutObject`, `s3:GetObject`,
`s3:AbortMultipartUpload`, and `s3:ListMultipartUploadParts` on
`arn:aws:s3:::digital-twin-golden-assets-sources-078183419290/uploads/pointclouds/*`.
The bucket should abort incomplete multipart uploads under `uploads/pointclouds/`
after one day, covering closed tabs, expired sign-in sessions and failed cleanup.
These bucket/IAM settings belong to the source bucket's Infrastructure stack.

Completed objects use `uploads/pointclouds/{region}/{UTC-date}/{uuid}/{filename}`
and record region, coordinate reference, original filename, size, hashed uploader,
and `upload-source=digital-twin-debug` in S3 metadata. That origin marker
distinguishes frontend uploads from the older Site. Completion validates S3's
actual part sizes and reads the final object's version; retrying completion
reconciles a lost response. Uploading does not register a point-cloud dataset,
replace active map data, or schedule processing.

Leaving the upload settings section cancels the transfer and requests removal of
unfinished parts. Completion verification cannot be cancelled; if it cannot be
confirmed, inspect S3 before uploading the same capture again. Local-network mode
has no verified identity and cannot use this private debug uploader.
