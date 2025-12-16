---
'@link-assistant/agent': patch
---

fix: Replace prompts.autocomplete with prompts.select in auth login command

The `agent auth login` command was failing with `TypeError: prompts.autocomplete is not a function` because `@clack/prompts@0.11.0` does not have the `autocomplete` function (it was added in v1.0.0-alpha.0).

This fix replaces `prompts.autocomplete()` with `prompts.select()` which is available in the stable version.

Fixes #43
