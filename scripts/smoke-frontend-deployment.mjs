// Public acceptance checks: identify the exact release and prove API data stays protected.
import assert from 'node:assert/strict';

const origin = process.env.FRONTEND_URL;
assert.ok(origin?.startsWith('https://'), 'FRONTEND_URL must be HTTPS');
const get = (path, init = {}) => fetch(new URL(path, origin), { redirect: 'manual', ...init });
const release = await get(`/deployment.json?run=${process.env.GITHUB_RUN_ID ?? Date.now()}`);
assert.equal(release.status, 200);
assert.equal((await release.json()).commit, process.env.GITHUB_SHA);
const deepLink = await get('/regions/golden-co/live');
assert.equal(deepLink.status, 200);
assert.match(deepLink.headers.get('content-type') ?? '', /text\/html/);
const ready = await get('/api/v1/health/ready');
assert.equal(ready.status, 200, 'Engine readiness must pass through the hosted frontend');
assert.match(ready.headers.get('content-type') ?? '', /json/);
for (const path of ['/api/digital-twin/access', '/api/v1/regions']) {
  const denied = await get(path);
  assert.equal(denied.status, 401, `${path} must require authentication`);
  assert.match(denied.headers.get('cache-control') ?? '', /no-store/);
}
const signIn = await get('/api/digital-twin/sign-in');
assert.ok([302, 303, 307].includes(signIn.status));
const location = new URL(signIn.headers.get('location'));
assert.ok(location.hostname.endsWith('.amazoncognito.com'));
assert.equal(location.searchParams.get('response_type'), 'code');
assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
console.log(`Verified release, deep links, backend readiness and authentication at ${origin}`);
