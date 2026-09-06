import { createPublicKey, sign, verify } from 'node:crypto';
import { DEFAULT_ALLOWED_MODELS } from './defaults.js';

const PREFIX = '<!-- model-pr-gate:v2:';
const FIELDS = ['version', 'issuer', 'model', 'repository', 'number', 'sha'];
function schema(p) {
  return p && typeof p === 'object' && !Array.isArray(p) &&
    Object.keys(p).length === FIELDS.length && FIELDS.every(k => Object.hasOwn(p, k)) &&
    p.version === 2 && typeof p.issuer === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(p.issuer) &&
    typeof p.model === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/.test(p.model) &&
    typeof p.repository === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(p.repository) &&
    p.repository.length <= 200 && Number.isSafeInteger(p.number) && p.number > 0 &&
    typeof p.sha === 'string' && /^[a-f0-9]{40}$/.test(p.sha);
}
export function validateKeys(keys) {
  if (!keys || typeof keys !== 'object' || Array.isArray(keys) || !Object.keys(keys).length) throw new Error('Invalid trust configuration');
  for (const [issuer, pem] of Object.entries(keys)) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(issuer) ||
        typeof pem !== 'string' || !pem.startsWith('-----BEGIN PUBLIC KEY-----') ||
        createPublicKey(pem).asymmetricKeyType !== 'ed25519') throw new Error('Invalid issuer public key');
  }
}
export function signAttestation(payload, privateKey) {
  // Exact schema prevents accidentally publishing prompts, run IDs or other extra fields.
  if (!schema(payload)) throw new Error('Invalid minimal proof payload');
  if (createPublicKey(privateKey).asymmetricKeyType !== 'ed25519') throw new Error('Signing key must be Ed25519');
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(null, Buffer.from(encoded), privateKey).toString('base64url');
  return `${PREFIX}${encoded}.${signature} -->`;
}
export function verifyAttestation({ body, repository, number, sha }, keys, allowedModels = DEFAULT_ALLOWED_MODELS) {
  validateKeys(keys);
  if (!Array.isArray(allowedModels) || !allowedModels.length || allowedModels.some(m => typeof m !== 'string' || !m.trim())) throw new Error('Invalid allowlist');
  const result = (verdict, reason) => ({ verdict, reason, evidenceLevel: verdict === 'verified' ? 'trusted-issuer' : 'none' });
  if (typeof body !== 'string' || !body.includes('<!-- model-pr-gate:')) return result('unverified', 'missing-proof');
  if (body.length > 1048576 || body.split('<!-- model-pr-gate:').length !== 2) return result('rejected', 'invalid-proof');
  const match = body.match(/<!-- model-pr-gate:v2:([A-Za-z0-9_-]{1,4096})\.([A-Za-z0-9_-]{86}) -->/);
  if (!match) return result('rejected', 'invalid-proof');
  try {
    const [, encoded, signature] = match;
    const p = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!schema(p)) return result('rejected', 'invalid-proof');
    if (!Object.hasOwn(keys, p.issuer)) return result('rejected', 'untrusted-issuer');
    if (!verify(null, Buffer.from(encoded), keys[p.issuer], Buffer.from(signature, 'base64url'))) return result('rejected', 'invalid-signature');
    if (p.repository !== repository || p.number !== number || p.sha !== sha) return result('rejected', 'subject-mismatch');
    if (!allowedModels.includes(p.model)) return result('rejected', 'model-not-allowed');
    return result('verified', 'valid-proof');
  } catch {
    return result('rejected', 'invalid-proof');
  }
}
