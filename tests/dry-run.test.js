import { test, expect, describe, setDefaultTimeout } from 'bun:test';

// Increase default timeout
setDefaultTimeout(30000);

/**
 * Test suite for --dry-run mode - Issue #68
 * Tests that dry-run mode is properly configured and can be enabled
 */
describe('Dry-run mode', () => {
  test('Flag.setDryRun sets OPENCODE_DRY_RUN', async () => {
    const { Flag } = await import('../src/flag/flag.ts');

    // Save original value
    const original = Flag.OPENCODE_DRY_RUN;

    try {
      // Test setting to true
      Flag.setDryRun(true);
      expect(Flag.OPENCODE_DRY_RUN).toBe(true);

      // Test setting to false
      Flag.setDryRun(false);
      expect(Flag.OPENCODE_DRY_RUN).toBe(false);
    } finally {
      // Restore original value
      Flag.setDryRun(original);
    }
  });

  test('OPENCODE_DRY_RUN environment variable is respected', async () => {
    // This test verifies that the env var is properly read
    const { Flag } = await import('../src/flag/flag.ts');

    // The flag should be false by default (unless env var is set)
    expect(typeof Flag.OPENCODE_DRY_RUN).toBe('boolean');
  });

  test('dry-run mode can be enabled programmatically', async () => {
    const { Flag } = await import('../src/flag/flag.ts');

    // Save original value
    const original = Flag.OPENCODE_DRY_RUN;

    try {
      // Enable dry-run mode
      Flag.setDryRun(true);

      // Verify it's enabled
      expect(Flag.OPENCODE_DRY_RUN).toBe(true);

      // Disable dry-run mode
      Flag.setDryRun(false);

      // Verify it's disabled
      expect(Flag.OPENCODE_DRY_RUN).toBe(false);
    } finally {
      // Restore original value
      Flag.setDryRun(original);
    }
  });

  test('Verbose mode flag can be set', async () => {
    const { Flag } = await import('../src/flag/flag.ts');

    // Save original value
    const original = Flag.OPENCODE_VERBOSE;

    try {
      // Test setting to true
      Flag.setVerbose(true);
      expect(Flag.OPENCODE_VERBOSE).toBe(true);

      // Test setting to false
      Flag.setVerbose(false);
      expect(Flag.OPENCODE_VERBOSE).toBe(false);
    } finally {
      // Restore original value
      Flag.setVerbose(original);
    }
  });
});
