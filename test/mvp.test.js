import { test, assert } from 'test-anywhere'
// @ts-ignore
import { sh } from 'command-stream'
import { writeFileSync, unlinkSync } from 'fs'

test('MVP agent responds to JSON input with streaming events', async () => {
  // Pipe JSON input to the agent CLI using command-stream
  const result = await sh(`echo '{"message":"hi"}' | bun run src/index.js`)

  // Parse all JSON lines from stdout
  const lines = result.stdout.trim().split('\n').filter(line => line.trim())
  const events = lines.map(line => JSON.parse(line))

  // Verify we got events
  assert.ok(events.length > 0, 'Should have events')

  // Check for text event
  const textEvents = events.filter(e => e.type === 'text')
  assert.equal(textEvents.length, 1, 'Should have one text event')
  assert.ok(textEvents[0].part.text.includes('hi'), 'Text should contain input message')
  assert.equal(textEvents[0].sessionID, events[0].sessionID, 'Should have consistent sessionID')
  assert.ok(textEvents[0].timestamp, 'Should have timestamp')
})

test('MVP agent executes tools with streaming events', async () => {
  // Create a test file
  writeFileSync('test-file.txt', 'Hello World\n')

  try {
    // Pipe JSON input with tools to the agent CLI using command-stream
    const jsonInput = JSON.stringify({
      message: "test",
      tools: [{
        name: "read",
        params: { filePath: "test-file.txt" }
      }]
    })

    const result = await sh(`echo '${jsonInput}' | bun run src/index.js`)

    // Parse all JSON lines from stdout
    const lines = result.stdout.trim().split('\n').filter(line => line.trim())
    const events = lines.map(line => JSON.parse(line))

    // Verify we got events
    assert.ok(events.length > 0, 'Should have events')

    // Check for step_start events (multiple now: request, tool execution, response)
    const stepStartEvents = events.filter(e => e.type === 'step_start')
    assert.ok(stepStartEvents.length >= 3, 'Should have at least 3 step_start events')
    const toolStepStart = stepStartEvents.find(e => e.part.step === 'execute_read')
    assert.ok(toolStepStart, 'Should have execute_read step_start')

    // Check for tool_use event
    const toolEvents = events.filter(e => e.type === 'tool_use')
    assert.equal(toolEvents.length, 1, 'Should have one tool_use event')
    assert.equal(toolEvents[0].part.tool, 'read', 'Should be read tool')
    assert.ok(toolEvents[0].part.state.output.includes('Hello World'), 'Should contain file content')

    // Check for step_finish events
    const stepFinishEvents = events.filter(e => e.type === 'step_finish')
    assert.ok(stepFinishEvents.length >= 3, 'Should have at least 3 step_finish events')
    const toolStepFinish = stepFinishEvents.find(e => e.part.step === 'execute_read')
    assert.ok(toolStepFinish, 'Should have execute_read step_finish')

    // Check for text event
    const textEvents = events.filter(e => e.type === 'text')
    assert.equal(textEvents.length, 1, 'Should have one text event')

    // All events should have the same sessionID
    const sessionID = events[0].sessionID
    events.forEach(event => {
      assert.equal(event.sessionID, sessionID, 'All events should have same sessionID')
      assert.ok(event.timestamp, 'Should have timestamp')
    })

  } finally {
    // Clean up
    try {
      unlinkSync('test-file.txt')
    } catch (e) {
      // Ignore cleanup errors
    }
  }
})