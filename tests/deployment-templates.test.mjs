import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

// Use the repository's existing YAML dependency; preserve CloudFormation tags as AST nodes.
const require = createRequire(new URL('../package.json', import.meta.url));
const yaml = require('js-yaml');
const tags = ['Ref', 'Sub', 'GetAtt', 'If', 'Not', 'Equals', 'And', 'Or', 'Select', 'Split', 'GetAZs'];
const schema = yaml.JSON_SCHEMA.extend(tags.flatMap((tag) => ['scalar', 'sequence'].map((kind) =>
  new yaml.Type(`!${tag}`, { kind, construct: (value) => ({ [tag]: value }) }))));
const templates = Object.fromEntries(['hosting', 'api-edge', 'dev-api-edge'].map((name) => [name,
  yaml.load(readFileSync(new URL(`../deployment/${name}.yaml`, import.meta.url), 'utf8'), { schema })]));

/** Evaluate the template intrinsics used by these templates without contacting AWS.
 * @param {unknown} value Template node.
 * @param {object} parameters Explicit parameters/pseudo parameters and resource attributes.
 * @param {object} conditions Template condition expressions.
 * @returns {unknown} Resolved scalar, collection or resource shape; throws on unknown intrinsics.
 */
function evaluate(value, parameters, conditions = {}) {
  const visit = (node) => evaluate(node, parameters, conditions);
  if (Array.isArray(value)) return value.map(visit);
  if (!value || typeof value !== 'object') return value;
  const [rawKey] = Object.keys(value);
  const key = rawKey.replace(/^Fn::/, '');
  const arg = value[rawKey];
  if (key === 'Ref') return parameters[arg] ?? `resource:${arg}`;
  if (key === 'GetAtt') return parameters[arg] ?? `attribute:${arg}`;
  if (key === 'Sub') return arg.replace(/\$\{([^}]+)\}/g, (_, name) => parameters[name] ?? `attribute:${name}`);
  if (key === 'If') return visit(visit(conditions[arg[0]]) ? arg[1] : arg[2]);
  if (key === 'Equals') return visit(arg[0]) === visit(arg[1]);
  if (key === 'Not') return !visit(arg[0]);
  if (key === 'And') return arg.every(visit);
  if (key === 'Or') return arg.some(visit);
  if (key === 'Select') return visit(arg[1])[visit(arg[0])];
  if (key === 'Split') return visit(arg[1]).split(visit(arg[0]));
  if (key === 'GetAZs') return ['us-east-1a', 'us-east-1b'];
  return Object.fromEntries(Object.entries(value).map(([name, node]) => [name, visit(node)]));
}

/** Validate required inputs, constraints and CloudFormation Rules for an offline fixture.
 * @param {object} template Parsed CloudFormation document.
 * @param {object} overrides Fixture's environment-specific inputs.
 * @returns {object} Parameters including defaults. Throws if a requirement or assertion fails.
 */
function validate(template, overrides) {
  const parameters = {
    'AWS::StackName': template === templates['dev-api-edge'] ? 'digital-twin-dev-api-edge'
      : overrides.Environment === 'dev' ? 'digital-twin-dev-frontend' : 'digital-twin-frontend',
    ...overrides,
  };
  for (const [name, spec] of Object.entries(template.Parameters)) {
    if (!(name in parameters) && 'Default' in spec) parameters[name] = spec.Default;
    assert.ok(name in parameters, `Required parameter: ${name}`);
    if (spec.AllowedValues) assert.ok(spec.AllowedValues.includes(parameters[name]), name);
    if (spec.AllowedPattern) assert.match(parameters[name], new RegExp(spec.AllowedPattern), name);
    if (spec.MinLength) assert.ok(parameters[name].length >= spec.MinLength, name);
    if (spec.MinValue) assert.ok(parameters[name] >= spec.MinValue, name);
    if (spec.MaxValue) assert.ok(parameters[name] <= spec.MaxValue, name);
  }
  for (const rule of Object.values(template.Rules)) {
    if (rule.RuleCondition && !evaluate(rule.RuleCondition, parameters)) continue;
    for (const assertion of rule.Assertions) {
      assert.equal(evaluate(assertion.Assert, parameters), true, assertion.AssertDescription);
    }
  }
  return parameters;
}

