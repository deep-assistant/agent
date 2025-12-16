---
'@link-assistant/agent': minor
---

Add support for google/gemini-3-pro model alias

- Added `google/gemini-3-pro` as an alias to `gemini-3-pro-preview`
- Updated README.md with Google Gemini usage examples
- Created comprehensive case study in docs/case-studies/issue-53/
- Fixes ProviderModelNotFoundError when using google/gemini-3-pro

This change allows users to use the commonly expected model name `gemini-3-pro` while maintaining compatibility with Google's official `gemini-3-pro-preview` identifier.
