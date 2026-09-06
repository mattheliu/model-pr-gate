# Model PR Gate

**English** · [简体中文](README.zh-CN.md)

**Only accept PRs made with Astra or Fable 5.1.**

That's the default policy. This small tool reads a Codex or Claude Code session,
checks the recorded models, and returns a result your CI can use.

No dependencies, API keys, transcript uploads, or background service. Node.js 22+.

**One limit:** a local session can be edited. A passing result means the recorded
models match your policy, not that the PR's authorship has been independently
verified. The session must also belong to the work you want to check.

## Run locally

```sh
npm install --global github:mattheliu/model-pr-gate#v0.2.0
model-pr-gate codex ./session.jsonl
# Or:
model-pr-gate claude ./session.jsonl
```

Defaults match these exact IDs:

| Model | Accepted ID |
| --- | --- |
| Astra | `gpt-6-astra` |
| Fable 5.1 | `claude-fable-5-1` |

Fable 5 (`claude-fable-5`, `claude-fable-5-high`) is not accepted. No fuzzy
matching or display-name aliases. [Fable 5.1's official model ID](https://platform.claude.com/docs/en/models/fable-5-1/overview).

To replace the default allowlist:

```sh
model-pr-gate codex ./session.jsonl gpt-6-astra YOUR_VERIFIED_MODEL_ID
```

Install once; checking sessions works offline. Nothing is automatically scanned.

## Add to GitHub Actions

Put this after the step that generates your session on the runner:

```yaml
- uses: mattheliu/model-pr-gate@v0.2.0
  with:
    agent: codex
    session: ./session.jsonl
```

It fails the job if another model is found or the record can't be checked. To
block merging, make that job a required check in your repository's branch rules.
The action itself needs no token or write permission. Use a runner with Node.js
22+; pin to a reviewed commit SHA when you need an immutable action reference.

The runner needs the file. It cannot read sessions from your laptop. Don't commit
raw sessions or upload them as public artifacts just to pass the check. Logs
supplied by a PR contributor can be forged; they are not an authentication method.

Optional settings:

```yaml
- uses: mattheliu/model-pr-gate@v0.2.0
  id: model-audit
  with:
    agent: claude
    session: ./session.jsonl
    mode: report           # Report without blocking; default is enforce
    language: zh-CN        # Human messages; default is en
    allowed-models: |      # Replaces defaults; exact IDs, one per line
      gpt-6-astra
      YOUR_VERIFIED_MODEL_ID
```

## Understand the result

| Exit | Result | Meaning |
| --- | --- | --- |
| 0 | `observed-models-allowed` | All observed models are allowed |
| 1 | `observed-disallowed-model` | Another model was found |
| 2 | `unknown` / error | Missing, incomplete, malformed or unreadable evidence |

In `report` mode, a disallowed or unknown result does not fail the job. Invalid
mode/language settings still fail. Action outputs are `verdict` and
`evidence-level`, always `local-unverified`.

Codex records tell us the **configured** model. Claude assistant records tell us
the model **saved with the response**. Neither is a signed provider receipt.
Child sessions must be checked separately. Counts are not billing metrics.

## Privacy and size

Only the file you specify is read, one line at a time. The CLI returns model
labels, counts and a verdict. CI logs show only the verdict and evidence level.
Neither exports prompts, code, paths, session IDs or request IDs.

The CLI package contains just the parser, command and docs. There are no runtime
dependencies beyond Node.js. A synthetic 1.7 MB / 20,000-line test took about
0.09 seconds and 66 MiB resident memory including Node.js on one machine. Memory
also grows with unique IDs used for counting. See [privacy details](PRIVACY.md).

## Language

```sh
model-pr-gate --lang zh-CN --help
model-pr-gate --lang en --help
```

Human messages support English and Simplified Chinese. JSON keys and verdicts
stay the same in both languages so integrations don't break.

## Need stronger proof?

The source repository includes an optional [signed-proof GitHub App](docs/github-app.md).
It is separate from the small CLI. A trusted generation service signs the model
and PR commit; the app verifies that proof. It still needs a trustworthy signer.

## Develop

```sh
git clone https://github.com/mattheliu/model-pr-gate.git
cd model-pr-gate
npm test
```

Tests use synthetic data. MIT licensed. No real sessions or private credentials
are included.
