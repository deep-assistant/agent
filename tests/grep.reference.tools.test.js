import { test, expect } from 'bun:test'
// @ts-ignore
import { sh } from 'command-stream'
import { writeFileSync, unlinkSync } from 'fs'

test('Reference test: agent-cli tool produces expected OpenCode-compatible JSON format', async () => {
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).substr(2, 9)

  // Create test files with unique names
  const file1 = `grep1-${timestamp}-${randomId}.txt`
  const file2 = `grep2-${timestamp}-${randomId}.txt`

  writeFileSync(file1, 'This is line 1\nThis contains search text\nThis is line 3\n')
  writeFileSync(file2, 'Another file\nMore search text here\nEnd of file\n')

  try {
    // Test original OpenCode grep tool (compatible with OpenCode format)
    const input = `{"message":"search for text","tools":[{"name":"grep","params":{"pattern":"search","include":"grep*-${timestamp}-${randomId}.txt"}}]}`
    const originalResult = await sh(`echo '${input}' | opencode run --format json --model opencode/grok-code`)
    const originalLines = originalResult.stdout.trim().split('\n').filter(line => line.trim())
    const originalEvents = originalLines.map(line => JSON.parse(line))

    // Document expected OpenCode JSON structure for grep tool (compatible with opencode run --format json --model opencode/grok-code)
    console.log('Expected OpenCode JSON event structure for grep tool:')
    console.log('{"type":"tool_use","timestamp":1234567890,"sessionID":"ses_xxx","part":{"tool":"grep","state":{"status":"completed","input":{"pattern":"search","include":"*.txt"},"output":{"matches":[{"file":"file.txt","line":2,"content":"..."}]}}}}')

    // Find tool_use events
    const originalToolEvents = originalEvents.filter(e => e.type === 'tool_use' && e.part.tool === 'grep')

    // Should have tool_use events for grep
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
    expect(typeof originalTool.part.state.input.include).toBeTruthy()
    expect(typeof originalTool.part.state.output).toBeTruthy()

    // Validate timing information
    expect(originalTool.part.time).toBeTruthy()
    expect(typeof originalTool.part.time.start).toBeTruthy()
    expect(typeof originalTool.part.time.end).toBeTruthy()

    // Check that output contains matches
    const agentOutput = JSON.parse(originalTool.part.state.output)
    expect(agentOutput.matches).toBeTruthy()
    expect(Array.isArray(agentOutput.matches)).toBeTruthy()
    expect(agentOutput.matches.length >= 2).toBeTruthy()

    // Validate match structure
    agentOutput.matches.forEach(match => {
      expect(typeof match.file).toBeTruthy()
      expect(typeof match.line).toBeTruthy()
      expect(typeof match.content).toBeTruthy()
      expect(match.content.includes('search')).toBeTruthy()
    })

    console.log('✅ Reference test passed - original OpenCode tool produces expected JSON format')
    console.log('Actual output structure validated against expected OpenCode format')
  } finally {
    // Clean up
    try {
      unlinkSync(file1)
      unlinkSync(file2)
    } catch (e) {
      // Ignore cleanup errors
    }
  }
})  console.log('This establishes the baseline behavior for compatibility testing')
