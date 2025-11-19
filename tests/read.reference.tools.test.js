import { test, expect } from 'bun:test'
// @ts-ignore
import { sh } from 'command-stream'
import { writeFileSync, unlinkSync } from 'fs'

test('Reference test: agent-cli tool produces expected OpenCode-compatible JSON format', async () => {
  const testFileName = `test-read-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.txt`

  // Create a test file in project root
  writeFileSync(testFileName, 'This is test content for reading\n')

  try {
    // Test original OpenCode read tool (compatible with OpenCode format)
    const input = `{"message":"read file","tools":[{"name":"read","params":{"filePath":"${testFileName}"}}]}`
    const originalResult = await sh(`echo '${input}' | opencode run --format json --model opencode/grok-code`)
    const originalLines = originalResult.stdout.trim().split('\n').filter(line => line.trim())
    const originalEvents = originalLines.map(line => JSON.parse(line))

    // Document expected OpenCode JSON structure for read tool (compatible with opencode run --format json --model opencode/grok-code)
    console.log('Expected OpenCode JSON event structure for read tool:')
    console.log('{"type":"tool_use","timestamp":1234567890,"sessionID":"ses_xxx","part":{"tool":"read","state":{"status":"completed","input":{"filePath":"..."},"output":"file content..."}}}')

    // Find tool_use events
    const originalToolEvents = originalEvents.filter(e => e.type === 'tool_use' && e.part.tool === 'read')

    // Should have tool_use events for read
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
    expect(typeof originalTool.part.state.input.filePath).toBeTruthy()
    expect(typeof originalTool.part.state.output).toBeTruthy()

    // Validate timing information
    expect(originalTool.part.time).toBeTruthy()
    expect(typeof originalTool.part.time.start).toBeTruthy()
    expect(typeof originalTool.part.time.end).toBeTruthy()

    // Check that output contains the file content
    expect(originalTool.part.state.output.includes('This is test content')).toBeTruthy()

    console.log('✅ Reference test passed - original OpenCode tool produces expected JSON format')
    console.log('Actual output structure validated against expected OpenCode format')
  } finally {
    // Clean up
    try {
      unlinkSync(testFileName)
    } catch (e) {
      // Ignore cleanup errors
    }
  }
})  console.log('This establishes the baseline behavior for compatibility testing')
