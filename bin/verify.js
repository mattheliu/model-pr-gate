#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { verifyAttestation } from '../src/attestation.js';
import { strings } from '../src/i18n.js';
let text = strings();
try {
  const args = process.argv.slice(2);
  const languageIndex = args.indexOf('--lang');
  if (languageIndex !== -1) text = strings(args[languageIndex + 1] || 'invalid');
  if (args.includes('--help')) { console.log(text.proofHelp); process.exit(0); }
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (!['--proof', '--keys', '--repository', '--pr', '--sha', '--lang'].includes(args[i]) || !args[i + 1] || Object.hasOwn(opts, args[i])) throw new Error('Invalid option');
    opts[args[i]] = args[++i];
  }
  text = strings(opts['--lang'] || 'en');
  const result = verifyAttestation({ body: readFileSync(opts['--proof'], 'utf8'), repository: opts['--repository'],
    number: Number(opts['--pr']), sha: opts['--sha'] }, JSON.parse(readFileSync(opts['--keys'], 'utf8')));
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.verdict === 'verified' ? 0 : result.verdict === 'rejected' ? 1 : 2;
} catch {
  console.error(text.proofError);
  process.exitCode = 2;
}
