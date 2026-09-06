import http from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { evaluate, validatePolicy } from './proof.js';
import { githubClient } from './github.js';

export function validWebhook(raw, signature, secret) {
  if (typeof signature !== 'string' || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'));
}
const actions = new Set(['opened', 'reopened', 'synchronize', 'edited', 'ready_for_review']);
export function createHandler({ secret, policy, github, logger = console }) {
  validatePolicy(policy);
  if (!secret || secret.length < 32) throw new Error('Webhook secret must be at least 32 characters');
  // Single-process serialization: always fetch current state, never trust stale event bodies.
  const queues = new Map();
  async function check(payload) {
    const repo = payload.repository?.full_name;
    const number = payload.pull_request?.number;
    const installation = payload.installation?.id;
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo || '') || !Number.isSafeInteger(number) || number < 1 || !Number.isSafeInteger(installation) || installation < 1) throw new Error('Invalid PR event');
    const key = `${repo}#${number}`;
    const prior = queues.get(key) || Promise.resolve();
    const next = prior.catch(() => {}).then(async () => {
      const client = await github.installation(installation);
      const pr = await client.getPR(repo, number);
      if (pr.state !== 'open') return;
      if (!/^[a-f0-9]{40}$/.test(pr.head?.sha || '') || pr.number !== number || pr.base?.repo?.full_name !== repo) throw new Error('Invalid current PR response');
      const verdict = evaluate({ body: pr.body, repository: repo, number, sha: pr.head.sha }, policy);
      await client.createCheck(repo, {
        name: 'model-pr-gate', head_sha: pr.head.sha, status: 'completed',
        conclusion: verdict.ok ? 'success' : 'failure',
        output: { title: verdict.ok ? 'Model provenance verified' : 'Model provenance rejected',
          summary: `${verdict.reason}\n\nPR #${number}. Proofs attest a trusted issuer’s generation record; they do not infer authorship from source code.` }
      });
    });
    queues.set(key, next);
    try { await next; } finally { if (queues.get(key) === next) queues.delete(key); }
  }
  return async (req, res) => {
    const reply = (status, message) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ message })); };
    if (req.method === 'GET' && req.url === '/healthz') return reply(200, 'ok');
    if (req.method !== 'POST' || req.url !== '/webhooks/github') return reply(404, 'not found');
    try {
      const chunks = []; let length = 0;
      for await (const chunk of req) {
        length += chunk.length;
        if (length > 2 * 1024 * 1024) return reply(413, 'payload too large');
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks);
      if (!validWebhook(raw, req.headers['x-hub-signature-256'], secret)) return reply(401, 'invalid signature');
      let payload;
      try { payload = JSON.parse(raw.toString('utf8')); } catch { return reply(400, 'invalid JSON'); }
      if (req.headers['x-github-event'] !== 'pull_request' || !actions.has(payload?.action)) return reply(200, 'ignored');
      await check(payload);
      return reply(200, 'checked');
    } catch (error) {
      logger.error('Model PR check failed:', error.message);
      return reply(503, 'check failed; inspect logs and redeliver webhook');
    }
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const requireEnv = key => { if (!process.env[key]) throw new Error(`Missing ${key}`); return process.env[key]; };
  const policy = JSON.parse(readFileSync(requireEnv('POLICY_PATH'), 'utf8'));
  const github = githubClient({ appId: requireEnv('GITHUB_APP_ID'), privateKey: readFileSync(requireEnv('GITHUB_APP_PRIVATE_KEY_PATH'), 'utf8') });
  const server = http.createServer(createHandler({ secret: requireEnv('GITHUB_WEBHOOK_SECRET'), policy, github }));
  server.requestTimeout = 15000;
  server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log('Model PR Gate listening'));
}
