import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { sessionInspector } from '../src/session.js';
const [agent, filename, ...allowedModels] = process.argv.slice(2);
if (!filename) {
  console.error('Usage: node bin/inspect-session.js <codex|claude> <session.jsonl> [allowed-model-id ...]');
  process.exitCode = 2;
} else {
  try {
    const inspector = sessionInspector(agent, allowedModels);
    const input = createInterface({ input: createReadStream(filename, { encoding: 'utf8' }), crlfDelay: Infinity });
    for await (const line of input) inspector.line(line);
    const result = inspector.result();
    console.log(JSON.stringify(result, null, 2));
    // Local observation only. A zero exit never authorizes a GitHub merge.
    process.exitCode = result.observedPolicy === 'observed-models-allowed' ? 0 : result.observedPolicy === 'observed-disallowed-model' ? 1 : 2;
  } catch {
    console.error('Unable to inspect session. Check agent name and file readability.');
    process.exitCode = 2;
  }
}