/** Build explicit, synthetic deployment inputs without real dev account/DNS identifiers.
 * @param {'dev'|'golden'} environment Environment fixture.
 * @returns {object} Nonsecret test-only parameters for both templates.
 */
function fixture(environment) {
  const dev = environment === 'dev';
  const account = '078183419290';
  return {
    Environment: environment, ExpectedAccountId: account, 'AWS::AccountId': account, BranchName: 'main',
    'AWS::Region': 'us-east-1', 'AWS::Partition': 'aws',
    ApiOrigin: dev ? 'https://api-dev.nexus.ipss.ai' : 'https://api.nexus.ipss.ai',
    PublicOrigin: dev ? 'https://dev.digital-twin.wattbyte-nexus.com' : 'https://digital-twin.wattbyte-nexus.com',
    ApiDomain: dev ? 'api-dev.nexus.ipss.ai' : 'api.nexus.ipss.ai',
    EngineRoleName: dev ? 'digital-twin-dev-engine-api-task' : 'digital-twin-golden-engine-api-task',
    TransactionalEmailSender: 'digital-twin@example.test',
    TransactionalEmailIdentityArn: `arn:aws:ses:us-east-1:${account}:identity/example.test`,
    GitHubOidcSubject: `repo:WattByte-Nexus/Digital-Twin-Frontend:${dev ? 'environment:dev' : 'ref:refs/heads/main'}`,
    SecondSubnetCidr: '10.82.2.0/24', VpcId: 'vpc-test', EngineSubnetId: 'subnet-test',
    PublicRouteTableId: 'rtb-test', HostedZoneId: 'zone-test',
    ListenerArn: `arn:aws:elasticloadbalancing:us-east-1:${account}:listener/app/shared/abc/def`,
    LoadBalancerArn: `arn:aws:elasticloadbalancing:us-east-1:${account}:loadbalancer/app/shared/abc`,
    LoadBalancerDnsName: 'shared.us-east-1.elb.amazonaws.com',
    LoadBalancerCanonicalHostedZoneId: 'ZALBTEST', LoadBalancerSecurityGroupId: 'sg-shared',
    RulePriority: 100,
    FargateTargetGroupArn: `arn:aws:elasticloadbalancing:us-east-1:${account}:targetgroup/${dev ? 'dev' : 'golden'}/123`,
    FargateSecurityGroupId: dev ? 'sg-12345678' : 'sg-87654321',
    GoldenTargetGroupArn: `arn:aws:elasticloadbalancing:us-east-1:${account}:targetgroup/golden/123`,
    GoldenApiSecurityGroupId: 'sg-87654321',
  };
}

test('Golden renders the deployed named identities, branch, origins and trust subject', () => {
  const parameters = fixture('golden');
  const hosting = templates.hosting;
  validate(hosting, parameters);
  validate(templates['api-edge'], parameters);
  const resources = evaluate(hosting.Resources, parameters, hosting.Conditions);
  const identities = { App: ['Name', 'wattbyte-nexus'], Main: ['BranchName', 'main'],
    UserPool: ['UserPoolName', 'wattbyte-nexus'], Client: ['ClientName', 'nexus-hosted-session'],
    Domain: ['Domain', 'wattbyte-nexus-078183419290'],
    SessionSecret: ['Name', 'digital-twin/frontend/session-signing-key'],
    DeployRole: ['RoleName', 'digital-twin-frontend-github-deploy'],
    EngineAuthenticationPolicy: ['PolicyName', 'nexus-hosted-authentication'] };
  for (const [name, [property, expected]] of Object.entries(identities)) assert.equal(resources[name].Properties[property], expected);
  assert.deepEqual(resources.Client.Properties.CallbackURLs, [`${parameters.PublicOrigin}/api/digital-twin/callback`]);
  assert.equal(resources.DeployRole.Properties.AssumeRolePolicyDocument.Statement[0].Condition.StringEquals['token.actions.githubusercontent.com:sub'], parameters.GitHubOidcSubject);
  const edge = evaluate(templates['api-edge'].Resources, parameters, templates['api-edge'].Conditions);
  assert.equal(edge.LoadBalancer.Properties.Name, 'digital-twin-frontend-api');
  assert.equal(edge.SecurityGroup.Properties.GroupName, 'digital-twin-frontend-api-alb');
  assert.equal(edge.SecondSubnet.Properties.CidrBlock, '10.82.2.0/24');
});

