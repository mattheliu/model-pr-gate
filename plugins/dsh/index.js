import { readFileSync } from 'node:fs';
import { configuration, preflight, verifyProof } from './checks.js';
import { render, strings } from './i18n.js';

export const name = 'model-pr-gate';
export const inject = ['tools'];

const resultSchema = (verdicts, reasons, levels) => ({
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: verdicts },
    reason: { type: 'string', enum: reasons },
    evidenceLevel: { type: 'string', enum: levels },
  },
  required: ['verdict', 'reason', 'evidenceLevel'],
  additionalProperties: false,
});

export function apply(ctx, rawConfig) {
  const config = configuration(rawConfig);
  const text = strings(config.language);
  const output = schema => ({ schema, render: (_args, value) => render(value, config.language) });
  // Raw JSON Schema is part of DSH's public tool contract. Validate inputs in
  // checks.js as well, keeping this adapter free of runtime package dependencies.
  ctx.tools.register({
    name: 'model_pr_gate_preflight',
    description: text.preflight,
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: output(resultSchema(['allowed', 'disallowed', 'unknown'],
      ['configured-model-allowed', 'configured-model-not-allowed', 'configured-model-unavailable'], ['local-config', 'none'])),
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      exec.signal.throwIfAborted();
      return preflight(args, exec.agent, config);
    },
  });
  ctx.tools.register({
    name: 'model_pr_gate_verify',
    description: text.verify,
    parameters: {
      type: 'object',
      properties: {
        repository: { type: 'string', description: 'Target OWNER/REPO, independently obtained.' },
        number: { type: 'integer', description: 'Actual PR number, independently obtained.' },
        sha: { type: 'string', description: 'Current PR headRefOid: 40 lowercase hexadecimal characters.' },
        proof: { type: 'string', description: 'Only the minimal model-pr-gate HTML comment; omit if missing.' },
      },
      required: ['repository', 'number', 'sha'],
      additionalProperties: false,
    },
    output: output(resultSchema(['verified', 'rejected', 'unverified'],
      ['valid-proof', 'missing-proof', 'invalid-proof', 'untrusted-issuer', 'invalid-signature', 'subject-mismatch', 'model-not-allowed', 'missing-trusted-keys'],
      ['trusted-issuer', 'none'])),
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      exec.signal.throwIfAborted();
      return verifyProof(args, config);
    },
  });
  // Tools remain usable in minimal profiles that do not provide a skill registry.
  ctx.inject(['skills'], scoped => {
    const filename = config.language === 'zh-CN' ? 'SKILL.zh-CN.md' : 'SKILL.md';
    const content = readFileSync(new URL(`skills/model-pr-gate-dsh/${filename}`, import.meta.url), 'utf8')
      .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
    scoped.skills.register({ name: 'model-pr-gate-dsh', description: text.skill, source: 'runtime', content });
  });
}
