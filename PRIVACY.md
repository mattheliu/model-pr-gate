# Privacy

**English** · [简体中文](PRIVACY.zh-CN.md)

The default session CLI is local and read-only. It opens only the file explicitly
passed on the command line. It does not access the network, scan other folders,
write caches, or collect telemetry. It parses one JSONL line at a time and does
not retain transcripts. Memory grows with unique request and turn identifiers
used for counting and linking, rather than total transcript text.

CLI output contains model labels, aggregate counts, evidence quality and an observed
allowlist verdict. It excludes prompts, code, tool arguments, file paths, session
IDs, request IDs, response IDs and timestamps. IDs are hashed in memory for
counting. Model labels themselves remain visible: inspect output before sharing
if your deployment uses confidential model names.

No real session files, credentials or user activity reports are distributed in
this repository. Tests use synthetic fixtures. Example credentials are
placeholders. Do not commit raw sessions or real signing keys.

The optional GitHub App is a separate program. When explicitly configured and
started, it receives GitHub webhook payloads, reads PR metadata/body from GitHub,
and publishes check results through the GitHub API. It does not upload local
session files. Run the CLI alone if you only need offline inspection.

Local logs may be edited, truncated or incomplete. A matching local model label
is an observation, not authenticated proof of which model generated a PR.

The composite GitHub Action emits only fixed verdict/evidence-level strings. It
does not write the detailed CLI JSON into CI logs or upload artifacts. Installing
the CLI from GitHub downloads public tool code; running its audit is offline.
