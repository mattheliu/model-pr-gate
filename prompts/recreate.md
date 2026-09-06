# Recreate Model PR Gate with one prompt

**English** · [简体中文](recreate.zh-CN.md)

Copy the **entire block below** into a coding agent with file editing, terminal and
internet access. No original conversation or source checkout is needed. It defines
the product philosophy, behavior and acceptance criteria for an equivalent project,
not byte-identical generated code. The baseline is Model PR Gate v0.4.0.

The prompt can drive development, testing and packaging. A trusted signing platform,
account access and publication authorization must actually exist; it cannot create
provider authentication out of nothing. Reuse an existing implementation when present.

````text
Implement a complete, runnable, reusable small open-source project named Model PR Gate.
By default, accept only PRs with trusted proofs declaring Astra or Fable 5.1.
Deliver code, tests, English/Simplified Chinese documentation, agent skills, an optional
DeepSeek Harness plugin and installable artifacts. Do not stop at a proposal, pseudocode,
empty interfaces or an offer to continue.

## Understand the product philosophy

Give repositories a model-credential gate: maintainers add a small CI workflow while
contributors keep their normal PR flow wherever possible. Keep it small, easy to adopt,
pluggable, private by default and understandable.

Model admission is repository policy, not a code-quality guarantee. Do not advertise
junk-code detection, author honesty detection or guaranteed quality from a chosen model.

Limit every conclusion to what its evidence supports:
- Code style, PR prose, agent self-description and GitHub Verified commits cannot
  authenticate the actual generating model.
- Editable local sessions, configuration, API request records and self-signed proofs
  cannot independently authenticate provenance either.
- One allowed model request does not establish the provenance of an entire PR.
- A signature authenticates an issuer's statement, not its truth or provider endorsement.

CI alone cannot deliver all three promises for arbitrary local tools: a few workflow
lines, no contributor installation/process changes, and reliable actual-model detection.
Use an honest, conditional architecture:

An existing trusted generation platform controls model execution and the final commit
→ it signs a minimal proof and attaches it through its existing GitHub integration
→ the repository's own CI verifies it offline.

Contributors get a seamless flow only after that upstream integration exists. Without a
trusted issuer, return unverified. Do not substitute session uploads, a hidden API proxy,
self-signing or model guessing. The issuer must account for fallbacks, child agents,
mixed provenance and later manual edits; never silently label mixed changes as one model.

## Default policy

- Astra: exact ID `gpt-6-astra`.
- Fable 5.1: exact ID `claude-fable-5-1`.
- `claude-fable-5-high` and `claude-fable-5` are Fable 5 and must fail.
- Match exact IDs, not display names, prefixes or fuzzy aliases. Let maintainers explicitly
  replace the allowlist.
- DeepSeek Harness is a runtime; using it does not imply using a DeepSeek model.
  DeepSeek model IDs do not automatically enter the default allowlist.

These IDs are an explicit requirement of this reproduction. Do not silently replace them
because APIs have changed. If a current provider or host does not support them, report that
limitation without pretending to connect them or relabeling another model.

## Lightweight architecture and privacy

Use Node.js 22+, ES modules and the standard library. Keep the core, CLI, Action and DSH
plugin free of third-party runtime dependencies. Development tests may install DSH in an
isolated environment. Do not add a database, account system, HTTP backend, GitHub App,
request proxy, telemetry, login page or mandatory persistent process.

Maintain one verifier source shared by CLI, CI and DSH adapters. Packaging may copy it,
but verify the copy automatically. Put the DSH plugin in an independent directory so
existing users need no DSH installation. Add abstractions for actual needs, not imagined ones.

Default verification makes no network requests, checks out no PR code, scans no personal
directories, reads no model API keys and uploads no sessions. CI may read GitHub's supplied
PR event and extract the proof in memory, but logs only fixed outcomes and reasons.
Never log raw inputs, full PR bodies, public-key contents, private keys, model names,
personal paths or stacks in result/error logs. No caches, history or telemetry. Distinguish
normal downloads of public code, dependencies and documentation during installation or
development from runtime uploads of user data.

## Minimal proof: compatible with version 2

Use standard-library Ed25519. A payload must contain exactly these six fields:

```json
{
  "version": 2,
  "issuer": "generation-service",
  "model": "gpt-6-astra",
  "repository": "OWNER/REPO",
  "number": 123,
  "sha": "0123456789abcdef0123456789abcdef01234567"
}
```

- version is the number 2; number is a positive safe integer; sha is 40 lowercase hex digits.
- issuer is a 1–64 character identifier, starts alphanumeric, then allows alphanumerics
  and underscore, dot or hyphen.
