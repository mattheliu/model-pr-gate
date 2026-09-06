import { DEFAULT_ALLOWED_MODELS } from './defaults.js';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { sessionInspector } from './session.js';

export async function inspectSessionFile(filename, agent, allowedModels = DEFAULT_ALLOWED_MODELS) {
  if (!Array.isArray(allowedModels) || !allowedModels.length || allowedModels.some(m => typeof m !== 'string' || !m.trim())) {
    throw new Error('At least one exact model ID is required');
  }
  const inspector = sessionInspector(agent, allowedModels);
  const stream = createReadStream(filename, { encoding: 'utf8' });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of lines) inspector.line(line);
    return inspector.result();
  } finally {
    lines.close();
    stream.destroy();
  }
}
