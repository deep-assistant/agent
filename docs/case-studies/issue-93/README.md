# Case Study: Issue #93 - Google OAuth Authentication Failure

## Issue Summary

**Title:** agent auth login через Google не работает
**Issue URL:** https://github.com/link-assistant/agent/issues/93
**Reporter:** @andchir
**Date:** 2025-12-22

## Problem Description

When attempting to authenticate via `agent auth login` using Google OAuth, users encounter a `403: restricted_client` error with the message:

```
Доступ заблокирован: ошибка авторизации
Unregistered scope(s) in the request: https://www.googleapis.com/auth/generative-language.tuning, https://www.googleapis.com/auth/generative-language.retriever
```

The affected authentication methods are:

- Google AI Pro/Ultra (OAuth - Browser)
- Google AI Pro/Ultra (OAuth - Manual Code Entry)

## Root Cause Analysis

### Investigation

The error message clearly indicates that two OAuth scopes are not registered for the OAuth client:

1. `https://www.googleapis.com/auth/generative-language.tuning`
2. `https://www.googleapis.com/auth/generative-language.retriever`

### Code Location

The problematic scopes are defined in `src/auth/plugins.ts` at lines 857-863:

```typescript
const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/generative-language.tuning', // <-- UNREGISTERED
  'https://www.googleapis.com/auth/generative-language.retriever', // <-- UNREGISTERED
];
```

### Root Cause

The Google OAuth implementation was missing the required scopes for Gemini API subscription features. The `generative-language.tuning` and `generative-language.retriever` scopes are necessary for:

1. Model tuning functionality
2. Semantic retrieval features
3. Advanced Gemini API subscription benefits

These scopes are valid OAuth scopes for the Generative Language API and are required for full functionality when using OAuth authentication with Gemini.

## Reference Implementation Analysis

### Gemini CLI (Official Google Implementation)

Source: https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/code_assist/oauth2.ts

Uses only 3 scopes:

```javascript
const OAUTH_SCOPE = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];
```

## Solution

Add the required generative-language scopes to `GOOGLE_OAUTH_SCOPES` for Gemini API subscription features.

### Before (Broken)

```typescript
const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];
```

### After (Fixed)

```typescript
const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/generative-language.tuning',
  'https://www.googleapis.com/auth/generative-language.retriever',
];
```

## Timeline

1. **2025-12-22:** Issue reported by @andchir
2. **2025-12-22:** Initial investigation identified missing generative-language scopes
3. **2025-12-22:** Scopes added to enable Gemini API subscription features

## Lessons Learned

1. OAuth scopes must match the required permissions for the API functionality being used
2. Generative Language API requires specific scopes for advanced features like tuning and retrieval
3. When implementing OAuth for AI APIs, include all necessary scopes for full feature support
