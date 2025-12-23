---
'@link-assistant/agent': minor
---

feat(google): Route OAuth requests through Cloud Code API for proper subscription support

When Google OAuth is active, the agent now routes requests through Google's Cloud Code API
(`cloudcode-pa.googleapis.com/v1internal`) instead of the standard Generative Language API
(`generativelanguage.googleapis.com`).

This is the same approach used by the official Gemini CLI and properly supports:

- Google AI Pro/Ultra subscription users
- The `cloud-platform` OAuth scope (which is all the OAuth client has registered)
- Automatic subscription tier handling (FREE, STANDARD, etc.)

The key insight is that the Gemini CLI doesn't call `generativelanguage.googleapis.com` directly.
Instead, it uses Google's Cloud Code API which:

1. Accepts `cloud-platform` OAuth tokens
2. Handles subscription tier validation
3. Proxies requests to the Generative Language API internally

This fix includes:

- URL transformation from Generative Language API to Cloud Code API
- Request body transformation to Cloud Code API format (wrapping with model/project fields)
- Response body transformation to unwrap Cloud Code API responses
- Streaming response support with proper SSE chunk transformation
- Fallback to API key authentication if Cloud Code API fails

Fixes #100

References:

- [Gemini CLI server.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/code_assist/server.ts)
- [Gemini CLI oauth2.ts](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/code_assist/oauth2.ts)
