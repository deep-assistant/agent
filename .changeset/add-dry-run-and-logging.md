---
'@link-assistant/agent': patch
---

feat: Add --dry-run mode and enhanced debugging logging

- Added `--dry-run` CLI flag to simulate operations without making actual API calls or package installations
- Added `OPENCODE_DRY_RUN` flag and `Flag.setDryRun()` function for programmatic control
- Enhanced error logging in `BunProc.install()` with detailed error messages including stderr/stdout
- Enhanced provider initialization logging with detailed context
- Added logging for package installation success/failure
- Added unit tests for dry-run mode functionality
- Improved debugging capabilities to help diagnose package installation failures

Fixes #68
