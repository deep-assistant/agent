# Case Study: Issue #66 - Full Support for Gemini OAuth (Subscriptions Login)

## Issue Summary

**Issue**: [#66](https://github.com/link-assistant/agent/issues/66)
**Title**: Full support for Gemini oAuth (subscriptions login)
**Status**: Open
**Labels**: bug

### Problem Statement

The current implementation only supports API token authentication for Google/Gemini. Users with Google AI Pro or Google AI Ultra subscriptions need OAuth-based authentication similar to how Claude Pro/Max subscriptions are handled.

### Screenshot Evidence

![Current Google Provider Selection](./issue-screenshot.jpg)

The screenshot shows that when selecting the Google provider, only API key authentication is available:

- "You can create an API key at https://aistudio.google.com/app/apikey"
- "Enter your API key"

## Technical Analysis

### Current State

#### Supported OAuth Providers (in `src/auth/plugins.ts`)

| Provider                   | OAuth Support | Implementation            |
| -------------------------- | ------------- | ------------------------- |
| Anthropic (Claude Pro/Max) | Yes           | Full OAuth flow with PKCE |
| GitHub Copilot             | Yes           | Device code flow          |
| OpenAI (ChatGPT Plus/Pro)  | Yes           | OAuth flow with PKCE      |
| **Google (Gemini)**        | **No**        | **Only API key**          |

#### Google Provider Configuration (in `src/provider/provider.ts`)

Currently, Google is configured as `google-vertex` provider which only supports:

- Environment variables: `GOOGLE_CLOUD_PROJECT`, `GCP_PROJECT`, `GCLOUD_PROJECT`
- Environment variables: `GOOGLE_CLOUD_LOCATION`, `VERTEX_LOCATION`

This is designed for Google Cloud Vertex AI with service account credentials, not for consumer OAuth login.

### Reference Implementations

#### 1. Gemini CLI OAuth Implementation (`reference-gemini-cli/packages/core/src/code_assist/oauth2.ts`)

The official Gemini CLI uses the following OAuth configuration:

```typescript
// OAuth Client ID
const OAUTH_CLIENT_ID =
  '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com';

// OAuth Client Secret (public for installed applications)
const OAUTH_CLIENT_SECRET = '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';

// OAuth Scopes
const OAUTH_SCOPE = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

// Redirect URLs
const SIGN_IN_SUCCESS_URL =
  'https://developers.google.com/gemini-code-assist/auth_success_gemini';
const SIGN_IN_FAILURE_URL =
  'https://developers.google.com/gemini-code-assist/auth_failure_gemini';
```

**OAuth Flow Used**: Standard OAuth 2.0 Authorization Code flow with PKCE

**Key Features**:

1. Browser-based authorization
2. Local HTTP server callback on localhost with dynamic port
3. Token refresh support
4. User info retrieval from `https://www.googleapis.com/oauth2/v2/userinfo`
5. Credentials cached locally in `~/.gemini/` directory

#### 2. Original OpenCode Google Support (`original-opencode/packages/opencode/src/provider/provider.ts`)

OpenCode uses Google as a console-level OAuth provider for user authentication but relies on Vertex AI for model access:

```typescript
'google-vertex': async () => {
  const project = process.env['GOOGLE_CLOUD_PROJECT'] ?? process.env['GCP_PROJECT'] ?? process.env['GCLOUD_PROJECT']
  const location = process.env['GOOGLE_CLOUD_LOCATION'] ?? process.env['VERTEX_LOCATION'] ?? 'us-east5'
  const autoload = Boolean(project)
  return {
    autoload,
    options: { project, location },
    async getModel(sdk: any, modelID: string) {
      return sdk.languageModel(id)
    },
  }
}
```

## Root Cause Analysis

### Why OAuth is Not Implemented for Google

1. **Historical Design**: The agent was initially designed for API key authentication with models.dev backend
2. **Vertex AI Focus**: Google integration focused on enterprise Vertex AI rather than consumer Gemini API
3. **Missing Plugin**: No `google` plugin exists in `src/auth/plugins.ts` unlike `anthropic`, `github-copilot`, and `openai`
4. **Different API Endpoint**: Consumer Gemini API uses `generativelanguage.googleapis.com` while Vertex AI uses `aiplatform.googleapis.com`

### Technical Gaps

1. **No Google OAuth Plugin**: `src/auth/plugins.ts` doesn't include a Google/Gemini OAuth plugin
2. **No Consumer Gemini Provider**: Only `google-vertex` provider exists, not consumer `google` or `gemini` provider
3. **No OAuth Configuration**: Missing OAuth client ID, scopes, and endpoints for consumer Gemini
4. **No Token Management**: No refresh token handling for Google OAuth tokens

## Proposed Solution

### 1. Add Google OAuth Plugin

Create a new Google OAuth plugin in `src/auth/plugins.ts` that:

- Uses Gemini CLI's OAuth client credentials
- Implements PKCE-based authorization code flow
- Handles token refresh
- Retrieves user info for subscription verification

### 2. Add Consumer Gemini Provider

Add a new `google` or `gemini` provider configuration that:

- Uses OAuth tokens from the auth plugin
- Points to `generativelanguage.googleapis.com` endpoint
- Supports subscription-based models

### 3. OAuth Flow Implementation

```
User                Browser              Agent               Google OAuth
  |                    |                   |                      |
  |--Select Google---->|                   |                      |
  |                    |                   |                      |
  |                    |<--Generate PKCE---|                      |
  |                    |                   |                      |
  |<--Open Auth URL----|------------------->                      |
  |                    |                   |                      |
  |----Login/Consent-->|----------------------------------------->|
  |                    |                   |                      |
  |<---Auth Code-------|<------------------------------------------|
  |                    |                   |                      |
  |----Paste Code----->|                   |                      |
  |                    |---Exchange Code-->|--------------------->|
  |                    |                   |                      |
  |                    |<--Access+Refresh--|<---------------------|
  |                    |                   |                      |
  |<---Success---------|                   |                      |
```

## Implementation Plan

1. **Phase 1**: Add Google OAuth plugin to `src/auth/plugins.ts`
2. **Phase 2**: Add `google-oauth` provider to `src/provider/provider.ts`
3. **Phase 3**: Integrate OAuth loader for custom fetch
4. **Phase 4**: Add tests and documentation
5. **Phase 5**: Update CLI to show Google OAuth option

## Files to Modify

| File                       | Changes                                     |
| -------------------------- | ------------------------------------------- |
| `src/auth/plugins.ts`      | Add GooglePlugin with OAuth methods         |
| `src/provider/provider.ts` | Add `google-oauth` provider configuration   |
| `docs/google-oauth.md`     | Create documentation for Google OAuth setup |

## References

### External Resources

- [Google Gemini API OAuth Documentation](https://ai.google.dev/gemini-api/docs/oauth)
- [Gemini CLI Authentication Setup](https://google-gemini.github.io/gemini-cli/docs/get-started/authentication.html)
- [Google OAuth 2.0 for Mobile & Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app)

### Internal References

- Gemini CLI OAuth Implementation: `reference-gemini-cli/packages/core/src/code_assist/oauth2.ts`
- Original OpenCode Provider: `original-opencode/packages/opencode/src/provider/provider.ts`
- Current Auth Plugins: `src/auth/plugins.ts`
- Current Provider Config: `src/provider/provider.ts`

## Timeline of Events

1. **Initial Implementation**: Agent created with API key authentication only
2. **Claude OAuth Added**: Anthropic OAuth plugin implemented for Claude Pro/Max
3. **GitHub Copilot Added**: Device code flow OAuth for Copilot
4. **OpenAI OAuth Added**: ChatGPT Plus/Pro OAuth support
5. **Issue #66 Opened**: User requested Gemini subscription OAuth support
6. **Current**: Google only supports Vertex AI with service accounts
