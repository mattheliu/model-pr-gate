# Connect a trusted signer

**English** · [简体中文](signer.zh-CN.md)

This is an integration guide for the service that already generates the code.
It is not a request for contributors to upload logs or install another agent.
No provider integration is included today; the steps below must be implemented
inside a trusted generation platform before strict admission is useful.

## 1. Create a key

```sh
node bin/keygen.js keys
```

Store `issuer-private.pem` only in the trusted generation service. Register the
public PEM with repositories that trust this issuer. Use a neutral issuer name
such as `generation-service`, not a person's name or private internal job name.
Public keys are not secrets, but their configuration must resist PR tampering.

## 2. Sign the completed PR commit

The service must know which model actually ran, including fallbacks and child
agents, and which changes belong to that execution. Verify the final commit
before signing; don't blindly accept a SHA/model pair from a client. Mixed or
unattributed edits need an explicit policy and must not silently pass as a
single-model run. API usage alone does not prove that code belongs to that run.

Read `attestation.example.json` for the exact version-2 schema. Fill in the final
repository, PR number, SHA, issuer and model, then run on the trusted service:

```sh
node bin/sign-attestation.js keys/issuer-private.pem payload.json
```

Or import `signAttestation(payload, privateKey)` from `model-pr-gate` in that
service. Only the six documented payload fields are accepted. No run IDs,
prompts, timestamps or custom extra metadata.

The tool prints a signed HTML comment. Have the platform append it to the PR
body using its existing authorized GitHub integration. The SDK does not make
that write or request GitHub credentials. Replace an old proof instead of adding
another; new commits require re-signing.

## 3. Verify in the repository

Use the root Action from the README. It derives the repository, PR number and
head SHA from the GitHub event, not from the proof's own claims. The issuer key
and model allowlist come from trusted workflow configuration. The action makes
no network requests and publishes only fixed result strings to CI logs.

Signatures authenticate an issuer statement, not the honesty of its author.
Protect the signer, key configuration and workflow. No automatic expiry,
revocation, repository-wide rechecking or merge queue support is implemented.
A proof is visible to everyone who can read its PR and reveals model usage.
