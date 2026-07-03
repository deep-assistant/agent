# Supported Tools

This document lists all tools supported by `@link-assistant/agent`. All tools are enabled by default and produce OpenCode-compatible JSON output.

> ⚠️ **Bun-only** - This package requires [Bun](https://bun.sh) and does NOT support Node.js or Deno.

## File Operations

### read

Reads file contents from the filesystem. Long files are summarized with first
and last line ranges by default, and long lines can be inspected with explicit
column windows.

**Status:** ✅ Fully supported and tested
**Test:** [tests/read.tools.test.js](tests/read.tools.test.js)

### write

Writes content to files in the filesystem.

**Status:** ✅ Fully supported and tested
**Test:** [tests/write.tools.test.js](tests/write.tools.test.js)

### edit

Performs exact string replacements in files.

**Status:** ✅ Fully supported and tested
**Test:** [tests/edit.tools.test.js](tests/edit.tools.test.js)

### list (ls)

Lists files and directories.

**Status:** ✅ Fully supported and tested
**Test:** [tests/list.tools.test.js](tests/list.tools.test.js)

## Search Tools

### glob

Fast file pattern matching tool that works with any codebase size. Supports glob patterns like `**/*.js` or `src/**/*.ts`.

**Status:** ✅ Fully supported and tested
**Test:** [tests/glob.tools.test.js](tests/glob.tools.test.js)

### grep

Powerful search tool built on ripgrep. Supports full regex syntax, can filter by
file type or glob pattern, and summarizes long matching lines around the match.

**Status:** ✅ Fully supported and tested
**Test:** [tests/grep.tools.test.js](tests/grep.tools.test.js)

### websearch

Searches the web using Exa API for current information. Always enabled, no environment variables required.

**Status:** ✅ Fully supported and tested
**Test:** [tests/websearch.tools.test.js](tests/websearch.tools.test.js)
**OpenCode Compatibility:** ✅ 100% compatible

### codesearch

Searches code repositories and documentation using Exa API. Always enabled.

**Status:** ✅ Fully supported and tested
**Test:** [tests/codesearch.tools.test.js](tests/codesearch.tools.test.js)
**OpenCode Compatibility:** ✅ 100% compatible

## Execution Tools

### bash

Executes bash commands in a persistent shell session with optional timeout.

**Status:** ✅ Fully supported and tested
**Test:** [tests/bash.tools.test.js](tests/bash.tools.test.js)

### batch

Batches multiple tool calls together for optimal performance. Executes multiple tools in a single operation. Always enabled.

**Status:** ✅ Fully supported and tested
**Test:** [tests/batch.tools.test.js](tests/batch.tools.test.js)

### task

Launches specialized agents to handle complex, multi-step tasks autonomously.

**Status:** ✅ Fully supported and tested
**Test:** [tests/task.tools.test.js](tests/task.tools.test.js)

## Utility Tools

### todo (todowrite/todoread)

Reads and writes TODO items for task tracking during execution.

**Status:** ✅ Fully supported and tested
**Test:** [tests/todo.tools.test.js](tests/todo.tools.test.js)

### webfetch

Fetches content from a specified URL and processes it using an AI model.

**Status:** ✅ Fully supported and tested
**Test:** [tests/webfetch.tools.test.js](tests/webfetch.tools.test.js)

## Read-Only / Planning Mode

By default all tools are enabled and the agent runs with full, unrestricted
access. For planning-only tasks (or to enforce a per-command approval UX in a
parent process such as
[`agent-commander`](https://github.com/link-assistant/agent-commander)), the
agent supports a **native, enforceable read-only mode**.

### `--read-only`

Disables every filesystem-mutating and shell tool so the agent can only read,
search and plan:

| Tool                                                                                                             | read-only   |
| ---------------------------------------------------------------------------------------------------------------- | ----------- |
| `bash`                                                                                                           | ❌ disabled |
| `edit`                                                                                                           | ❌ disabled |
| `write`                                                                                                          | ❌ disabled |
| `multiedit`                                                                                                      | ❌ disabled |
| `patch`                                                                                                          | ❌ disabled |
| everything else (`read`, `list`, `glob`, `grep`, `websearch`, `codesearch`, `webfetch`, `todo`, `batch`, `task`) | ✅ enabled  |

```bash
echo "Summarize this project" | agent --read-only
```

Can also be enabled with the `LINK_ASSISTANT_AGENT_READ_ONLY=true` environment
variable.

The restriction is enforced where tools are exposed to the model **and** when a
tool is invoked indirectly through the `batch` tool, so it cannot be bypassed by
the model.

### `--disable-tools <list>`

Disable an explicit, comma-separated set of tools (in addition to or instead of
`--read-only`):

```bash
echo "hi" | agent --disable-tools bash,write,edit
```

Can also be set with `LINK_ASSISTANT_AGENT_DISABLE_TOOLS=bash,write,edit`.

### Fine-grained permission system (`--permission-mode` / `--permission`)

`--read-only` / `--disable-tools` remove tools entirely (the hard layer). For
finer control — read-only **planning** that still allows safe shell commands, or
**per-command approval** — the agent ships a native, JSON-driven permission
system ported from OpenCode, with **no TUI**:

```bash
# Deny edits, allow read-only shell, ask before anything else (planning):
agent --permission-mode plan --input-format stream-json

# Hard read-only that still allows read-only shell commands, never asks:
agent --permission-mode readonly -p "summarize the repo layout"

# Approve every mutating tool over JSON (stdin/stdout):
agent --permission-mode ask --input-format stream-json

# OpenCode-compatible fine-grained override, merged on top of the mode:
agent --permission '{"edit":"ask","bash":{"git push*":"ask","*":"allow"}}'
```

The default mode is `auto` (full autonomy, never asks — unchanged behavior).
Approvals are exchanged as `permission_request` / `permission_response` JSON
frames. See [docs/permissions.md](docs/permissions.md) for the full protocol,
every mode, the JSON shapes, environment variables, and worked examples.

## Testing

### Run All Tool Tests

```bash
bun test tests/*.tools.test.js
```

### Run Specific Tool Test

```bash
bun test tests/bash.tools.test.js
bun test tests/websearch.tools.test.js
```

### Test Coverage

Each tool test verifies:

- ✅ Correct JSON output structure
- ✅ OpenCode compatibility (where applicable)
- ✅ Proper input/output handling
- ✅ Error handling

## Key Features

### No Configuration Required

- All tools work without environment variables or configuration files
- WebSearch and CodeSearch work without `LINK_ASSISTANT_AGENT_EXPERIMENTAL_EXA`
- Batch tool is always enabled, no experimental flag needed

### OpenCode Compatible

- All tools produce JSON output compatible with OpenCode's format
- WebSearch and CodeSearch tools are 100% compatible with OpenCode output
- Tool event structure matches OpenCode specifications

### Plain Text Input Support

`@link-assistant/agent` also accepts plain text input (not just JSON):

```bash
echo "hello world" | agent
```

Plain text is automatically converted to a message request.
