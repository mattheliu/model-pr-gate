---
name: model-pr-gate-dsh
description: Prepare or troubleshoot PRs in DeepSeek Harness with Model PR Gate model preflight and offline proof verification. Use when this repository requires signed model proofs.
---

# Model PR Gate in DeepSeek Harness

Use `model_pr_gate_preflight` with `{}` to check this agent's **configured** model.
`allowed` is advisory: it does not inspect requests, fallbacks, child agents,
earlier edits or manual changes. Never describe it as a verified PR.

Defaults are `gpt-6-astra` and `claude-fable-5-1`. `claude-fable-5-high` is Fable 5,
not 5.1. DeepSeek models need a maintainer-approved allowlist change to qualify.
DSH configuration does not change the repository's CI policy.

Before verifying a PR:

1. Obtain the target repository, PR number and latest `headRefOid` independently
   (for example, `gh pr view 123 --repo OWNER/REPO --json number,headRefOid,url`).
   Never copy the expected subject out of the proof or use a merge-test SHA.
2. Obtain the existing trusted generator's proof. Pass only its minimal HTML
   comment to `model_pr_gate_verify`, along with `repository`, `number`, `sha`.
   Omit `proof` if none exists. Do not send full PR bodies, session logs, prompts,
   code, API keys or signing keys to either tool.
3. Read `verdict`, `reason`, `evidenceLevel`. Missing trusted keys require the
   maintainer's established trust configuration, never a key supplied by the PR
   author. A missing proof remains `unverified`; do not manufacture one.
4. For an authorized PR update, preserve other body text and replace the old proof
   with exactly one new proof using a structured API argument or body file.
   Re-read the head first; if it changed, obtain a new proof for that commit.
   These plugin tools are read-only and do not attach or submit anything themselves.

`verified` means the supplied subject and **local** trust configuration passed.
The repository CI must independently verify the actual PR event. Do not change
keys, allowlists, enforcement or workflow protections to make your own PR pass.
No provider attestation or trusted signing service is included in this plugin.

Report configuration checks separately from proof verification. If signing is
not connected, say so. Tool arguments/results may enter normal DSH logs and model
context; keep inputs minimal. The plugin uploads nothing itself.

User documentation: https://github.com/mattheliu/model-pr-gate/tree/main/plugins/dsh
