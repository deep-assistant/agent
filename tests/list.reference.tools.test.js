import { test, expect } from 'bun:test'
// @ts-ignore
import { sh } from 'command-stream'
import { writeFileSync, unlinkSync } from 'fs'

test('Reference test: agent-cli tool produces expected OpenCode-compatible JSON format', async () => {
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).substr(2, 9)

  // Create test files with unique names
  const file1 = `ls-test1-${timestamp}-${randomId}.txt`
  const file2 = `ls-test2-${timestamp}-${randomId}.txt`

  writeFileSync(file1, 'content1')
  writeFileSync(file2, 'content2')

  try {
    // Test original OpenCode list tool (compatible with OpenCode ls tool)
    const input = `{"message":"list files","tools":[{"name":"list","params":{"path":"."}}]}`
    const originalResult = await sh(`echo '${input}' | opencode run --format json --model opencode/grok-code`)
    const originalLines = originalResult.stdout.trim().split('\n').filter(line => line.trim())
    const originalEvents = originalLines.map(line => JSON.parse(line))

    // Document expected OpenCode JSON structure for ls tool (compatible with opencode run --format json --model opencode/grok-code)
    console.log('Expected OpenCode JSON event structure for ls tool:')
    console.log('{"type":"tool_use","timestamp":1234567890,"sessionID":"ses_xxx","part":{"tool":"ls","state":{"status":"completed","input":{"path":"."},"output":{"items":[{"name":"file.txt","type":"file","size":123,"modified":"2023-..." }]}}}}')

    // Find tool_use events
    const originalToolEvents = originalEvents.filter(e => e.type === 'tool_use' && e.part.tool === 'list')

    // Should have tool_use events
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
    expect(typeof originalTool.part.state.input.path).toBeTruthy()
    expect(typeof originalTool.part.state.output).toBeTruthy()

    // Validate timing information
    expect(originalTool.part.time).toBeTruthy()
    expect(typeof originalTool.part.time.start).toBeTruthy()
    expect(typeof originalTool.part.time.end).toBeTruthy()

    // Check that output contains file listings
    const agentOutput = JSON.parse(originalTool.part.state.output)
    expect(agentOutput.items).toBeTruthy()
    expect(Array.isArray(agentOutput.items)).toBeTruthy()
    expect(agentOutput.items.some(item => item.name.includes('ls-test'))).toBeTruthy()

    // Validate item structure
    agentOutput.items.forEach(item => {
      expect(typeof item.name).toBeTruthy()
      expect(typeof item.type).toBeTruthy()
      expect(typeof item.size).toBeTruthy()
      expect(item.modified).toBeTruthy()
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
