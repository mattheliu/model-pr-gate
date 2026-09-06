# CI, CLI and development

**English** · [简体中文](usage.zh-CN.md) · [Project home](../README.md)

Start with the [README workflow](../README.md#connect-a-repository). Verification
needs an existing trusted generation platform; [signer integration](signer.md)
explains how it issues proofs for the final PR commit.

## Configuration

The repository Actions variable `MODEL_GATE_TRUSTED_KEYS` maps issuer names to
Ed25519 **public PEM** keys. Replace the placeholder with a real, maintainer-approved key:

```json
{"generation-service":"-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"}
```

Keep private signing keys inside the trusted generation platform, never in a PR
or verification job. The verifier does not accept private keys as trust configuration.

| Action input | Default | Purpose |
| --- | --- | --- |
| `trusted-keys` | Required | JSON map of trusted issuer public keys |
| `allowed-models` | Astra and Fable 5.1 | Exact IDs, one per line; replaces the defaults |
| `language` | `en` | Human messages: `en` or `zh-CN` |
| `mode` | `enforce` | `report` returns results without blocking on rejected or missing proofs |

For example, make the defaults explicit and use Chinese messages:

```yaml
- uses: mattheliu/model-pr-gate@v0.4.0
  with:
    trusted-keys: ${{ vars.MODEL_GATE_TRUSTED_KEYS }}
    language: zh-CN
    allowed-models: |
      gpt-6-astra
      claude-fable-5-1
```

Fable 5 is not Fable 5.1: `claude-fable-5-high` and `claude-fable-5` fail the default
policy. There is no fuzzy matching. [Fable 5.1 official model ID](https://platform.claude.com/docs/en/models/fable-5-1/overview).
Configuration errors always fail, including in `report` mode.

## Protect the check

Protect the public-key configuration **and** the workflow. Otherwise a contributor
could replace the verifier with a successful no-op. Where supported, use an
organization/enterprise [required-workflow ruleset](https://docs.github.com/en/enterprise-cloud%40latest/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
sourced from a trusted repository, and restrict bypasses. A same-named required
status alone does not establish which code ran. If your repository cannot enforce
the trusted workflow, it still needs maintainer oversight.

Pin the Action to a reviewed commit SHA for immutable code. Custom runners need
Node.js 22+. The Action reads GitHub's existing PR event and checks its repository,
PR number and current head SHA; it does not check out code, need a token or make
network requests. Do not use a merge-test SHA or copy expected values from the proof.

## Results and limits

| Default exit | Verdict | Meaning |
| --- | --- | --- |
| 0 | `verified` | Trusted signature, matching PR/head, allowed model |
| 1 | `rejected` | Invalid, mismatched or disallowed proof |
| 2 | `unverified` / error | Missing proof or invalid configuration/event |

Action outputs are `verdict`, `reason` and `evidence-level`; CLI JSON uses
`evidenceLevel`. `trusted-issuer` means the configured issuer is trusted, not
independent provider certification. CI logs contain only fixed results, not proof
contents, model names or paths. [Troubleshoot by reason](agent-guide.md#when-a-check-fails).

In `report` mode, rejected or missing proofs may exit 0. Read the verdict, not only
process success. Configuration errors still exit 2.

New commits need new proofs. Proof expiry, automatic revocation and merge queues
are not implemented; key changes require re-running checks. CI updates asynchronously
after PR edits, so a previous green status is not an immediate revocation mechanism.
Keep exactly one current proof and preserve other PR text when replacing it.

## Local CLI

```sh
npm install --global github:mattheliu/model-pr-gate#v0.4.0
model-pr-gate --proof proof.txt --keys trusted-keys.json \
  --repository OWNER/REPO --pr 123 --sha FULL_HEAD_SHA
model-pr-gate --lang zh-CN --help
```

Obtain the PR head independently, for example with
`gh pr view 123 --repo OWNER/REPO --json number,headRefOid,url`.
Use `headRefOid`. The CLI uses the default model policy; custom allowlists are
available through the Action, SDK and DSH plugin configuration.

For personal, offline session auditing only:

```sh
model-session-audit codex ./session.jsonl
model-session-audit claude ./session.jsonl
```

These inspect local records; they are **not signed proofs or merge authorization**.
Keep sessions local. The optional audit Action is
`mattheliu/model-pr-gate/actions/session-audit@v0.4.0`; use it only where the runner
already has the file, not by uploading private logs. [Privacy](../PRIVACY.md).

## Develop and migrate

From a source checkout:

```sh
npm test
npm run demo
npm run pack:dsh
```

Tests use synthetic data and disposable keys. CI covers Node.js 22 / 24 and real
DSH package integration. The optional [DSH guide](../plugins/dsh/README.md) covers
installation, configuration, removal and plugin development.

In v0.3 the root Action changed from session auditing to signature verification.
The old HTTP GitHub App was removed; v0.2 remains in Git history. Current verification
runs without a service. No real sessions or credentials are distributed. [MIT](../LICENSE).
