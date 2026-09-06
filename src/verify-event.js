import { verifyAttestation } from './attestation.js';

export function verifyPREvent(event, repository, keys, allowedModels) {
  const pr = event?.pull_request;
  if (!pr || event.repository?.full_name !== repository || pr.base?.repo?.full_name !== repository ||
      !Number.isSafeInteger(pr.number) || pr.number < 1 || !/^[a-f0-9]{40}$/.test(pr.head?.sha || '')) {
    throw new Error('Expected a pull request event for this repository');
  }
  return verifyAttestation({ body: pr.body, repository, number: pr.number, sha: pr.head.sha }, keys, allowedModels);
}
