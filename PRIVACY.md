# Privacy

**English** · [简体中文](PRIVACY.zh-CN.md)

## Default: proof verification

The Action reads the PR event file GitHub already supplies to its runner. This
file contains ordinary PR metadata and body; the tool extracts the proof in
memory. It does not check out code, upload sessions, write caches, run a web
service, collect telemetry, or make API/network requests. Downloading the Action
or installing the package still downloads public tool code normally.

A proof contains model ID, commit SHA, issuer, repository, PR number, format
version and signature. No conversations, code, personal paths, session/request
IDs or timestamps. The signer and verifier reject additional fields. Proofs
are readable, not encrypted, and reveal model usage to anyone who can read the
PR. Choose a nonpersonal issuer name. CI logs contain only fixed verdict/reason
and evidence-level values. The workflow and platform still have their normal
access to the PR; this tool does not change GitHub's existing data handling.

The private signing key never belongs in the PR or verification job. The trusted
generation platform keeps it and handles its own original requests according
to its policies; this project does not add a proxy for those requests.

## Optional local session audit

`model-session-audit` opens only the specified file and processes it line by line.
It does not scan other folders or access the network. It discards transcript
records after parsing; hashes of request/turn IDs remain in memory for counting.
Memory grows with unique IDs. CLI JSON contains model labels and aggregate counts,
not prompts, code, paths or raw IDs. Confidential model names may still appear.
Keep raw sessions local; don't upload them to CI just to run this command.

The optional session audit Action logs only fixed verdict/evidence-level strings.
It is separate from the default proof verifier and is not an authenticity check.
No real sessions, credentials or user activity reports are distributed. Tests
use synthetic data. There is no third-party App service in v0.3.
