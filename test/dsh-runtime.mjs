// Integration test using an actual DSH install and an isolated Harness home.
// Usage: node test/dsh-runtime.mjs RUNTIME_DIRECTORY PLUGIN_TARBALL
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { signAttestation } from '../src/attestation.js';

const [runtime, archive] = process.argv.slice(2).map(value => resolve(value));
assert.ok(runtime && archive, 'Pass a DSH runtime directory and plugin tarball');
const requireRuntime = createRequire(join(runtime, 'package.json'));
const load = name => import(pathToFileURL(requireRuntime.resolve(name)).href);
const [{ Context }, { default: Tools }, { default: Skills }, { default: SystemPrompt }] = await Promise.all([
  load('@deepseek-ai/cordis'), load('@deepseek-ai/dsh-tools'), load('@deepseek-ai/dsh-skill'), load('@deepseek-ai/dsh-system-prompt'),
]);
const home = await mkdtemp(join(tmpdir(), 'model-pr-gate-dsh-'));
const cli = join(runtime, 'node_modules/@deepseek-ai/dsh/lib/bin.js');
const run = args => {
  const child = spawnSync(process.execPath, [cli, ...args], {
    cwd: home, env: { ...process.env, DSH_HOME: home }, encoding: 'utf8', timeout: 120000,
  });
  assert.equal(child.status, 0, `DSH command failed: ${child.error?.message ?? ''}\n${child.stdout}\n${child.stderr}`);
  return child.stdout;
};
try {
  run(['plugin', '--profile', 'sdk-minimal', 'add', archive]);
  assert.match(run(['--profile', 'sdk-minimal', '--dump-config']), /dsh-model-pr-gate/);
  const profilePath = join(home, 'profiles/sdk-minimal/package.json');
  const requireProfile = createRequire(profilePath);
  const plugin = await import(pathToFileURL(requireProfile.resolve('dsh-model-pr-gate')).href);
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const trustedKeys = { synthetic: publicKey.export({ type: 'spki', format: 'pem' }) };
  const subject = { repository: 'example/project', number: 7, sha: 'a'.repeat(40) };
  const proof = model => signAttestation({ version: 2, issuer: 'synthetic', model, ...subject }, privateKey);

  for (const language of ['en', 'zh-CN']) {
    const ctx = new Context();
    const owners = [ctx.plugin(SystemPrompt), ctx.plugin(Tools), ctx.plugin(Skills)];
    await Promise.all(owners);
    const fiber = ctx.plugin(plugin, { trustedKeys, language });
    await fiber;
    const call = (name, args, agent, signal = new AbortController().signal) => ctx.tools.execute({
      callId: 'synthetic-call', name, arguments: args, agent, signal,
    });
    try {
      assert.deepEqual(ctx.tools.schemas().map(tool => tool.name).sort(), ['model_pr_gate_preflight', 'model_pr_gate_verify']);
      const skill = await ctx.skills.get('model-pr-gate-dsh');
      assert.ok(skill.invocation.modelInvocable && skill.invocation.userInvocable);
      assert.match(skill.content, language === 'en' ? /configured/ : /配置/);
      for (const model of ['gpt-6-astra', 'claude-fable-5-1', 'claude-fable-5-high']) {
        const expected = model === 'claude-fable-5-high' ? 'disallowed' : 'allowed';
        const agent = { options: { model }, get session() { throw Error('private session access'); } };
        const local = await call('model_pr_gate_preflight', {}, agent);
        assert.equal(local.isError, false);
        assert.equal(local.value.verdict, expected);
        const verified = await call('model_pr_gate_verify', { ...subject, proof: proof(model) });
        assert.equal(verified.isError, false);
        assert.equal(verified.value.verdict, expected === 'allowed' ? 'verified' : 'rejected');
        assert.ok(!JSON.stringify(verified.content).includes(subject.repository));
      }
      const moved = await call('model_pr_gate_verify', { ...subject, sha: 'b'.repeat(40), proof: proof('gpt-6-astra') });
      assert.equal(moved.value.reason, 'subject-mismatch');
      const missing = await call('model_pr_gate_verify', subject);
      assert.equal(missing.value.verdict, 'unverified');
      const injected = await call('model_pr_gate_verify', { ...subject, proof: proof('gpt-6-astra'), trustedKeys });
      assert.equal(injected.isError, true);
      const cancelled = await call('model_pr_gate_preflight', {}, undefined, AbortSignal.abort());
      assert.equal(cancelled.isError, true);
    } finally {
      await fiber.dispose();
      assert.deepEqual(ctx.tools.schemas(), []);
      assert.deepEqual(await ctx.skills.list(), []);
      for (const owner of owners.reverse()) await owner.dispose();
    }
  }

  // Profiles without a skills service still get both tools; late service mounting works.
  const ctx = new Context();
  const promptOwner = ctx.plugin(SystemPrompt);
  const toolsOwner = ctx.plugin(Tools);
  await toolsOwner;
  const fiber = ctx.plugin(plugin);
  await fiber;
  assert.equal(ctx.tools.schemas().length, 2);
  const noTrust = await ctx.tools.execute({ callId: 'synthetic-no-trust', name: 'model_pr_gate_verify', arguments: subject, signal: new AbortController().signal });
  assert.equal(noTrust.value.reason, 'missing-trusted-keys');
  const skillsOwner = ctx.plugin(Skills);
  await skillsOwner;
  assert.equal((await ctx.skills.list()).length, 1);
  await fiber.dispose();
  assert.equal((await ctx.skills.list()).length, 0);
  for (const owner of [skillsOwner, toolsOwner, promptOwner]) await owner.dispose();

  run(['plugin', '--profile', 'sdk-minimal', 'remove', 'dsh-model-pr-gate']);
  const profile = JSON.parse(await readFile(profilePath, 'utf8'));
  assert.ok(!profile.dependencies?.['dsh-model-pr-gate']);
  assert.ok(!profile.dsh.profile.bundles.includes('dsh-model-pr-gate'));
  console.log('DSH integration passed: tarball install, composition, real tool execution, en/zh-CN skills, cancellation, disposal and removal.');
} finally {
  await rm(home, { recursive: true, force: true });
}
