# Online References

Research date: 2026-07-03

## ripgrep JSON Output

- Source: https://manpages.debian.org/testing/ripgrep/rg.1.en.html
- Finding: `--json` emits JSON Lines messages. Match messages include the
  matched text and offsets. The man page also states that standard output
  shaping flags, including `-M`/`--max-columns`, have no effect when JSON output
  is enabled.
- Impact: Agent cannot rely on ripgrep to pre-truncate JSON match lines. The
  JS grep tool should parse structured matches and apply its own column window.

## grep-printer Wire Format

- Source: https://docs.rs/grep-printer/latest/grep_printer/struct.JSON.html
- Finding: The JSON wire format describes `match` messages with `path`,
  `lines`, `line_number`, and `submatches`. Submatch `start` and `end` fields
  are byte offsets into the `lines` data and use a half-open interval.
- Impact: JS grep must convert byte offsets to display columns before choosing
  a readable snippet around the match.

## ripgrep User Guide

- Source: https://ripgrep.dev/docs/guide/
- Finding: ripgrep is the existing fast recursive search component and supports
  explicit files/directories plus glob filtering.
- Impact: The fix should keep using the existing bundled ripgrep path for JS
  search and only change output parsing/windowing, not file discovery.

## Related ripgrep Issue

- Source: https://github.com/BurntSushi/ripgrep/issues/1451
- Finding: A prior ripgrep issue reported that `-M` did not limit line length
  under `--json`; this matches the current man page behavior.
- Impact: Confirms Option 2 in the case study is not a complete solution.
