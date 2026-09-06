import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHmac, generateKeyPairSync, verify } from 'node:crypto';
import { evaluate, signProof, validatePolicy } from '../src/proof.js';
import { createHandler } from '../src/server.js';
import { appJwt, githubClient } from '../src/github.js';
const keys = generateKeyPairSync('ed25519');
const publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' });
const policy = { allowedModels: ['Astra', 'Fable 5.1'], trustedIssuers: { trusted: { publicKey, models: ['Astra', 'Fable 5.1'] } } };
const context = { repository: 'org/repo', number: 5, sha: 'a'.repeat(40) };
const payload = { version: 1, issuer: 'trusted', ...context, model: 'Astra', issuedAt: 1000, runId: 'job-1' };
const signed = changes => signProof({ ...payload, ...changes }, keys.privateKey);
const verdict = (body, ctx = context, p = policy) => evaluate({ ...ctx, body }, p, 2000);
for (const model of policy.allowedModels) test(`accepts ${model}`, () => assert.equal(verdict(signed({ model })).ok, true));
for (const [name, body] of [
  ['missing', 'Made by Astra'], ['disallowed', signed({ model: 'other' })],
  ['wrong repository', signed({ repository: 'other/repo' })], ['wrong PR', signed({ number: 6 })],
  ['old SHA', signed({ sha: 'b'.repeat(40) })], ['untrusted issuer', signed({ issuer: 'other' })],
  ['prototype issuer', signed({ issuer: '__proto__' })], ['future issuance', signed({ issuedAt: 2100 })],
  ['wrong version', signed({ version: 2 })], ['missing run', signed({ runId: '' })],
  ['duplicate', `${signed({})}\n${signed({})}`], ['malformed', '<!-- model-pr-gate:e30.AA -->'],
  ['additional malformed marker', `${signed({})}\n<!-- model-pr-gate:broken -->`]
]) test(`rejects ${name}`, () => assert.equal(verdict(body).ok, false));
test('rejects payload tampering', () => {
  const original = signed({});
  const encoded = original.split(':')[1].split('.')[0];
  const changed = Buffer.from(JSON.stringify({ ...payload, model: 'Fable 5.1' })).toString('base64url');
  assert.equal(verdict(original.replace(encoded, changed)).ok, false);
});
test('restricts issuer model scope', () => assert.equal(verdict(signed({}), context, { ...policy, trustedIssuers: { trusted: { publicKey, models: ['Fable 5.1'] } } }).ok, false));
test('fails startup on placeholder policy', () => assert.throws(() => validatePolicy({ ...policy, trustedIssuers: { invalid: { publicKey: 'placeholder', models: ['Astra'] } } })));
test('rejects proof signed with another key', () => assert.equal(verdict(signProof(payload, generateKeyPairSync('ed25519').privateKey)).ok, false));
test('GitHub JWT is RSA signed and bounded', () => {
  const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwt = appJwt('123', rsa.privateKey);
  const [header, claims, signature] = jwt.split('.');
  assert.equal(JSON.parse(Buffer.from(header, 'base64url')).alg, 'RS256');
  assert.equal(JSON.parse(Buffer.from(claims, 'base64url')).iss, '123');
  assert.ok(verify('RSA-SHA256', Buffer.from(`${header}.${claims}`), rsa.publicKey, Buffer.from(signature, 'base64url')));
});
test('GitHub client exchanges token and posts check to target repo', async () => {
  const calls = [];
  const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const client = githubClient({ appId: '123', privateKey: rsa.privateKey, fetchImpl: async (url, options) => {
    calls.push({ url, options }); return { ok: true, json: async () => ({ token: 'installation-token' }) };
  } });
  const installation = await client.installation(9);
  await installation.getPR('org/repo', 5);
  await installation.createCheck('org/repo', { head_sha: context.sha });
  assert.equal(calls[0].url, 'https://api.github.com/app/installations/9/access_tokens');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer installation-token');
  assert.equal(calls[2].options.method, 'POST');
  assert.equal(JSON.parse(calls[2].options.body).head_sha, context.sha);
});
async function fixture(t, getPR) {
  const checks = []; const secret = 'x'.repeat(32);
  const server = http.createServer(createHandler({ secret, policy, logger: { error() {} }, github: {
    installation: async () => ({ getPR, createCheck: async (repo, check) => checks.push({ repo, check }) })
  } }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const send = async (patch = {}, signatureOverride) => {
    const raw = JSON.stringify({ action: 'opened', repository: { full_name: 'org/repo' }, installation: { id: 9 }, pull_request: { number: 5, body: 'stale payload' }, ...patch });
    return fetch(`http://127.0.0.1:${server.address().port}/webhooks/github`, { method: 'POST', headers: {
      'x-github-event': 'pull_request', 'x-hub-signature-256': signatureOverride ?? `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`
    }, body: raw });
  };
  return { checks, send };
}
const pr = body => ({ state: 'open', number: 5, head: { sha: context.sha }, base: { repo: { full_name: 'org/repo' } }, body });
test('HTTP webhook checks fresh PR, not event body', async t => {
  const f = await fixture(t, async () => pr(signed({})));
  assert.equal((await f.send()).status, 200);
  assert.equal(f.checks[0].check.conclusion, 'success');
  assert.equal(f.checks[0].check.head_sha, context.sha);
});
test('HTTP missing proof produces explicit failure', async t => {
  const f = await fixture(t, async () => pr('Astra'));
  assert.equal((await f.send()).status, 200);
  assert.equal(f.checks[0].check.conclusion, 'failure');
});
test('invalid webhook cannot publish a check', async t => {
  const f = await fixture(t, async () => pr(signed({})));
  assert.equal((await f.send({}, 'sha256=' + '0'.repeat(64))).status, 401);
  assert.equal(f.checks.length, 0);
});
test('API outage does not publish success', async t => {
  const f = await fixture(t, async () => { throw new Error('offline'); });
  assert.equal((await f.send()).status, 503);
  assert.equal(f.checks.length, 0);
});
test('closed PR events ignored', async t => {
  const f = await fixture(t, async () => { throw new Error('must not read'); });
  assert.equal((await f.send({ action: 'closed' })).status, 200);
  assert.equal(f.checks.length, 0);
});
test('concurrent PR edits run serially and newest body wins', async t => {
  let active = 0; let max = 0; let reads = 0;
  const f = await fixture(t, async () => {
    active++; max = Math.max(max, active);
    await new Promise(resolve => setTimeout(resolve, 20)); active--;
    return pr(++reads === 1 ? signed({}) : 'proof removed');
  });
  await Promise.all([f.send(), f.send({ action: 'edited' })]);
  assert.equal(max, 1);
  assert.deepEqual(f.checks.map(c => c.check.conclusion), ['success', 'failure']);
});