- model is a 1–100 character identifier, starts alphanumeric, then allows alphanumerics
  and `._:/-`.
- repository is OWNER/REPO, at most 200 characters; each part allows alphanumerics and `_.-`.
- Reject all extra fields. Include no prompts, code, session/request IDs, timestamps or
  private job labels.
- Base64url-encode the JSON's UTF-8 bytes without padding to obtain encoded.
- Sign the encoded string's UTF-8 bytes with Ed25519; base64url-encode the signature
  without padding.
- Verify the received encoded bytes, not a reserialized JSON representation.
- Wrap it as the sole proof comment in the PR body:
  `<!-- model-pr-gate:v2:<encoded>.<signature> -->`
- Bound inputs: PR body at most 1 MiB, encoded at most 4096 characters, signature exactly
  86 characters. Multiple model-pr-gate markers, old versions and malformed proofs cannot pass.

Maintainers configure an issuer → Ed25519 public PEM map. Reject private keys as verifier
configuration. The trusted generation platform alone holds the private signing key;
neither contributors nor verification CI receive it.
The proof is readable, not encrypted: PR readers can decode its fields. Use neutral issuer
names rather than personal identifiers in public proofs.

The generation platform must independently establish actual execution and final-change
provenance before calling the signer. Supply a signing SDK, CLI helper and synthetic demo,
but never pretend a real provider has already been connected.
Key generation must not overwrite existing files; use directory mode 0700 and private-key
mode 0600 on POSIX systems.

## CLI and GitHub Action

Implement an offline CLI, for example:

```sh
model-pr-gate --proof proof.txt --keys trusted-keys.json \
  --repository OWNER/REPO --pr 123 --sha FULL_HEAD_SHA
```

Expose `signAttestation(payload, privateKey)`, `verifyAttestation(subject, keys, allowedModels)`
and public-key validation. subject is `{body, repository, number, sha}`: body contains the
proof to extract; the other three fields are independently obtained expected values.
Return only fixed verdict, reason and evidenceLevel fields.

Verdicts: verified / rejected / unverified.
Evidence level: trusted-issuer for successful verification, otherwise none.
Distinguish at least valid-proof, missing-proof, invalid-proof, untrusted-issuer,
invalid-signature, subject-mismatch and model-not-allowed. Use fixed configuration/runtime
errors. Default exit codes: 0 verified, 1 rejected, 2 missing evidence or configuration/runtime error.

Provide a distributable GitHub Action at the repository root:
- Inputs: trusted-keys, optional allowed-models, language (en / zh-CN), mode (enforce / report).
- Default enforce; report may allow rejected/missing evidence without failing the job,
  but configuration errors always fail.
- Outputs: verdict, reason, evidence-level. Exit success alone does not mean verified in report mode.
- Independently derive target repository, PR number and current head SHA from the GitHub PR
  event and GITHUB_REPOSITORY; check repository consistency. Never use the merge-test SHA
  or take the expected subject from the proof's own claims.
- Public keys and allowlists come from maintainer configuration, not PR authors,
  PR-controlled files or tool arguments.
- No checkout, GitHub token or model API key; execute no PR-supplied code.
- Supply a permissions: {} workflow handling opened, reopened, synchronize, edited and
  ready_for_review, with older checks for the same PR cancelled.
- New commits make old proofs mismatch the current head and require re-signing. When
  attaching a new proof, preserve other body text and replace the old proof.

Explain protection of both trust configuration and workflows. An altered workflow can
spoof a same-named required status; a green status alone is not an unbypassable gate.
Where available, use required-workflow rules sourced from a trusted repository; otherwise
state the remaining need for maintainer supervision. Check current official GitHub rules
instead of inventing settings. The initial version omits expiry, automatic revocation and
merge queues; document reruns after key changes and asynchronous check-update delays.

## Separate personal session auditing

Optionally provide `model-session-audit codex|claude <specified-file>` for an explicitly
selected local file only. Stream it and extract model records of limited evidentiary value.
Never output raw conversations, paths or request IDs. Hash deduplication IDs in memory if
needed, without persistence; explain that deduplication memory grows with unique records.
For Codex use model-context records; for Claude use assistant model fields. Ignore synthetic
records and do not search user text or tool output for model names. Test with synthetic format
fixtures, not personal histories. Use distinct observed-* outcomes. Logs never authorize merging.
Do not tell contributors to upload private logs to CI; any audit Action belongs in a separate directory.

## Optional DeepSeek Harness plugin

