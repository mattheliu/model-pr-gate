import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { configuration, preflight, verifyProof } from '../plugins/dsh/checks.js';
import { signAttestation } from '../src/attestation.js';
import { apply } from '../plugins/dsh/index.js';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const config = configuration({ trustedKeys: { synthetic: publicKey.export({ type: 'spki', format: 'pem' }) } });
const subject = { repository: 'example/project', number: 7, sha: 'a'.repeat(40) };
const signed = (model = 'gpt-6-astra', changes = {}) => signAttestation({ version: 2, issuer: 'synthetic', model, ...subject, ...changes }, privateKey);

test('DSH preflight reads only configured model and never returns proof verification', () => {
  for (const [model, expected] of [['gpt-6-astra', 'allowed'], ['claude-fable-5-1', 'allowed'],
    ['claude-fable-5-high', 'disallowed'], ['deepseek-synthetic', 'disallowed'], [undefined, 'unknown']]) {
    const agent = {
      options: { model, get provider() { throw Error('must not read provider'); } },
      get session() { throw Error('must not read session'); },
    };
    const result = preflight({}, agent, config);
    assert.equal(result.verdict, expected);
    assert.notEqual(result.evidenceLevel, 'trusted-issuer');
    assert.ok(!JSON.stringify(result).includes(model ?? 'undefined'));
  }
  assert.throws(() => preflight({ model: 'gpt-6-astra' }, {}, config), /Invalid preflight arguments/);
});

test('DSH has separate missing trust and missing proof outcomes', () => {
  assert.equal(verifyProof({ ...subject, proof: signed() }, configuration()).reason, 'missing-trusted-keys');
  assert.equal(verifyProof(subject, config).reason, 'missing-proof');
  assert.equal(verifyProof({ ...subject, proof: ' ' }, config).verdict, 'unverified');
});

test('DSH verifies both allowed models and rejects Fable 5 without accepting caller policy', () => {
  for (const model of ['gpt-6-astra', 'claude-fable-5-1']) {
    assert.equal(verifyProof({ ...subject, proof: signed(model) }, config).verdict, 'verified');
  }
  assert.equal(verifyProof({ ...subject, proof: signed('claude-fable-5-high') }, config).reason, 'model-not-allowed');
  for (const extra of ['trustedKeys', 'allowedModels']) {
    assert.throws(() => verifyProof({ ...subject, proof: signed(), [extra]: {} }, config), /Invalid proof arguments/);
  }
});

test('DSH binds proofs to independently supplied PR metadata', () => {
  for (const change of [{ sha: 'b'.repeat(40) }, { number: 8 }, { repository: 'example/other' }]) {
    assert.equal(verifyProof({ ...subject, ...change, proof: signed() }, config).reason, 'subject-mismatch');
  }
  for (const change of [{ sha: '' }, { number: 0 }, { number: 1.5 }, { repository: '../invalid/path' }]) {
    assert.throws(() => verifyProof({ ...subject, ...change, proof: signed() }, config), /Invalid proof arguments/);
  }
});

test('DSH rejects tampering, duplicated proofs and surrounding private text', () => {
  const proof = signed();
  const tampered = proof.replace(/\.([A-Za-z0-9_-])/, (_, first) => `.${first === 'A' ? 'B' : 'A'}`);
  assert.equal(verifyProof({ ...subject, proof: tampered }, config).reason, 'invalid-signature');
  for (const invalid of [proof + proof, `SYNTHETIC_PRIVATE_PROMPT\n${proof}`, 'x'.repeat(8193)]) {
    const outcome = verifyProof({ ...subject, proof: invalid }, config);
    assert.equal(outcome.reason, 'invalid-proof');
    assert.ok(!JSON.stringify(outcome).includes('SYNTHETIC_PRIVATE_PROMPT'));
  }
});

test('DSH configuration is copied, strictly validated and errors do not expose inputs', () => {
  const models = ['deepseek-synthetic'];
  const keys = { ...config.trustedKeys };
  const custom = configuration({ allowedModels: models, trustedKeys: keys, language: 'zh-CN' });
  models.push('gpt-6-astra');
  delete keys.synthetic;
  assert.equal(preflight({}, { options: { model: 'gpt-6-astra' } }, custom).verdict, 'disallowed');
  assert.equal(verifyProof({ ...subject, proof: signed('deepseek-synthetic') }, custom).verdict, 'verified');
  for (const bad of [null, [], { language: 'invalid' }, { allowedModels: [] }, { allowedModels: ['Astra display'] },
    { privateKey: 'SYNTHETIC_PRIVATE_KEY' }, { trustedKeys: { synthetic: 'SYNTHETIC_PRIVATE_KEY' } }]) {
    assert.throws(() => configuration(bad), { message: 'Invalid Model PR Gate configuration' });
  }
});

test('DSH tools honor cancellation and localize output without echoing proof data', async () => {
  const tools = new Map();
  const ctx = { tools: { register(tool) { tools.set(tool.name, tool); } }, inject() {} };
  apply(ctx, { ...config, language: 'zh-CN' });
  const tool = tools.get('model_pr_gate_verify');
  const args = { ...subject, proof: signed() };
  const result = await tool.execute(args, { signal: new AbortController().signal });
  const text = JSON.stringify(tool.output.render(args, result));
  assert.match(text, /仓库 CI/);
  for (const hidden of [subject.sha, subject.repository, args.proof, 'synthetic', 'gpt-6-astra']) assert.ok(!text.includes(hidden));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(tool.execute(args, { signal: controller.signal }), { name: 'AbortError' });
});
