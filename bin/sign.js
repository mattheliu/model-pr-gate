import { readFileSync } from 'node:fs';
import { signProof } from '../src/proof.js';
const [keyFile, payloadFile] = process.argv.slice(2);
if (!keyFile || !payloadFile) throw new Error('Usage: node bin/sign.js <private-key.pem> <payload.json>');
const payload = JSON.parse(readFileSync(payloadFile, 'utf8'));
console.log(signProof(payload, readFileSync(keyFile, 'utf8')));
