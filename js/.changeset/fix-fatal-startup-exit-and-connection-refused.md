---
'@link-assistant/agent': patch
---

fix: exit non-zero on fatal startup errors and stop retrying refused connections

Fixes two failure modes reported in issue #290.

Fatal startup errors (for example an unknown `provider/model`) previously exited with
code 0 and emitted no `error` event on the JSON stream — a recurrence of issue #22.
Model-resolution failures now publish `Session.Event.Error` on the bus, the entry point
folds in the error state tracked by continuous mode, and the prompt promise is awaited
after the `session.idle` event so the process can no longer exit before the rejection is
recorded.

`ConnectionRefused` and `ENOTFOUND` were classified as retryable, so the default 7 day
retry budget was spent on endpoints that will never answer. A shared classifier
(`util/network-error.ts`) now marks permanently unreachable endpoints as non-retryable in
both the HTTP retry layer and `MessageV2.fromError`. Transient failures such as `EAI_AGAIN`
and `ECONNRESET` remain retryable.
