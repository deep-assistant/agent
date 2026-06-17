---
'@link-assistant/agent': minor
---

Add a native, enforceable permission system ported from OpenCode, fully controllable over JSON with no TUI (issue #271).

The agent now supports `--permission-mode <auto|plan|readonly|ask>` (env `LINK_ASSISTANT_AGENT_PERMISSION_MODE`) and an OpenCode-compatible `--permission '<json>'` override (env `LINK_ASSISTANT_AGENT_PERMISSION`). The default mode is `auto` (full autonomy, never asks), so existing behavior is unchanged and the full-auto path has zero added overhead.

- `plan` denies edits, allows read-only shell commands, and asks before anything else.
- `readonly` denies all mutations (never asks).
- `ask` requests approval before every mutating tool.
- `--permission` accepts the OpenCode `{edit, bash, webfetch}` shape (where `bash` is a string or a `{glob: action}` map) and is merged on top of the mode.

Approvals are exchanged purely as JSON: the agent emits a `permission_request` event on stdout and the consumer replies with a `permission_response` frame (`once` / `always` / `reject`) on stdin, in both text and `stream-json` input modes. See `docs/permissions.md` for the full protocol and `docs/case-studies/issue-271` for the design rationale and prior-art survey. The same policy/mode/override semantics, CLI flags, and JSON schemas are mirrored in the Rust implementation.
