import { DEFAULT_ALLOWED_MODELS } from './defaults.js';
import { createHash } from 'node:crypto';

// Only known structural fields are inspected. Prose, prompts and tool output are never searched.
export function sessionInspector(agent, allowedModels = DEFAULT_ALLOWED_MODELS) {
  if (!['codex', 'claude'].includes(agent)) throw new Error('Agent must be codex or claude');
  const models = new Map(); const contexts = new Set(); const usageTurns = new Map();
  const requestHashes = new Set(); let malformedLines = 0; let invalidModels = 0;
  const hash = value => createHash('sha256').update(value).digest('hex');
  const add = (model, source) => {
    if (model === '<synthetic>') return;
    if (typeof model !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/ -]{0,99}$/.test(model)) { invalidModels++; return; }
    const key = `${source}\0${model}`;
    const row = models.get(key) || { model, source, records: 0, allowed: allowedModels.includes(model) };
    row.records++; models.set(key, row);
  };
  return {
    line(line) {
      if (!line.trim()) return;
      let e; try { e = JSON.parse(line); } catch { malformedLines++; return; }
      if (!e || typeof e !== 'object') { malformedLines++; return; }
      const p = e.payload || {};
      if (agent === 'codex') {
        if (e.type === 'turn_context') {
          add(p.model, 'configured-model');
          if (typeof p.turn_id === 'string' && typeof p.model === 'string') contexts.add(hash(p.turn_id));
        }
        if (e.type === 'token_usage_record') {
          if (typeof p.response_id === 'string') requestHashes.add(hash(p.response_id));
          const turn = hash(typeof p.turn_id === 'string' ? p.turn_id : '<missing>');
          usageTurns.set(turn, (usageTurns.get(turn) || 0) + 1);
        }
      } else if (e.type === 'assistant' && e.message?.model !== '<synthetic>') {
        add(e.message?.model, 'locally-recorded-response-model');
        if (typeof e.requestId === 'string') requestHashes.add(hash(e.requestId));
      }
    },
    result() {
      const rows = [...models.values()];
      let unlinkedUsage = 0;
      for (const [turn, count] of usageTurns) if (!contexts.has(turn)) unlinkedUsage += count;
      return { agent, evidenceLevel: 'local-unverified', models: rows,
        uniqueRecordedRequestOrResponseIds: requestHashes.size, malformedLines, invalidModels, unlinkedUsage,
        observedPolicy: !rows.length || malformedLines || invalidModels || unlinkedUsage ? 'unknown' : rows.every(r => r.allowed) ? 'observed-models-allowed' : 'observed-disallowed-model',
        mergeAuthorization: 'not-established' };
    }
  };
}
export function inspectSession(raw, agent, allowedModels = DEFAULT_ALLOWED_MODELS) {
  const inspector = sessionInspector(agent, allowedModels);
  for (const line of raw.split('\n')) inspector.line(line);
  return inspector.result();
}
