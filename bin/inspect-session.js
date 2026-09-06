#!/usr/bin/env node
import { inspectSessionFile } from '../src/session-file.js';
import { strings } from '../src/i18n.js';
let text = strings();
try {
  const args = process.argv.slice(2);
  const index = args.indexOf('--lang');
  if (index !== -1) { text = strings(args[index + 1] || 'invalid'); args.splice(index, 2); }
  const [agent, filename, ...allowedModels] = args;
  if (agent === '--help' || agent === '-h' || !filename) {
    console.log(text.help);
    process.exitCode = agent === '--help' || agent === '-h' ? 0 : 2;
  } else {
    const result = await inspectSessionFile(filename, agent, allowedModels.length ? allowedModels : undefined);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.observedPolicy === 'observed-models-allowed' ? 0 : result.observedPolicy === 'observed-disallowed-model' ? 1 : 2;
  }
} catch {
  console.error(text.error);
  process.exitCode = 2;
}
