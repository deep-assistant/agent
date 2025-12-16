---
'@link-assistant/agent': patch
---

fix: Use valid placeholder API keys for OAuth providers (Anthropic, GitHub Copilot, OpenAI)

When using `--model anthropic/claude-sonnet-4-5` after authenticating with `agent auth login` (Anthropic > Claude Pro/Max), the command failed with `ProviderInitError` at line 732 in `src/provider/provider.ts`.

The OAuth authentication plugin loaders in `src/auth/plugins.ts` were returning empty strings (`''`) for the `apiKey` parameter. The AI SDK providers (e.g., `@ai-sdk/anthropic`, `@ai-sdk/openai`) require a non-empty `apiKey` parameter even when using custom fetch functions for authentication. The empty string failed validation, causing provider initialization to fail.

This fix changes the `apiKey` value from an empty string to a descriptive placeholder string (`'oauth-token-used-via-custom-fetch'`) for all OAuth loaders (AnthropicPlugin, GitHubCopilotPlugin, and OpenAIPlugin). The placeholder satisfies AI SDK validation requirements while the actual OAuth authentication happens via Bearer tokens in the custom fetch's Authorization header.

Fixes #47
