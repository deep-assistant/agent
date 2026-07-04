# Case Study: Issue #230 - Read/search tools improvements

## Issue Reference

- GitHub issue: https://github.com/link-assistant/agent/issues/230
- Prepared PR: https://github.com/link-assistant/agent/pull/278
- Research date: 2026-07-03

## Collected Data

Raw artifacts are stored in `data/`:

- `issue-230.json`
- `issue-230-comments.json`
- `pr-278.json`
- `pr-278-conversation-comments.json`
- `pr-278-review-comments.json`
- `pr-278-reviews.json`
- `gh-code-search-max-line-length.txt`
- `related-merged-prs.json`

At collection time, issue #230 had no comments. PR #278 had no conversation
comments, review comments, or reviews. Code search showed the old truncation
points in `js/src/tool/read.ts` and `rust/src/tool/read.rs`.

Online research notes are in `research/online-references.md`.

## Summary

The previous read and search tools hid important information in long lines. The
read tool kept only the start of long lines, and the search tool could omit a
whole long matching line, which made the match itself invisible. The default
read behavior also only showed the beginning of a long file, so an agent had no
first-call signal about how the file ended.

The implemented solution adds shared column-window formatting in both
JavaScript and Rust. The read tool now summarizes long files with first and
last line ranges by default, supports explicit `columnOffset` and
`columnLimit`, and summarizes long single lines with omitted-column markers. The
search tool now keeps long matching lines readable by showing a window centered
on the match and marking omitted column ranges.

## Requirements

| ID  | Requirement from issue #230                                                 | Resolution                                                                                                                                               |
| --- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Support long lines in tools                                                 | Added column-window helpers in JS and Rust that preserve first/last or match-focused text with omitted-column markers.                                   |
| R2  | Search should show the matching segment, not `[Omitted long matching line]` | JS grep now parses ripgrep JSON submatch offsets; Rust grep uses `regex::Regex::find`. Both format a match-focused window.                               |
| R3  | Read should allow columns, not only lines                                   | Added `columnOffset` and `columnLimit` parameters in JS and Rust read schemas and implementations.                                                       |
| R4  | Default read should give a useful whole-file overview                       | When no explicit line range is supplied and the file exceeds the line limit, read returns the first and last ranges with `... [omitted lines X..Y] ...`. |
| R5  | One long-line file should show first and last columns                       | Default long-line read uses first columns, omitted-column range, and last columns.                                                                       |
| R6  | Preserve previous behavior with tests before changing logic                 | Added regression tests for existing IDs/schema behavior plus failing long-file, long-line, explicit-column, and grep match-window cases before the fix.  |
| R7  | Collect issue data and perform case-study analysis                          | Added this folder with raw GitHub artifacts, online/library research, requirements, alternatives, and verification notes.                                |
| R8  | Check existing components/libraries that can help                           | Evaluated ripgrep JSON output, `grep-printer` JSON wire format, existing JS ripgrep wrapper, and Rust `regex`/`walkdir` implementation.                  |

## Root Cause

The original read implementations used a fixed `MAX_LINE_LENGTH` prefix
truncation. This discarded the end of long single-line files and did not expose
any parameter for column-level follow-up reads.

The JS search implementation used plain ripgrep output, so it had no structured
match offset to select a useful snippet. External research also confirmed that
ripgrep output-control flags such as `-M` do not apply when `--json` is used,
so Agent must do its own windowing when it consumes structured output.

The Rust grep implementation searched lines directly and printed the full line
in content mode. It needed the same match-focused formatting to keep parity
with JS behavior and avoid huge single-line output.

## Existing Components Checked

- JS `Ripgrep.filepath()` already resolves the bundled ripgrep binary.
- ripgrep `--json` emits match messages with `lines`, `line_number`, and
  `submatches` byte offsets, which is enough to find the matching segment.
- Rust `regex::Regex::find` returns the byte range for a match in a line.
- Existing read/grep tests already cover stable tool IDs, schemas, simple
  reads, offsets, binary handling, glob matching, regex matching, and grep
  output modes.

## Solution Options

### Option 1: Increase or remove the line-length limit

This would make the example match visible, but it would also dump very large
minified files into the model context. It does not solve targeted follow-up
reads by column.

### Option 2: Use ripgrep max-column flags

This is not reliable for the JS search path because ripgrep documents that
standard output shaping flags such as `-M` have no effect with `--json`. It also
would not help the read tool.

### Option 3: Add Agent-owned column windows

This is the implemented plan. It keeps output bounded, exposes omitted ranges
that can be requested later, and uses structured match offsets where available.
The same visible marker format is used in read and grep output in both ports.

## Implementation Notes

- `formatBalancedLineWindow` keeps the first and last columns of a long line.
- `formatColumnWindow` implements explicit read windows with omitted ranges on
  both sides when needed.
- `formatFocusedLineWindow` centers the output window around a matching range.
- JS converts ripgrep byte offsets to JavaScript column indices before
  formatting.
- Rust converts regex byte offsets to character indices before formatting.
- Default read summarization only applies when the caller does not provide
  `offset` or `limit`; explicit line windows retain pagination behavior and the
  "File has more lines" hint.

## Verification

Focused pre-fix tests were added first and failed against the old behavior.
After implementation, these focused checks pass:

```bash
cd js
bun test ./tests/tool_read.js ./tests/tool_grep.js
```

```bash
cd rust
cargo test --test tool_read --test tool_grep
```

The JS focused tests cover:

- default long-file first/last line summaries;
- default long single-line omitted-column ranges;
- explicit `columnOffset`/`columnLimit` reads;
- match-focused grep output for a long line.

The Rust focused tests cover the same read and grep behaviors plus the existing
read/grep parity cases.