test('dev has separate identity resources, exact callbacks, proxy origin and scoped auth permissions', () => {
  const parameters = fixture('dev');
  for (const template of [templates.hosting, templates['dev-api-edge']]) validate(template, parameters);
  const resources = evaluate(templates.hosting.Resources, parameters, templates.hosting.Conditions);
  for (const name of ['App', 'UserPool', 'Client', 'Domain', 'SessionSecret', 'DeployRole']) {
    assert.match(JSON.stringify(resources[name].Properties), /dev/);
  }
  assert.deepEqual(resources.Client.Properties.CallbackURLs, [`${parameters.PublicOrigin}/api/digital-twin/callback`]);
  assert.deepEqual(resources.Client.Properties.LogoutURLs, [`${parameters.PublicOrigin}/`]);
  assert.equal(resources.App.Properties.CustomRules[0].Target, `${parameters.ApiOrigin}/api/<*>`);
  assert.deepEqual(resources.EngineAuthenticationPolicy.Properties.Roles, [parameters.EngineRoleName]);
  assert.deepEqual(resources.EngineAuthenticationPolicy.Properties.PolicyDocument.Statement.map((entry) => entry.Resource), ['resource:SessionSecret', 'attribute:UserPool.Arn', parameters.TransactionalEmailIdentityArn]);
  assert.equal(resources.UserPool.Properties.MfaConfiguration, 'ON');
  assert.deepEqual(resources.UserPool.Properties.EnabledMfas, ['SOFTWARE_TOKEN_MFA']);
  assert.equal(resources.UserPool.Properties.Schema[0].Mutable, false);
  assert.equal(resources.UserPool.Properties.Schema[0].Name, 'nexus_account_id');
  assert.equal(resources.Administrators, undefined);
  assert.deepEqual(resources.EngineAuthenticationPolicy.Properties.PolicyDocument.Statement[2].Condition.StringEquals,
    { 'ses:FromAddress': parameters.TransactionalEmailSender });
  for (const template of [templates.hosting, templates['dev-api-edge']]) {
    const outputs = evaluate(template.Outputs, parameters, template.Conditions);
    assert.equal(outputs.DeploymentAccountId.Value, parameters['AWS::AccountId']);
    assert.equal(outputs.DeploymentRegion.Value, 'us-east-1');
    assert.equal(outputs.DeploymentEnvironment.Value, 'dev');
  }
});

test('missing and mixed-environment inputs fail before deployment', () => {
  for (const [stack, template] of Object.entries(templates)) {
    const environment = stack === 'api-edge' ? 'golden' : 'dev';
    for (const name of ['Environment', 'ExpectedAccountId']) {
      const parameters = fixture(environment); delete parameters[name];
      assert.throws(() => validate(template, parameters), /Required parameter/);
    }
    assert.throws(() => validate(template, { ...fixture(environment), 'AWS::AccountId': '222222222222' }), /selected (?:AWS|shared) account/);
  }
  for (const name of ['ApiOrigin', 'PublicOrigin', 'EngineRoleName']) {
    const parameters = fixture('dev'); delete parameters[name];
    assert.throws(() => validate(templates.hosting, parameters), /Required parameter/);
    assert.throws(() => validate(templates.hosting, { ...fixture('dev'), [name]: fixture('golden')[name] }));
  }
  assert.throws(() => validate(templates.hosting, { ...fixture('dev'), PublicOrigin: 'https://dev.example.test/path' }));
  assert.throws(() => validate(templates.hosting, { ...fixture('dev'), GitHubOidcSubject: fixture('golden').GitHubOidcSubject }));
  assert.throws(() => validate(templates['dev-api-edge'], { ...fixture('dev'), ApiDomain: fixture('golden').ApiDomain }));
});

