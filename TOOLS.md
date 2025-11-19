# Agent-CLI Tools Implementation Status

This document tracks the implementation status of tools supported by original-opencode in our agent-cli MVP.

## Core Tools

| Tool | Original OpenCode | Agent-CLI Status | Agent-CLI Test | Reference Test |
|------|-------------------|------------------|----------------|---------------|
| bash | ✅ | ✅ Implemented | [bash.tools.test.js](tests/bash.tools.test.js) | [bash.reference.tools.test.js](tests/bash.reference.tools.test.js) |
| read | ✅ | ✅ Implemented | [read.tools.test.js](tests/read.tools.test.js) | [read.reference.tools.test.js](tests/read.reference.tools.test.js) |
| edit | ✅ | ✅ Implemented | [edit.tools.test.js](tests/edit.tools.test.js) | [edit.reference.tools.test.js](tests/edit.reference.tools.test.js) |
| write | ✅ | ✅ Implemented | [write.tools.test.js](tests/write.tools.test.js) | [write.reference.tools.test.js](tests/write.reference.tools.test.js) |
| glob | ✅ | ✅ Implemented | [glob.tools.test.js](tests/glob.tools.test.js) | [glob.reference.tools.test.js](tests/glob.reference.tools.test.js) |
| grep | ✅ | ✅ Implemented | [grep.tools.test.js](tests/grep.tools.test.js) | [grep.reference.tools.test.js](tests/grep.reference.tools.test.js) |
| list | ✅ | ✅ Implemented | [list.tools.test.js](tests/list.tools.test.js) | [list.reference.tools.test.js](tests/list.reference.tools.test.js) |
| task | ✅ | ✅ Implemented | [task.tools.test.js](tests/task.tools.test.js) | [task.reference.tools.test.js](tests/task.reference.tools.test.js) |
| webfetch | ✅ | ✅ Implemented | [webfetch.tools.test.js](tests/webfetch.tools.test.js) | [webfetch.reference.tools.test.js](tests/webfetch.reference.tools.test.js) |
| todowrite | ✅ | ✅ Implemented | [todowrite.tools.test.js](tests/todowrite.tools.test.js) | [todowrite.reference.tools.test.js](tests/todowrite.reference.tools.test.js) |
| todoread | ✅ | ✅ Implemented | [todowrite.tools.test.js](tests/todowrite.tools.test.js) | [todowrite.reference.tools.test.js](tests/todowrite.reference.tools.test.js) |

## Experimental Tools

| Tool | Original OpenCode | Agent-CLI Status | Agent-CLI Test | Reference Test |
|------|-------------------|------------------|----------------|---------------|
| batch | ✅ (experimental) | ❌ Not implemented | N/A | N/A |
| websearch | ✅ (flag-gated) | ❌ Not implemented | N/A | N/A |
| codesearch | ✅ (flag-gated) | ❌ Not implemented | N/A | N/A |

## Special Tools

| Tool | Original OpenCode | Agent-CLI Status | Agent-CLI Test | Reference Test |
|------|-------------------|------------------|----------------|---------------|
| invalid | ✅ | ❌ Not implemented | N/A | N/A |

## Implementation Notes

- **Core Tools**: All 11 core tools from original-opencode are implemented and fully tested
- **Agent-CLI Tests**: Test files for agent-cli tool implementations (11 files)
- **Reference Tests**: Tests comparing agent-cli output against original opencode command (11 files)
- **Experimental Tools**: Batch, websearch, and codesearch tools are not implemented as they are experimental/flag-gated in original
- **Invalid Tool**: Special tool for handling invalid requests - not needed in CLI context

## Test Files Overview

- `basic.tools.test.js` - Basic functionality tests
- `mvp.test.js` - Agent behavior validation
- `reference.test.js` - Tool request handling
- `*.tools.test.js` - Agent-CLI tool implementation tests (11 files)
- `*.reference.tools.test.js` - Reference tests validating compatibility with original opencode (11 files)

All tests pass: **26 tests, 0 failures** ✅