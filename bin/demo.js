import { generateKeyPairSync } from 'node:crypto';
import { signProof, evaluate, validatePolicy } from '../src/proof.js';
const keys = generateKeyPairSync('ed25519');
const policy = validatePolicy({ allowedModels: ['Astra', 'Fable 5.1'], trustedIssuers: {
  demo: { publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }), models: ['Astra', 'Fable 5.1'] }
} });
const context = { repository: 'example/project', number: 7, sha: 'a'.repeat(40) };
for (const model of ['Astra', 'Fable 5.1', 'Other Model']) {
  const body = signProof({ version: 1, issuer: 'demo', ...context, model, runId: 'demo-run', issuedAt: Math.floor(Date.now() / 1000) }, keys.privateKey);
  console.log(model, evaluate({ ...context, body }, policy));
}
console.log('Missing proof', evaluate({ ...context, body: 'Made by Astra' }, policy));