test('Fargate-only edge bootstraps without a target, then associates it before task activation', () => {
  const template = templates['api-edge'];
  const parameters = { ...fixture('golden'), EnableApi: 'true', FargateTargetGroupArn: 'arn:aws:elasticloadbalancing:us-east-1:078183419290:targetgroup/golden/123', FargateSecurityGroupId: 'sg-12345678' };
  assert.throws(() => validate(template, { ...parameters, FargateSecurityGroupId: '' }), /both Fargate/);
  assert.throws(() => validate(template, { ...fixture('golden'), EnableApi: 'true', FargateTargetGroupArn: '', FargateSecurityGroupId: '' }), /before enabling/);
  const bootstrap = validate(template, { ...fixture('golden'), FargateTargetGroupArn: '', FargateSecurityGroupId: '' });
  const edge = evaluate(template.Resources, bootstrap, template.Conditions);
  assert.equal(edge.Listener.Properties.DefaultActions[0].Type, 'fixed-response');
  assert.equal(edge.Listener.Properties.DefaultActions[0].FixedResponseConfig.StatusCode, '503');
  assert.deepEqual(edge.SecurityGroup.Properties.SecurityGroupEgress, [{ IpProtocol: '-1', CidrIp: '255.255.255.255/32' }]);
  assert.equal(evaluate(template.Conditions.FargatePrepared, bootstrap), false);
  const inputs = validate(template, parameters);
  const resources = evaluate(template.Resources, inputs, template.Conditions);
  assert.equal(resources.Listener.Properties.DefaultActions[0].TargetGroupArn, parameters.FargateTargetGroupArn);
  assert.equal(resources.FargateEgress.Properties.DestinationSecurityGroupId, parameters.FargateSecurityGroupId);
  assert.deepEqual(resources.SecurityGroup.Properties.SecurityGroupEgress, []);
  assert.equal(resources.Listener.Properties.Port, 443);
  assert.equal(evaluate(template.Outputs.TargetGroupArn.Value, inputs), parameters.FargateTargetGroupArn);
  for (const name of ['EngineInstanceId', 'EngineSecurityGroupId', 'UseFargateApi']) assert.equal(name in template.Parameters, false);
  assert.equal(Object.values(template.Resources).some((resource) => ['AWS::ElasticLoadBalancingV2::TargetGroup', 'AWS::ElasticLoadBalancingV2::ListenerRule'].includes(resource.Type)), false);
});

test('Golden edge resource identities and every rendered property match the audited live Fargate stack', () => {
  // Snapshot captured from the deployed stack on 2026-11-05; it contains no secrets.
  const live = JSON.parse(readFileSync(new URL('./fixtures/api-edge.golden-live.json', import.meta.url), 'utf8'));
  const template = templates['api-edge'];
  const parameters = validate(template, { ...fixture('golden'), EnableApi: 'true',
    FargateTargetGroupArn: 'arn:aws:elasticloadbalancing:us-east-1:078183419290:targetgroup/digital-twin-independent-api/b4f0a80243ee27cb',
    FargateSecurityGroupId: 'sg-0c44e6ed43e0a2d0c' });
  const current = evaluate(template.Resources, parameters, template.Conditions);
  const baseline = evaluate(live.Resources, parameters, live.Conditions);
  assert.deepEqual(Object.keys(current).sort(), Object.keys(baseline).sort());
  for (const name of Object.keys(baseline)) {
    assert.equal(current[name].Type, baseline[name].Type, name);
    assert.deepEqual(current[name].Properties, baseline[name].Properties, name);
    assert.deepEqual(current[name].DependsOn, baseline[name].DependsOn, name);
    if (template.Resources[name].Condition) assert.equal(evaluate(template.Conditions[template.Resources[name].Condition], parameters), true, name);
  }
  for (const name of Object.keys(live.Outputs)) assert.deepEqual(evaluate(template.Outputs[name].Value, parameters, template.Conditions), evaluate(live.Outputs[name].Value, parameters, live.Conditions), name);
});

