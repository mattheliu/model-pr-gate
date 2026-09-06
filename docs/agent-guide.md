# Agent guide

**English** · [简体中文](agent-guide.zh-CN.md)

Give this guide to the agent working on your repository. For automatic skill
selection, import the complete [`skills/model-pr-gate`](../skills/model-pr-gate)
folder into your agent's supported skill directory. Keep its subfolders together.
The entry point is `SKILL.md`; a Chinese companion and workflow template are included.
No plugin, daemon or hosted App is required.

## Start with one of these requests

**Integrate a repository**

> Use the Model PR Gate skill to add offline proof verification to this repository.
> Keep the default Astra/Fable 5.1 policy and protect the workflow and trust keys.
> Don't upload sessions. If no trusted signer exists, prepare the integration and
> report that prerequisite instead of registering a made-up signer.

**Prepare a PR**

> Use the Model PR Gate skill to check PR #123 against its current head SHA.
> Obtain the proof from our existing trusted generation platform. Preserve the
> PR description and don't change repository policy to make the check pass.

**Connect an existing generation service**

> Use the Model PR Gate skill to add minimal proof signing to this trusted service.
> Derive the actual model and final commit from its execution records. Keep private
> keys inside the service and add no prompt, session or request data to the proof.

## Use inside DeepSeek Harness

Install the optional [DSH plugin](../plugins/dsh/README.md) to discover
`model-pr-gate-dsh` automatically. Run `model_pr_gate_preflight` with no arguments,
then `model_pr_gate_verify` with only the proof comment and independently obtained
`repository`, `number`, `sha`. Public keys belong in trusted plugin configuration,
not tool arguments. Preflight checks configuration only; `allowed` is not a
verified PR. Tool inputs/results may enter DSH's normal logs and model context.

## What the agent needs

| Task | Required inputs | Result |
| --- | --- | --- |
| Repository setup | Target repo, existing trusted issuer public key, permission to configure CI | Workflow, public-key config and enforcement status |
| PR verification | Target repo/PR, current head SHA, proof, trusted public keys | `verified`, `rejected` or `unverified` with a reason |
| Signing integration | Trusted execution record and signer environment | A minimal proof attached by the existing authorized platform |
| Personal audit | Explicit local session path | An unverified observation, never a merge certificate |

No real issuer is bundled. A fresh local key is fine for a synthetic test, but
must not be added as a production trust anchor just to approve the agent's own PR.

## Smallest repository setup

Use the [workflow template](../skills/model-pr-gate/references/model-proof.yml).
Register a maintainer-approved Ed25519 public key in `MODEL_GATE_TRUSTED_KEYS`.
The action derives the target repository, PR number and head SHA from GitHub's
PR event, so there is no session path to configure and no transcript to upload.

Use exact model IDs: `gpt-6-astra`, `claude-fable-5-1`. Fable 5 is not accepted.
The agent should resolve a release to a reviewed commit SHA before pinning it.
Protect the workflow using a trusted required-workflow ruleset where supported;
otherwise explicitly report the remaining maintainer-enforcement requirement.

## Verify a supplied proof locally

```sh
npm install --global github:mattheliu/model-pr-gate#v0.4.0
gh pr view 123 --repo OWNER/REPO --json number,headRefOid,url
model-pr-gate --proof proof.txt --keys trusted-keys.json \
  --repository OWNER/REPO --pr 123 --sha FULL_HEAD_SHA
```

The agent must use `headRefOid`, not the merge-test SHA or values copied from the
proof itself. A new commit invalidates the old proof for that PR head. Read the
head again before an authorized PR update. Replace an old proof, rather than
adding a duplicate, and preserve unrelated description text.

## When a check fails

| Reason | Correct response |
| --- | --- |
| `missing-proof` | Obtain one from the existing trusted generator; otherwise report unverified |
| `subject-mismatch` | Verify repo/PR/head and request a new proof for the actual commit |
| `invalid-signature` / `invalid-proof` | Obtain the original valid proof; don't edit signed fields |
| `untrusted-issuer` | Ask the maintainer to verify issuer identity through its established channel |
| `model-not-allowed` | Use an allowed generation workflow; don't relabel Fable 5 as 5.1 |
| `configuration-error` | Check public-key JSON, language/mode and the PR event; don't log private inputs |

`report` mode may exit 0 even when the proof fails. Read the verdict, not only
process success. Local `observed-*` audit results are not `verified` proofs.

## How the agent should report completion

State what changed, the action release/commit, the verified PR head, the result,
and any remaining signing or workflow-protection prerequisite. Don't claim
upstream provider attestation has been connected unless it actually has.

Never put raw sessions, prompts, keys or private paths in public issues, release
notes or test fixtures. The only PR addition is the minimal proof; it is readable
by PR viewers and reveals the model. [Privacy](../PRIVACY.md) · [Signer integration](signer.md)
