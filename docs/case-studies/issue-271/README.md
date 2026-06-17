# Case Study: Native Enforceable Permission System (read-only / plan / per-command approval)

**Issue:** [#271](https://github.com/link-assistant/agent/issues/271)
**PR:** [#272](https://github.com/link-assistant/agent/pull/272)
**Date:** 2026-06-17

## Problem Statement

The Agent CLI advertised itself as "100% UNSAFE AND AUTONOMOUS … No Permissions
System … No Safety Guardrails". Because there was no native permission system,
`link-assistant/agent-commander` listed the `agent` tool's read-only mode as
**"❌ not enforceable"** and rejected `agent-commander start-agent --tool agent
--read-only` before launch — every other tool (`claude`, `codex`, `opencode`,
`qwen`, `gemini`) maps `--read-only` to a native restriction.

This blocked downstream consumers (e.g. the Formal-AI desktop app,
link-assistant/formal-ai#511) that want to run `@link-assistant/agent` for
**read-only / planning** work with **per-command approval**, and could not rely
on the CLI to enforce no-write / no-shell-mutation.

The maintainer's directive ([issue comment
4730457589](https://github.com/link-assistant/agent/issues/271#issuecomment-4730457589))
sharpened the scope:

> We need to add permissions system from OpenCode back (in the most similar way
> possible), but by default our Agent CLI should use full auto-mode, and if we
> need plan mode or readonly, and approve each command option, we should use CLI
> options. Make sure everything is fully controllable from JSON (input and
> output) with detailed docs on how to send approval JSON. We still will not
> integrate any TUI … make sure we fully implement it in both JavaScript and
> Rust.

## Requirements

Each requirement extracted from the issue body and the maintainer comment, with
how it is resolved in this PR:

| # | Requirement (source) | Resolution |
|---|----------------------|------------|
| R1 | Re-add OpenCode's permission system "in the most similar way possible" (comment) | Ported OpenCode's `Permission` namespace (`ask`/`respond`/`RejectedError`, `permission.updated`/`permission.replied` bus events, `once`/`always`/`reject` responses, per-tool glob rules with "last matching rule wins") to `js/src/permission/index.ts` and `rust/src/permission.rs`. |
| R2 | Default behavior must remain **full auto-mode** (comment) | Default `--permission-mode auto` resolves every action to `allow`. `Permission.bashEnforced()` short-circuits the tree-sitter parse, so the default path has zero added overhead and no behavior change. |
| R3 | Plan mode, readonly mode, and approve-each-command via **CLI options** (comment + issue) | `--permission-mode {auto,plan,readonly,ask}` plus an OpenCode-compatible `--permission '<json>'` override. `plan` denies edits + allows read-only shell + asks otherwise; `readonly` denies all mutations (never asks); `ask` prompts before every mutating tool. |
| R4 | Everything **fully controllable from JSON** (input and output) (comment) | Output: a `permission_request` JSON event is emitted when a tool needs approval. Input: a `permission_response` JSON frame (`{"type":"permission_response","permissionID":"…","response":"once"\|"always"\|"reject"}`) resolves it, accepted in both text and `stream-json` input modes. No TUI. |
| R5 | **Detailed docs** on how to send approval JSON (comment) | [`docs/permissions.md`](../../permissions.md) documents the protocol, every mode, the JSON shapes, environment variables, and worked end-to-end examples. |
| R6 | Fail clearly if the mode cannot be honored (issue) | A denied tool throws `RejectedError` with an actionable message naming the tool and active mode; combined with the hard `--read-only` / `--disable-tools` tool-removal layer the model never even sees disabled tools. |
| R7 | Expressible through OpenCode-compatible permission/deny rules (issue) | `--permission` accepts the OpenCode `{edit, bash, webfetch}` shape, where `bash` is a string or a `{pattern: action}` map evaluated with the same structured wildcard matcher. |
| R8 | Implement in **both JavaScript and Rust** (comment) | JS: full runtime enforcement in the agent loop + tools. Rust: `permission` module with the same policy/mode/override semantics, CLI flags, JSON event schemas, and unit tests (the Rust binary has no agent loop yet, so enforcement is policy-resolution + schema parity; this is documented honestly below). |
| R9 | Collect issue data into `./docs/case-studies/issue-271`, deep analysis, online research, requirement list, solution plans, existing components (comment) | This folder: `README.md` (analysis + per-requirement solution plans), `research-permissions-landscape.md` (sourced prior-art survey), `research-data.json` (machine-readable facts). |
| R10 | No TUI (comment) | No interactive terminal UI is added. Approvals are pure JSON over stdin/stdout. The vestigial OpenCode TUI `select()` in `cmd/run.ts` is left untouched and is not on the JSON path. |

## Root Cause

When `@link-assistant/agent` forked OpenCode, the entire `permission` namespace
and all tool-level permission checks were stripped out (each mutating tool was
reduced to a `// No restrictions` comment) to make the CLI fully autonomous.
That made read-only / planning impossible to enforce natively, which is exactly
what agent-commander's uniform `--read-only` flag requires.

## Solution

A native permission system modeled on OpenCode, but **JSON-first and TUI-free**,
defaulting to full auto so nothing changes for existing consumers.

### Architecture

1. **Policy core** (`js/src/permission/index.ts`, `rust/src/permission.rs`)
   - `Mode` = `auto | plan | readonly | ask`; `Action` = `allow | ask | deny`.
   - `modePolicy(mode)` produces a `{edit, bash, webfetch}` policy. `bash` is a
     glob→action map; plan/readonly seed it from a read-only shell allowlist
     (`cat`, `ls`, `grep`, `git diff/log/status/show`, …) with the destructive
     variants (`find … -delete/-exec`, `sort -o`, redirection, command
     substitution) falling back to ask/deny.
   - `parseOverride(json)` parses the OpenCode-compatible `--permission` JSON;
     `policy()` merges it on top of the mode (override wins, bash maps merge
     key-by-key).

2. **Ask / respond machinery** (ported from OpenCode)
   - `ask()` resolves immediately if already approved (`always`), otherwise
     registers a pending request, publishes `permission.updated`, and returns a
     promise resolved by `respond()`.
   - `respond({sessionID, permissionID, response})` resolves/rejects the pending
     promise; `always` records a session-scoped approval that auto-clears other
     covered pending requests. Disposing the instance rejects all pending asks.

3. **Tool enforcement** (JS)
   - `bash`: parses the command with tree-sitter, extracts each `command` node's
     tokens, evaluates every node against the bash policy — `deny` throws, `ask`
     patterns are batched into one request. Skipped entirely in `auto` mode.
   - `edit` / `write` / `patch`: `Permission.check({type:'edit', …})`.
   - `webfetch`: `Permission.check({type:'webfetch', …})`.
   - `multiedit` routes through the `edit` tool, inheriting its check.

4. **JSON I/O** (JS CLI)
   - `event-handler.js` emits `permission_request` on `permission.updated`.
   - `input-queue.js` parses `permission_response` frames in both text and
     `stream-json` modes.
   - `continuous-mode.js` routes `permission_response` straight to
     `Permission.respond`, bypassing the in-flight-turn queue so a blocked turn
     can be unblocked mid-flight.

5. **Hard layer retained**: `--read-only` / `--disable-tools` still remove tools
   from the model entirely (issue #271's first increment, PR #271). The new
   permission system is the finer-grained, OpenCode-compatible layer on top.

### Why ask-modes need streaming input

`readonly` never asks (deny-only), so it works in any input mode. `plan` and
`ask` emit `permission_request` mid-turn and block until a `permission_response`
arrives, so they require the continuous/`stream-json` input mode (single-shot
`--prompt` would deadlock on the first ask). This is documented in
`docs/permissions.md`.

## Alternatives Considered

| Option | Tradeoff |
|--------|----------|
| Tool-removal only (`--disable-tools`, already shipped) | Enforceable and simple, but coarse: cannot allow read-only shell in plan mode, and offers no per-command approval UX. |
| Re-add OpenCode's TUI `select()` approval | Rejected by the maintainer ("we still will not integrate any TUI"). |
| Re-add OpenCode's `Plugin.trigger` hook for permissions | Dropped — the fork has no plugin host on the JSON path; approval is driven purely over stdin JSON. |
| Re-add OpenCode's `Filesystem.contains` path-containment guard for bash | Not re-added by default to preserve full autonomy; path scoping can be layered later via `--permission` rules. |
| Build a brand-new permission DSL | Rejected — the issue explicitly asks to reuse OpenCode "in the most similar way possible" for compatibility. |

## Existing Components / Prior Art Evaluated

See [`research-permissions-landscape.md`](./research-permissions-landscape.md)
for the fully-sourced survey. Summary of what was reused vs. referenced:

- **OpenCode permission system** — directly ported (config shape, action enum,
  ask/respond, `once`/`always`/`reject`, glob matcher). Primary reuse.
- **Claude Code `--permission-mode plan` / `canUseTool` `{behavior:"allow"|"deny"}`** —
  informed the mode names and the allow/deny JSON response shape.
- **MCP elicitation `accept`/`decline`/`cancel`** — informed the three-action
  response model (`once`/`always`/`reject`).
- **OpenAI Codex sandbox `read-only`/`workspace-write`** and **Gemini/Qwen
  `--approval-mode plan`** — informed mode naming and the comparison matrix.
- **Vercel AI SDK 6 `needsApproval`** — noted as in-process JS-only prior art;
  not adopted (not JSON-transport, not cross-language).

## Verification

- `js/tests/permission.test.ts` — 22 tests covering `modePolicy`,
  `parseOverride`, `policy()` resolution/merge, `evaluateBash`, `bashEnforced`,
  `check()` allow/deny, and the full ask→respond lifecycle (`once`/`reject`/`always`).
- `js/tests/read-only.test.ts` — unchanged, still green (hard tool-removal layer).
- `rust` — `cargo test permission` covers mode policy, override parsing/merge,
  bash evaluation, and JSON event (de)serialization.
- Full JS suite: `bun test` green.

## Files Changed

- `js/src/permission/index.ts` (new) — permission namespace.
- `js/src/tool/{bash,edit,write,patch,webfetch}.ts` — enforcement calls.
- `js/src/cli/{event-handler,input-queue,continuous-mode,run-options}.js`,
  `js/src/config/config.ts` — JSON I/O + CLI flags + config.
- `js/tests/permission.test.ts` (new).
- `rust/src/permission.rs` (new) + `rust/src/cli.rs` flags + `rust/src/main.rs` wiring.
- `docs/permissions.md` (new), `docs/case-studies/issue-271/*`, README/TOOLS updates.
