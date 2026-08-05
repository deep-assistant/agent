---
'@link-assistant/agent': patch
---

JSON `error` events now always carry a human-readable `message` string next to
the machine-readable `error` object (#289). Consumers that interpolated
`record.error` previously published `[object Object]` and lost the real failure
cause. The change is additive: the `error` field is unchanged.
