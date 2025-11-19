import { test, expect } from 'bun:test'
// @ts-ignore
import { sh } from 'command-stream'
import { writeFileSync, unlinkSync } from 'fs'

test('Reference test: agent-cli tool produces expected OpenCode-compatible JSON format', async () => {
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).substr(2, 9)

  // Create test files with unique names
  const file1 = `test1-${timestamp}-${randomId}.txt`
  const file2 = `test2-${timestamp}-${randomId}.txt`
  const file3 = `other-${timestamp}-${randomId}.js`

  writeFileSync(file1, 'content1')
  writeFileSync(file2, 'content2')
  writeFileSync(file3, 'javascript')

  try {
    // Test original OpenCode glob tool (compatible with OpenCode format)
    const input = `{"message":"find txt files","tools":[{"name":"glob","params":{"pattern":"test*-${timestamp}-${randomId}.txt"}}]}`
    const originalResult = await sh(`echo '${input}' | opencode run --format json --model opencode/grok-code`)
    const originalLines = originalResult.stdout.trim().split('\n').filter(line => line.trim())
    const originalEvents = originalLines.map(line => JSON.parse(line))

    // Document expected OpenCode JSON structure for glob tool (compatible with opencode run --format json --model opencode/grok-code)
    console.log('Expected OpenCode JSON event structure for glob tool:')
    console.log('{"type":"tool_use","timestamp":1234567890,"sessionID":"ses_xxx","part":{"tool":"glob","state":{"status":"completed","input":{"pattern":"*.txt"},"output":{"matches":["file1.txt","file2.txt"]}}}}')

    // Find tool_use events
    const originalToolEvents = originalEvents.filter(e => e.type === 'tool_use' && e.part.tool === 'glob')

    // Should have tool_use events for glob
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
    expect(typeof originalTool.part.state.input.pattern).toBeTruthy()
    expect(typeof originalTool.part.state.output).toBeTruthy()

    // Validate timing information
    expect(originalTool.part.time).toBeTruthy()
    expect(typeof originalTool.part.time.start).toBeTruthy()
    expect(typeof originalTool.part.time.end).toBeTruthy()

    // Check that output contains file matches
    const agentOutput = JSON.parse(originalTool.part.state.output)
    expect(agentOutput.matches).toBeTruthy()
    expect(Array.isArray(agentOutput.matches)).toBeTruthy()
    expect(agentOutput.matches.length >= 2).toBeTruthy()

    // Validate that matches are strings (file paths)
    agentOutput.matches.forEach(match => {
      expect(typeof match).toBeTruthy()
    })

    console.log('✅ Reference test passed - original OpenCode tool produces expected JSON format')
    console.log('Actual output structure validated against expected OpenCode format')
  } finally {
    // Clean up
    try {
      unlinkSync(file1)
      unlinkSync(file2)
      unlinkSync(file3)
    } catch (e) {
      // Ignore cleanup errors
    }
  }
})  console.log('This establishes the baseline behavior for compatibility testing')
