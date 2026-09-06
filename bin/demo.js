import { generateKeyPairSync } from 'node:crypto';
import { signAttestation, verifyAttestation } from '../src/attestation.js';
const pair = generateKeyPairSync('ed25519');
const keys = { demo: pair.publicKey.export({type:'spki',format:'pem'}) };
const subject = { repository:'example/repo', number:1, sha:'a'.repeat(40) };
for (const model of ['gpt-6-astra','claude-fable-5-1','claude-fable-5-high']) {
  const body = signAttestation({ version:2, issuer:'demo', model, ...subject }, pair.privateKey);
  console.log(model, verifyAttestation({body,...subject}, keys));
}
