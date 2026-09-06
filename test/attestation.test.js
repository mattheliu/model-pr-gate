import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { signAttestation, verifyAttestation } from '../src/attestation.js';
import { verifyPREvent } from '../src/verify-event.js';
const keys = generateKeyPairSync('ed25519');
const publicKeys = { signer: keys.publicKey.export({ type: 'spki', format: 'pem' }) };
const subject = { repository: 'example/repo', number: 1, sha: 'a'.repeat(40) };
const payload = { version: 2, issuer: 'signer', model: 'gpt-6-astra', ...subject };
const proof = patch => signAttestation({ ...payload, ...patch }, keys.privateKey);
const check = (body, patch = {}) => verifyAttestation({ ...subject, body, ...patch }, publicKeys);
for (const model of ['gpt-6-astra', 'claude-fable-5-1']) {
  test(`minimal proof accepts ${model}`, () => assert.equal(check(proof({ model })).verdict, 'verified'));
}
for (const model of ['claude-fable-5-high', 'claude-fable-5', 'other']) {
  test(`minimal proof rejects ${model}`, () => assert.equal(check(proof({ model })).reason, 'model-not-allowed'));
}
for (const patch of [{ sha: 'b'.repeat(40) }, { number: 2 }, { repository: 'other/repo' }]) {
  test(`proof bound to ${Object.keys(patch)[0]}`, () => assert.equal(check(proof({}), patch).reason, 'subject-mismatch'));
}
test('minimal proof rejects private extra fields before signing', () => {
  assert.throws(() => proof({ prompt: 'PRIVATE_SENTINEL' }));
  assert.throws(() => proof({ runId: 'PRIVATE_SENTINEL' }));
});
test('missing proof is unverified, duplicates are rejected', () => {
  assert.equal(check('ordinary PR').verdict, 'unverified');
  assert.equal(check(proof({}) + proof({})).verdict, 'rejected');
});
test('unsigned claims and old format do not pass', () => {
  assert.equal(check('<!-- model-pr-gate:v2:e30.AA -->').verdict, 'rejected');
  assert.equal(check('<!-- model-pr-gate:e30.AA -->').verdict, 'rejected');
});
test('tampered payload and wrong key fail signature verification', () => {
  const original = proof({});
  const encoded = original.slice('<!-- model-pr-gate:v2:'.length).split('.')[0];
  const altered = Buffer.from(JSON.stringify({ ...payload, model: 'claude-fable-5-1' })).toString('base64url');
  assert.equal(check(original.replace(encoded, altered)).reason, 'invalid-signature');
  const fake = signAttestation(payload, generateKeyPairSync('ed25519').privateKey);
  assert.equal(check(fake).reason, 'invalid-signature');
});
test('untrusted signer and invalid trust configuration fail closed', () => {
  assert.equal(check(proof({ issuer: 'other' })).reason, 'untrusted-issuer');
  assert.throws(() => verifyAttestation({ ...subject, body: proof({}) }, {}));
  assert.throws(() => verifyAttestation({ ...subject, body: proof({}) }, { signer: keys.privateKey.export({type:'pkcs8',format:'pem'}) }));
});
test('valid signature with private extras is still rejected', () => {
  const encoded = Buffer.from(JSON.stringify({ ...payload, prompt: 'PRIVATE_SENTINEL' })).toString('base64url');
  const signature = sign(null, Buffer.from(encoded), keys.privateKey).toString('base64url');
  assert.equal(check(`<!-- model-pr-gate:v2:${encoded}.${signature} -->`).verdict, 'rejected');
});
const event = body => ({ repository: { full_name: subject.repository }, pull_request: {
  number: subject.number, body, head: { sha: subject.sha }, base: { repo: { full_name: subject.repository } }
} });
test('CI derives expected subject from PR event, never from proof claims', () => {
  assert.equal(verifyPREvent(event(proof({})), subject.repository, publicKeys).verdict, 'verified');
  assert.throws(() => verifyPREvent(event(proof({})), 'other/repo', publicKeys));
  assert.throws(() => verifyPREvent({}, subject.repository, publicKeys));
});
test('action has no token and exports only fixed results', t => {
  const dir = mkdtempSync(join(tmpdir(), 'proof-ci-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const eventPath = join(dir, 'PRIVATE_PATH.json');
  const outputPath = join(dir, 'output');
  writeFileSync(eventPath, JSON.stringify(event('PRIVATE_PROMPT\n' + proof({}))));
  const run = env => spawnSync(process.execPath, [new URL('../bin/verify-action.js', import.meta.url).pathname], {
    encoding: 'utf8', env: { PATH: process.env.PATH, GITHUB_EVENT_PATH: eventPath,
      GITHUB_REPOSITORY: subject.repository, GITHUB_OUTPUT: outputPath,
      MODEL_GATE_TRUSTED_KEYS: JSON.stringify(publicKeys), ...env }
  });
  const valid = run({});
  assert.equal(valid.status, 0);
  assert.equal(valid.stdout.includes('PRIVATE'), false);
  assert.equal(valid.stdout.includes(subject.repository), false);
  assert.equal(valid.stdout.includes('gpt-6-astra'), false);
  assert.equal(readFileSync(outputPath, 'utf8'), 'verdict=verified\nreason=valid-proof\nevidence-level=trusted-issuer\n');
  assert.ok(run({ MODEL_GATE_LANGUAGE: 'zh-CN' }).stdout.includes('模型证明'));
  writeFileSync(eventPath, JSON.stringify(event('no proof')));
  assert.equal(run({}).status, 2);
  assert.equal(run({ MODEL_GATE_MODE: 'report' }).status, 0);
  assert.equal(run({ MODEL_GATE_MODE: 'typo' }).status, 2);
  assert.equal(run({ MODEL_GATE_TRUSTED_KEYS: '{}', MODEL_GATE_MODE: 'report' }).status, 2);
});
test('offline proof CLI works with minimal files', t => {
  const dir = mkdtempSync(join(tmpdir(), 'proof-cli-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'proof'), proof({}));
  writeFileSync(join(dir, 'keys'), JSON.stringify(publicKeys));
  const run = spawnSync(process.execPath, [new URL('../bin/verify.js', import.meta.url).pathname,
    '--proof', join(dir, 'proof'), '--keys', join(dir, 'keys'), '--repository', subject.repository,
    '--pr', '1', '--sha', subject.sha, '--lang', 'zh-CN'], {encoding:'utf8'});
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).verdict, 'verified');
});
