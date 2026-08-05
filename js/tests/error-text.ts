import { describe, expect, test } from 'bun:test';
import { errorText, stringifyErrorValue } from '../src/util/error-text.ts';

describe('stringifyErrorValue', () => {
  test('renders NamedError.toObject() shape (issue #289)', () => {
    expect(
      stringifyErrorValue({
        name: 'RetryTimeoutExceededError',
        data: { message: 'Retry timeout exceeded after 604800s' },
      })
    ).toBe('RetryTimeoutExceededError: Retry timeout exceeded after 604800s');
  });

  test('renders plain strings unchanged', () => {
    expect(stringifyErrorValue('boom')).toBe('boom');
  });

  test('renders Error instances', () => {
    expect(stringifyErrorValue(new TypeError('bad input'))).toBe(
      'TypeError: bad input'
    );
  });

  test('unwraps nested { error: … } envelopes', () => {
    expect(
      stringifyErrorValue({ error: { name: 'InnerError', data: {} } })
    ).toBe('InnerError');
  });

  test('joins arrays of errors', () => {
    expect(stringifyErrorValue([new Error('a'), 'b'])).toBe('Error: a; b');
  });

  test('falls back to the name when no message exists', () => {
    expect(stringifyErrorValue({ name: 'SomeError' })).toBe('SomeError');
  });

  test('is circular-safe', () => {
    const value: Record<string, unknown> = { name: 'Cyclic' };
    value.error = value;
    expect(stringifyErrorValue(value)).toBe('Cyclic');
  });

  test('is depth-limited', () => {
    let value: Record<string, unknown> = { message: 'deep' };
    for (let i = 0; i < 20; i++) value = { error: value };
    expect(() => stringifyErrorValue(value)).not.toThrow();
  });

  test('returns an empty string when nothing is readable', () => {
    expect(stringifyErrorValue({})).toBe('');
    expect(stringifyErrorValue(null)).toBe('');
  });
});

describe('errorText', () => {
  test('uses the fallback only when nothing is readable', () => {
    expect(errorText({}, 'Tool execution failed')).toBe(
      'Tool execution failed'
    );
    expect(errorText({ message: 'real' }, 'Tool execution failed')).toBe(
      'real'
    );
  });

  test('never returns "[object Object]"', () => {
    expect(errorText({ name: 'E', data: { message: 'm' } })).toBe('E: m');
  });
});
