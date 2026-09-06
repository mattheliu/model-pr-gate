import { readFileSync, appendFileSync } from 'node:fs';
import { verifyPREvent } from '../src/verify-event.js';
import { strings } from '../src/i18n.js';
let result = { verdict: 'unverified', reason: 'configuration-error', evidenceLevel: 'none' };
let configError = false;
let text = strings();
const mode = process.env.MODEL_GATE_MODE || 'enforce';
try {
  text = strings(process.env.MODEL_GATE_LANGUAGE || 'en');
  if (!['enforce', 'report'].includes(mode)) throw new Error('Invalid mode');
  const keys = JSON.parse(process.env.MODEL_GATE_TRUSTED_KEYS || '{}');
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const allowed = (process.env.MODEL_GATE_ALLOWED || '').split(/\r?\n/).map(m => m.trim()).filter(Boolean);
  result = verifyPREvent(event, process.env.GITHUB_REPOSITORY, keys, allowed.length ? allowed : undefined);
} catch {
  configError = true;
}
// Never log event data, proof data, key configuration, model names or paths.
console.log(`${text.proof}: ${result.verdict} (${result.reason})`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,
  `verdict=${result.verdict}\nreason=${result.reason}\nevidence-level=${result.evidenceLevel}\n`);
process.exitCode = configError ? 2 : mode === 'report' || result.verdict === 'verified' ? 0 : result.verdict === 'rejected' ? 1 : 2;
