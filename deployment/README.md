# AWS frontend deployment

The frontend's CloudFormation templates support independently selected `dev`
and stable `golden` accounts. GitHub Actions currently builds/tests/releases the
main artifact through the stable repository/main OIDC role; dev release workflow
and exact-artifact promotion changes remain a separate phase. PR builds need no
AWS credentials. Ordinary release jobs cannot provision infrastructure.

## Resource ownership

- `hosting.yaml` owns Amplify and its selected artifact branch, invitation-only
  Cognito pool/client/group, a generated session-signing secret, scoped API
  authentication permissions and the GitHub deployment role.
- `api-edge.yaml` owns the HTTPS ALB/listener, ALB security group and every ALB
  egress rule, ACM certificate, DNS and second public subnet/route association.
- Infrastructure owns the Engine network, independent API IP target group,
  Fargate service/task roles/security group and task ingress from the ALB.
  It owns the EC2 simulation worker; EC2 is not an API routing target.
- Engine owns authentication/authorization and its DynamoDB session store.
  Configure `verified_host` with the selected Cognito identifiers, exact browser
  origin and secret ARN. Runtime credentials retrieve secrets inside the API;
  OAuth tokens and secret values never enter frontend build variables.

Amplify proxies same-origin `/api/*` to the explicit HTTPS API origin. API cookies
and query strings are forwarded, and protected responses use `private, no-store`.
The service worker excludes API navigation so OAuth callbacks reach the server;
other SPA deep links serve index.html. Only the ALB security group reaches the
private Fargate API port 8000. Do not add a public task IP, EC2 API target or a
Terraform-owned listener/ALB egress rule.

## Inputs and isolation

Both templates require `Environment` (`dev` or `golden`) and `ExpectedAccountId`.
The templates compare that ID to the actual caller account and reject the known
stable account for dev. Deploy each environment under its own stack in its own
account; never change an existing stack's environment.

Hosting also requires `ApiOrigin`, `PublicOrigin`, `EngineRoleName`,
`TransactionalEmailSender` and `TransactionalEmailIdentityArn`. The email
identity must be verified in the selected API region/account; its policy permits
SES sends only from that mailbox. Set the same mailbox as `cognito.email_sender`
in the Engine hosting configuration. The role
is Infrastructure's API **task role**, not the execution role or EC2 worker role.
Origins are exact HTTPS origins without paths, trailing slashes or wildcards;
Cognito registers only the selected browser callback/logout URLs. There is no
default API origin or runtime role. Amplify uses `BranchName` (default `main`) as
the artifact destination independently of the candidate source commit.

Dev requires `GitHubOidcSubject` equal to
`repo:WattByte-Nexus/Digital-Twin-Frontend:environment:dev`. Configure that GitHub
environment and its release job before attempting OIDC deployment. Golden's
default remains its deployed exact repository/main subject. No wildcard trust
is introduced.

Edge additionally requires network/DNS identifiers and `SecondSubnetCidr`.
`EngineSubnetId` retains its deployed parameter name and means the first public
subnet; it does not select an EC2 API. The second subnet uses the region's second
AZ, so the first subnet must use another AZ. Its CIDR must not overlap the VPC's
other subnets. `FargateTargetGroupArn` and `FargateSecurityGroupId` are optional
only during the initial fixed-503 bootstrap, and must be supplied together.
`EnableApi=true` requires them. There is one route target: Fargate.

## Fresh dev bootstrap order

Account creation, operator access, OIDC provider setup, spending approval and DNS
delegation are prerequisites. The proposed browser/API names
`dev.digital-twin.wattbyte-nexus.com` and `api-dev.nexus.ipss.ai` remain unconfirmed.
No dev account or hosted-zone IDs are invented here. Verify the approved zone's
access/delegation and ACM/Amplify certificate validation records in that account.

1. Initialize the selected account's assets/weather and Engine network using the
   owning repositories. Keep `enable_independent_api`, `activate_independent_api`
   and other activation switches false. Export Engine `frontend_network`.
2. Create only the edge stack with that network, approved DNS, explicit account,
   environment and free second-subnet CIDR. Use `EnableApi=false` and leave both
   Fargate inputs empty. The listener returns 503. A bootstrap-only sink egress
   rule suppresses AWS's default allow-all outbound rule. Export `SecurityGroupId`,
   `SecondSubnetId`, `LoadBalancerArn` and `ApiOrigin`.
3. Feed the edge SG/subnet into Engine's `api_alb_security_group_id` and
   `api_second_public_subnet_id`; enable API resources with
   `enable_independent_api=true`, keeping `activate_independent_api=false`.
   This creates its target group, task security group and task role without ECS
   tasks. Export the updated `frontend_network` and `independent_api`.
4. Deploy hosting/auth using `frontend_network.api_task_role_name`, the selected
   API/browser origins and approved OIDC subject. Export the Cognito identifiers,
   session-secret ARN and exact `FrontendUrl`. Create dev users/grants explicitly.
