import { strings } from '../src/i18n.js';
import { appendFileSync } from 'node:fs';
import { inspectSessionFile } from '../src/session-file.js';
let verdict = 'unknown';
let invalidConfig = false;
const mode = process.env.MODEL_GATE_MODE || 'enforce';
let text = strings();
try {
  try { text = strings(process.env.MODEL_GATE_LANGUAGE || 'en'); } catch { invalidConfig = true; throw new Error('Invalid language'); }
  if (!['enforce', 'report'].includes(mode)) { invalidConfig = true; throw new Error('Invalid mode'); }
  const allowed = (process.env.MODEL_GATE_ALLOWED || '').split(/\r?\n/).map(m => m.trim()).filter(Boolean);
  const result = await inspectSessionFile(process.env.MODEL_GATE_SESSION, process.env.MODEL_GATE_AGENT, allowed.length ? allowed : undefined);
  verdict = result.observedPolicy;
} catch {
  // Do not print exceptions: filesystem errors may include private paths.
  console.error(text.auditError);
}
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `verdict=${verdict}\nevidence-level=local-unverified\n`);
}
// CI logs receive only fixed verdicts, never models, paths, IDs, or transcript data.
console.log(`${text.audit}: ${verdict}; ${text.evidence}: local-unverified`);
process.exitCode = invalidConfig ? 2 : mode === 'report' || verdict === 'observed-models-allowed' ? 0 : verdict === 'observed-disallowed-model' ? 1 : 2;
