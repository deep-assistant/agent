# Case Study: Issue #270 - Formal AI setup for Agent CLI

## Issue Reference

- **GitHub Issue**: https://github.com/link-assistant/agent/issues/270
- **Prepared PR**: https://github.com/link-assistant/agent/pull/277
- **Formal AI upstream repo**: https://github.com/link-assistant/formal-ai
- **Formal AI upstream issue #621**: https://github.com/link-assistant/formal-ai/issues/621
- **Research date**: 2026-07-03

## Collected Data

This folder contains the raw issue and PR metadata used for the analysis:

- `issue-270.json`
- `issue-comments.json`
- `pr-277.json`
- `pr-comments.json`
- `pr-review-comments.json`
- `pr-reviews.json`
- `formal-ai-issue-621.json`
- `formal-ai-with-formal-ai-prs.json`
- `formal-ai-alias-prs.json`
- `formal-ai-code-search.json`

At collection time, issue #270 had no comments, PR #277 had no discussion comments, no review comments, and no reviews.

## Summary

Agent could only use Formal AI through a manual OpenAI-compatible provider config. The short selector `formal-ai` failed during short-name resolution because Formal AI is not in the models.dev catalog, and `@link-assistant/formal-ai` did not have an Agent provider entry. Formal AI issue #621 separately tracks adding Agent to the `with-formal-ai` wrapper, but issue #270 requires Agent itself to know the aliases by default.

The implemented solution adds a built-in OpenAI-compatible Formal AI provider backed by the already bundled `@ai-sdk/openai-compatible` package. Agent now accepts `formal-ai`, `formal-ai/formal-ai`, `@link-assistant/formal-ai`, and `formalai/formal-ai` without a manual config. Documentation now covers install, local server setup, remote base URLs, auth, and common failure modes.

## Requirements

| Requirement from issue #270                                          | Resolution                                                                                                                                   |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Check current Formal AI docs and options, including `with-formal-ai` | Reviewed Formal AI README, install docs, API routes, wrappers, and integration tests from commit `6f94f490f4a2cf361991932856264086c0e2a2a8`. |
| Verify behavior with actual execution/tests                          | Added and ran `bun test ./tests/formal-ai-provider.ts`; it fails before the provider change and passes after it.                             |
| Agent CLI knows `formal-ai` by default                               | Added built-in `formal-ai` provider and short-model resolution through provider state.                                                       |
| Agent CLI knows `@link-assistant/formal-ai` by default               | Added `@link-assistant` as a provider alias whose `formal-ai` model resolves to the canonical server model id.                               |
| Provide setup instructions                                           | Added `docs/formal-ai.md` and linked it from `MODELS.md`, `README.md`, and `js/README.md`.                                                   |
| Explain what to do when the local/remote server is unavailable       | Added server checks and troubleshooting for connection failures, auth failures, missing agent mode, and old Agent versions.                  |
| Collect related data in `docs/case-studies/issue-270`                | Added raw GitHub metadata plus this analysis.                                                                                                |
| List possible solutions and plans                                    | Captured below.                                                                                                                              |
| Check existing components/libraries                                  | Reused existing provider custom loaders, synthetic provider injection, and bundled `@ai-sdk/openai-compatible`.                              |

## Upstream Facts

- Formal AI exposes protocol namespaces under `/api/openai/v1`, `/api/anthropic/v1`, `/api/gemini/v1beta`, and `/api/vertex/v1`.
- Formal AI's canonical model id is `formal-ai`.
- Formal AI's API accepts `@link-assistant/formal-ai`, `link-assistant/formal-ai`, `formal-ai-latest`, and `latest` as aliases and returns `formal-ai` in responses.
- Formal AI's OpenAI-compatible base URL for Agent is `http://127.0.0.1:8080/api/openai/v1`.
- Formal AI supports bearer auth with server-side `FORMAL_AI_API_BEARER_TOKEN`; clients send the same value through their API key path, documented here as `FORMAL_AI_API_KEY`.
- When the server has no bearer token configured, any non-empty client API key is enough for clients that require one.
- `formal-ai with` and `with-formal-ai` currently cover Codex, OpenCode, and Gemini. Upstream issue #621 tracks adding Agent as another wrapper target.

Primary upstream references:

- Formal AI README at commit `6f94f490f4a2cf361991932856264086c0e2a2a8`: https://github.com/link-assistant/formal-ai/blob/6f94f490f4a2cf361991932856264086c0e2a2a8/README.md
- Model alias contract tests: https://github.com/link-assistant/formal-ai/blob/6f94f490f4a2cf361991932856264086c0e2a2a8/tests/unit/specification/openai_compatibility.rs
- `with-formal-ai` integration tests: https://github.com/link-assistant/formal-ai/blob/6f94f490f4a2cf361991932856264086c0e2a2a8/tests/integration/with_formal_ai.rs