5. Update the edge with `independent_api.target_group_arn` and
   `independent_api.security_group_id`, setting `EnableApi=true`. The listener
   associates the IP target group before ECS service creation. It returns 503
   until healthy tasks exist; the API remains authenticated. CloudFormation alone
   adds the task egress rule and removes its bootstrap sink.
6. Publish the account-local digest-pinned API image. Supply hosted-auth runtime
   settings, scoped secret/Cognito permissions, dev DynamoDB session/runtime
   resources and immutable dev static inputs to Engine; then set
   `activate_independent_api=true`. Complete readiness, TLS, login/logout,
   browser/API, streaming and cross-environment denial acceptance before release.
   Activate relay/point-cloud processing only after their independent readiness.

This order avoids a dependency cycle: edge/network first, inactive API role and
target next, hosting/auth next, target association next, tasks last. Passing an
offline template check does not provision or validate that deployment.

## Preserve the active Golden deployment

Golden's recorded account/region are `078183419290` / `us-east-1`; its browser and
API origins are `https://digital-twin.wattbyte-nexus.com` and
`https://api.nexus.ipss.ai`. The live edge audit on 2026-11-05 confirmed the
Fargate-only topology and Terraform-owned target group:

```text
arn:aws:elasticloadbalancing:us-east-1:078183419290:targetgroup/digital-twin-independent-api/b4f0a80243ee27cb
```

Keep `EnableApi=true`, that verified target ARN and its actual task security
group on any Golden update. Do not replay the fresh-dev fixed-503 bootstrap
against the active stack. Supply `Environment=golden`,
`ExpectedAccountId=078183419290` and `SecondSubnetCidr=10.82.2.0/24` alongside its
existing network/DNS/Fargate values. Hosting must retain its actual API task-role
input and current origins. Review the change set before updating infrastructure.

The templates retain every deployed edge logical ID and Golden resource property,
plus Golden hosting resource names, default branch and role trust. Golden's
existing empty inline ALB egress list and separately owned Fargate egress remain
unchanged. The checked-in live template fixture verifies these identities;
no legacy EC2 target or diagnostic header route remains.

## Outputs and cross-repository wiring

Both stacks export actual `DeploymentAccountId`, `DeploymentRegion` and selected
`DeploymentEnvironment` for the Engine identity preflight. Export
`aws cloudformation describe-stacks --stack-name <selected-stack> --query
'Stacks[0].Outputs'` as JSON. Identity agreement does not prove IAM isolation or
validate every supplied external resource's ownership.

| Stack/output | Consumer |
| --- | --- |
| Hosting `AppId`, `DeployRoleArn`, `BranchName`, `FrontendUrl` | Selected GitHub deployment destination and smoke checks |
| Hosting `UserPoolId`, `ClientId`, `CognitoDomain`, `SessionSecretArn`, `FrontendUrl`, `ApiOrigin` | Selected Engine verified-host configuration and scoped authentication policy |
| Edge `SecurityGroupId`, `SecondSubnetId`, `LoadBalancerArn` | Infrastructure API network/monitoring inputs |
| Edge `ApiOrigin` | Hosting API proxy origin |
| Edge `TargetGroupArn` (when prepared) | Reports Infrastructure's serving Fargate target; does not create one |

Sessions use the selected API's own DynamoDB table. Do not copy stable sessions
or users into dev. Feed the exact browser origin into Engine CSRF and the source
bucket owner's upload CORS rules. Infrastructure owns upload bucket IAM/lifecycle;
the existing upload workflow below retains its API contract.

GitHub uses `FRONTEND_AWS_REGION`, `FRONTEND_AMPLIFY_APP_ID`,
`FRONTEND_DEPLOY_ROLE_ARN` and `FRONTEND_URL` from the selected hosting outputs.
Existing browser mapping credentials remain public browser credentials once
bundled; restrict provider origins. Never put Engine secrets into Vite variables.
Current workflow checks the Engine contract, lint/tests/type checks/build, records
`deployment.json`, and checks revision, SPA, readiness and Cognito redirects.
Workflow/environment selection and exact-artifact promotion remain separate work.

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

## Offline verification

```sh
uvx --from cfn-lint cfn-lint deployment/api-edge.yaml deployment/hosting.yaml
node --test tests/deployment-templates.test.mjs
bash -n scripts/deploy-amplify.sh
```

Tests compare all Golden edge resource properties against the nonsecret audited
live template in `tests/fixtures/api-edge.golden-live.json`, check hosting resource
identities, reject missing/mixed environment inputs, and prove fixed-503 bootstrap
and Fargate association without EC2 targets or diagnostic switches. Live change
sets, DNS/TLS, session/task replacement and cross-account denial remain required
deployment evidence.

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
