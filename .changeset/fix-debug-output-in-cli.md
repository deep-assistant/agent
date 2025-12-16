---
'@link-assistant/agent': patch
---

Fix debug output appearing in CLI commands - logs are now suppressed by default and only shown with --verbose flag. This fixes the issue where commands like `agent auth list` displayed debug messages that broke the clean CLI UI.
