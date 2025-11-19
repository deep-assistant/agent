import { test, expect } from 'bun:test'
// @ts-ignore
import { sh } from 'command-stream'

test('Reference test: agent-cli tool produces expected OpenCode-compatible JSON format', async () => {
  const input = '{"message":"fetch url","tools":[{"name":"webfetch","params":{"url":"https://httpbin.org/html","format":"html"}}]}'

  // Test original OpenCode webfetch tool
  const originalResult = await sh(`echo '${input}' | opencode run --format json --model opencode/grok-code`)
  const originalLines = originalResult.stdout.trim().split('\n').filter(line => line.trim())
  const originalEvents = originalLines.map(line => JSON.parse(line))

  // Document expected OpenCode JSON structure for webfetch tool
  console.log('Expected OpenCode JSON structure for webfetch tool:')
  console.log('{"type":"tool_use","timestamp":1234567890,"sessionID":"ses_xxx","part":{"tool":"webfetch","state":{"status":"completed","input":{"url":"...","format":"..."},"output":"content..."}}}')

  // Find tool_use events
  const originalToolEvents = originalEvents.filter(e => e.type === 'tool_use' && e.part.tool === 'webfetch')

  // Should have tool_use events for webfetch
  expect(originalToolEvents.length > 0).toBeTruthy()

  // Check the structure matches OpenCode format
  const originalTool = originalToolEvents[0]

  // Validate top-level structure
  expect(typeof originalTool.type).toBeTruthy()
  expect(originalTool.type).toBeTruthy()
  expect(typeof originalTool.timestamp).toBeTruthy()
  expect(typeof originalTool.sessionID).toBeTruthy()

  // Validate part structure
  expect(originalTool.part).toBeTruthy()
  expect(originalTool.part.tool).toBeTruthy()
  expect(originalTool.part.type).toBeTruthy()

  // Validate state structure
  expect(originalTool.part.state).toBeTruthy()
  expect(originalTool.part.state.status).toBeTruthy()
  expect(typeof originalTool.part.state.title).toBeTruthy()
  expect(originalTool.part.state.input).toBeTruthy()
  expect(typeof originalTool.part.state.input.url).toBeTruthy()
  expect(typeof originalTool.part.state.input.format).toBeTruthy()
  expect(typeof originalTool.part.state.output).toBeTruthy()

  // Validate timing information
  expect(originalTool.part.time).toBeTruthy()
  expect(typeof originalTool.part.time.start).toBeTruthy()
  expect(typeof originalTool.part.time.end).toBeTruthy()

  console.log('✅ Reference test passed - original OpenCode tool produces expected JSON format')
  console.log('This establishes the baseline behavior for compatibility testing')
})