Implement a DSH bundle in a separate directory of the same repository and ship a directly
installable prebuilt tarball. Verify current APIs against official documentation/source;
DSH 0.1.2-rc.1 / Cordis 4.0.2 are a reference baseline. Record actually tested versions rather
than presenting preview APIs as permanently stable. Require no install-time compilation or
global installation of this project's CLI. Do not bundle the entire DSH runtime.

Expose two tools:
1. `model_pr_gate_preflight`: no arguments; read only this agent's `agent.options.model`.
   Return allowed / disallowed / unknown and a fixed reason. Evidence level is local-config
   when configuration was read, otherwise none. This is neither an actual-request audit
   nor PR authentication. Inspect no requests, sessions or history.
2. `model_pr_gate_verify`: accept only repository, number, sha and an optional minimal proof
   comment. Host configuration supplies public keys and allowlists; callers cannot supply
   policy. Accept one intact comment only, at most 8192 characters; reject surrounding body
   text or logs. Reuse the verifier. Missing keys return missing-trusted-keys; missing proofs
   return missing-proof; both are unverified.

Plugin configuration contains only trustedKeys, allowedModels and language. Invalid config
fails activation without echoing input. Return structured outputs and fixed localized prose,
honor cancellation and remove registrations on unload. Automatically register the localized
model-pr-gate-dsh skill when the host offers a skill registry. Both tools must work without
that registry. Do not scan history, sign claims or create/update PRs automatically.

Local DSH policy does not change repository CI; one instance uses one explicit policy.
Local verified means the supplied subject passes that local configuration. CI must still
independently validate the actual PR event. Tool arguments/results may enter DSH's normal
logs and model context. Disclose this; an offline plugin cannot promise the whole host
never processes or sends data.

## Documentation and agent experience

Deliver English and Simplified Chinese READMEs, privacy notes, signer integration, agent
guides, an importable general skill and a DSH skill. Write plainly: purpose and usage first,
then limits. Make examples copyable, keep machine fields stable across languages, and
explain installation, configuration, failure handling and removal.

Skills must teach consequential decisions: get the PR head independently, respect maintainer
policy, report missing proofs, never self-sign a pass or silently relax policy, and never
upgrade local observations into authentication. For an already-authorized PR update, use
structured arguments or a body file, preserve other text, and re-read the head before writing.
A skill grants no additional external-write permissions.

Keep English/Chinese copies of this reproduction prompt and link them from the README.
Use MIT licensing and retain required licenses/attribution when reusing open-source code.
Use generic OWNER/REPO placeholders and synthetic examples only.

## Execution and acceptance

Inspect the working directory and project instructions first. Improve an existing project
incrementally; create a new one only in an appropriate empty location. Preserve unrelated
work. Decide reversible implementation details without step-by-step confirmations.
Consult public official documentation for compatibility; do not source examples from
private sessions, credentials or personal directories.

Run meaningful synthetic-data tests for allowed models, Fable 5 rejection, missing evidence,
malformed/duplicate proofs, signature/payload tampering, extra private fields, unknown issuers,
wrong keys, cross-repository/PR/SHA reuse, invalid config, enforce/report exits, i18n, no input
echoing, and real CLI/Action invocation. Exercise actual DSH tarball installation, configuration
composition, tool execution, skill discovery, cancellation and removal. Do not claim integration
based only on mocks; state any untested environment. Use temporary test keys, never register
them as real repository trust, and require no paid model calls for acceptance.

Check Node.js 22 / 24 in CI, isolate DSH test dependencies, and report actual results.
Package the CLI, DSH plugin and skills; measure compressed/unpacked sizes and list dependencies.
Aim for a DSH package within a few tens of KB. Explain documentation size rather than deleting
necessary guidance to hit a number. Check artifacts contain no credentials, real sessions,
personal paths, caches or node_modules.

Follow the current user's actual publishing authorization. By default, finish runnable local
artifacts; push an existing repository only within authorized scope. New GitHub repositories
default to PRIVATE; publish one only when PUBLIC is explicitly authorized for that target.
Do not hardcode the original author's account or treat this public prompt as credentials or
publication authorization. When authorized, complete checks and proceed with commit/push/release.
If publication is unavailable, report the limit instead of fabricating links, test results,
model integrations or Marketplace status.

Finish with actual locations/repository, usage, test results, artifacts and sizes, dependencies,
and any outstanding trusted-issuer or workflow-protection prerequisites. Keep configuration
preflight, log observations, trusted-issuer statements and independent provider certification
clearly distinct.
````

This prompt is open-source under the project's [MIT license](../LICENSE).
It contains no original chat transcript, real sessions, personal paths, credentials or account authorization.
