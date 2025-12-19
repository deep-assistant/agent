# Issue #66: Full support for Gemini oAuth (subscriptions login)

## Issue Description

**Status**: Closed  
**Labels**: bug  
**Created**: Dec 16, 2025  
**Closed**: Unknown

### Original Description

At the moment we only support API token, but we need to also to support Gemini subscriptions with oAuth (or similar flow) like we do for Claude Pro/Max subscriptions.

We should use reference code at ./original-opencode and ./reference-gemini-cli.

Please download all logs and data related about the issue to this repository, make sure we compile that data to ./docs/case-studies/issue-{id} folder, and use it to do deep case study analysis (also make sure to search online for additional facts and data), in which we will reconstruct timeline/sequence of events, find root causes of the problem, and propose possible solutions.

### Screenshot

![Screenshot](https://private-user-images.githubusercontent.com/1431904/527282484-3c90f393-d9b5-476f-a9c4-cdafb520907e.jpg?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NjYxNzkzNDIsIm5iZiI6MTc2NjE3OTA0MiwicGF0aCI6Ii8xNDMxOTA0LzUyNzI4MjQ4NC0zYzkwZjM5My1kOWI1LTQ3NmYtYTljNC1jZGFmYjUyMDkwN2UuanBnP1gtQW16LUFsZ29yaXRobT1BV1M0LUhNQUMtU0hBMjU2JlgtQW16LUNyZWRlbnRpYWw9QUtJQVZDT0RZTFNBNTNQUUs0WkElMkYyMDI1MTIxOSUyRnVzLWVhc3QtMSUyRnMzJTJGYXdzNF9yZXF1ZXN0JlgtQW16LURhdGU9MjAyNTEyMTlUMjExNzIyWiZYLUFtei1FeHBpcmVzPTMwMCZYLUFtei1TaWduYXR1cmU9NTFjZWFlM2NlYTA5NDk0ZGRmYzNmYzIwN2JmNmU2YjBhNmE1OWYxYjJjNDA4ODcyYzdhNjc2ZWI4ZDFkODc4NiZYLUFtei1TaWduZWRIZWFkZXJzPWhvc3QifQ.IrcVvzeHCyywPEuFIDyeXoULxP7m8l3QwdOlVKr9fIc)

### Related PRs

- [#67](https://github.com/link-assistant/agent/pull/67)
- [#74](https://github.com/link-assistant/agent/pull/74)

## Analysis

### Current Implementation Status

Based on codebase analysis, Google OAuth support appears to be implemented:

1. **Auth Plugin**: Google OAuth plugin exists in `src/auth/plugins.ts` with proper OAuth 2.0 flow
2. **Provider Support**: Both `google` and `google-oauth` providers are configured in `src/provider/provider.ts`
3. **CLI Integration**: `agent auth login` supports Google OAuth authentication
4. **Reference Code**: Uses same OAuth credentials as reference-gemini-cli

### Key Components

- **OAuth Client ID/Secret**: Same as Gemini CLI (public for installed apps)
- **Scopes**: `https://www.googleapis.com/auth/cloud-platform`, `userinfo.email`, `userinfo.profile`, `generative-language.retriever`
- **Flow**: OAuth 2.0 with PKCE, local server callback
- **Token Management**: Automatic refresh using refresh tokens
- **Authentication**: Bearer token in Authorization header

### Research Findings

**Official Google Documentation**:

- Google provides official OAuth quickstart for Gemini API: https://ai.google.dev/gemini-api/docs/oauth
- OAuth is the recommended authentication method for Gemini subscriptions
- Desktop applications should use installed app flow with public client credentials

**Scope Requirements**:

- `generative-language.retriever` scope added in PR #74 and implemented is required for Gemini API access
- This scope enables access to Gemini models with subscription benefits
- Without this scope, OAuth authentication may fail or have limited functionality

**Reference Implementation**:

- Gemini CLI uses identical OAuth credentials and flow
- Local HTTP server approach (implemented in PR #74) is the modern standard
- PKCE (Proof Key for Code Exchange) is required for security

### Potential Issues

1. **Token Refresh**: May need verification that refresh tokens work properly
2. **Scope Requirements**: May need additional scopes for Gemini API access
3. **Error Handling**: OAuth flow error handling and user feedback
4. **Integration Testing**: End-to-end testing of OAuth flow

## Timeline Reconstruction

- **Dec 16, 2025**: Issue created requesting Gemini OAuth support
- **Dec 16, 2025**: PR #67 created - "feat: Add Google OAuth support for Gemini subscriptions"
  - Initial implementation with OAuth plugin, provider loader, and documentation
  - Used deprecated out-of-band OAuth flow initially
  - Blocked by GitHub secret scanning (resolved as credentials are public for desktop apps)
- **Dec 17, 2025**: PR #67 merged into main
- **Dec 19, 2025**: PR #74 created - "Full support for Gemini oAuth (subscriptions login)"
  - Updated to modern local HTTP server approach
  - Added `generative-language.retriever` scope for full Gemini API access
- **Unknown**: Issue closed as resolved

## Root Cause Analysis

**Primary Issue**: Lack of OAuth authentication support for Gemini subscriptions

**Root Causes**:

1. Only API key authentication was implemented initially
2. Gemini subscriptions require OAuth flow similar to Claude Pro/Max
3. No integration with Google's OAuth endpoints for AI subscriptions

**Solutions Implemented**:

1. Added Google OAuth plugin with proper OAuth 2.0 flow
2. Integrated with existing auth system
3. Added provider support for OAuth credentials
4. Used reference implementation from Gemini CLI

## Recommendations

1. **Test OAuth Flow**: Verify end-to-end OAuth authentication works
2. **Token Refresh**: Ensure automatic token refresh functions properly
3. **Error Handling**: Improve error messages for OAuth failures
4. **Documentation**: Update docs to mention OAuth support for Gemini
5. **Integration Tests**: Add automated tests for OAuth flow
