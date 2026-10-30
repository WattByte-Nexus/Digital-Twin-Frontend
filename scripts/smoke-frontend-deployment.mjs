// Public acceptance checks: identify the exact release and prove API data stays protected.
import assert from 'node:assert/strict';

const origin = process.env.FRONTEND_URL;
assert.ok(origin?.startsWith('https://'), 'FRONTEND_URL must be HTTPS');
const get = (path, init = {}) => fetch(new URL(path, origin), { redirect: 'manual', ...init });
const release = await get(`/deployment.json?run=${process.env.GITHUB_RUN_ID ?? Date.now()}`);
assert.equal(release.status, 200);
assert.equal((await release.json()).commit, process.env.GITHUB_SHA);
for (const path of ['/regions/golden-co/live', '/regions/route.with.period/live', '/workspace', '/admin', '/diagnostics']) {
  const deepLink = await get(path);
  assert.equal(deepLink.status, 200, `${path} must load the application shell`);
  assert.match(deepLink.headers.get('content-type') ?? '', /text\/html/);
}
const manifest = await get('/manifest.webmanifest');
assert.equal(manifest.status, 200);
assert.equal((await manifest.json()).name, 'WattByte Nexus');
const notebook = await get('/jupyterlite/lab/index.html');
assert.equal(notebook.status, 200);
assert.match(await notebook.text(), /<title>JupyterLite<\/title>/);
const poleModel = await get('/assets/digital-twin/13.8kv_power_pole.glb');
assert.equal(poleModel.status, 200);
const modelBytes = new Uint8Array(await poleModel.arrayBuffer());
assert.deepEqual([...modelBytes.slice(0, 4)], [0x67, 0x6c, 0x54, 0x46], 'Pole model must be a binary glTF asset');
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
assert.equal(location.searchParams.get('redirect_uri'), new URL('/api/digital-twin/callback', origin).href);
console.log(`Verified release, deep links, backend readiness and authentication at ${origin}`);
