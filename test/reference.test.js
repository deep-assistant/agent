import { test, assert } from 'test-anywhere'
// @ts-ignore
import { sh } from 'command-stream'

test('Compare agent-cli output with real OpenCode reference', async () => {
  // Get real OpenCode output
  const opencodeResult = await sh(`echo '{"message":"hi"}' | opencode run --format json --model opencode/grok-code`)
  const opencodeLines = opencodeResult.stdout.trim().split('\n').filter(line => line.trim())
  const opencodeEvents = opencodeLines.map(line => JSON.parse(line))

  // Get our agent-cli output
  const agentResult = await sh(`echo '{"message":"hi"}' | bun run src/index.js`)
  const agentLines = agentResult.stdout.trim().split('\n').filter(line => line.trim())
  const agentEvents = agentLines.map(line => JSON.parse(line))

  // Compare event types and structure
  const opencodeEventTypes = opencodeEvents.map(e => e.type)
  const agentEventTypes = agentEvents.map(e => e.type)

  // Both should have text events
  assert.ok(opencodeEventTypes.includes('text'), 'OpenCode should have text event')
  assert.ok(agentEventTypes.includes('text'), 'Agent should have text event')

  // Check that both have the same basic structure
  const opencodeTextEvent = opencodeEvents.find(e => e.type === 'text')
  const agentTextEvent = agentEvents.find(e => e.type === 'text')

  assert.ok(opencodeTextEvent, 'OpenCode should have text event')
  assert.ok(agentTextEvent, 'Agent should have text event')

  // Both should have sessionID, timestamp, and part
  assert.ok(opencodeTextEvent.sessionID, 'OpenCode text event should have sessionID')
  assert.ok(opencodeTextEvent.timestamp, 'OpenCode text event should have timestamp')
  assert.ok(opencodeTextEvent.part, 'OpenCode text event should have part')

  assert.ok(agentTextEvent.sessionID, 'Agent text event should have sessionID')
  assert.ok(agentTextEvent.timestamp, 'Agent text event should have timestamp')
  assert.ok(agentTextEvent.part, 'Agent text event should have part')

  // Part should have sessionID, type, and text
  assert.equal(opencodeTextEvent.part.type, 'text', 'OpenCode part should be text type')
  assert.equal(agentTextEvent.part.type, 'text', 'Agent part should be text type')

  assert.ok(opencodeTextEvent.part.text, 'OpenCode should have text content')
  assert.ok(agentTextEvent.part.text, 'Agent should have text content')

  console.log('OpenCode events:', opencodeEventTypes)
  console.log('Agent events:', agentEventTypes)
})

test('Compare agent-cli tool output with real OpenCode reference', async () => {
  // Create a test file
  await sh(`echo "test content" > test-file.txt`)

  try {
    // Get real OpenCode output with tool
    const opencodeResult = await sh(`echo '{"message":"read this file","tools":[{"name":"read","params":{"filePath":"test-file.txt"}}]}' | opencode run --format json --model opencode/grok-code`)
    const opencodeLines = opencodeResult.stdout.trim().split('\n').filter(line => line.trim())
    const opencodeEvents = opencodeLines.map(line => JSON.parse(line))

    // Get our agent-cli output with tool
    const agentResult = await sh(`echo '{"message":"read this file","tools":[{"name":"read","params":{"filePath":"test-file.txt"}}]}' | bun run src/index.js`)
    const agentLines = agentResult.stdout.trim().split('\n').filter(line => line.trim())
    const agentEvents = agentLines.map(line => JSON.parse(line))

    // Compare event types
    const opencodeEventTypes = opencodeEvents.map(e => e.type)
    const agentEventTypes = agentEvents.map(e => e.type)

    console.log('OpenCode tool events:', opencodeEventTypes)
    console.log('Agent tool events:', agentEventTypes)

    // Both should have tool_use events
    assert.ok(opencodeEventTypes.includes('tool_use'), 'OpenCode should have tool_use event')
    assert.ok(agentEventTypes.includes('tool_use'), 'Agent should have tool_use event')

    // Both should have step_start and step_finish
    assert.ok(opencodeEventTypes.includes('step_start'), 'OpenCode should have step_start event')
    assert.ok(agentEventTypes.includes('step_start'), 'Agent should have step_start event')

    assert.ok(opencodeEventTypes.includes('step_finish'), 'OpenCode should have step_finish event')
    assert.ok(agentEventTypes.includes('step_finish'), 'Agent should have step_finish event')

    // Check tool_use event structure
    const opencodeToolEvent = opencodeEvents.find(e => e.type === 'tool_use')
    const agentToolEvent = agentEvents.find(e => e.type === 'tool_use')

    assert.ok(opencodeToolEvent, 'OpenCode should have tool_use event')
    assert.ok(agentToolEvent, 'Agent should have tool_use event')

    // Both should have the same basic tool structure
    assert.equal(opencodeToolEvent.part.tool, 'read', 'OpenCode should use read tool')
    assert.equal(agentToolEvent.part.tool, 'read', 'Agent should use read tool')

    assert.ok(opencodeToolEvent.part.state.output, 'OpenCode should have tool output')
    assert.ok(agentToolEvent.part.state.output, 'Agent should have tool output')

  } finally {
    // Clean up
    try {
      await sh(`rm -f test-file.txt`)
    } catch (e) {
      // Ignore cleanup errors
    }
  }
})