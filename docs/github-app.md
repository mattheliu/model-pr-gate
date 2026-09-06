# Optional signed-proof GitHub App

**English** · [简体中文](github-app.zh-CN.md)

Use this prototype when a trusted generation service can sign its own execution
records. The small CLI does not start this service or include it in its package.
Clone the full repository to use it.

## How it works

The generation service runs the model, pushes a commit and creates a PR. It signs
a proof containing the model, repository, PR number, head SHA and generation run
ID, then adds that proof to the PR body. The app verifies the signature and
publishes the `model-pr-gate` GitHub check. New commits need new proofs.

The default policy allows `gpt-6-astra` and `claude-fable-5-1`. Model IDs match exactly; the app
does not infer provider aliases. The signer must verify actual model execution
and the final commit, including fallbacks and edits. A public endpoint that signs
whatever model name a client sends is not trustworthy.

## Configure the signer

```sh
node bin/keygen.js keys
cp policy.example.json policy.local.json
```

Put the complete contents of `keys/issuer-public.pem` into the policy's
`trustedIssuers.generation-service.publicKey`. Keep the private key only on the
trusted generation service. These Ed25519 keys are separate from the GitHub
App's RSA authentication key.

Copy `payload.example.json` to `payload.json`. Set `version` to 1, `issuer` to the
policy issuer name, `repository` to the target `OWNER/REPO`, `number` to the PR
number, `sha` to its full current head SHA, `model` to the exact model ID, `runId`
to an auditable generation job ID, and `issuedAt` to the current Unix time in
seconds. Then run on the trusted signer:

```sh
node bin/sign.js keys/issuer-private.pem payload.json
```

Append its `<!-- model-pr-gate:... -->` output to the PR body. Exactly one proof
is allowed. Proofs have no automatic expiry; future issuance beyond a 60-second
clock allowance is rejected.

## Configure GitHub

Create and install a GitHub App with Pull requests read permission, Checks write
permission, and the Pull request event subscription. Set a random webhook secret
of at least 32 characters and URL `https://YOUR-SERVICE/webhooks/github`. Generate
the App's RSA private key and record its App ID.

```sh
cp .env.example .env
# Fill in the App ID, RSA key path, webhook secret and policy path.
node --env-file=.env src/server.js
```

Default address: `127.0.0.1:3000`. Put an HTTPS reverse proxy in front of it.
`GET /healthz` is the liveness endpoint. Invalid placeholder keys fail startup.

Trigger a test PR check, then require `model-pr-gate` in branch rules and restrict
its source to this installed App. Don't accept the same check name from arbitrary
sources. Configure bypass permissions intentionally.

The app handles opened, reopened, synchronize, edited and ready_for_review PR
events. To check an existing PR, edit its body or redeliver a webhook. Check-page
Re-run events are not implemented. The service never executes PR code.

## Prototype limits

- Real App installation, fork PR behavior and branch protection still require
  end-to-end validation in your repository.
- GitHub checks attach to a SHA, not an isolated PR authorization. PRs sharing a
  head SHA can reuse or overwrite results. Strict per-PR isolation needs unique
  head commits or a final merge service that rechecks the PR.
- Webhooks are asynchronous. Body edits and key/policy changes do not instantly
  revoke an existing successful check. Restart and recheck after policy changes.
- Webhooks run synchronously; API calls time out after 8 seconds each, and the
  overall request may exceed GitHub's delivery timeout. Monitor failures and
  redeliver them. Existing successful checks do not expire when this app is down.
- Events are serialized per PR within one process. Production multi-instance
  use needs a durable queue, distributed serialization, retries and reconciliation.
- No merge queue support, automatic revocation or line-by-line authorship proof.
- A compromised or dishonest signer can lie. The app verifies the signature,
  not the underlying model provider independently.

GitHub references: [webhook signatures](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries),
[App authentication](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app),
[check runs](https://docs.github.com/en/rest/checks/runs),
[branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).