## Existing Agent Components Checked

- `Provider.state()` already supports synthetic provider records before environment, auth, custom loader, and config loading.
- `CUSTOM_LOADERS` already supports provider-specific autoload and SDK options.
- `@ai-sdk/openai-compatible` is already bundled in `BUNDLED_PROVIDERS`, so no dynamic package install is needed.
- `resolveShortModelName()` resolves short model names from active providers, so a default-loaded Formal AI provider is enough for `--model formal-ai`.
- `parseModelConfig()` validates explicit `provider/model` selections against active provider metadata, so `@link-assistant/formal-ai` needs a real `@link-assistant` provider entry.

## Root Cause

Formal AI was only known to Agent when users supplied a custom provider config. It was not part of models.dev and had no built-in synthetic provider record. As a result:

- `agent --model formal-ai` failed with `ProviderModelNotFoundError` because no active provider had a `formal-ai` model.
- `agent --model @link-assistant/formal-ai` parsed as provider `@link-assistant` plus model `formal-ai`, but that provider did not exist.
- Users had to copy a manual provider block from Formal AI docs or use environment-only config workarounds.

## Solution Options Considered

### Option 1: Documentation-only manual config

Documenting the existing provider block would be low risk, but it would not satisfy the requirement that Agent knows `formal-ai` and `@link-assistant/formal-ai` by default.

### Option 2: Wait for `with-formal-ai agent`

Formal AI issue #621 would make wrapper-based usage easier, but users would still need an extra wrapper and the Agent CLI itself would not know the aliases. This remains a useful upstream follow-up, not a blocker.

### Option 3: Built-in Formal AI provider aliases

Add synthetic provider records for `formal-ai`, `formalai`, and `@link-assistant`, all using `@ai-sdk/openai-compatible` and the same local base URL. This satisfies the default alias requirement, keeps config override support, and reuses the existing provider loading architecture. This is the implemented solution.

## Implementation Notes

- `FORMAL_AI_BASE_URL` overrides the default base URL and must include `/api/openai/v1`.
- `FORMAL_AI_API_KEY` overrides the default placeholder key. The placeholder is useful because local Formal AI servers without bearer auth accept any non-empty key and the AI SDK requires one.
- `formalai/formal-ai` is included for compatibility with Formal AI's OpenCode wrapper naming.
- `link-assistant/formal-ai` is intentionally not a documented Agent selector because `link-assistant` is already an internal Agent provider namespace. Users should use `@link-assistant/formal-ai` instead.

## Verification

The new regression test launches a fresh child process per selector, parses CLI model config, calls `Provider.getModel()`, and asserts that the configured base URL and API key are applied.

Initial pre-fix failure for `formal-ai`:

```text
ProviderModelNotFoundError: Model "formal-ai" not found in any provider.
```

Post-fix command:

```bash
cd js
bun test ./tests/formal-ai-provider.ts
```

Result:

```text
4 pass
0 fail
```

Live Formal AI smoke test:

```bash
cd /tmp/formal-ai-issue270
cargo run --bin formal-ai -- serve --agent-mode --host 127.0.0.1 --port 18080
```

Server checks:

```bash
curl -s http://127.0.0.1:18080/health
curl -s http://127.0.0.1:18080/api/openai/v1/models
curl -s http://127.0.0.1:18080/api/openai/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"@link-assistant/formal-ai","messages":[{"role":"user","content":"Hi"}]}'
```

Observed result: `/health` returned `status: ok`, `/api/openai/v1/models` advertised `formal-ai`, and the chat response returned model `formal-ai` with text `Hi, how may I help you?`.

Agent smoke tests against the live server:

```bash
FORMAL_AI_BASE_URL=http://127.0.0.1:18080/api/openai/v1 \
FORMAL_AI_API_KEY=local-test-token \
bun run src/index.js --model formal-ai --permission-mode plan -p "hi" --compact-json

FORMAL_AI_BASE_URL=http://127.0.0.1:18080/api/openai/v1 \
FORMAL_AI_API_KEY=local-test-token \
LINK_ASSISTANT_AGENT_DEFAULT_COMPACTION_MODELS='(same)' \
bun run src/index.js --model @link-assistant/formal-ai --permission-mode plan -p "hi" --compact-json
```

Both Agent runs exited with code 0 and emitted the assistant text `Hi, how may I help you?`. The scoped alias run logged `providerID: "@link-assistant"`, `modelID: "formal-ai"`, and `resolvedModelID: "formal-ai"`.

## Follow-Ups

- Formal AI issue #621 can still add `with-formal-ai agent` support for users who prefer wrapper-managed invocation.
- Formal AI's README Agent section can be simplified after this Agent release because manual provider config is no longer required for the built-in selectors.
