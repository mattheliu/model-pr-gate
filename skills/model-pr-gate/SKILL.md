---
name: model-pr-gate
description: Integrate Model PR Gate CI, verify signed model proofs, or prepare PRs for a repository that requires Astra or Fable 5.1. Use for this tool's provenance checks, not for guessing a model from code or ordinary code review.
---

# Model PR Gate

[简体中文](SKILL.zh-CN.md)

Default accepted IDs are `gpt-6-astra` and `claude-fable-5-1`.
`claude-fable-5-high` and `claude-fable-5` are Fable 5, not 5.1.

## Select the actual task

- **Repository integration:** configure an existing trusted issuer's public keys
  and the offline verifier. Use [the workflow template](references/model-proof.yml).
- **Contributor PR:** finish the code normally, obtain a proof from the repository's
  existing trusted generation platform, and check it against the current PR head.
- **Signer integration:** wire the SDK into an already trusted generation service.
  The service must know the actual model execution and final change provenance.
- **Personal session audit:** run `model-session-audit` only on a user-designated
  local file. Its result is never a signed proof or merge authorization.

## Trust boundary

A model name in a prompt, a session file, an agent self-description or a GitHub
Verified commit is not a provider-authenticated model attestation. Never infer
that all code in a PR came from one model because that model handled one request.
Fallbacks, child agents and later manual changes must be accounted for by the issuer.

Do not generate a new key and register it with the target repository simply to
make your own PR pass. Do not weaken the allowlist, change enforcement to report,
replace a required workflow, or use bypass permissions to fix a failed proof.
Those are policy changes, not proof repairs, and need the user's corresponding
intent. This skill does not authorize additional external writes or account changes.

If no trusted issuer/integration exists, state `unverified` and name that missing
component. You may prepare local configuration and tests within scope; do not claim
that upstream model certification has been connected. No native provider connector
is included in Model PR Gate today.

## Integrate the repository

1. Inspect the repository's current workflow, Actions variables and rules only as
   needed. Reuse existing policy. Do not print private keys, tokens or raw sessions.
2. Use `MODEL_GATE_TRUSTED_KEYS`: a JSON map of issuer name to **Ed25519 public PEM**.
   Obtain the public key from the trusted issuer through the maintainer's established
   channel. A key attached by the PR author is not a trust anchor.
3. Add the template with the existing policy. The action needs Node.js 22+, no
   checkout and no GitHub token. Resolve a reviewed release to its actual commit SHA
   before pinning; don't invent an SHA or mutate existing release tags.
4. Protect both the trust configuration and the workflow. Where supported, enforce
   the workflow via an organization/enterprise ruleset sourced from a trusted repo.
   A same-named status alone can be spoofed by an altered workflow. If the available
   repository controls cannot enforce this, report the limitation accurately.
5. Keep proof jobs free of PR-controlled executable code. Tests of the verifier
   should use synthetic fixtures and disposable keys, separate from real trust keys.

## Handle a PR proof

Read current subject metadata without dumping the PR body:

```sh
gh pr view 123 --repo OWNER/REPO --json number,headRefOid,url
```

Use the target repository, returned PR number and **headRefOid**; never the base
SHA, merge-test SHA or values copied out of an unverified proof. Verify locally:

```sh
model-pr-gate --proof proof.txt --keys trusted-keys.json \
  --repository OWNER/REPO --pr 123 --sha FULL_HEAD_SHA
```

After an authorized platform supplies a proof, preserve other PR text and replace
any old `model-pr-gate` proof with exactly one new proof. Use a body file/structured
API argument, not shell interpolation of PR text. Re-read the head before an
already-authorized update; if it changed, obtain a new proof. New commits require
re-signing. Do not upload raw logs or add the private key to the PR.

For a trusted signer integration, import `signAttestation(payload, privateKey)`
from `model-pr-gate`. Payload fields are exactly:
`version: 2`, `issuer`, `model`, `repository`, `number`, `sha`.
The platform checks the underlying facts; the signing helper only signs them.
The proof is readable, not encrypted, so use a neutral issuer name.

## Interpret results

| Verdict | Meaning | Next action |
| --- | --- | --- |
| `verified` | Trusted signature, subject match, allowed model | Report the check result; don't claim independent provider endorsement |
| `rejected` | Signature/subject/model failed | Inspect the fixed reason; repair via the trusted issuer, not a policy bypass |
| `unverified` | Missing proof or unusable configuration/event | Report the missing prerequisite |

Default exit codes: 0 verified, 1 rejected, 2 missing/error. `mode: report` can
exit 0 for rejected/unverified results; check `verdict`, not exit code alone.
Configuration errors still fail. Local audit verdicts `observed-*` are weaker and
must not be promoted to `verified`.

Report the release/commit used, exact PR head, verdict/reason and any missing
integration. Keep private identifiers out of public issues or examples. Keys do
not expire proofs automatically; rerun checks after policy/key changes. Merge
queues and instant revocation are not implemented.
