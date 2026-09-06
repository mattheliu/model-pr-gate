# Model PR Gate

**English** · [简体中文](README.zh-CN.md)

**Accept PRs with trusted model proofs. Defaults: Astra and Fable 5.1.**

Your generation platform signs a small proof; repository CI verifies it offline.
Node.js 22+, zero third-party runtime dependencies, no session uploads or backend.

**You need a generation platform you trust.** This project provides signing and
verification tools, but no built-in provider attestation service. Missing proofs
remain `unverified`; the tool cannot infer a model from code.

## Connect a repository

Set the signer's **public keys** in the Actions variable `MODEL_GATE_TRUSTED_KEYS`
([JSON format](docs/usage.md#configuration)). Keep private keys with the generator.
Save this as `.github/workflows/model-proof.yml`:

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
      - uses: mattheliu/model-pr-gate@v0.4.0
        with:
          trusted-keys: ${{ vars.MODEL_GATE_TRUSTED_KEYS }}
```

No checkout or token needed. **Protect both public-key configuration and the
workflow**; a same-named required status alone is not enough to prevent bypass.
See [configuration and enforcement](docs/usage.md#protect-the-check).

## Default models

| Model | Exact ID |
| --- | --- |
| Astra | `gpt-6-astra` |
| Fable 5.1 | `claude-fable-5-1` |

Fable 5, including `claude-fable-5-high`, is rejected. Maintainers can
[replace the allowlist](docs/usage.md#configuration).

## Guides

- [CI options, CLI and development](docs/usage.md)
- [Connect a trusted signer](docs/signer.md)
- [DeepSeek Harness plugin](plugins/dsh/README.md): preflight, verification and a bundled skill
- [Agent guide](docs/agent-guide.md) · [Importable skill](skills/model-pr-gate/SKILL.md)
- Recreate the project: [English prompt](prompts/recreate.md) · [中文 prompt](prompts/recreate.zh-CN.md)

Proofs expose model and PR metadata, never conversations or code. They are readable
by PR viewers. [Privacy details](PRIVACY.md).

## Idea inspiration

Inspired by [@arkuy99](https://x.com/arkuy99) and
[this post](https://x.com/arkuy99/status/2096425638018306166?s=20).

[MIT license](LICENSE).