test('shared dev attaches only an exact host rule, its own certificate, DNS and task egress', () => {
  const template = templates['dev-api-edge'];
  const inputs = validate(template, fixture('dev'));
  const resources = evaluate(template.Resources, inputs);
  assert.deepEqual(Object.values(resources).map((resource) => resource.Type).sort(), [
    'AWS::CertificateManager::Certificate', 'AWS::EC2::SecurityGroupEgress',
    'AWS::ElasticLoadBalancingV2::ListenerCertificate', 'AWS::ElasticLoadBalancingV2::ListenerRule',
    'AWS::Route53::RecordSet',
  ].sort());
  const rule = resources.DevHostRule.Properties;
  assert.equal(rule.ListenerArn, inputs.ListenerArn);
  assert.deepEqual(rule.Conditions, [{ Field: 'host-header', HostHeaderConfig: { Values: ['api-dev.nexus.ipss.ai'] } }]);
  assert.equal(rule.Actions[0].TargetGroupArn, inputs.FargateTargetGroupArn);
  assert.equal(rule.Conditions[0].HostHeaderConfig.Values.includes('api.nexus.ipss.ai'), false);
  assert.deepEqual(resources.DevListenerCertificate.Properties.Certificates, [{ CertificateArn: 'resource:Certificate' }]);
  assert.equal(resources.DevListenerCertificate.Properties.ListenerArn, inputs.ListenerArn);
  assert.equal(resources.Certificate.Properties.DomainName, 'api-dev.nexus.ipss.ai');
  assert.equal(resources.Dns.Properties.Name, 'api-dev.nexus.ipss.ai');
  assert.equal(resources.Dns.Properties.AliasTarget.DNSName, inputs.LoadBalancerDnsName);
  assert.equal(resources.DevTaskEgress.Properties.GroupId, inputs.LoadBalancerSecurityGroupId);
  assert.equal(resources.DevTaskEgress.Properties.DestinationSecurityGroupId, inputs.FargateSecurityGroupId);
  assert.equal(JSON.stringify(template).includes('DefaultActions'), false);
  assert.throws(() => validate(templates['api-edge'], fixture('dev')), /Environment/);
  assert.throws(() => validate(template, { ...inputs, 'AWS::StackName': 'digital-twin-api-load-balancer' }), /never the existing Golden/);
  assert.throws(() => validate(templates.hosting, { ...fixture('dev'), 'AWS::StackName': 'digital-twin-frontend' }), /never the Golden/);
  assert.throws(() => validate(template, { ...inputs, FargateTargetGroupArn: inputs.GoldenTargetGroupArn }), /Golden target/);
  assert.throws(() => validate(template, { ...inputs, FargateSecurityGroupId: inputs.GoldenApiSecurityGroupId }), /separate security group/);
  assert.throws(() => validate(template, { ...inputs, RulePriority: 0 }), /RulePriority/);
});

test('shared-account change leaves every Golden hosting resource property unchanged', () => {
  const baseline = yaml.load(readFileSync(new URL('./fixtures/hosting.before-shared.yaml', import.meta.url), 'utf8'), { schema });
  const inputs = validate(templates.hosting, fixture('golden'));
  assert.deepEqual(evaluate(templates.hosting.Resources, inputs, templates.hosting.Conditions), evaluate(baseline.Resources, inputs, baseline.Conditions));
  assert.deepEqual(evaluate(templates.hosting.Outputs, inputs, templates.hosting.Conditions), evaluate(baseline.Outputs, inputs, baseline.Conditions));
});

test('dev hosting grants auth only to the exact verified dev API task role', () => {
  const template = templates.hosting;
  const inputs = fixture('dev');
  validate(template, inputs);
  for (const role of [
    'digital-twin-golden-engine-api-task',
    'digital-twin-golden-engine-host',
    'digital-twin-independent-api-task',
    'unrelated-role',
  ]) {
    assert.throws(() => validate(template, { ...inputs, EngineRoleName: role }), /dev API task role/);
  }
  validate(template, fixture('golden'));
});
