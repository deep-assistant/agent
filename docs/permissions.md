# Permission System (read-only / plan / per-command approval)

The Agent CLI has a native, **enforceable** permission system, ported from
OpenCode but driven entirely over **JSON** — there is **no TUI**. It lets you run
the agent in read-only or planning modes, or approve each mutating command
individually, while keeping **full auto-mode the default** so nothing changes for
existing consumers.

This is the native counterpart of `agent-commander`'s uniform `--read-only`
flag (issue [#271](https://github.com/link-assistant/agent/issues/271)).

## TL;DR

```bash
# Default — full auto, never asks (unchanged behavior):
agent -p "refactor this file"

# Hard read-only: deny every edit and any non read-only shell command, never asks:
agent --permission-mode readonly -p "summarize the repo layout"

# Planning: deny edits, allow read-only shell, ask before anything else:
agent --permission-mode plan --input-format stream-json

# Ask before every mutating tool (per-command approval over JSON):
agent --permission-mode ask --input-format stream-json

# OpenCode-compatible fine-grained override (merged on top of the mode):
agent --permission '{"edit":"ask","bash":{"git push*":"ask","*":"allow"}}'
```

## Modes

`--permission-mode <mode>` (env `LINK_ASSISTANT_AGENT_PERMISSION_MODE`):

| Mode | `edit` / `write` / `patch` | `bash` | `webfetch` | Asks? |
|------|----------------------------|--------|------------|-------|
| `auto` *(default)* | allow | allow | allow | never |
| `plan` | **deny** | read-only commands **allow**, else **ask** | allow | yes |
| `readonly` | **deny** | read-only commands **allow**, else **deny** | allow | never |
| `ask` | ask | ask (every command) | ask | yes |

The read-only shell allowlist includes `cat`, `ls`, `pwd`, `grep`/`rg`, `head`,
`tail`, `wc`, `stat`, `file`, `find` (read-only forms), `diff`, `tree`,
`git diff`/`log`/`status`/`show`/`branch`, and similar. Destructive variants
(`find … -delete`/`-exec`, `sort -o`, output redirection `>`, command
substitution `$(…)`/backticks) fall back to the mode's non-allow action.

> **Hard layer.** `--read-only` and `--disable-tools bash,edit,write,multiedit,patch`
> remove tools from the model entirely (they are never even offered). The
> permission system is the finer-grained layer; combine both for defense in
> depth.

## Fine-grained override: `--permission`

`--permission '<json>'` (env `LINK_ASSISTANT_AGENT_PERMISSION`) takes an
OpenCode-compatible policy and is **merged on top of the mode** (override wins;
`bash` maps merge key-by-key):

```jsonc
{
  "edit": "ask",              // "allow" | "ask" | "deny"
  "webfetch": "allow",
  "bash": {                   // string ("ask") or a {glob: action} map
    "git push*": "ask",
    "rm*": "deny",
    "*": "allow"              // catch-all
  }
}
```

Bash globs are matched with the same structured wildcard matcher as OpenCode
(`*` matches any token sequence; **the longest / last matching rule wins**). Each
command in a chain (`a && b`, `a | b`, `$(c)`) is evaluated independently.

## JSON protocol

### 1. Request (agent → you)

When a tool needs approval, the agent emits a `permission_request` event on
stdout:

```json
{
  "type": "permission_request",
  "timestamp": 1718630400000,
  "sessionID": "ses_abc123",
  "permissionID": "per_xyz789",
  "callID": "call_001",
  "tool": "bash",
  "pattern": ["npm install *"],
  "title": "npm install",
  "metadata": { "command": "npm install", "patterns": ["npm install *"] }
}
```

| Field | Meaning |
|-------|---------|
| `permissionID` | Opaque id you must echo back to approve/deny this request. |
| `sessionID` | Session the request belongs to. |
| `callID` | The tool call id (if any). |
| `tool` | `bash`, `edit`, or `webfetch`. |
| `pattern` | For `bash`, the glob pattern(s) being approved; absent for others. |
| `title` | Human-readable summary (the command, file path, or URL). |
| `metadata` | Tool-specific details. |

### 2. Response (you → agent)

Send a `permission_response` frame on stdin:

```json
{ "type": "permission_response", "permissionID": "per_xyz789", "response": "once" }
```

`response` is one of:

| Value | Effect |
|-------|--------|
| `once` | Allow this single request and continue. |
| `always` | Allow this request **and** auto-approve later matching requests in the same session. |
| `reject` | Deny. The tool call fails with a `RejectedError`; the model may retry differently. |

The same frame works in both input formats:

- **Text mode** (default): one JSON object per line.
- **`--input-format stream-json`** (Claude-compatible NDJSON): one frame per line.

`permissionID` may also be sent as `permission_id`.

## Input mode requirements

- `auto` and `readonly` **never ask**, so they work with any input mode,
  including single-shot `--prompt`.
- `plan` and `ask` **emit requests mid-turn and block** until you respond. They
  require a streaming input mode so you can reply while the turn is in flight:

  ```bash
  agent --permission-mode ask --input-format stream-json
  ```

  Single-shot `--prompt` with an ask-mode would deadlock on the first request.

## End-to-end example (`ask` mode)

```bash
agent --permission-mode ask --input-format stream-json <<'EOF'
{"type":"user","message":"create hello.txt with the text hi"}
EOF
```

The agent streams a request:

```json
{"type":"permission_request","permissionID":"per_001","tool":"edit","title":"/work/hello.txt", ...}
```

Reply on stdin to approve:

```json
{"type":"permission_response","permissionID":"per_001","response":"once"}
```

…or deny:

```json
{"type":"permission_response","permissionID":"per_001","response":"reject"}
```

## Environment variables

| Variable | Equivalent flag | Default |
|----------|-----------------|---------|
| `LINK_ASSISTANT_AGENT_PERMISSION_MODE` | `--permission-mode` | `auto` |
| `LINK_ASSISTANT_AGENT_PERMISSION` | `--permission` | *(none)* |

## Notes

- **No TUI.** Approvals are pure JSON; there is no interactive terminal prompt.
- **Full auto by default.** In `auto` mode the bash policy is `{"*":"allow"}`, so
  the tree-sitter command parse is skipped and there is zero added overhead.
- See the case study under
  [`docs/case-studies/issue-271`](case-studies/issue-271/README.md) for the
  design rationale and the prior-art survey.
