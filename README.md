# Model PR Gate

**English** · [简体中文](README.zh-CN.md)

**Accept signed PR proofs for Astra and Fable 5.1, without uploading sessions.**

A trusted generation service signs a small record. Your repository's CI checks
that signature offline. No third-party GitHub App, session uploads, API keys or
background service are needed for verification. Node.js 22+, zero dependencies.

**This verifies evidence; it does not discover which model wrote arbitrary code.**
You need a generation platform you trust to issue the proof. This project provides
the signer and verifier, but has no built-in OpenAI or Anthropic attestation
integration. Without a trusted signer, the result is `unverified`.

## What gets shared?

Only model ID, commit SHA, issuer, repository, PR number, format version and
signature. Repository and PR bind the proof to its destination. No prompts, code,
session IDs, request IDs, personal paths or timestamps. Extra fields are rejected.
The proof is signed, not encrypted: anyone who can read the PR can decode it.

The generation platform appends this small proof to the PR body automatically.
Contributors shouldn't have to find or upload a session file.

## Connect a repository

First, register the signer's **public** keys in a repository Actions variable
called `MODEL_GATE_TRUSTED_KEYS`. It is a JSON object like
`{"generation-service":"-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"}`.
The private key stays with the trusted generator, never in a contributor's PR job.

Add this workflow:

```yaml
name: Model proof
on:
  pull_request:
    types: [opened, reopened, synchronize, edited, ready_for_review]
permissions: {}
concurrency:
  group: model-proof-${{ github.event.pull_request.number }}
  cancel-in-progress: true
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: mattheliu/model-pr-gate@v0.3.0
        with:
          trusted-keys: ${{ vars.MODEL_GATE_TRUSTED_KEYS }}
```

No checkout or token is needed. The action reads the PR event GitHub already
provides to the runner; it makes no API calls. Use Node.js 22+ on custom runners.
Pin the action to a reviewed commit SHA for immutable code.

**For tamper-resistant enforcement, protect the workflow as well as the keys.**
A contributor must not be able to replace this check with a successful no-op.
Use an organization/enterprise [required-workflow ruleset](https://docs.github.com/en/enterprise-cloud%40latest/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
where supported, sourced from a trusted repository. A same-named required status
alone does not establish that the intended verifier ran. Restrict bypasses.
If your repository cannot enforce a trusted workflow, treat this as a verification
check with maintainer oversight, not an unbypassable merge policy.

## Default policy

| Model | Exact accepted ID |
| --- | --- |
| Astra | `gpt-6-astra` |
| Fable 5.1 | `claude-fable-5-1` |

Fable 5, including `claude-fable-5-high`, is rejected. No fuzzy matching.
[Fable 5.1 official ID](https://platform.claude.com/docs/en/models/fable-5-1/overview).

Optional inputs: `language: zh-CN`, `mode: report` (don't block on a bad/missing
proof), and `allowed-models` (one exact ID per line, replaces defaults).
Configuration errors always fail. Default mode is `enforce`.

| Exit | Verdict | Meaning |
| --- | --- | --- |
| 0 | `verified` | Trusted signature, matching PR/head and allowed model |
| 1 | `rejected` | Invalid, mismatched or disallowed proof |
| 2 | `unverified` / error | Missing proof or invalid configuration/event |

Action outputs: `verdict`, `reason`, `evidence-level`. CI logs contain only fixed
results, not proof contents or model names. `trusted-issuer` means we trust that
signer; it is not an independent provider endorsement.

## Set up a signer

See [the signer guide](docs/signer.md). The issuer must control generation and
verify the final commit. Signing an arbitrary client-supplied model label or
locally edited session does not make it trustworthy. Any later commit needs a
new proof. There is no proof expiry or automatic revocation; key changes require
re-running checks. Async CI has a delay after PR edits. Merge queues are not yet
supported. Do not assume a prior green check is an immediate revocation system.

## Local tools

```sh
npm install --global github:mattheliu/model-pr-gate#v0.3.0
model-pr-gate --proof proof.txt --keys trusted-keys.json \
  --repository OWNER/REPO --pr 123 --sha FULL_HEAD_SHA
model-pr-gate --lang zh-CN --help
```

For personal, offline session auditing only:

```sh
model-session-audit codex ./session.jsonl
model-session-audit claude ./session.jsonl
```

Session audits are **not** signed proofs. Keep raw sessions local. The optional
legacy audit action lives at `mattheliu/model-pr-gate/actions/session-audit@v0.3.0`;
use it only where a local session already exists, not by uploading private logs.

## Privacy, migration and development

[Privacy details](PRIVACY.md). No real sessions or credentials are included.

v0.3 changes the root action from session auditing to signature verification.
The old HTTP GitHub App has been removed; v0.2 remains in Git history. No service
is started by this release.

```sh
npm test
npm run demo
```

Synthetic tests cover tampering, cross-PR replay, privacy and CLI/CI integration.
MIT licensed.
