---
'@link-assistant/agent': patch
---

fix: Add graceful fallback when provider initialization fails

Fixes issue #72 where version 0.3.0 appeared "completely broken" due to Bun package cache corruption preventing opencode provider initialization. The agent now gracefully falls back to alternative providers when initialization fails, improving resilience and user experience.

Changes:

- Test provider initialization before selecting it as default
- Fall back to alternative providers if opencode provider fails to initialize
- Add helpful error messages when Bun cache corruption is detected
- Log warnings with detailed error information for troubleshooting

Impact:

- Agent no longer crashes when provider initialization fails
- Better error messages guide users to recovery steps
- Improved stability in production environments
