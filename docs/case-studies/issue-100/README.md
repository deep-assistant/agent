# Case Study: Issue #100 - Google OAuth Scope Mismatch

## Issue Reference

- **Issue URL**: https://github.com/link-assistant/agent/issues/100
- **Title**: We should try all available auth credentials we have for Google
- **Labels**: bug
- **Date Reported**: December 23, 2025

## Timeline of Events

1. **User installs agent v0.6.3**: `bun install -g @link-assistant/agent@latest`
2. **User authenticates with Google OAuth**: Uses "Google AI Pro/Ultra (OAuth - Manual Code Entry)" method
3. **Login appears successful**: Terminal shows "Login successful"
4. **API request fails**: When using `echo "hi" | agent --model google/gemini-3-pro`, the request fails with error code 403

## Error Analysis

### Error Response Details

```json
{
  "error": {
    "code": 403,
    "message": "Request had insufficient authentication scopes.",
    "status": "PERMISSION_DENIED",
    "details": [
      {
        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
        "reason": "ACCESS_TOKEN_SCOPE_INSUFFICIENT",
        "domain": "googleapis.com",
        "metadata": {
          "method": "google.ai.generativelanguage.v1beta.GenerativeService.StreamGenerateContent",
          "service": "generativelanguage.googleapis.com"
        }
      }
    ]
  }
}
```

### WWW-Authenticate Header

```
Bearer realm="https://accounts.google.com/",
error="insufficient_scope",
scope="https://www.googleapis.com/auth/generative-language
       https://www.googleapis.com/auth/generative-language.tuning
       https://www.googleapis.com/auth/generative-language.tuning.readonly
       https://www.googleapis.com/auth/generative-language.retriever
       https://www.googleapis.com/auth/generative-language.retriever.readonly"
```

## Root Cause Analysis

### Current Implementation (src/auth/plugins.ts)

The Google OAuth plugin uses these scopes:

```typescript
const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];
```

### What Google API Requires

The Google Generative Language API (used by gemini-3-pro) requires one of these scopes:

- `https://www.googleapis.com/auth/generative-language`
- `https://www.googleapis.com/auth/generative-language.tuning`
- `https://www.googleapis.com/auth/generative-language.retriever`

### The Mismatch

**Problem**: The `cloud-platform` scope grants broad access to Google Cloud Platform resources, but it does NOT automatically grant access to the Generative Language API which uses a different scope hierarchy.

