import { validateKeys, verifyAttestation } from './core/attestation.js';
import { DEFAULT_ALLOWED_MODELS } from './core/defaults.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const modelId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/.test(value);
const result = (verdict, reason, evidenceLevel = 'none') => ({ verdict, reason, evidenceLevel });

export function configuration(raw = {}) {
  try {
    if (!object(raw) || Object.keys(raw).some(key => !['trustedKeys', 'allowedModels', 'language'].includes(key))) throw 0;
    const { trustedKeys = {}, allowedModels = DEFAULT_ALLOWED_MODELS, language = 'en' } = raw;
    if (!object(trustedKeys) || !Array.isArray(allowedModels) || !allowedModels.length ||
        !allowedModels.every(modelId) || !['en', 'zh-CN'].includes(language)) throw 0;
    if (Object.keys(trustedKeys).length) validateKeys(trustedKeys);
    return Object.freeze({
      trustedKeys: Object.freeze({ ...trustedKeys }),
      allowedModels: Object.freeze([...allowedModels]),
      language,
    });
  } catch {
    // Never include untrusted configuration, key material or paths in errors.
    throw new Error('Invalid Model PR Gate configuration');
  }
}

export function preflight(args, agent, config) {
  if (!object(args) || Object.keys(args).length) throw new Error('Invalid preflight arguments');
  // Read only this field: never session history, prompts, credentials or requests.
  const model = agent?.options?.model;
  if (!modelId(model)) return result('unknown', 'configured-model-unavailable');
  return config.allowedModels.includes(model)
    ? result('allowed', 'configured-model-allowed', 'local-config')
    : result('disallowed', 'configured-model-not-allowed', 'local-config');
}

export function verifyProof(args, config) {
  if (!object(args) || Object.keys(args).some(key => !['proof', 'repository', 'number', 'sha'].includes(key)) ||
      typeof args.repository !== 'string' || args.repository.length > 200 ||
      !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(args.repository) ||
      !Number.isSafeInteger(args.number) || args.number <= 0 ||
      typeof args.sha !== 'string' || !/^[a-f0-9]{40}$/.test(args.sha) ||
      (args.proof !== undefined && typeof args.proof !== 'string')) {
    throw new Error('Invalid proof arguments');
  }
  if (!Object.keys(config.trustedKeys).length) return result('unverified', 'missing-trusted-keys');
  if (args.proof === undefined || !args.proof.trim()) return result('unverified', 'missing-proof');
  // Accept the minimal comment only; don't turn this into a PR body/log reader.
  if (args.proof.length > 8192 || !/^<!-- model-pr-gate:v2:[A-Za-z0-9_-]{1,4096}\.[A-Za-z0-9_-]{86} -->$/.test(args.proof.trim())) {
    return result('rejected', 'invalid-proof');
  }
  return verifyAttestation({ body: args.proof.trim(), repository: args.repository, number: args.number, sha: args.sha },
    config.trustedKeys, config.allowedModels);
}
