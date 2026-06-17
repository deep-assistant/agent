---
'@link-assistant/agent': minor
---

Add a native, enforceable read-only / planning mode (`--read-only`) plus a general `--disable-tools <list>` flag (issue #271).

`--read-only` (env `LINK_ASSISTANT_AGENT_READ_ONLY`) disables every filesystem-mutating and shell tool — `bash`, `edit`, `write`, `multiedit`, `patch` — so the agent can only read, search and plan. The restriction is enforced at tool resolution and also when tools are invoked indirectly via the `batch` tool, so it cannot be bypassed. `--disable-tools bash,write,edit` (env `LINK_ASSISTANT_AGENT_DISABLE_TOOLS`) allows disabling an explicit set of tools.

This makes agent-commander's uniform `--read-only` flag enforceable for the `agent` tool, on par with the other supported tools.