**Gemini CLI Approach**: The official Gemini CLI (https://github.com/google-gemini/gemini-cli) also uses `cloud-platform` scope, suggesting that scope should work. However, the key difference may be in how the API is being called.

## Key Findings

### Authentication Methods for Google AI

| Method                      | Required Scope                      | Works?       |
| --------------------------- | ----------------------------------- | ------------ |
| API Key                     | None (uses `x-goog-api-key` header) | Yes          |
| OAuth (cloud-platform)      | `cloud-platform`                    | Inconsistent |
| OAuth (generative-language) | `generative-language.*`             | Should work  |

### The Issue Title's Insight

The issue title "We should try all available auth credentials we have for Google" suggests that:

1. Users may have both OAuth tokens and API keys stored
2. When OAuth fails due to scope issues, the system should fall back to API key authentication
3. Currently, the system does not attempt alternative credentials

## Current Auth Storage

From `src/auth/index.ts`:

```typescript
export namespace Auth {
  export const Oauth = z.object({
    type: z.literal('oauth'),
    refresh: z.string(),
    access: z.string(),
    expires: z.number(),
    enterpriseUrl: z.string().optional(),
  });

  export const Api = z.object({
    type: z.literal('api'),
    key: z.string(),
  });

  // Auth is stored per-provider in auth.json
}
```

Auth credentials are stored by provider ID, meaning:

- `google` -> OAuth credentials (with limited scope)
- API keys from environment variables (`GOOGLE_GENERATIVE_AI_API_KEY` or `GEMINI_API_KEY`)

## Proposed Solutions

### Solution 1: Add Generative Language Scopes to OAuth

Update `GOOGLE_OAUTH_SCOPES` in `src/auth/plugins.ts`:

```typescript
const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/generative-language',
];
```

**Pros**: Simple fix
**Cons**: Users must re-authenticate; scope may not be available for all Google accounts

### Solution 2: Credential Fallback Mechanism (Recommended)

Implement a fallback strategy in `src/provider/provider.ts`:

1. Try OAuth credentials first
2. If OAuth fails with scope error (403), try API key
3. If API key fails, report the original error

This allows users who have both OAuth and API keys to seamlessly use whichever works.

### Solution 3: Multiple Credential Storage

Allow storing multiple credentials per provider:

- OAuth tokens for subscription access
- API keys for direct API access

The system could try each credential in priority order until one succeeds.

## Implementation Recommendation

**Primary Fix**: Solution 2 - Credential Fallback Mechanism

1. Modify the Google provider loader to attempt API key auth if OAuth fails
2. Add error detection for scope-related 403 errors
3. Log which credential method was used for transparency
4. Maintain backward compatibility

**Secondary Enhancement**: Solution 1 - Update OAuth Scopes

After implementing fallback, also update the OAuth scopes to reduce the likelihood of scope errors for new authentications.

## Implementation

### Changes Made

#### 1. Added All Required Generative Language Scopes (`src/auth/plugins.ts`)

Updated `GOOGLE_OAUTH_SCOPES` to include all scopes mentioned in the API's WWW-Authenticate header:

```typescript
const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  // Add generative-language scopes for Gemini API access
  'https://www.googleapis.com/auth/generative-language',
  'https://www.googleapis.com/auth/generative-language.tuning',
  'https://www.googleapis.com/auth/generative-language.tuning.readonly',
  'https://www.googleapis.com/auth/generative-language.retriever',
  'https://www.googleapis.com/auth/generative-language.retriever.readonly',
];
```

#### 2. Added Fallback to API Key on OAuth Scope Errors (`src/auth/plugins.ts`)

In the Google OAuth loader, added logic to:

1. Detect OAuth scope errors (HTTP 403 with `insufficient_scope` in `www-authenticate` header)
2. Fall back to API key authentication if available (`GOOGLE_GENERATIVE_AI_API_KEY` or `GEMINI_API_KEY`)
3. Log helpful warnings and hints for users

```typescript
const isScopeError = (response: Response): boolean => {
  if (response.status !== 403) return false;
  const wwwAuth = response.headers.get('www-authenticate') || '';
  return (
    wwwAuth.includes('insufficient_scope') ||
    wwwAuth.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT')
  );
};

// In the fetch handler:
if (isScopeError(oauthResponse)) {
  const fallbackApiKey = getFallbackApiKey();
  if (fallbackApiKey) {
    log.warn('oauth scope error, falling back to api key authentication');
    // Use API key instead of OAuth
  }
}
```

### How to Test

1. **New users**: After updating, run `agent auth login` and select Google. The new OAuth flow will request all required scopes.

2. **Existing users with scope errors**: If you have both OAuth and an API key, the system will automatically fall back to the API key.

3. **Manual verification**: Check the logs for messages like:
   - `using google oauth credentials` - OAuth being used
   - `oauth scope error, falling back to api key authentication` - Fallback triggered

## References

- [Google OAuth Scopes Documentation](https://ai.google.dev/gemini-api/docs/oauth)
- [Gemini CLI OAuth Implementation](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/code_assist/oauth2.ts)
- [Issue #51 - PaLM API 403 Insufficient Scopes](https://github.com/google/generative-ai-python/issues/51)
- [Google Developer Forum - ACCESS_TOKEN_SCOPE_INSUFFICIENT](https://discuss.google.dev/t/googlegenerativeaierror-access-token-scope-insufficient/170693)
