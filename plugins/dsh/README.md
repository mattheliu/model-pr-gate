# Model PR Gate for DeepSeek Harness

**English** · [简体中文](README.zh-CN.md)

Check your configured model before submitting a PR, then verify the generator's
signed proof. Defaults: **Astra and Fable 5.1**.

This is an optional plugin in the Model PR Gate repository. Existing GitHub CI
and CLI users need no DSH installation. The plugin has **zero third-party runtime
dependencies**, no server and no installation build step. It uses DSH's tool and
optional skill registries, plus the same verifier as the GitHub Action.

## Install

With DeepSeek Harness and pnpm already installed:

```sh
dsh plugin --profile web add https://github.com/mattheliu/model-pr-gate/releases/download/v0.4.0/dsh-model-pr-gate-0.4.0.tgz
```

Restart DSH. The tools are available immediately. Profiles with a skill registry
also discover `model-pr-gate-dsh` automatically. Use the profile you actually run
in place of `web`. To remove both the package and its bundle:

```sh
dsh plugin --profile web remove dsh-model-pr-gate
```

Tested with **DSH 0.1.2-rc.1** and Cordis 4.0.2. DSH is in developer preview;
future API changes may require an adapter update. This package adds no model
provider or credentials. DSH and the chosen provider must already support your model.

## Use it

Tell your agent:

> Use the model-pr-gate-dsh skill. Preflight this agent, then check PR #123's proof
> against its current head. Do not upload sessions or change the repository policy.

| Tool | What it does |
| --- | --- |
| `model_pr_gate_preflight` | Reads only this agent's configured model; no arguments |
| `model_pr_gate_verify` | Checks one proof against supplied PR metadata and configured public keys |

Preflight returns `allowed`, `disallowed` or `unknown`. It reads **configuration**,
not actual requests, response identities or change history. Overrides, fallbacks,
other agents and manual edits are outside its scope. `allowed` never means a PR
has been authenticated.

Verification returns `verified`, `rejected` or `unverified`, plus fixed `reason`
and `evidenceLevel` fields. Without trusted keys it returns `missing-trusted-keys`;
with keys but no proof it returns `missing-proof`. Neither case passes verification.

The agent supplies `repository`, `number`, `sha` and optional `proof`. Get the
subject independently, for example:

```sh
gh pr view 123 --repo OWNER/REPO --json number,headRefOid,url
```

Use `headRefOid` and pass only the proof's HTML comment. Do not paste the full PR
body or a session. A new commit needs a new proof. The tools do not read GitHub,
attach proofs, sign statements, create PRs or enforce merge restrictions.
The existing agent workflow can attach a supplied proof within the user's task
authorization; repository CI independently verifies the actual PR event.

## Configure trust and language

Append this row to your profile's `cordis.patch.yml`, or save it in a separate
patch file. Use the **maintainer-approved Ed25519 public key** for the repository:

```yaml
- id: model-pr-gate
  config:
    language: en
    trustedKeys:
      generation-service: |
        -----BEGIN PUBLIC KEY-----
        REPLACE_WITH_MAINTAINER_APPROVED_PUBLIC_KEY
        -----END PUBLIC KEY-----
    allowedModels:
      - gpt-6-astra
      - claude-fable-5-1
```

The placeholder is intentionally invalid; replace it before loading this patch.
Use `language: zh-CN` for Chinese tools, explanations and the bundled skill.
For a separate patch:

```sh
dsh --profile web --patch ./model-pr-gate.patch.yml
```

Configuration keys are `trustedKeys` (default `{}`), `allowedModels` (default the
two IDs above), and `language` (default `en`). Invalid configuration fails plugin
activation with a fixed error. A DSH patch replaces the row's complete config, so
keep all desired settings in the override. Public keys come from trusted local
configuration, never from tool arguments. Align it with the target repository;
one running plugin instance uses one trust policy.

Changing this local policy does not change GitHub CI. `claude-fable-5-high` is
Fable 5 and fails the default policy. DeepSeek model IDs also fail by default;
maintainers can configure another allowlist in both places.

## Privacy and proof limits

The plugin reads only `agent.options.model`, caller-supplied proof metadata and
its own bundled skill files. It does not scan sessions, read API credentials,
intercept requests, upload data, run telemetry or keep a history/cache. Its
outputs contain only fixed status fields and localized explanations.

Tool arguments/results may still enter **DSH's normal session log and model
context**. This plugin does not change DSH's or a provider's data handling.
Use only the minimal proof; it reveals model ID, issuer, repository, PR number,
commit SHA, format version and signature to anyone who can read it.

A local plugin is not a trusted signer. Signatures remain statements by the
configured issuer, not independent provider certification. The repository needs
an existing trusted generation platform that controls generation and the final
commit. No such service or provider attestation connector is included here.

## Develop in this repository

From the repository root:

```sh
npm test
npm run pack:dsh
dsh plugin --profile web add ./dsh-model-pr-gate-0.4.0.tgz
```

`prepare:dsh` copies the canonical verifier and defaults into the bundle's ignored
`core/` directory; there is no separately maintained cryptographic implementation.
Packaging includes the bilingual DSH skill and MIT license. Release tarballs need
no install scripts or npm publication.

[DSH bundle installation](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/publish)
· [Tool contract](https://deepseek-harness.github.io/deepseek-harness/en/reference/cookbook/adding-a-tool)
· [Project and CI guide](https://github.com/mattheliu/model-pr-gate)
