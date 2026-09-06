// This is an integration harness, not a real provider attestation.
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { signAttestation } from '../src/attestation.js';
const dir = mkdtempSync(join(tmpdir(), 'installed-proof-'));
try {
  const pair = generateKeyPairSync('ed25519');
  const payload = { version:2,issuer:'test',model:'claude-fable-5-1',repository:'example/repo',number:1,sha:'a'.repeat(40) };
  writeFileSync(join(dir,'proof'),signAttestation(payload,pair.privateKey));
  writeFileSync(join(dir,'keys'),JSON.stringify({test:pair.publicKey.export({type:'spki',format:'pem'})}));
  const result = spawnSync('model-pr-gate',['--proof',join(dir,'proof'),'--keys',join(dir,'keys'),'--repository','example/repo','--pr','1','--sha',payload.sha],{encoding:'utf8'});
  if (result.status !== 0 || JSON.parse(result.stdout).verdict !== 'verified') throw new Error('Installed proof CLI failed');
  console.log('Installed proof CLI verified a synthetic attestation.');
} finally { rmSync(dir,{recursive:true,force:true}); }
