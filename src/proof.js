import { createPublicKey, sign, verify } from 'node:crypto';

const marker = /<!-- model-pr-gate:([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+) -->/g;
export function validatePolicy(policy) {
  if (!Array.isArray(policy.allowedModels) || !policy.allowedModels.length ||
      policy.allowedModels.some(m => typeof m !== 'string' || !m.trim())) throw new Error('Invalid allowedModels');
  if (!policy.trustedIssuers || !Object.keys(policy.trustedIssuers).length) throw new Error('No trusted issuers');
  for (const issuer of Object.values(policy.trustedIssuers)) {
    if (createPublicKey(issuer.publicKey).asymmetricKeyType !== 'ed25519') throw new Error('Issuer key must be Ed25519');
    if (!Array.isArray(issuer.models) || !issuer.models.length) throw new Error('Issuer must specify models');
  }
  return policy;
}
export function signProof(payload, privateKey) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(null, Buffer.from(encoded), privateKey).toString('base64url');
  return `<!-- model-pr-gate:${encoded}.${signature} -->`;
}
export function evaluate({ body, repository, number, sha }, policy, now = Math.floor(Date.now() / 1000)) {
  const reject = reason => ({ ok: false, reason });
  if (typeof body !== 'string') return reject('Missing signed model proof');
  const matches = [...body.matchAll(marker)];
  if (matches.length !== 1 || body.split('<!-- model-pr-gate:').length !== 2) return reject('Exactly one signed model proof is required');
  const [encoded, signature] = matches[0][1].split('.');
  if (encoded.length > 16384) return reject('Proof is too large');
  try {
    const proof = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!proof || typeof proof !== 'object' || typeof proof.issuer !== 'string') return reject('Invalid proof schema');
    if (!Object.hasOwn(policy.trustedIssuers, proof.issuer)) return reject('Untrusted issuer');
    const issuer = policy.trustedIssuers[proof.issuer];
    if (!verify(null, Buffer.from(encoded), issuer.publicKey, Buffer.from(signature, 'base64url'))) return reject('Invalid proof signature');
    if (proof.version !== 1 || !Number.isSafeInteger(proof.issuedAt) || proof.issuedAt < 1 || proof.issuedAt > now + 60) return reject('Invalid proof version or issuance time');
    if (typeof proof.runId !== 'string' || !proof.runId.trim() || proof.runId.length > 256) return reject('Missing generation run ID');
    if (proof.repository !== repository || proof.number !== number || proof.sha !== sha) return reject('Proof does not match this repository, PR and current head SHA');
    if (!policy.allowedModels.includes(proof.model)) return reject('Model is not allowed');
    if (!issuer.models.includes(proof.model)) return reject('Issuer is not authorized for this model');
    return { ok: true, reason: `Verified model: ${proof.model}`, model: proof.model, issuer: proof.issuer, runId: proof.runId };
  } catch {
    return reject('Malformed proof or invalid signature');
  }
}
