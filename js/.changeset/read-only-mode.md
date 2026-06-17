---
'@link-assistant/agent': minor
---

Add a native, enforceable permission system, ported from OpenCode and fully controllable over JSON with no TUI (issue #271).

**Hard layer.** `--read-only` (env `LINK_ASSISTANT_AGENT_READ_ONLY`) disables every filesystem-mutating and shell tool — `bash`, `edit`, `write`, `multiedit`, `patch` — so the agent can only read, search and plan. The restriction is enforced at tool resolution and also when tools are invoked indirectly via the `batch` tool, so it cannot be bypassed. `--disable-tools bash,write,edit` (env `LINK_ASSISTANT_AGENT_DISABLE_TOOLS`) disables an explicit set of tools. This makes agent-commander's uniform `--read-only` flag enforceable for the `agent` tool, on par with the other supported tools.

**Fine-grained layer.** `--permission-mode <auto|plan|readonly|ask>` (env `LINK_ASSISTANT_AGENT_PERMISSION_MODE`) plus an OpenCode-compatible `--permission '<json>'` override (env `LINK_ASSISTANT_AGENT_PERMISSION`). The default mode is `auto` (full autonomy, never asks), so existing behavior is unchanged and the full-auto path has zero added overhead.

- `plan` denies edits, allows read-only shell commands, and asks before anything else.
- `readonly` denies all mutations (never asks).
- `ask` requests approval before every mutating tool.
- `--permission` accepts the OpenCode `{edit, bash, webfetch}` shape (where `bash` is a string or a `{glob: action}` map) and is merged on top of the mode.

Approvals are exchanged purely as JSON: the agent emits a `permission_request` event on stdout and the consumer replies with a `permission_response` frame (`once` / `always` / `reject`) on stdin, in both text and `stream-json` input modes. See `docs/permissions.md` for the full protocol and `docs/case-studies/issue-271` for the design rationale and prior-art survey. The same policy/mode/override semantics, CLI flags, and JSON schemas are mirrored in the Rust implementation.
