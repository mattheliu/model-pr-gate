import { readFileSync } from 'node:fs';
import { signAttestation } from '../src/attestation.js';
try {
  const [keyFile, payloadFile] = process.argv.slice(2);
  console.log(signAttestation(JSON.parse(readFileSync(payloadFile, 'utf8')), readFileSync(keyFile, 'utf8')));
} catch {
  console.error('Unable to sign minimal proof. Check the payload schema and Ed25519 private key.');
  process.exitCode = 2;
}
