import { describe, expect, test } from 'bun:test';
import {
  createBusEventSubscription,
  outputBusEvent,
} from '../src/cli/event-handler.js';
import { Bus } from '../src/bus/index.ts';
import { Instance } from '../src/project/instance.ts';
import { SessionStatus } from '../src/session/status.ts';

describe('createBusEventSubscription', () => {
  test('outputs a public idle event when the session reaches a turn boundary', async () => {
    await Instance.provide({
      directory: process.cwd(),
      fn: async () => {
        const outputs = [];
        const { unsub, idlePromise } = createBusEventSubscription({
          sessionID: 'ses_idle',
          eventHandler: {
            output(event) {
              outputs.push(event);
            },
          },
          onError() {},
        });

        try {
          await Bus.publish(SessionStatus.Event.Idle, {
            sessionID: 'ses_idle',
          });
          await idlePromise;
        } finally {
          unsub();
        }

        expect(outputs).toContainEqual(
          expect.objectContaining({
            type: 'session_idle',
            sessionID: 'ses_idle',
          })
        );
      },
    });
  });
});

describe('outputBusEvent error events (issue #289)', () => {
  test('session.error carries a human-readable message alongside the object', () => {
    const outputs = [];
    outputBusEvent({
      event: {
        type: 'session.error',
        properties: {
          sessionID: 'ses_err',
          error: {
            name: 'RetryTimeoutExceededError',
            data: { message: 'Retry timeout exceeded after 604800s' },
          },
        },
      },
      sessionID: 'ses_err',
      eventHandler: {
        output(event) {
          outputs.push(event);
        },
      },
      onError() {},
    });

    const error = outputs.find((event) => event.type === 'error');
    expect(error.message).toBe(
      'RetryTimeoutExceededError: Retry timeout exceeded after 604800s'
    );
    // The machine-readable object is still emitted (additive change).
    expect(error.error.name).toBe('RetryTimeoutExceededError');
    expect(`${error.message}`).not.toBe('[object Object]');
  });

  test('failed tool parts carry a human-readable message', () => {
    const outputs = [];
    outputBusEvent({
      event: {
        type: 'message.part.updated',
        properties: {
          part: {
            sessionID: 'ses_tool',
            type: 'tool',
            state: { status: 'error', error: { name: 'ToolError' } },
          },
        },
      },
      sessionID: 'ses_tool',
      eventHandler: {
        output(event) {
          outputs.push(event);
        },
      },
      onError() {},
    });

    const error = outputs.find((event) => event.type === 'error');
    expect(error.message).toBe('ToolError');
  });

  test('failed tool parts without any error detail use the fallback', () => {
    const outputs = [];
    outputBusEvent({
      event: {
        type: 'message.part.updated',
        properties: {
          part: {
            sessionID: 'ses_tool2',
            type: 'tool',
            state: { status: 'error' },
          },
        },
      },
      sessionID: 'ses_tool2',
      eventHandler: {
        output(event) {
          outputs.push(event);
        },
      },
      onError() {},
    });

    const error = outputs.find((event) => event.type === 'error');
    expect(error.message).toBe('Tool execution failed');
  });
});
