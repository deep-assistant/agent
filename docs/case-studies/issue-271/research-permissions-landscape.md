# Case Study Research: Native Enforceable Read-Only / Planning / Per-Command-Approval for `@link-assistant/agent`

Research compiled 2026-06-17. Every claim is sourced. Quotes are verbatim; JSON/flag shapes are reproduced exactly. Where a fact is inferred rather than directly quotable, it is flagged.

---

## 1. OpenCode (`sst/opencode`) permission system

OpenCode — which `@link-assistant/agent` forked and then stripped — has a mature, JSON-first permission system. This is the most directly reusable prior art.

### 1.1 The `permission` config schema

Three action values (verbatim, https://opencode.ai/docs/permissions):
- `"allow"` — run without approval
- `"ask"` — prompt for approval
- `"deny"` — block the action

**Simple form** (global `*` plus per-tool overrides):
```json
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "*": "ask",
    "bash": "allow",
    "edit": "deny"
  }
}
```

**Single-value form:** `"permission": "allow"`

**Granular per-pattern (object) form** for `bash`/`edit`:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "permission": {
    "bash": {
      "*": "ask",
      "git *": "allow",
      "rm *": "deny",
      "grep *": "allow"
    },
    "edit": {
      "*": "deny",
      "packages/web/src/content/docs/*.mdx": "allow"
    }
  }
}
```

**Pattern evaluation rule** (verbatim): "Rules are evaluated by pattern match, with the **last matching rule winning**." Wildcards: `*` matches zero-or-more chars, `?` matches exactly one.

**Available permission keys** (verbatim list): `read`, `edit` (covers `edit`/`write`/`patch`), `glob`, `grep`, `bash`, `task` (subagents), `skill`, `lsp`, `question`, `webfetch`, `websearch`, `external_directory`, `doom_loop`.

Source schema (`packages/core/src/v1/config/permission.ts`, branch `dev`):
```ts
export const Action = Schema.Literals(["ask", "allow", "deny"])
export const Object = Schema.Record(Schema.String, Action)
export const Rule = Schema.Union([Action, Object])
```
Note: `permission` superseded the deprecated legacy `tools` boolean config as of `v1.1.1`.

Sources: https://opencode.ai/docs/permissions · https://github.com/sst/opencode/blob/dev/packages/core/src/v1/config/permission.ts

### 1.2 `OPENCODE_PERMISSION` env var

From the CLI env-var table (https://opencode.ai/docs/cli/):

| Variable | Type | Description |
| --- | --- | --- |
| `OPENCODE_PERMISSION` | string | Inlined json permissions config |

It takes the **same JSON shape** as the `permission` config object, supplied inline as a string. The docs likewise describe `OPENCODE_CONFIG_CONTENT` as "Inline json config content". There is also an experimental `OPENCODE_EXPERIMENTAL_PLAN_MODE` toggle and a `--dangerously-skip-permissions` flag on `opencode run` ("Auto-approve permissions that are not explicitly denied (dangerous!)").

> Caveat: the docs table states *what* the variable is but does **not** contain a verbatim sentence asserting precedence over the config file. Treat "env overrides config" as inferred, not directly quotable.

Source: https://opencode.ai/docs/cli/

### 1.3 Plan vs Build agent modes

Both are `primary` agents (https://opencode.ai/docs/agents/):
- **Build** (verbatim): "the **default** primary agent with all tools enabled… full access to file operations and system commands."
- **Plan** (verbatim): "A restricted agent designed for planning and analysis… By default, all of the following are set to `ask`: `file edits` (All writes, patches, and edits), `bash` (All bash commands)… analyze code, suggest changes, or create plans without making any actual modifications."

> Important: the built-in Plan agent defaults edit/bash to **`ask`**, not hard `deny`. The docs' JSON example that uses `"edit":"deny","bash":"deny"` is an illustrative *override*, not the built-in default. Agent permissions are merged with global config, "and agent rules take precedence."

Source: https://opencode.ai/docs/agents/

### 1.4 Permission prompt / response flow (server + SDK)

**HTTP endpoint** (verbatim, https://opencode.ai/docs/server/):
| `POST` | `/session/:id/permissions/:permissionID` | Respond to a permission request | body: `{ response, remember? }`, returns `boolean` |

**SSE bus events** (source `packages/opencode/src/permission/index.ts`): `permission.asked` and `permission.replied`, delivered on the `GET /event` SSE stream.

**Three reply values** (source `packages/core/src/v1/permission.ts`):
```ts
export const Reply = Schema.Literals(["once", "always", "reject"])
```
- `once` — approve just this request
- `always` — approve future requests matching the suggested patterns (rest of session); patterns are tool-provided (e.g. bash whitelists a safe prefix like `git status*`)
- `reject` — deny (raises `RejectedError`, or `CorrectedError` if a `message` is supplied; also rejects other pending requests in the session)

> **This is the key finding for `@link-assistant/agent`:** the fork's own merged PR #271 already wired the consumer side of this exact flow. `js/src/cli/cmd/run.ts` listens for `permission.updated` events and POSTs to `postSessionIdPermissionsPermissionId` with `once`/`always`/`reject`. The infrastructure survived the fork; only the policy layer was stripped.

Sources: https://opencode.ai/docs/server/ · https://github.com/sst/opencode/blob/dev/packages/opencode/src/permission/index.ts · https://github.com/sst/opencode/blob/dev/packages/core/src/v1/permission.ts

### 1.5 Default behavior (no config)

Verbatim: "Most permissions default to `"allow"`. `doom_loop` and `external_directory` default to `"ask"`. `read` is `"allow"`, but `.env` files are denied by default" (`*.env` → `deny`, `*.env.example` → `allow`).

Source: https://opencode.ai/docs/permissions

---

## 2. `link-assistant/agent-commander` read-only model (issue #20 / PR #21)

**Issue #20** ("Add hard read-only / no-shell tool mode for planning tasks", author konard, CLOSED) was driven by Hive Mind issue #501: split a GitHub issue into sub-issues by asking an agent *only for a JSON plan*, with the app performing all mutations deterministically. Requirement (verbatim): a `start-agent` flag such as `--read-only`/`--plan-only`/`--disable-tools shell,bash,write`, mapped to "the safest available native options," and **"If a selected tool cannot enforce the requested restrictions, `start-agent` should fail clearly instead of silently running with broader permissions."**

**PR #21** ("Add read-only planning mode for agent tools", MERGED 2026-04-26) implemented `--read-only` and `--plan-only` in both JS and Rust. The per-tool native mapping (verbatim from the merged docs/case-study):

| Tool | Read-only mapping | Meaning |
|------|---------|----------|
| Claude | `--permission-mode plan` | Analyze without file edits or command execution |
| Codex | `--ask-for-approval never exec --sandbox read-only` | Non-interactive read-only sandbox |
| OpenCode | `OPENCODE_PERMISSION='{"edit":"deny","bash":"deny","task":"deny"}'` | Blocks file edits, shell commands, subagent launches |
| Qwen | `--approval-mode plan` | Plan mode for read-only analysis |
| Gemini | `--approval-mode plan` | Plan mode for read-only exploration |

The **read-only matrix** marked `agent` (i.e. `@link-assistant/agent`) as the one tool that is **"❌ not enforceable"** — verbatim: *"`--tool agent --read-only` is rejected because @link-assistant/agent has no native permission system."* Before PR #21, every tool ran with autonomous defaults (Claude `--dangerously-skip-permissions`, Codex `--dangerously-bypass-approvals-and-sandbox`, Qwen/Gemini yolo-style, OpenCode no override). PR #21 also confirmed screen-isolation wrapping is preserved for restricted commands.

This is precisely the gap that issue #271 closes: it gives `agent` a native permission system so agent-commander's uniform `--read-only` becomes enforceable. (The fork's merged PR #271 implements `--read-only` + `--disable-tools` with enforcement at tool resolution and inside the batch tool, plus a read-only system-prompt note — see `js/src/tool/registry.ts`, `js/src/tool/batch.ts`, `js/src/cli/run-options.js:215`.)

Sources: `gh issue view 20 --repo link-assistant/agent-commander` · `gh pr view 21 --repo link-assistant/agent-commander` (https://github.com/link-assistant/agent-commander/pull/21) · local commit `1bd2427`.

---

## 3. How comparable CLIs implement read-only / plan / approval

### 3.1 Claude Code

**`--permission-mode`** accepts (current docs, 6 modes): `default`, `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions`. "Overrides `defaultMode` from settings files." What runs without a prompt (verbatim):

| Mode | Allowed without prompt |
|------|----------|
| `default` | Reads only (prompts on first use of each tool) |
| `acceptEdits` | Reads, file edits, common fs commands (`mkdir`, `touch`, `mv`, `cp`, `rm`, `rmdir`, `sed`) |
| `plan` | Reads only — "research and propose changes without making them" |
| `bypassPermissions` | Everything |

`plan` mode is **hard-enforced read-only in the SDK** (verbatim): "`plan` routes file-edit and shell-write tools to your `canUseTool` callback regardless of allow rules, so write operations cannot be auto-approved while planning." The `--dontAsk` mode "Auto-denies tools unless pre-approved" — relevant for locked-down CI.

**`--allowedTools` / `--disallowedTools`** (verbatim):
- `--allowedTools` — "Tools that execute without prompting." Example: `"Bash(git log *)" "Bash(git diff *)" "Read"`. The `:*` suffix is equivalent to space-wildcard: `Bash(ls:*)` ≡ `Bash(ls *)`.
- `--disallowedTools` — "A bare tool name removes the matching tools from the model's context… A scoped rule such as `Bash(rm *)` leaves the tool available and denies only matching calls."

**Approvals in print / stream-json mode.** `--output-format` ∈ {`text`,`json`,`stream-json`}; `--input-format` ∈ {`text`,`stream-json`}. Two mechanisms:

1. **`canUseTool` callback** (TS SDK) returns a `PermissionResult` union (verbatim):
```ts
type PermissionResult =
  | { behavior: "allow"; updatedInput?: Record<string,unknown>; updatedPermissions?: PermissionUpdate[]; toolUseID?: string }
  | { behavior: "deny";  message: string; interrupt?: boolean; toolUseID?: string };
```
2. **`--permission-prompt-tool <mcp-tool>`** — "Specify an MCP tool to handle permission prompts in non-interactive mode." The MCP tool returns the same `behavior`/`updatedInput`/`message` decision, wrapped as stringified JSON in an MCP `content`/`type:"text"` block:
```jsonc
// allow: { "content": [ { "type":"text", "text":"{\"behavior\":\"allow\",\"updatedInput\":{...}}" } ] }
// deny:  { "content": [ { "type":"text", "text":"{\"behavior\":\"deny\",\"message\":\"...\"}" } ] }
```
> The inner field names (`behavior`/`updatedInput`/`message`) are primary-sourced from the `canUseTool` docs. The MCP `content` text-wrapper is only secondary-sourced in currently-live docs (legacy SDK pages now redirect) — treat as high-confidence but secondary.

**`settings.json` permissions block** (verbatim): `permissions.allow`, `permissions.ask`, `permissions.deny` (arrays of `Tool` / `Tool(specifier)` rules), plus `permissions.defaultMode`. Evaluation order: **deny → ask → allow** (first match wins); SDK full order: Hooks → Deny → Ask → Permission mode → Allow → `canUseTool`.

**`--dangerously-skip-permissions`** — "Equivalent to `--permission-mode bypassPermissions`." Refuses to run as root/sudo; can be blocked via `permissions.disableBypassPermissionsMode: "disable"`.

Sources: https://code.claude.com/docs/en/cli-reference · https://code.claude.com/docs/en/permission-modes · https://code.claude.com/docs/en/permissions · https://code.claude.com/docs/en/headless · https://code.claude.com/docs/en/agent-sdk/permissions · https://code.claude.com/docs/en/agent-sdk/user-input · https://code.claude.com/docs/en/agent-sdk/typescript

### 3.2 Gemini CLI

**`--approval-mode`** (string, default `default`): choices `default`, `auto_edit`, `yolo`, `plan` (note the canonical flag value is `auto_edit` with an underscore; prose docs also write `auto-edit`). `--yolo`/`-y` is **deprecated** in favor of `--approval-mode=yolo`. Shift+Tab cycles `Default → Auto-Edit → Plan`.

**Plan Mode** (verbatim): "a read-only environment for architecting robust solutions before implementation… Explore the project in a read-only state to prevent accidental changes." Allowed tools are strictly an allowlist (`read_file`, `list_directory`, `glob`, `grep_search`, `google_web_search`, `web_fetch`, research subagents, `ask_user`, read-only MCP tools); `write_file`/`replace` allowed **only** for `.md` files in the plans dir; **no `run_shell_command`**. Enforced by a built-in Tier-1 policy engine (`plan.toml`).

Sources: https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/cli-reference.md · https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/plan-mode.md

### 3.3 OpenAI Codex CLI

Codex separates **sandbox** from **approval**:

**`--sandbox`** values (verbatim):
- `read-only` — "Codex can inspect files, but it can't edit files or run commands without approval."
- `workspace-write` — "read files, edit within the workspace, and run routine local commands inside that boundary."
- `danger-full-access` — "runs without sandbox restrictions… removes the filesystem and network boundaries."

**`--ask-for-approval` / `-a`** values: `untrusted` (deprecated), `on-failure` (deprecated), `on-request` ("Prompts before executing commands in interactive sessions"), `never` ("Runs commands without interruption in non-interactive contexts"). `--full-auto` is a deprecated legacy alias for `--sandbox workspace-write`.

**config.toml**: `approval_policy` (`untrusted`/`on-request`/`never`, or granular object `{ granular = { sandbox_approval, rules, mcp_elicitations, request_permissions, skill_approval } }`) and `sandbox_mode` (`read-only`/`workspace-write`/`danger-full-access`):
```toml
approval_policy = "on-request"
sandbox_mode = "workspace-write"
```
**`--dangerously-bypass-approvals-and-sandbox`** (alias `--yolo`) — "No sandbox; no approvals (not recommended)."

Sources: https://developers.openai.com/codex/concepts/sandboxing · https://developers.openai.com/codex/cli/reference · https://developers.openai.com/codex/config-reference · https://developers.openai.com/codex/agent-approvals-security

### 3.4 Qwen Code CLI

**`--approval-mode` / `/approval-mode`** — five modes; config key `tools.approvalMode` in `.qwen/settings.json` (`"plan"`, `"default"`, `"auto-edit"`, `"auto"`, `"yolo"`):
- **Plan** — file editing "❌ Read-only analysis only", shell "❌ Not executed" (lowest risk)
- **Ask Permissions** (config `default`) — both require manual approval
- **Auto-Edit** — edits auto-approved (`edit`, `write_file`, `notebook_edit`), shell manual
- **Auto** — classifier-evaluated, fail-closed if classifier unreachable
- **YOLO** — everything auto-approved

Plan mode (verbatim): "create a plan by analyzing the codebase with **read-only** operations." Cycle order: `plan → default → auto-edit → auto → yolo`.

Sources: https://qwenlm.github.io/qwen-code-docs/en/users/features/approval-mode/ · https://github.com/QwenLM/qwen-code/blob/main/docs/users/features/approval-mode.md

---

## 4. Existing reusable libraries / components

**MCP elicitation** (spec `2025-06-18`): a server-requests-structured-input-from-user primitive. Request `elicitation/create` with `message` + `requestedSchema`; response three-action model `action: "accept" | "decline" | "cancel"` with `content`. **But the spec explicitly says "Servers MUST NOT use elicitation to request sensitive information,"** and the shape carries no `updatedInput` or rule scope — so it is a form/consent primitive, not a purpose-built tool-call gate. Source: https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation

**Claude `permissionPromptToolName`** (= CLI `--permission-prompt-tool`): nominate an MCP tool that returns the `PermissionResult` (`{behavior:"allow",updatedInput?}` / `{behavior:"deny",message}`). Source: https://code.claude.com/docs/en/agent-sdk/typescript

**Vercel AI SDK** — the brief's premise ("no built-in canUseTool") is **outdated as of AI SDK 6**, which added `needsApproval` (boolean or `(input)=>boolean`) → tool enters `approval-requested` state → host calls `addToolApprovalResponse({id, approved})`. JS-only, in-process; **no Rust equivalent and not a JSON-over-stdin protocol.** Source: https://vercel.com/blog/ai-sdk-6

**Generic policy engines** (decision engines you embed behind your own gate, not approval *protocols*): Cedar (`cedar-policy` Rust crate + WASM/JS bindings, https://crates.io/crates/cedar-policy), OPA/Rego, Casbin. `agent-fetch` (npm + crate) is the closest cross-language "agent gating" precedent but is network-only.

**Assessment.** For a JS+Rust OpenCode fork needing JSON-I/O-controllable read-only/plan/per-command approval: **reuse OpenCode's own stripped permission model as the core** — its three-state `allow`/`ask`/`deny` config with per-tool glob rules and "last matching rule wins" already expresses read-only/plan/per-command gating in plain JSON, the fork still vendors the reference implementation at `original-opencode/packages/opencode/src/permission/index.ts`, and the consumer-side reply flow (`once`/`always`/`reject`) is already wired in `js/src/cli/cmd/run.ts`. Adopt the Anthropic `PermissionResult` shape (`behavior`/`updatedInput`/`message`) as the JSON-over-stdin decision contract (de-facto standard, trivially a Rust enum, gives input-rewriting for free). Use MCP elicitation / `permissionPromptToolName` only as an optional interactive transport, not the primary primitive. Reach for Cedar (Rust + WASM) only if declarative org-wide policy is later needed. Do **not** reimplement from scratch.

---

## 5. Comparison table — read-only / plan / approval flags

| Capability | Claude Code | OpenAI Codex | Gemini CLI | Qwen Code | OpenCode | `@link-assistant/agent` (after #271) |
|---|---|---|---|---|---|---|
| **Read-only / plan flag** | `--permission-mode plan` | `--sandbox read-only` | `--approval-mode plan` | `--approval-mode plan` | Plan agent / `OPENCODE_PERMISSION` deny | `--read-only` / `--disable-tools` |
| **Approval policy values** | `default`, `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions` | sandbox: `read-only`/`workspace-write`/`danger-full-access`; approval: `untrusted`/`on-failure`/`on-request`/`never` | `default`, `auto_edit`, `yolo`, `plan` | `plan`, `default`, `auto-edit`, `auto`, `yolo` | per-tool `allow`/`ask`/`deny` | env: `LINK_ASSISTANT_AGENT_READ_ONLY`, `LINK_ASSISTANT_AGENT_DISABLE_TOOLS` |
| **Allow/deny specific tools** | `--allowedTools` / `--disallowedTools` (`Bash(git log:*)`) | sandbox + approval policy | tool allowlist (plan mode) | mode-based | `permission: {bash:{...},edit:{...}}` glob rules | `--disable-tools bash,edit,write,...` |
| **Bypass / YOLO** | `--dangerously-skip-permissions` | `--dangerously-bypass-approvals-and-sandbox` (`--yolo`) | `--approval-mode yolo` (`-y` deprecated) | `--approval-mode yolo` | `--dangerously-skip-permissions` | (n/a) |
| **Config-file equivalent** | `permissions.{allow,ask,deny,defaultMode}` | `approval_policy`, `sandbox_mode` (config.toml) | `--approval-mode` / settings | `tools.approvalMode` (.qwen/settings.json) | `permission` block in opencode.json | config + flags |
| **Programmatic approval over JSON** | `canUseTool` / `--permission-prompt-tool` MCP → `{behavior:"allow"|"deny",...}` | MCP elicitations (granular approval) | policy engine (plan.toml) | classifier (auto mode) | `POST /session/:id/permissions/:permissionID` `{response,remember?}`; replies `once`/`always`/`reject` | `permission.updated` SSE + POST reply (inherited from OpenCode) |

---

### Verification caveats to carry into the case study
1. **OpenCode Plan default = `ask`, not `deny`** — the `deny` JSON in the docs is an override example. agent-commander's mapping deliberately uses hard `deny` via `OPENCODE_PERMISSION`.
2. **`OPENCODE_PERMISSION` precedence over config file** is inferred, not verbatim-documented.
3. **Claude `--permission-prompt-tool` MCP `content`/text wrapper** is secondary-sourced (live first-party SDK pages now redirect); the inner `behavior`/`updatedInput`/`message` fields are primary-sourced.
4. **Vercel "no canUseTool"** premise is outdated — AI SDK 6 ships `needsApproval` (JS-only, in-process).
5. Codex `untrusted`/`on-failure` and Gemini/Codex `--full-auto`/`-y` are **deprecated**; prefer `on-request`/`never` and `--approval-mode=*`.